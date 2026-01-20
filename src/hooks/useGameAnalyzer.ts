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
  const [fenBeingEvaluated, setFenBeingEvaluated] = useState<string | null>(null);
  const [currentPositionIndex, setCurrentPositionIndex] = useState<number>(0);
  const [lines, setLines] = useState<Lines>({});
  const [gameEvals, setGameEvals] = useState<GameEvals>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [_isStockfishReady, setIsStockfishReady] = useState(false);

  const fenRef = useRef<string | null>(null);
  const lastDepth = useRef<number>(0);
  const lastAddedEval = useRef<Evaluation | null>(null);
  const afterBestMoveFoundCallback = useRef<((bestMoveInfo?: BestMoveInfo) => void) | undefined>(undefined);

  // Generate all FENs from the game
  const generateFensFromGame = useCallback(() => {
    try {
      const parsedPgn = parsePGN(game.pgn)[0];
      if (!parsedPgn) return [];

      const chessjs = new ChessJS();
      const fens: string[] = [chessjs.fen()]; // Starting position

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
    setFenBeingEvaluated(fen);
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

        const evaluation: Evaluation = {
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
