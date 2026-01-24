import { useEffect, useRef, useState, useCallback } from 'react';
import { GameData, GameEvaluation, PositionEvaluation } from '@/types/chess';
import { Move } from 'cm-chess/src/Chess';
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
import { getFen } from '@/utils/chess';
import useStockfish from '@/hooks/useStockfish';
import { parse as parsePGN } from 'pgn-parser';
import { Chess as CmChess } from 'cm-chess/src/Chess';
import usePrevious from '@/hooks/usePrevious';

const MAX_THREADS_USAGE = 0.5;

interface Output {
  analyzeGame: (game: GameData) => void;
  gameEvaluation: GameEvaluation;
  variationEvaluations: GameEvaluation;
  analyzePosition: (fen: string, prevFen?: string) => void;
  latestEvaluation: PositionEvaluation | null;
  fenBeingAnalyzed: string | null;
  engineName: string | null;
  isAnalyzingGame: boolean;
  progress: number; // Percentage (0-100)
  currentPosition: number; // Current position being analyzed
  totalPositions: number; // Total positions to analyze
}

interface Options {
  evalDepth?: number;
  numLines?: number;
}

export default function useGameAnalyzer(
  isPositionAnalysisOn: boolean,
  currentMove: Move | undefined,
  options?: Options
): Output {
  const evalDepth = (options && options.evalDepth) || 20;
  const numLines = (options && options.numLines) || 1;
  const { stockfish, recommendation } = useStockfish();

  const prevIsPositionAnalysisOn = usePrevious(isPositionAnalysisOn);

  const [fensToAnalyze, setFensToAnalyze] = useState<string[]>([]);
  const [currentPositionIndex, setCurrentPositionIndex] = useState<number>(0);
  const [gameEvaluation, setGameEvaluation] = useState<GameEvaluation>({});
  const [variationEvaluations, setVariationEvaluations] = useState<GameEvaluation>({});
  const [isAnalyzingGame, setIsAnalyzingGame] = useState(false);
  const [isAnalyzingPosition, setIsAnalyzingPosition] = useState(false);
  const [positionQueue, setPositionQueue] = useState<string[]>([]);
  const [latestEvaluation, setLatestEvaluation] = useState<PositionEvaluation | null>(null);
  const [fenBeingAnalyzed, setFenBeingAnalyzed] = useState<string | null>(null);
  const [engineName, setEngineName] = useState<string | null>(null);
  const [_isStockfishReady, setIsStockfishReady] = useState(false);

  const fenRef = useRef<string | null>(null);
  const lastDepth = useRef<number>(0);
  const lastAddedEval = useRef<PositionEvaluation | null>(null);
  const afterBestMoveFoundCallback = useRef<((bestMoveInfo?: BestMoveInfo) => void) | undefined>(undefined);
  const prevPositionIndex = usePrevious(currentPositionIndex);
  const prevIsAnalyzingGame = usePrevious(isAnalyzingGame);
  const prevPositionQueue = usePrevious(positionQueue);

  const linesRef = useRef<Lines>({});

  const changeFenBeingAnalyzed = (fen: string | null) => {
    fenRef.current = fen;
    setFenBeingAnalyzed(fen);
  };

  const removeFromPositionQueue = (fen: string) => {
    setPositionQueue((queue) => queue.filter((qFen) => qFen !== fen));
  };

  const cancelAllAnalysis = useCallback((callback?: () => void) => {
    const go = () => {
      setPositionQueue([]);
      changeFenBeingAnalyzed(null);
      if (callback) callback();
    };

    if (stockfish) {
      if (fenRef.current) {
        afterBestMoveFoundCallback.current = () => {
          go();
        };
        stockfish.postMessage('stop');
      } else {
        go();
      }
    }
  }, [stockfish]);

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
  const generateFensFromGame = useCallback((game: GameData) => {
    try {
      const parsedPgn = parsePGN(game.pgn)[0];
      if (!parsedPgn) return [];

      const cmchess = new CmChess();
      const fens: string[] = [];

      parsedPgn.moves.forEach((move) => {
        try {
          cmchess.move(move.move);
          fens.push(cmchess.fen());
        } catch (error) {
          console.error('Invalid move:', move.move, error);
        }
      });

      return fens;
    } catch (error) {
      console.error('Error parsing PGN:', error);
      return [];
    }
  }, []);

  // Start analyzing the game
  const analyzeGame = useCallback((game: GameData) => {
    const fens = generateFensFromGame(game);
    if (fens.length === 0) {
      console.error('No positions to analyze');
      return;
    }

    // Cancel any ongoing position analysis
    if (isAnalyzingPosition) {
      cancelAllAnalysis(() => {
        setIsAnalyzingPosition(false);
      });
    }

    setFensToAnalyze(fens);
    setCurrentPositionIndex(0);
    setGameEvaluation({});
    linesRef.current = {};
    setIsAnalyzingGame(true);

    if (stockfish) {
      stockfish.postMessage('ucinewgame');
    }
  }, [generateFensFromGame, stockfish, isAnalyzingPosition, cancelAllAnalysis]);

  // Analyze a single position or variation
  const analyzePosition = useCallback((fen: string, prevFen?: string) => {
    if (isAnalyzingGame) {
      console.warn('Cannot analyze position while game analysis is running');
      return;
    }

    const newFens = prevFen ? [prevFen, fen] : [fen];

    cancelAllAnalysis(() => {
      setPositionQueue(newFens);
      setIsAnalyzingPosition(true);
    });
  }, [isAnalyzingGame, cancelAllAnalysis]);

  // Handle stockfish messages
  useEffect(() => {
    const handleStockfishMessage = (event: MessageEvent) => {
      const line = typeof event === 'object' ? event.data : event;

      const name = parseName(line);
      if (name) {
        setEngineName(recommendation ? recommendation.title : null);
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
      if (bestMoveInfo.bestmove && lastDepth.current >= evalDepth) {
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
        setLatestEvaluation(evaluation);

        // Remove from position queue if analyzing position
        if (isAnalyzingPosition && fenRef.current) {
          removeFromPositionQueue(fenRef.current);
        }
      }

      // If there is no best move (probably because the game is over)
      if (bestMoveInfo.bestmove == null) {
        if (isAnalyzingPosition && fenRef.current) {
          removeFromPositionQueue(fenRef.current);
        }
      }

      // Move to next position (for game analysis) or clear fen (for position analysis)
      if (isAnalyzingGame) {
        changeFenBeingAnalyzed(null);
        setCurrentPositionIndex((prev) => prev + 1);
      } else if (isAnalyzingPosition) {
        changeFenBeingAnalyzed(null);
      }

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
      const evaluation: PositionEvaluation = {
        depth: evalDepth,
        fen: fenRef.current,
        score: { key: scoreKey, value: scoreValue },
        lines,
      };

      addEval(evaluation);
      // Update latestEvaluation even when depth < evalDepth
      setLatestEvaluation(evaluation);
    };

    const addEval = (evaluation: PositionEvaluation) => {
      lastAddedEval.current = evaluation;

      const updateEvaluation = (g: GameEvaluation) => {
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
      };

      if (isAnalyzingGame) {
        setGameEvaluation(updateEvaluation);
      } else if (isAnalyzingPosition) {
        setVariationEvaluations(updateEvaluation);
      }
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
  }, [stockfish, numLines, evalDepth, recommendation, isAnalyzingGame, isAnalyzingPosition]);

  // Analyze next position when currentPositionIndex changes (for game analysis)
  useEffect(() => {
    // In general, we only want to proceed if currentPositionIndex has changed.
    // However, we also need to make sure that we proceed when currentPositionIndex
    // has not changed, but isAnalyzingGame has changed from false to true (i.e., game
    // analysis is being started or resumed).
    if (prevPositionIndex === currentPositionIndex) {
      if (prevIsAnalyzingGame === isAnalyzingGame) return;
    }

    if (!isAnalyzingGame) return;
    if (!stockfish) return;
    if (fenRef.current !== null) return; // Already analyzing a position

    if (currentPositionIndex >= fensToAnalyze.length) {
      // Analysis complete
      setIsAnalyzingGame(false);
      changeFenBeingAnalyzed(null);
      return;
    }

    const nextFen = fensToAnalyze[currentPositionIndex];

    // Check if we already have this evaluation at the required depth
    if (nextFen in gameEvaluation && gameEvaluation[nextFen].depth >= evalDepth && nextFen in linesRef.current) {
      // Skip this position, move to next
      setCurrentPositionIndex((prev) => prev + 1);
      return;
    }

    // Start analyzing this position
    lastDepth.current = 0;
    changeFenBeingAnalyzed(nextFen);
    stockfish.postMessage(`position fen ${nextFen}`);
    stockfish.postMessage(`go depth ${evalDepth}`);
  }, [isAnalyzingGame, currentPositionIndex, fensToAnalyze, stockfish, evalDepth, gameEvaluation,
      prevPositionIndex, prevIsAnalyzingGame]
  );

  // Process position queue (for position analysis)
  useEffect(() => {
    if (positionQueue === prevPositionQueue) return;
    if (!isAnalyzingPosition) return;
    if (!stockfish) return;
    if (fenRef.current !== null) return; // Already analyzing a position

    if (positionQueue.length === 0) {
      // Position analysis complete
      setIsAnalyzingPosition(false);
      return;
    }

    const nextFen = positionQueue[0];

    // Check if we already have this evaluation at the required depth
    if (nextFen in variationEvaluations && variationEvaluations[nextFen].depth >= evalDepth && nextFen in linesRef.current) {
      setPositionQueue(positionQueue.slice(1));
      return;
    }

    // Start analyzing this position
    lastDepth.current = 0;
    changeFenBeingAnalyzed(nextFen);
    stockfish.postMessage(`position fen ${nextFen}`);
    stockfish.postMessage(`go depth ${evalDepth}`);
  }, [positionQueue, prevPositionQueue, isAnalyzingPosition, stockfish, evalDepth, variationEvaluations]);

  // Automatically analyze position when isPositionAnalysisOn is true
  useEffect(() => {
    if (isPositionAnalysisOn) {
      if (isAnalyzingGame) {
        console.warn('Cannot enable position analysis while game analysis is running');
        return;
      }

      const fen = getFen(currentMove);
      analyzePosition(fen);
    }
  }, [isPositionAnalysisOn, currentMove, analyzePosition, isAnalyzingGame]);

  // Handle isPositionAnalysisOn changes
  useEffect(() => {
    if (isPositionAnalysisOn === prevIsPositionAnalysisOn) return;

    if (!isPositionAnalysisOn && fenBeingAnalyzed != null) {
      if (isAnalyzingGame) {
        console.warn('Cannot disable position analysis while game analysis is running');
        return;
      }
      cancelAllAnalysis();
    }
  }, [isPositionAnalysisOn, prevIsPositionAnalysisOn, cancelAllAnalysis, fenBeingAnalyzed, isAnalyzingGame]);

  const progress = fensToAnalyze.length > 0
    ? Math.round((currentPositionIndex / fensToAnalyze.length) * 100)
    : 0;

  return {
    analyzeGame,
    gameEvaluation,
    variationEvaluations,
    analyzePosition,
    latestEvaluation,
    fenBeingAnalyzed,
    engineName,
    isAnalyzingGame,
    progress,
    currentPosition: currentPositionIndex,
    totalPositions: fensToAnalyze.length,
  };
}
