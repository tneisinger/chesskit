import { useEffect, useRef, useState, useCallback } from 'react';
import { PositionEvaluation, ShortMove, Evaluations } from '@/types/chess';
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
import { BookPositions } from '@/types/bookPositions';
import { getBookPosition } from '@/utils/bookPositionsContext';
import { AnalyzerStatus } from '@/types/analyzer';

export class AnalyzeInterruptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyzeInterruptedError';
  }
}

export interface AnalyzeOptions {
  maxDepth?: number;  // Stop the analysis after getting a best move at this depth
  maxSeconds?: number;  // The maximum number of seconds to spend analyzing
  numLines?: number;  // Number of lines to analyze (MultiPV), default 1
}

export interface StockfishSettings {
  threadsPercentage?: number;  // Percentage of available threads to use (0-1), default 0.5
  numThreads?: number;  // Absolute number of threads to use, overrides threadsPercentage if provided
  hashSize?: number;  // Hash table size in MB, default 512
  id?: string;
  initializeImmediately?: boolean;
  bookPositions?: BookPositions | null;
  evaluations?: Evaluations;
  setEvaluations?: React.Dispatch<React.SetStateAction<Evaluations>>;
}

export interface Output {
  analyze: (fen: string, options?: AnalyzeOptions) => Promise<PositionEvaluation>;
  stop: () => Promise<void>;
  newGame: () => Promise<void>;
  latestEvaluation: PositionEvaluation | null;
  engineName: string | null;
  fenBeingAnalyzed: string | null;
  modifyStockfishSettings: (settings: StockfishSettings) => void;
  availableThreads: number | null;
  setupWorker: () => Promise<void>;
  terminateWorker: () => void;
  status: AnalyzerStatus;
}

