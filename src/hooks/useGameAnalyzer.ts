import { useEffect, useRef, useState, useCallback } from 'react';
import { GameData, GameEvaluation, PositionEvaluation } from '@/types/chess';
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
  gameEvaluation: GameEvaluation;
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
  const [gameEvaluation, setGameEvaluation] = useState<GameEvaluation>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [_isStockfishReady, setIsStockfishReady] = useState(false);

  const fenRef = useRef<string | null>(null);
  const lastDepth = useRef<number>(0);
  const lastAddedEval = useRef<PositionEvaluation | null>(null);
  const afterBestMoveFoundCallback = useRef<((bestMoveInfo?: BestMoveInfo) => void) | undefined>(undefined);
  const prevPositionIndex = usePrevious(currentPositionIndex);
  const prevIsAnalyzing = usePrevious(isAnalyzing);

  const linesRef = useRef<Lines>({});

  const getLinesForFen = (fen: string): PositionEvaluation['lines'] => {
    let result: PositionEvaluation['lines'] = [];
    if (fen in linesRef.current) {
      result = linesRef.current[fen].map((mpv) => {
        return {
          score: mpv.score,
          lanLine: mpv.lanLine.join(' '),
        };
      });
    }
    return result;
  };

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
    setGameEvaluation({});
    linesRef.current = {};
    setIsAnalyzing(true);

    if (stockfish) {
      stockfish.postMessage('ucinewgame');
    }
  }, [generateFensFromGame, stockfish]);

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
      if (bestMoveInfo.bestmove && lastDepth.current >= depth) {
        const bestMove = parseLanMove(bestMoveInfo.bestmove);
        if (fenRef.current == null) {
          console.error('fenRef was null');
          return;
        }

        if (!lastAddedEval.current) {
          console.error('lastAddedEval should be defined');
          return;
        }

        if (fenRef.current !== lastAddedEval.current.fen) {
          console.error('lastAddedEval fen should match fenRef');
          return;
        }

        if (lastAddedEval.current.depth !== lastDepth.current) {
          console.error('lastAddedEval depth should match lastDepth');
          return;
        }

        const evaluation: PositionEvaluation = {
          ...lastAddedEval.current,
          bestMove,
          depth: lastDepth.current
        };

        addEval(evaluation);
      }

      // If there is no best move (probably because the game is over)
      if (bestMoveInfo.bestmove == null) {
        // Continue to next position anyway
      }

      // Move to next position
      fenRef.current = null;
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

      // Update linesRef
      if (fen in linesRef.current) {
        linesRef.current[fen][evalerLine.multipv - 1] = evalerLine;
      } else {
        const newLines = [];
        newLines[evalerLine.multipv - 1] = evalerLine;
        linesRef.current[fen] = newLines;
      }
    };

    const saveEvaluation = (evalDepth: number, scoreKey: "cp" | "mate", scoreValue: number) => {
      // If lastDepth is 0, that means evaluation just started
      // In that case, if the new 'depth' value is not 1, then this message
      // from Stockfish must be residual from a previous run
      if (lastDepth.current === 0 && evalDepth !== 1) {
        return;
      }

      lastDepth.current = evalDepth;

      if (fenRef.current == null) return;

      const lines = getLinesForFen(fenRef.current);
      addEval({
        depth: evalDepth,
        fen: fenRef.current,
        score: { key: scoreKey, value: scoreValue },
        lines,
      });
    };

    const addEval = (evaluation: PositionEvaluation) => {
      lastAddedEval.current = evaluation;

      setGameEvaluation((g) => {
        const storedEval = g[evaluation.fen];
        if (storedEval && storedEval.depth > evaluation.depth) {
          return g;
        } else {
          // Get the most up-to-date lines for this position
          const lines = getLinesForFen(evaluation.fen);

          const p: PositionEvaluation = {
            depth: evaluation.depth,
            fen: evaluation.fen,
            score: evaluation.score,
            lines,
            bestMove: evaluation.bestMove,
          };
          return { ...g, [evaluation.fen]: p };
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
      fenRef.current = null;
      return;
    }

    const nextFen = fensToAnalyze[currentPositionIndex];

    // Check if we already have this evaluation at the required depth
    if (nextFen in gameEvaluation && gameEvaluation[nextFen].depth >= depth && nextFen in linesRef.current) {
      // Skip this position, move to next
      setCurrentPositionIndex((prev) => prev + 1);
      return;
    }

    // Start analyzing this position
    lastDepth.current = 0;
    fenRef.current = nextFen;
    stockfish.postMessage(`position fen ${nextFen}`);
    stockfish.postMessage(`go depth ${depth}`);
  }, [isAnalyzing, currentPositionIndex, fensToAnalyze, stockfish, depth, gameEvaluation]);

  const progress = fensToAnalyze.length > 0
    ? Math.round((currentPositionIndex / fensToAnalyze.length) * 100)
    : 0;

  return {
    analyzeGame,
    gameEvaluation,
    isAnalyzing,
    progress,
    currentPosition: currentPositionIndex,
    totalPositions: fensToAnalyze.length,
  };
}
