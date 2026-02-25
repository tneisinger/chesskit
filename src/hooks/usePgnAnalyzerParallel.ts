import { useState, useEffect, useCallback, useRef } from 'react';
import { Evaluations } from '@/types/chess';
import useFenAnalyzer, { StockfishSettings } from '@/hooks/useFenAnalyzer';
import { parse as parsePGN } from 'pgn-parser';
import { Chess as CmChess } from 'cm-chess/src/Chess';

export enum AnalysisStatus {
  NotStarted = 'Not Started',
  Analyzing = 'Analyzing',
  Complete = 'Complete',
}

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
  status: AnalysisStatus;
  progress: number;
  currentPosition: number;
  totalPositions: number;
  pgnEvaluations: Evaluations;
}

// No longer needed - using queue-based approach
// interface InstanceState removed

const MAX_INSTANCES = 8;

export default function usePgnAnalyzerParallel(
  numInstances: number,
  evaluations: Evaluations,
  setEvaluations: React.Dispatch<React.SetStateAction<Evaluations>>,
  stockfishSettings?: StockfishSettings,
  defaultDepth: number = 20,
  defaultNumLines: number = 2
): Output {
  if (numInstances < 1) throw new Error('numInstances must be at least 1');
  if (numInstances > MAX_INSTANCES) throw new Error(`numInstances cannot exceed ${MAX_INSTANCES}`);

  // Create maximum number of analyzer instances (must be unconditional for Rules of Hooks)
  const analyzers = [
    useFenAnalyzer({...stockfishSettings, id: '1'}),
    useFenAnalyzer({...stockfishSettings, id: '2'}),
    useFenAnalyzer({...stockfishSettings, id: '3'}),
    useFenAnalyzer({...stockfishSettings, id: '4'}),
    useFenAnalyzer({...stockfishSettings, id: '5'}),
    useFenAnalyzer({...stockfishSettings, id: '6'}),
    useFenAnalyzer({...stockfishSettings, id: '7'}),
    useFenAnalyzer({...stockfishSettings, id: '8'}),
  ];

  const availableThreads = analyzers[0].availableThreads ?? 1;

  // Warn if numInstances exceeds available threads
  useEffect(() => {
    if (numInstances > availableThreads) {
      console.warn(
        `Requested ${numInstances} analyzer instances but only ${availableThreads} threads are available. ` +
        `This may cause performance degradation.`
      );
    }
  }, [numInstances, availableThreads]);

  const [status, setStatus] = useState(AnalysisStatus.NotStarted);
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

  // No longer needed - using queue instead of chunks
  // splitIntoChunks removed

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
    setStatus(AnalysisStatus.NotStarted);
    setTotalPositions(0);
    setCompletedPositions(0);
    currentOptionsRef.current = null;
  }, [numInstances, analyzers]);

  const analyzePgn = useCallback((pgn: string, partialOptions?: AnalyzePgnOptions) => {
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
      // Divide equally
      threadsPerInstance = Math.max(1, Math.floor(availableThreads / numInstances));
    }

    // Configure each analyzer instance with thread allocation
    for (let i = 0; i < numInstances; i++) {
      analyzers[i].modifyStockfishSettings({
        numThreads: threadsPerInstance,
      });
    }

    // Initialize queue and instance busy states
    queueRef.current = [...allFens]; // Copy all FENs into the queue
    instanceBusyRef.current = new Array(numInstances).fill(false);

    // Set up state for new analysis
    setTotalPositions(allFens.length);
    setCompletedPositions(0);
    setPgnEvaluations({});
    isAnalyzingRef.current = true;
    setStatus(AnalysisStatus.Analyzing);
  }, [
    generateFensFromPgn,
    defaultDepth,
    defaultNumLines,
    cancel,
    numInstances,
    availableThreads,
    analyzers,
  ]);

  // Process positions using queue-based work distribution
  useEffect(() => {
    if (!isAnalyzingRef.current) return;
    if (status !== AnalysisStatus.Analyzing) return;

    const options = currentOptionsRef.current;
    if (!options) return;

    // Check if all work is complete (queue empty and all instances idle)
    const allInstancesIdle = instanceBusyRef.current.every((busy) => !busy);
    if (queueRef.current.length === 0 && allInstancesIdle) {
      // Analysis complete
      isAnalyzingRef.current = false;
      setStatus(AnalysisStatus.Complete);
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
      if (nextFen in evaluations && evaluations[nextFen].depth >= options.depth) {
        // Use existing evaluation
        setPgnEvaluations((prev) => ({ ...prev, [nextFen]: evaluations[nextFen] }));
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
          // Add to both evaluations stores
          setEvaluations((evs) => ({ ...evs, [nextFen]: evaluation }));
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
  }, [status, completedPositions, numInstances, analyzers, evaluations, setEvaluations]);

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
  };
}