export default function useFenAnalyzer(initialSettings?: StockfishSettings): Output {
  const {
    stockfish,
    recommendation,
    setupWorker: setupStockfishWorker,
    terminateWorker: terminateStockfishWorker
  } = useStockfish({
    initializeImmediately: initialSettings?.initializeImmediately ?? true
  });

  const [status, setStatus] = useState<AnalyzerStatus>(AnalyzerStatus.Uninitialized);
  const [latestEvaluation, setLatestEvaluation] = useState<PositionEvaluation | null>(null);
  const [engineName, setEngineName] = useState<string | null>(null);
  const [fenBeingAnalyzed, setFenBeingAnalyzed] = useState<string | null>(null);
  const [settings, setSettings] = useState<StockfishSettings>({
    threadsPercentage: initialSettings?.threadsPercentage ?? 0.5,
    numThreads: initialSettings?.numThreads,
    hashSize: initialSettings?.hashSize ?? 512,
    id: initialSettings?.id ?? '',
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

  // Promise resolution for setup
  const setupPromiseRef = useRef<{
    resolve: () => void;
    reject: (reason: any) => void;
  } | null>(null);
  const isWaitingForSetupReadyRef = useRef<boolean>(false);

  // Promise resolution for newGame
  const newGamePromiseRef = useRef<{
    resolve: () => void;
    reject: (reason: any) => void;
  } | null>(null);
  const isWaitingForNewGameReadyRef = useRef<boolean>(false);

  // Timeout for maxSeconds
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppingDueToMaxSecondsRef = useRef<boolean>(false);

  // Current analysis options
  const currentOptionsRef = useRef<AnalyzeOptions | null>(null);
  const lastAddedEval = useRef<PositionEvaluation | null>(null);
  const pendingAnalysisStart = useRef<{ fen: string; options: AnalyzeOptions } | null>(null);

  const getDefaultNumThreads = useCallback((): number => {
    // If numThreads is explicitly set, use it (takes precedence over threadsPercentage)
    if (settings.numThreads !== undefined) {
      // Validate minimum
      if (settings.numThreads < 1) {
        throw new Error(`Stockfish ${settings.id} numThreads must be at least 1`);
      }

      // If we have recommendation, validate against max available threads
      if (recommendation) {
        if (settings.numThreads > recommendation.threads) {
          console.warn(`stockfish ${settings.id}:`);
          console.warn(
            `numThreads (${settings.numThreads}) exceeds available threads (${recommendation.threads}). Using ${recommendation.threads} threads instead.`
          );
          return recommendation.threads;
        }
      } else {
        // No recommendation available yet, but numThreads is set
        // Use the specified value (user knows what they want)
        return settings.numThreads;
      }

      return settings.numThreads;
    }

    // Fall back to threadsPercentage calculation
    if (!recommendation || settings.threadsPercentage == undefined) return 1;
    return Math.max(1, Math.floor(recommendation.threads * settings.threadsPercentage));
  }, [recommendation, settings.threadsPercentage, settings.numThreads]);

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
      numThreads: newSettings.numThreads !== undefined ? newSettings.numThreads : prev.numThreads,
      hashSize: newSettings.hashSize ?? prev.hashSize,
      id: newSettings.id ?? prev.id,
      initializeImmediately: newSettings.initializeImmediately ?? prev.initializeImmediately,
      bookPositions: newSettings.bookPositions ?? prev.bookPositions,
      evaluations: newSettings.evaluations ?? prev.evaluations,
      setEvaluations: newSettings.setEvaluations ?? prev.setEvaluations,
    }));

    // Apply settings to stockfish if it's ready
    if (stockfish && hasStockfishBeenSetup.current) {
      // Handle thread settings (numThreads takes precedence over threadsPercentage)
      if (newSettings.numThreads !== undefined) {
        // Validate minimum
        if (newSettings.numThreads < 1) {
          throw new Error(`Stockfish ${settings.id} numThreads must be at least 1`);
        }

        let threadsToUse = newSettings.numThreads;

        // Validate against max available threads if we have recommendation
        if (recommendation && newSettings.numThreads > recommendation.threads) {
          console.warn(
            `numThreads (${newSettings.numThreads}) exceeds available threads (${recommendation.threads}). Using ${recommendation.threads} threads instead.`
          );
          threadsToUse = recommendation.threads;
        }

        stockfish.postMessage(`setoption name Threads value ${threadsToUse}`);
      } else if (newSettings.threadsPercentage !== undefined && recommendation) {
        const numThreads = Math.max(1, Math.floor(recommendation.threads * newSettings.threadsPercentage));
        stockfish.postMessage(`setoption name Threads value ${numThreads}`);
      }

      if (newSettings.hashSize !== undefined) {
        stockfish.postMessage(`setoption name Hash value ${newSettings.hashSize}`);
      }
    }
  }, [stockfish, recommendation]);

  const setupWorker = useCallback((): Promise<void> => {
    setStatus(AnalyzerStatus.Initializing);
    return new Promise((resolve, reject) => {
      // If already set up, resolve immediately
      if (hasStockfishBeenSetup.current && stockfish) {
        setStatus(AnalyzerStatus.Initializing);
        resolve();
        return;
      }

      // Store the promise resolver
      setupPromiseRef.current = { resolve, reject };
      isWaitingForSetupReadyRef.current = true;

      // Set up a timeout in case the worker never responds
      const timeoutSeconds = 120;
      const timeout = setTimeout(() => {
        if (setupPromiseRef.current) {
          setStatus(AnalyzerStatus.Uninitialized);
          setupPromiseRef.current.reject(
            new Error(`Stockfish ${settings.id} Worker setup timed out after {timeoutSeconds} seconds`)
          );
          setupPromiseRef.current = null;
          isWaitingForSetupReadyRef.current = false;
        }
      }, timeoutSeconds * 1000);

      // Clear timeout when promise resolves or rejects
      const originalResolve = setupPromiseRef.current.resolve;
      const originalReject = setupPromiseRef.current.reject;
      setupPromiseRef.current.resolve = () => {
        clearTimeout(timeout);
        setStatus(AnalyzerStatus.Idle);
        originalResolve();
      };
      setupPromiseRef.current.reject = (reason: any) => {
        clearTimeout(timeout);
        setStatus(AnalyzerStatus.Uninitialized);
        originalReject(reason);
      };

      // Trigger worker creation
      setupStockfishWorker();
    });
  }, [setupStockfishWorker, stockfish, settings.id]);

  const terminateWorker = useCallback(() => {
    // Clear any ongoing analysis
    if (isAnalyzingRef.current) {
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Reject pending analysis
      if (analysisPromiseRef.current) {
        analysisPromiseRef.current.reject(
          new AnalyzeInterruptedError(`Stockfish ${settings.id} Worker terminated during analysis`)
        );
        analysisPromiseRef.current = null;
      }

      isAnalyzingRef.current = false;
    }

    // Reject pending setup
    if (setupPromiseRef.current) {
      setupPromiseRef.current.reject(
        new Error(`Stockfish ${settings.id} Worker terminated during setup`)
      );
      setupPromiseRef.current = null;
      isWaitingForSetupReadyRef.current = false;
    }

    // Reject pending newGame
    if (newGamePromiseRef.current) {
      newGamePromiseRef.current.reject(
        new Error(`Stockfish ${settings.id} Worker terminated during newGame`)
      );
      newGamePromiseRef.current = null;
      isWaitingForNewGameReadyRef.current = false;
    }

    // Reset setup flag so worker can be re-initialized
    hasStockfishBeenSetup.current = false;

    // Clear state
    setLatestEvaluation(null);
    setFenBeingAnalyzed(null);
    fenRef.current = null;
    lastDepth.current = 0;
    linesRef.current = {};

    // Terminate the stockfish worker
    terminateStockfishWorker();
    setStatus(AnalyzerStatus.Uninitialized);
  }, [terminateStockfishWorker, settings.id]);

  const newGame = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!stockfish || !hasStockfishBeenSetup.current) {
        reject(new Error(`Worker ${settings.id} not initialized`));
        return;
      }
      if (isAnalyzingRef.current) {
        reject(new Error(`Worker ${settings.id} cannot call newGame while analyzing`));
        return;
      }
      newGamePromiseRef.current = { resolve, reject };
      isWaitingForNewGameReadyRef.current = true;
      stockfish.postMessage('ucinewgame');
      stockfish.postMessage('isready');
    });
  }, [stockfish, settings.id]);

  const stop = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!stockfish) {
        reject(new Error(`Stockfish ${settings.id} Worker is not initialized. Call setupWorker() first.`));
        return;
      }

      if (!isAnalyzingRef.current) {
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
      setStatus(AnalyzerStatus.Idle);
    });
  }, [stockfish, settings.id]);


  const checkForExistingEvaluation = useCallback((fen: string, maxDepth?: number): PositionEvaluation | null => {
    // Only check for existing evaluation if maxDepth is defined
    if (maxDepth == undefined) return null;

    // Check for an existingEvaluation in evaluations and in bookPositions
    let existingEval = null;
    if (initialSettings?.evaluations && initialSettings.evaluations[fen] != undefined) {
      existingEval = initialSettings.evaluations[fen];
    } else if (initialSettings?.bookPositions) {
      const bookPosition = getBookPosition(fen, initialSettings.bookPositions);
      if (bookPosition) existingEval = bookPosition.pev;
    }
    return existingEval;
  }, [initialSettings?.evaluations, initialSettings?.bookPositions]);


  const analyze = useCallback((fen: string, options?: AnalyzeOptions): Promise<PositionEvaluation> => {
    const opts: AnalyzeOptions = {
      numLines: options?.numLines ?? 1,
      maxDepth: options?.maxDepth,
      maxSeconds: options?.maxSeconds,
    };

    return new Promise((resolve, reject) => {
      // Check if we already have an evaluation at the required depth (only if maxDepth is defined)
      const existingEval = checkForExistingEvaluation(fen, opts.maxDepth);
      if (existingEval && opts.maxDepth != undefined && existingEval.depth >= opts.maxDepth) {
        if (initialSettings && initialSettings.setEvaluations) {
          initialSettings.setEvaluations((evs) => ({ ...evs, [existingEval.fen]: existingEval }));
        }
        // Return the existing evaluation without analyzing
        resolve(existingEval);
        return;
      }

      // Check if already analyzing
      if (isAnalyzingRef.current) {
        reject(new Error(`Stockfish ${settings.id} Already analyzing a position. Call stop() first.`));
        return;
      }

      if (!stockfish) {
        reject(new Error(`Stockfish ${settings.id} Worker is not initialized. Call setupWorker() first.`));
        return;
      }

      // Set up analysis state
      isAnalyzingRef.current = true;
      setLatestEvaluation(null);
      setFenBeingAnalyzed(fen);
      fenRef.current = fen;
      lastDepth.current = 0;
      linesRef.current = {};
      currentOptionsRef.current = opts;
      analysisPromiseRef.current = { resolve, reject };
      isStoppingDueToMaxSecondsRef.current = false;
      lastAddedEval.current = null;

      // Set MultiPV
      if (opts.numLines == undefined) throw new Error(`Stockfish ${settings.id} numLines was undefined`);
      stockfish.postMessage(`setoption name MultiPV value ${opts.numLines}`);
      numLinesRef.current = opts.numLines;

      // Wait for stockfish to be ready, then start analysis
      pendingAnalysisStart.current = { fen, options: opts };
      stockfish.postMessage('isready');
    });
  }, [stockfish, checkForExistingEvaluation, settings.id, initialSettings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);


  // Handle stockfish messages
  useEffect(() => {
    const handleStockfishMessage = (event: MessageEvent) => {
      const line = typeof event === 'object' ? event.data : event;
      // console.log('Stockfish ', settings.id, ': ', line);

      const name = parseName(line);
      if (name) {
        setEngineName(recommendation ? recommendation.title : null);
      }

      if (parseIsStockfishReady(line)) {
        // Check if this is readyok from initial setup
        if (isWaitingForSetupReadyRef.current && setupPromiseRef.current) {
          isWaitingForSetupReadyRef.current = false;
          setupPromiseRef.current.resolve();
          setupPromiseRef.current = null;
          return;
        }

        // Check if this is readyok from newGame
        if (isWaitingForNewGameReadyRef.current && newGamePromiseRef.current) {
          isWaitingForNewGameReadyRef.current = false;
          newGamePromiseRef.current.resolve();
          newGamePromiseRef.current = null;
          return;
        }

        // Check if we have a pending analysis start
        if (pendingAnalysisStart.current && stockfish) {
          const { fen, options } = pendingAnalysisStart.current;
          pendingAnalysisStart.current = null;
          setStatus(AnalyzerStatus.Analyzing);

          stockfish.postMessage(`position fen ${fen}`);
          // console.log(`Stockfish ${settings.id}: position fen ${fen}`);

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
                console.warn(`stockfish ${settings.id} stopping due to maxSeconds limit`);
                isStoppingDueToMaxSecondsRef.current = true;
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
      if (fenRef.current == null) throw new Error(`Stockfish ${settings.id} fenRef was null when handling best move info`);

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Resolve stop promise if it exists
      if (stopPromiseRef.current) {
        setStatus(AnalyzerStatus.Idle);
        stopPromiseRef.current.resolve();
        stopPromiseRef.current = null;
      }

      // Check if we have any unsaved lines and save them
      // This handles the last depth when bestmove arrives (including mate-0 at depth 0)
      if (!lastAddedEval.current && fenRef.current in linesRef.current) {
        const rawLines = linesRef.current[fenRef.current];
        if (rawLines.length > 0) {
          saveEvaluation(rawLines[0].depth);
        }
      }

      const requiredDepth = currentOptionsRef.current?.maxDepth;

      // If we haven't reached the requiredDepth, it could be that the position is a checkmate.
      // In that case, bestMove will be undefined at depth 0.
      // Use chessJS to check for checkmate
      const chessjs = new ChessJS();
      chessjs.load(fenRef.current);
      const isCheckmate = chessjs.isCheckmate();
      const legalMoves = chessjs.moves();

      // If we did not reach the required depth in a non-checkmate position...
      if (requiredDepth !== undefined && lastDepth.current < requiredDepth && !isCheckmate) {

        // If we didn't reach the required depth because we reached the maxSeconds time limit,
        // then we should still resolve with the best move found so far (if any). But if we stopped
        // for any other reason before reaching the required depth, that's an error and we should reject.
        if (isStoppingDueToMaxSecondsRef.current) {
          // do nothing
        } else if (legalMoves.length < numLinesRef.current && lastDepth.current === requiredDepth - 1) {
          // If there are fewer legal moves than the number of lines requested, and the lastDepth is one
          // less than the requiredDepth, then this is not an error because Stockfish will not be able to
          // provide the requested number of lines at any depth. In this case, we can still resolve with
          // the best move found so far (if any).
          // do nothing
        } else {
          console.warn(`Stockfish ${settings.id} Analysis stopped before reaching required depth`)
          console.warn('requiredDepth:', requiredDepth);
          console.warn('lastDepth.current:', lastDepth.current);
          console.warn(`Stockfish ${settings.id} lastAddedEval: ${lastAddedEval.current}`);
        }
      }

      if (fenRef.current == null) {
        console.error(`stockfish ${settings.id} fenRef was null`);
        if (analysisPromiseRef.current) {
          setStatus(AnalyzerStatus.Idle);
          analysisPromiseRef.current.reject(new Error(`Stockfish ${settings.id} FEN reference was null`));
          analysisPromiseRef.current = null;
        }
        isAnalyzingRef.current = false;
        return;
      }

      if (!lastAddedEval.current) {
        console.error(`stockfish ${settings.id} lastAddedEval should be defined`);
        if (analysisPromiseRef.current) {
          setStatus(AnalyzerStatus.Idle);
          analysisPromiseRef.current.reject(new Error(`Stockfish ${settings.id} No evaluation data available`));
          analysisPromiseRef.current = null;
        }
        isAnalyzingRef.current = false;
        fenRef.current = null;
        return;
      }

      // If there's a best move, add it to the evaluation. If not, we might still have an
      // evaluation (e.g. in checkmate positions), so resolve with what we have.
      const bestMove = bestMoveInfo.bestmove ? parseLanMove(bestMoveInfo.bestmove) : undefined;

      let depth = lastDepth.current;

      // If the position is a checkmate, lastDepth.current will probably be zero because stockfish
      // doesn't bother evaluating at any depth if the position is a checkmate. But a depth of zero
      // does not acurately reflect the quality of the evaluation. If the position is checkmate,
      // we should consider the evaluation very good (of high depth). In that case, set depth to 100.
      if (isCheckmate) depth = 100;

      const evaluation: PositionEvaluation = {
        ...lastAddedEval.current,
        bestMove,
        depth,
      };

      saveEvaluation(depth, bestMove);

      // Save to evaluations store if setEvaluations is provided
      if (initialSettings?.setEvaluations && fenRef.current) {
        initialSettings.setEvaluations((evs) => ({ ...evs, [evaluation.fen]: evaluation }));
      }

      if (analysisPromiseRef.current) {
        setStatus(AnalyzerStatus.Idle);
        analysisPromiseRef.current.resolve(evaluation);
        analysisPromiseRef.current = null;
      }

      isAnalyzingRef.current = false;
      setFenBeingAnalyzed(null);
      fenRef.current = null;
      currentOptionsRef.current = null;
    };

    const handleStockfishInfo = (info: StockfishInfo) => {
      if (fenRef.current == null) return;

      // If Stockfish has moved to a new depth, save evaluation for the previous depth
      // This handles cases where fewer lines are sent than MultiPV setting
      if (info.depth !== undefined && info.depth > lastDepth.current && fenRef.current) {
        if (fenRef.current in linesRef.current) {
          const rawLines = linesRef.current[fenRef.current];
          // If we have unsaved lines from a previous depth, save them now
          if (rawLines.length > 0 && rawLines[0].depth !== lastDepth.current) {
            saveEvaluation(rawLines[0].depth);
          }
        }
      }

      saveLine(info, fenRef.current);

      // If this is the last expected multipv line, save immediately
      if (info.multipv === numLinesRef.current && info.score && info.depth != undefined) {
        saveEvaluation(info.depth);
      }
    };

    const saveLine = (info: StockfishInfo, fen: string) => {
      if (info.depth == undefined) return;
      if (info.score == undefined) return;
      // For mate-0 positions, multipv and pv may be undefined
      // Default multipv to 1 and pv to empty array
      const multipv = info.multipv ?? 1;

      const evalerLine: MultiPV = {
        depth: info.depth,
        multipv: multipv,
        score: info.score,
        lanLine: info.pv ? info.pv.split(' ') : [],
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

    const saveEvaluation = (evalDepth: number, bestMove?: ShortMove) => {
      // If lastDepth is 0, that means evaluation just started
      // In that case, if the new 'depth' value is not 1, then this message
      // from Stockfish must be residual from a previous run
      // EXCEPT: For mate-0 positions, Stockfish sends depth 0 with a mate score
      if (lastDepth.current === 0 && evalDepth !== 1) {
        // Check if we have valid lines (might be a mate-0 position with depth 0)
        if (fenRef.current == null) return;
        const lines = getLinesForFen(fenRef.current);
        if (lines.length === 0 || (evalDepth !== 0 || lines[0].score.key !== 'mate')) {
          return;
        }
        // It's a mate-0 evaluation at depth 0, allow it to proceed
      }

      lastDepth.current = evalDepth;

      if (fenRef.current == null) return;

      const lines = getLinesForFen(fenRef.current);
      const evaluation: PositionEvaluation = {
        depth: evalDepth,
        fen: fenRef.current,
        score: { key: lines[0].score.key, value: lines[0].score.value },
        lines,
        bestMove,
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
    newGame,
    status,
    latestEvaluation,
    engineName,
    fenBeingAnalyzed,
    modifyStockfishSettings,
    availableThreads: recommendation?.threads ?? null,
    setupWorker,
    terminateWorker,
  };
}
