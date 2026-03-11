import { useState, useEffect, useCallback, useRef } from 'react';
import { Evaluations } from '@/types/chess';
import useFenAnalyzer, { StockfishSettings } from '@/hooks/useFenAnalyzer';
import { parse as parsePGN } from 'pgn-parser';
import { Chess as CmChess } from 'cm-chess/src/Chess';
import { AnalyzerStatus } from '@/types/analyzer';
import { getBookPosition } from '@/utils/bookPositionsContext';

export interface AnalyzePgnOptions {
  analyzeVariations?: boolean;
  depth?: number;
  numLines?: number;
  maxSecondsPerPosition?: number;
  threadsPerInstance?: number; // If specified, each instance uses this many threads. Otherwise, divide equally.
}

export interface Output {
  analyzePgn: (pgn: string, options?: AnalyzePgnOptions) => void;
  cancel: () => void;
  status: AnalyzerStatus;
  progress: number;
  currentPosition: number;
  totalPositions: number;
  pgnEvaluations: Evaluations;
  setupWorkers: () => Promise<void>;
  terminateWorkers: () => void;
}

const MAX_INSTANCES = 8;

export default function usePgnAnalyzerParallel(
  numInstances: number,
  stockfishSettings?: StockfishSettings,
  defaultDepth: number = 20,
  defaultNumLines: number = 2
): Output {
  if (numInstances < 1) throw new Error('numInstances must be at least 1');
  if (numInstances > MAX_INSTANCES) throw new Error(`numInstances cannot exceed ${MAX_INSTANCES}`);

  // Create maximum number of analyzer instances (must be unconditional for Rules of Hooks)
  const analyzers = [
    useFenAnalyzer({...stockfishSettings, id: 'pgn1'}),
    useFenAnalyzer({...stockfishSettings, id: 'pgn2'}),
    useFenAnalyzer({...stockfishSettings, id: 'pgn3'}),
    useFenAnalyzer({...stockfishSettings, id: 'pgn4'}),
    useFenAnalyzer({...stockfishSettings, id: 'pgn5'}),
    useFenAnalyzer({...stockfishSettings, id: 'pgn6'}),
    useFenAnalyzer({...stockfishSettings, id: 'pgn7'}),
    useFenAnalyzer({...stockfishSettings, id: 'pgn8'}),
  ];

  const availableThreads = analyzers[0].availableThreads;

  // Warn if numInstances exceeds available threads
  useEffect(() => {
    if (availableThreads != null && numInstances > availableThreads) {
      console.warn(
        `Requested ${numInstances} analyzer instances but only ${availableThreads} threads are available. ` +
        `This may cause performance degradation.`
      );
    }
  }, [numInstances, availableThreads]);

  const [status, setStatus] = useState(AnalyzerStatus.Uninitialized);
  const [pgnEvaluations, setPgnEvaluations] = useState<Evaluations>({});
  const [totalPositions, setTotalPositions] = useState(0);
  const [completedPositions, setCompletedPositions] = useState(0);

  // Queue-based work distribution
  const queueRef = useRef<string[]>([]);
  const instanceBusyRef = useRef<boolean[]>([]);
  const isAnalyzingRef = useRef(false);
  const currentOptionsRef = useRef<Required<AnalyzePgnOptions> | null>(null);

  // Generate all FENs from the PGN
  const generateFensFromPgn = useCallback((pgn: string, analyzeVariations: boolean): string[] => {
    try {
      const parsedPgn = parsePGN(pgn)[0];
      if (!parsedPgn) return [];

      const fens: string[] = [];

      // Helper function to recursively process moves and variations
      const processMoves = (moves: any[], cmchess: CmChess) => {
        moves.forEach((move) => {
          try {
            cmchess.move(move.move);
            fens.push(cmchess.fen());

            // Process variations (ravs) if they exist and analyzeVariations is true
            if (analyzeVariations && move.ravs && move.ravs.length > 0) {
              // Save the current position before entering variations
              const positionBeforeVariations = cmchess.fen();

              // Process each variation
              move.ravs.forEach((rav: any) => {
                // Reset to position before the variation
                cmchess.load(positionBeforeVariations);
                // Go back one move to get to the position before the current move
                cmchess.undo();

                // Process the variation recursively
                if (rav.moves && rav.moves.length > 0) {
                  processMoves(rav.moves, cmchess);
                }

                // Return to the position after the main move
                cmchess.load(positionBeforeVariations);
              });
            }
          } catch (error) {
            console.error('Invalid move:', move.move, error);
          }
        });
      };

      const cmchess = new CmChess();
      processMoves(parsedPgn.moves, cmchess);

      return fens;
    } catch (error) {
      console.error('Error parsing PGN:', error);
      return [];
    }
  }, []);


  const setupWorkers = useCallback(async () => {
    setStatus(AnalyzerStatus.Initializing);
    // Set up only the number of instances we're actually using
    const promises = [];
    for (let i = 0; i < numInstances; i++) {
      promises.push(analyzers[i].setupWorker());
    }
    await Promise.all(promises);
    setStatus(AnalyzerStatus.Idle);
  }, [numInstances, analyzers]);

  const terminateWorkers = useCallback(() => {
    // Terminate all analyzer instances
    for (let i = 0; i < MAX_INSTANCES; i++) {
      analyzers[i].terminateWorker();
    }

    // reset state
    isAnalyzingRef.current = false;
    queueRef.current = [];
    instanceBusyRef.current = [];
    setStatus(AnalyzerStatus.Uninitialized);
    setTotalPositions(0);
    setCompletedPositions(0);
    setPgnEvaluations({});
    currentOptionsRef.current = null;
  }, [analyzers]);

  const cancel = useCallback(() => {
    if (!isAnalyzingRef.current) return;

    // Stop all active analyzers
    for (let i = 0; i < numInstances; i++) {
      if (instanceBusyRef.current[i]) {
        analyzers[i].stop();
      }
    }

    isAnalyzingRef.current = false;
    queueRef.current = [];
    instanceBusyRef.current = [];
    setStatus(AnalyzerStatus.Idle);
    setTotalPositions(0);
    setCompletedPositions(0);
    currentOptionsRef.current = null;
  }, [numInstances, analyzers]);

  const analyzePgn = useCallback((pgn: string, partialOptions?: AnalyzePgnOptions) => {
    // Check if workers are initialized by checking if any of the workers we'll use have availableThreads set
    // availableThreads is set when the stockfish worker is initialized
    const allWorkersReady = analyzers.slice(0, numInstances).every(a => a.availableThreads !== null);
    if (!allWorkersReady) {
      throw new Error('Workers are not initialized. Call setupWorkers() first.');
    }

    // Set up default options
    const defaultOptions: Required<AnalyzePgnOptions> = {
      analyzeVariations: true,
      depth: defaultDepth,
      numLines: defaultNumLines,
      maxSecondsPerPosition: 0,
      threadsPerInstance: 0, // 0 means auto-calculate
    };

    const options: Required<AnalyzePgnOptions> = { ...defaultOptions, ...partialOptions };
    currentOptionsRef.current = options;

    // Generate FENs from PGN
    const allFens = generateFensFromPgn(pgn, options.analyzeVariations);

    let fensToAnalyze: string[] = [];
    const bookEvaluations: Evaluations = {};

    // Get any evaluations from bookPositions that we can
    if (stockfishSettings) {
      if (stockfishSettings.bookPositions) {
        for (let i = 0; i < allFens.length; i++) {
          const bookPos = getBookPosition(allFens[i], stockfishSettings.bookPositions);
          if (bookPos) {
            bookEvaluations[allFens[i]] = bookPos.pev;
          } else {
            fensToAnalyze.push(allFens[i]);
          }
        }
        if (stockfishSettings.setEvaluations) {
          stockfishSettings.setEvaluations((evs) => ({...evs, ...bookEvaluations }))
        }
      }
    }

    // If no bookEvaluations, then set fensToAnalyze to allFens
    if (Object.keys(bookEvaluations).length < 1) fensToAnalyze = allFens;


    if (allFens.length === 0) {
      console.error('No positions to analyze');
      return;
    }

    // Cancel any ongoing analysis
    if (isAnalyzingRef.current) {
      cancel();
    }

    // Calculate threads per instance
    let threadsPerInstance: number;
    if (options.threadsPerInstance > 0) {
      threadsPerInstance = options.threadsPerInstance;
    } else {
      threadsPerInstance = 1;
    }

    // Configure each analyzer instance with thread allocation
    for (let i = 0; i < numInstances; i++) {
      analyzers[i].modifyStockfishSettings({
        numThreads: threadsPerInstance,
      });
    }

    // Initialize queue and instance busy states
    queueRef.current = [...fensToAnalyze];
    instanceBusyRef.current = new Array(numInstances).fill(false);

    // Set up state for new analysis
    setTotalPositions(allFens.length);

    if (Object.keys(bookEvaluations).length > 0) {
      setCompletedPositions(Object.keys(bookEvaluations).length);
      setPgnEvaluations(bookEvaluations);
    } else {
      setCompletedPositions(0);
      setPgnEvaluations({});
    }

    if (fensToAnalyze.length > 0) {
      isAnalyzingRef.current = true;
      setStatus(AnalyzerStatus.Analyzing);
    }
  }, [
    generateFensFromPgn,
    defaultDepth,
    defaultNumLines,
    cancel,
    numInstances,
    availableThreads,
    analyzers,
    stockfishSettings,
  ]);

  // Process positions using queue-based work distribution
  useEffect(() => {
    if (!isAnalyzingRef.current) return;
    if (status !== AnalyzerStatus.Analyzing) return;

    const options = currentOptionsRef.current;
    if (!options) return;

    // Check if all work is complete (queue empty and all instances idle)
    const allInstancesIdle = instanceBusyRef.current.every((busy) => !busy);
    if (queueRef.current.length === 0 && allInstancesIdle) {
      // Analysis complete
      isAnalyzingRef.current = false;
      setStatus(AnalyzerStatus.Idle);
      return;
    }

    // For each instance, if idle and queue has work, assign next position
    for (let i = 0; i < numInstances; i++) {
      // Skip if instance is busy
      if (instanceBusyRef.current[i]) continue;

      // Skip if queue is empty
      if (queueRef.current.length === 0) continue;

      // Get next FEN from queue
      const nextFen = queueRef.current.shift()!;

      // Check if we already have this evaluation at the required depth
      if (stockfishSettings?.evaluations &&
          nextFen in stockfishSettings.evaluations &&
          stockfishSettings.evaluations[nextFen].depth >= options.depth) {
        // Use existing evaluation
        setPgnEvaluations((prev) => ({ ...prev, [nextFen]: stockfishSettings.evaluations![nextFen] }));
        setCompletedPositions((prev) => prev + 1);
        // Don't mark as busy, just continue to next iteration
        continue;
      }

      // Mark instance as busy
      instanceBusyRef.current[i] = true;

      // Prepare analysis options
      const analyzeOptions: any = {
        maxDepth: options.depth,
        numLines: options.numLines,
      };

      if (options.maxSecondsPerPosition > 0) {
        analyzeOptions.maxSeconds = options.maxSecondsPerPosition;
      }

      // Start analysis
      analyzers[i]
        .analyze(nextFen, analyzeOptions)
        .then((evaluation) => {
          // useFenAnalyzer now handles saving to evaluations store
          // Just add to pgnEvaluations for tracking this PGN's analysis
          setPgnEvaluations((prev) => ({ ...prev, [nextFen]: evaluation }));
          setCompletedPositions((prev) => prev + 1);

          // Mark instance as not busy
          instanceBusyRef.current[i] = false;
        })
        .catch((error) => {
          console.error(`Error analyzing position (instance ${i}):`, error);
          setCompletedPositions((prev) => prev + 1);

          // Mark instance as not busy even on error
          instanceBusyRef.current[i] = false;
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, completedPositions, numInstances]);

  const progress =
    totalPositions > 0 ? Math.round((completedPositions / totalPositions) * 100) : 0;

  return {
    analyzePgn,
    cancel,
    status,
    progress,
    currentPosition: completedPositions,
    totalPositions,
    pgnEvaluations,
    setupWorkers,
    terminateWorkers,
  };
}
