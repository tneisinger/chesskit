import { useEffect, useRef, useState, useCallback } from 'react';
import { PositionEvaluation } from '@/types/chess';
import useStockfish from '@/hooks/useStockfish';
import {
  parseInfoLine,
  parseBestMoveLine,
  parseLanMove,
  parseIsStockfishReady,
  parseName,
  StockfishInfo,
  BestMoveInfo,
  MultiPV,
  Lines,
} from '@/utils/stockfish';
import { Chess as ChessJS } from 'chess.js';

export interface AnalyzeOptions {
  maxDepth?: number;  // Stop the analysis after getting a best move at this depth
  maxSeconds?: number;  // The maximum number of seconds to spend analyzing
  numLines?: number;  // Number of lines to analyze (MultiPV), default 1
}

export interface StockfishSettings {
  threadsPercentage?: number;  // Percentage of available threads to use (0-1), default 0.5
  hashSize?: number;  // Hash table size in MB, default 512
}

export interface Output {
  analyze: (fen: string, options?: AnalyzeOptions) => Promise<PositionEvaluation>;
  stop: () => Promise<void>;
  isAnalyzing: boolean;
  latestEvaluation: PositionEvaluation | null;
  engineName: string | null;
  fenBeingAnalyzed: string | null;
  modifyStockfishSettings: (settings: StockfishSettings) => void;
}

