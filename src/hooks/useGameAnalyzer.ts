import { useEffect, useRef, useState, useCallback } from 'react';
import { GameData, Evaluation, GameEvals } from '@/types/chess';
import {
  parseBestMoveLine,
  parseInfoLine,
  parseLanMove,
  parseName,
  parseIsStockfishReady,
  BestMoveInfo,
  StockfishInfo,
  MultiPV,
  Lines,
} from '@/utils/stockfish';
import useStockfish from '@/hooks/useStockfish';
import { parse as parsePGN } from 'pgn-parser';
import { Chess as ChessJS } from 'chess.js';
import usePrevious from '@/hooks/usePrevious';

const MAX_THREADS_USAGE = 0.5;

interface Toolkit {
  analyzeGame: () => void;
  gameEvals: GameEvals;
  lines: Lines;
  isAnalyzing: boolean;
  progress: number; // Percentage (0-100)
  currentPosition: number; // Current position being analyzed
  totalPositions: number; // Total positions to analyze
}

export default function useGameAnalyzer(
  game: GameData,
  depth: number = 20,
  numLines: number = 1
): Toolkit {
  const { stockfish, recommendation } = useStockfish();

  const [fensToAnalyze, setFensToAnalyze] = useState<string[]>([]);
  const [currentPositionIndex, setCurrentPositionIndex] = useState<number>(0);
  const [lines, setLines] = useState<Lines>({});
  const [gameEvals, setGameEvals] = useState<GameEvals>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [_isStockfishReady, setIsStockfishReady] = useState(false);

  const fenRef = useRef<string | null>(null);
  const lastDepth = useRef<number>(0);
  const lastAddedEval = useRef<Evaluation | null>(null);
  const afterBestMoveFoundCallback = useRef<((bestMoveInfo?: BestMoveInfo) => void) | undefined>(undefined);
  const fensAnalyzed = useRef<Set<string>>(new Set());

  const prevPositionIndex = usePrevious(currentPositionIndex);
  const prevIsAnalyzing = usePrevious(isAnalyzing);

  // Generate all FENs from the game
  const generateFensFromGame = useCallback(() => {
    try {
      const parsedPgn = parsePGN(game.pgn)[0];
      if (!parsedPgn) return [];

      const chessjs = new ChessJS();
      const fens: string[] = [];

      parsedPgn.moves.forEach((move) => {
        try {
          chessjs.move(move.move);
          fens.push(chessjs.fen());
        } catch (error) {
          console.error('Invalid move:', move.move, error);
        }
      });

      return fens;
    } catch (error) {
      console.error('Error parsing PGN:', error);
      return [];
    }
  }, [game.pgn]);

  // Start analyzing the game
  const analyzeGame = useCallback(() => {
    const fens = generateFensFromGame();
    if (fens.length === 0) {
      console.error('No positions to analyze');
      return;
    }

    setFensToAnalyze(fens);
    setCurrentPositionIndex(0);
    setGameEvals({});
    setLines({});
    setIsAnalyzing(true);

    if (stockfish) {
      stockfish.postMessage('ucinewgame');
    }
  }, [generateFensFromGame, stockfish]);

  const changeFenBeingEvaluated = (fen: string | null) => {
    fenRef.current = fen;
  };

  // Handle stockfish messages
  useEffect(() => {
    const handleStockfishMessage = (event: MessageEvent) => {
      const line = typeof event === 'object' ? event.data : event;

      const name = parseName(line);
      if (name) {
        // Engine name parsed
      }

      if (parseIsStockfishReady(line)) {
        setIsStockfishReady(true);
      }

      const fen = fenRef.current ? fenRef.current : undefined;
      const info = parseInfoLine(line, fen);

      if (info) {
        handleStockfishInfo(info);
      }

      const bestMoveInfo = parseBestMoveLine(line);
      if (bestMoveInfo) {
        handleBestMoveInfo(bestMoveInfo);
      }
    };

    const handleBestMoveInfo = (bestMoveInfo: BestMoveInfo) => {
      if (fenRef.current == null) {
        console.error('fenRef was null in handleBestMoveInfo');
        changeFenBeingEvaluated(null);
        setCurrentPositionIndex((prev) => prev + 1);
        return;
      }

      // Ensure we have an evaluation for this position
      let evaluationSaved = false;

      if (bestMoveInfo.bestmove) {
        // Best move exists - save evaluation with best move if we have it
        const bestMove = parseLanMove(bestMoveInfo.bestmove);

        if (lastAddedEval.current && lastAddedEval.current.fen === fenRef.current) {
          // We have an evaluation for this position
          const evaluation: Evaluation = {
            ...lastAddedEval.current,
            bestMove,
            depth: lastDepth.current
          };
          addEval(evaluation);
          evaluationSaved = true;
        } else {
          console.warn(`Best move returned but no evaluation found for FEN: ${fenRef.current}`);
        }
      } else {
        // No best move available (terminal position like checkmate or stalemate)
        if (lastAddedEval.current && lastAddedEval.current.fen === fenRef.current) {
          // We have a partial evaluation, save it
          addEval(lastAddedEval.current);
          evaluationSaved = true;
        }
      }

      // If we still don't have an evaluation, create one based on position state
      if (!evaluationSaved) {
        console.warn(`No evaluation saved for position, creating synthetic evaluation for: ${fenRef.current}`);
        const chessjs = new ChessJS(fenRef.current);
        let evaluation: Evaluation;

        if (chessjs.isCheckmate()) {
          // Checkmate - the side to move is mated
          evaluation = {
            mate: 0,
            depth: 0,
            fen: fenRef.current,
          };
        } else if (chessjs.isStalemate() || chessjs.isDraw()) {
          // Draw
          evaluation = {
            cp: 0,
            depth: 0,
            fen: fenRef.current,
          };
        } else {
          // Other state - use neutral evaluation
          evaluation = {
            cp: 0,
            depth: 0,
            fen: fenRef.current,
          };
        }

        addEval(evaluation);
      }

      // Move to next position
      changeFenBeingEvaluated(null);
      setCurrentPositionIndex((prev) => prev + 1);

      if (afterBestMoveFoundCallback.current) {
        afterBestMoveFoundCallback.current(bestMoveInfo);
        afterBestMoveFoundCallback.current = undefined;
      }
    };

    const handleStockfishInfo = (info: StockfishInfo) => {
      if (fenRef.current == null) return;
      saveLine(info, fenRef.current);

      // If this is the best line, save the evaluation
      if (info.multipv === 1 && info.score && info.depth != undefined) {
        saveEvaluation(info.depth, info.score.key, info.score.value);
      }
    };

    const saveLine = (info: StockfishInfo, fen: string) => {
      if (info.depth == undefined) return;
      if (info.multipv == undefined) return;
      if (info.score == undefined) return;
      if (info.pv == undefined) return;

      const evalerLine: MultiPV = {
        depth: info.depth,
        multipv: info.multipv,
        score: info.score,
        lanLine: info.pv.split(' '),
      };

      setLines((lines) => {
        if (fen in lines) {
          lines[fen][evalerLine.multipv - 1] = evalerLine;
        } else {
          const newLines = [];
          newLines[evalerLine.multipv - 1] = evalerLine;
          lines[fen] = newLines;
        }
        return { ...lines };
      });
    };

    const saveEvaluation = (evalDepth: number, scoreKey: string, scoreValue: number) => {
      // If lastDepth is 0, that means evaluation just started
      // In that case, if the new 'depth' value is not 1, then this message
      // from Stockfish must be residual from a previous run
      if (lastDepth.current === 0 && evalDepth !== 1) {
        return;
      }

      lastDepth.current = evalDepth;

      if (fenRef.current == null) return;

      let cp = undefined;
      let mate = undefined;
      if (scoreKey === 'cp') cp = scoreValue;
      else if (scoreKey === 'mate') mate = scoreValue;

      if (cp != undefined) {
        addEval({
          cp,
          depth: evalDepth,
          fen: fenRef.current
        });
      } else if (mate != undefined) {
        addEval({
          mate,
          depth: evalDepth,
          fen: fenRef.current,
        });
      }
    };

    const addEval = (evaluation: Evaluation) => {
      lastAddedEval.current = evaluation;
      fensAnalyzed.current.add(evaluation.fen);

      setGameEvals((evals) => {
        const storedEval = evals[evaluation.fen];
        if (storedEval && storedEval.depth > evaluation.depth) {
          return evals;
        } else {
          return { ...evals, [evaluation.fen]: evaluation };
        }
      });
    };

    if (stockfish) {
      stockfish.onmessage = handleStockfishMessage;
      stockfish.postMessage('uci');
      const numThreads = Math.max(1, Math.floor(recommendation!.threads * MAX_THREADS_USAGE));
      stockfish.postMessage(`setoption name Threads value ${numThreads}`);
      stockfish.postMessage('setoption name Hash value 1024');
      stockfish.postMessage(`setoption name MultiPV value ${numLines}`);
      stockfish.postMessage('isready');
    }
  }, [stockfish, numLines, depth]);

  // Analyze next position when currentPositionIndex changes
  useEffect(() => {
    // In general, we only want to proceed if currentPositionIndex has changed.
    // However, we also need to make sure that we proceed when currentPositionIndex
    // has not changed, but isAnalyzing has changed from false to true (i.e., analysis
    // is being started or resumed).
    if (prevPositionIndex === currentPositionIndex) {
      if (prevIsAnalyzing === isAnalyzing) return;
    }

    if (!isAnalyzing) return;
    if (!stockfish) return;
    if (fenRef.current !== null) return; // Already analyzing a position

    if (currentPositionIndex >= fensToAnalyze.length) {
      // Analysis complete
      setIsAnalyzing(false);
      changeFenBeingEvaluated(null);
      return;
    }

    const nextFen = fensToAnalyze[currentPositionIndex];

    // Check if we already have this evaluation at the required depth
    if (nextFen in gameEvals && gameEvals[nextFen].depth >= depth && nextFen in lines) {
      // Skip this position, move to next
      setCurrentPositionIndex((prev) => prev + 1);
      return;
    }

    // Start analyzing this position
    lastDepth.current = 0;
    changeFenBeingEvaluated(nextFen);
    stockfish.postMessage(`position fen ${nextFen}`);
    stockfish.postMessage(`go depth ${depth}`);
  }, [isAnalyzing, currentPositionIndex, fensToAnalyze, stockfish, depth, gameEvals, lines]);

  const progress = fensToAnalyze.length > 0
    ? Math.round((currentPositionIndex / fensToAnalyze.length) * 100)
    : 0;

  return {
    analyzeGame,
    gameEvals,
    lines,
    isAnalyzing,
    progress,
    currentPosition: currentPositionIndex,
    totalPositions: fensToAnalyze.length,
  };
}