export default function useFenAnalyzer(initialSettings?: StockfishSettings): Output {
  const { stockfish, recommendation } = useStockfish();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState<PositionEvaluation | null>(null);
  const [engineName, setEngineName] = useState<string | null>(null);
  const [fenBeingAnalyzed, setFenBeingAnalyzed] = useState<string | null>(null);
  const [settings, setSettings] = useState<Required<StockfishSettings>>({
    threadsPercentage: initialSettings?.threadsPercentage ?? 0.5,
    hashSize: initialSettings?.hashSize ?? 512,
  });

  const fenRef = useRef<string | null>(null);
  const lastDepth = useRef<number>(0);
  const linesRef = useRef<Lines>({});
  const hasStockfishBeenSetup = useRef<boolean>(false);
  const isAnalyzingRef = useRef<boolean>(false);
  const numLinesRef = useRef<number>(1);

  // Promise resolution/rejection for current analysis
  const analysisPromiseRef = useRef<{
    resolve: (value: PositionEvaluation) => void;
    reject: (reason: any) => void;
  } | null>(null);

  // Promise resolution for stop
  const stopPromiseRef = useRef<{
    resolve: () => void;
  } | null>(null);

  // Timeout for maxSeconds
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Current analysis options
  const currentOptionsRef = useRef<AnalyzeOptions | null>(null);
  const lastAddedEval = useRef<PositionEvaluation | null>(null);
  const pendingAnalysisStart = useRef<{ fen: string; options: AnalyzeOptions } | null>(null);

  const getDefaultNumThreads = useCallback((): number => {
    if (!recommendation) return 1;
    return Math.max(1, Math.floor(recommendation.threads * settings.threadsPercentage));
  }, [recommendation, settings.threadsPercentage]);

  const getLinesForFen = useCallback((fen: string): PositionEvaluation['lines'] => {
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
  }, []);

  const modifyStockfishSettings = useCallback((newSettings: StockfishSettings) => {
    setSettings((prev) => ({
      threadsPercentage: newSettings.threadsPercentage ?? prev.threadsPercentage,
      hashSize: newSettings.hashSize ?? prev.hashSize,
    }));

    // Apply settings to stockfish if it's ready
    if (stockfish && hasStockfishBeenSetup.current) {
      if (newSettings.threadsPercentage !== undefined && recommendation) {
        const numThreads = Math.max(1, Math.floor(recommendation.threads * newSettings.threadsPercentage));
        stockfish.postMessage(`setoption name Threads value ${numThreads}`);
      }
      if (newSettings.hashSize !== undefined) {
        stockfish.postMessage(`setoption name Hash value ${newSettings.hashSize}`);
      }
    }
  }, [stockfish, recommendation]);

  const stop = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (!isAnalyzingRef.current || !stockfish) {
        resolve();
        return;
      }

      // Clear any timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      stopPromiseRef.current = { resolve };
      stockfish.postMessage('stop');
    });
  }, [stockfish]);

  const analyze = useCallback((fen: string, options?: AnalyzeOptions): Promise<PositionEvaluation> => {
    const opts: AnalyzeOptions = {
      numLines: options?.numLines ?? 1,
      maxDepth: options?.maxDepth,
      maxSeconds: options?.maxSeconds,
    };

    return new Promise((resolve, reject) => {
      // Check if already analyzing
      if (isAnalyzingRef.current) {
        reject(new Error('Already analyzing a position. Call stop() first.'));
        return;
      }

      if (!stockfish) {
        reject(new Error('Stockfish is not initialized'));
        return;
      }

      // Set up analysis state
      isAnalyzingRef.current = true;
      setIsAnalyzing(true);
      setLatestEvaluation(null);
      setFenBeingAnalyzed(fen);
      fenRef.current = fen;
      lastDepth.current = 0;
      linesRef.current = {};
      currentOptionsRef.current = opts;
      analysisPromiseRef.current = { resolve, reject };
      lastAddedEval.current = null;

      // Set MultiPV
      if (opts.numLines == undefined) throw new Error('numLines was undefined');
      stockfish.postMessage(`setoption name MultiPV value ${opts.numLines}`);
      numLinesRef.current = opts.numLines;

      // Wait for stockfish to be ready, then start analysis
      pendingAnalysisStart.current = { fen, options: opts };
      stockfish.postMessage('isready');
    });
  }, [stockfish]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Sync isAnalyzingRef with isAnalyzing state
  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  // Handle stockfish messages
  useEffect(() => {
    const handleStockfishMessage = (event: MessageEvent) => {
      const line = typeof event === 'object' ? event.data : event;
      console.log('Stockfish:', line);

      const name = parseName(line);
      if (name) {
        setEngineName(recommendation ? recommendation.title : null);
      }

      if (parseIsStockfishReady(line)) {
        // Check if we have a pending analysis start
        if (pendingAnalysisStart.current && stockfish) {
          const { fen, options } = pendingAnalysisStart.current;
          pendingAnalysisStart.current = null;

          stockfish.postMessage(`position fen ${fen}`);

          // Determine which go command to send
          if (options.maxDepth === undefined && options.maxSeconds === undefined) {
            // Go infinite
            stockfish.postMessage('go infinite');
          } else if (options.maxDepth !== undefined && options.maxSeconds === undefined) {
            // Go to depth
            stockfish.postMessage(`go depth ${options.maxDepth}`);
          } else if (options.maxDepth === undefined && options.maxSeconds !== undefined) {
            // Go for time
            stockfish.postMessage(`go movetime ${options.maxSeconds * 1000}`);
          } else if (options.maxDepth !== undefined && options.maxSeconds !== undefined) {
            // Go to depth, but stop after maxSeconds
            stockfish.postMessage(`go depth ${options.maxDepth}`);
            timeoutRef.current = setTimeout(() => {
              if (isAnalyzingRef.current) {
                stop();
              }
            }, options.maxSeconds * 1000);
          }
        }
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
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Resolve stop promise if it exists
      if (stopPromiseRef.current) {
        stopPromiseRef.current.resolve();
        stopPromiseRef.current = null;
      }

      const requiredDepth = currentOptionsRef.current?.maxDepth;

      if (bestMoveInfo.bestmove) {
        // Check if we've reached required depth (if specified)
        if (requiredDepth !== undefined && lastDepth.current < requiredDepth) {
          // Not deep enough yet - this shouldn't happen with 'go depth', but handle it
          if (analysisPromiseRef.current) {
            analysisPromiseRef.current.reject(new Error('Analysis stopped before reaching required depth'));
            analysisPromiseRef.current = null;
          }
          isAnalyzingRef.current = false;
          setIsAnalyzing(false);
          fenRef.current = null;
          return;
        }

        const bestMove = parseLanMove(bestMoveInfo.bestmove);

        if (fenRef.current == null) {
          console.error('fenRef was null');
          if (analysisPromiseRef.current) {
            analysisPromiseRef.current.reject(new Error('FEN reference was null'));
            analysisPromiseRef.current = null;
          }
          isAnalyzingRef.current = false;
          setIsAnalyzing(false);
          return;
        }

        if (!lastAddedEval.current) {
          console.error('lastAddedEval should be defined');
          if (analysisPromiseRef.current) {
            analysisPromiseRef.current.reject(new Error('No evaluation data available'));
            analysisPromiseRef.current = null;
          }
          isAnalyzingRef.current = false;
          setIsAnalyzing(false);
          fenRef.current = null;
          return;
        }

        const evaluation: PositionEvaluation = {
          ...lastAddedEval.current,
          bestMove,
          depth: lastDepth.current
        };

        if (analysisPromiseRef.current) {
          analysisPromiseRef.current.resolve(evaluation);
          analysisPromiseRef.current = null;
        }
      } else {
        // No best move (maybe because of checkmate)
        if (analysisPromiseRef.current) {

          // If fenRef is defined and the fen is not a checkmate position, throw an error.
          if (fenRef.current != null) {
            const chessJS = new ChessJS();
            chessJS.load(fenRef.current);
            if (!chessJS.isCheckmate()) {
              analysisPromiseRef.current.reject(new Error('No best move found'));
              analysisPromiseRef.current = null;
            }

          } else {
            console.warn('fenRef.current was null');
            analysisPromiseRef.current.reject(new Error('No best move found'));
            analysisPromiseRef.current = null;
          }
        }
      }

      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setFenBeingAnalyzed(null);
      fenRef.current = null;
      currentOptionsRef.current = null;
    };

    const handleStockfishInfo = (info: StockfishInfo) => {
      if (fenRef.current == null) return;
      saveLine(info, fenRef.current);

      // If this is the last multipv line, save the evaluation
      if (info.multipv === numLinesRef.current && info.score && info.depth != undefined) {
        saveEvaluation(info.depth);
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

    const saveEvaluation = (evalDepth: number) => {
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
        score: { key: lines[0].score.key, value: lines[0].score.value },
        lines,
      };

      lastAddedEval.current = evaluation;
      setLatestEvaluation(evaluation);
    };

    if (stockfish && !hasStockfishBeenSetup.current) {
      stockfish.onmessage = handleStockfishMessage;
      stockfish.postMessage('uci');
      const numThreads = getDefaultNumThreads();
      stockfish.postMessage(`setoption name Threads value ${numThreads}`);
      stockfish.postMessage(`setoption name Hash value ${settings.hashSize}`);
      stockfish.postMessage('isready');
      hasStockfishBeenSetup.current = true;
    }
  }, [stockfish, settings.hashSize, getDefaultNumThreads, getLinesForFen, stop]);

  return {
    analyze,
    stop,
    isAnalyzing,
    latestEvaluation,
    engineName,
    fenBeingAnalyzed,
    modifyStockfishSettings,
  };
}
