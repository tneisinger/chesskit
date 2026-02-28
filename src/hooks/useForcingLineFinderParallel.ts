import { useEffect, useState, useCallback, useRef } from 'react';
import useFenAnalyzer, { StockfishSettings, AnalyzeInterruptedError } from '@/hooks/useFenAnalyzer';
import { Evaluations, PositionEvaluation } from "@/types/chess";
import { ShortMove } from '@/types/chess';
import { getThreadCount } from '@/utils/stockfishDetector';
import {
  convertLanLineToFens,
  convertLanLineToShortMoves,
  doesOnlyOneGoodMoveExist,
  lanToShortMove
} from '@/utils/chess';

const MAX_INSTANCES = 8;

export enum AnalyzerStatus {
  Uninitialized = 'Uninitialized',
  Idle = 'Idle',
  Analyzing = 'Analyzing',
}

export interface FindForcingLineOptions {
  minDepth: number;
  maxLineLength: number;
  maxSecondsPerPosition?: number;
}

export interface Output {
  findForcingLine: (pev: PositionEvaluation, options: FindForcingLineOptions) => Promise<ShortMove[]>;
  forcingMoves: ShortMove[];
  status: AnalyzerStatus;
  setupWorkers: () => Promise<void>;
  terminateWorkers: () => void;
  cancel: () => void;
}

interface FenWithIndex {
  fen: string;
  index: number;
}

export default function useForcingLineFinderParallel(
  numInstances: number,
  evaluations: Evaluations,
  setEvaluations: React.Dispatch<React.SetStateAction<Evaluations>>,
  stockfishSettings?: StockfishSettings,
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

  const availableThreads = getThreadCount();

  useEffect(() => {
    if (availableThreads != null && numInstances > availableThreads) {
      console.warn(
        `Requested ${numInstances} analyzer instances but only ${availableThreads} threads are available. ` +
        `This may cause performance degradation.`
      );
    }
  }, [numInstances, availableThreads]);

  const [status, setStatus] = useState<AnalyzerStatus>(AnalyzerStatus.Uninitialized);
  const [forcingMoves, setForcingMoves] = useState<ShortMove[]>([]);
  const [localEvaluations, setLocalEvaluations] = useState<{index: number, pev: PositionEvaluation}[]>([]);

  // Queue-based work distribution
  const queueRef = useRef<FenWithIndex[]>([]);
  const instanceBusyRef = useRef<boolean[]>([]);
  const isAnalyzingRef = useRef(false);
  const currentOptionsRef = useRef<Required<FindForcingLineOptions> | null>(null);
  const originalPevRef = useRef<PositionEvaluation | null>(null);
  const workersSetupRef = useRef(false);

  // Promise resolution/rejection for current analysis
  const findForcingLinePromiseRef = useRef<{
    resolve: (value: ShortMove[]) => void;
    reject: (reason: any) => void;
  } | null>(null);


  // This ref is used to indicate that we're in the process of terminating workers,
  // so we can ignore expected errors from that process
  const isTerminatingWorkersRef = useRef(false);


  const generateFens = useCallback((pev: PositionEvaluation, maxLineLength: number): FenWithIndex[] => {
    if (pev.lines.length < 1) throw new Error('PositionEvaluation must have at least one line to generate FENs from');
    const allFens = convertLanLineToFens(pev.lines[0].lanLine, pev.fen);
    const allObjects = allFens.map((fen, index) => ({ fen, index }));

    // Only return objects with odd indices (analyzing positions after moves 2, 4, 6, ...)
    // Limit to indices that won't exceed maxLineLength when we add one move beyond
    const maxIndexToAnalyze = maxLineLength - 2;
    return allObjects.filter(({ index }) => index % 2 === 1 && index <= maxIndexToAnalyze);
  }, []);

  // Build ShortMove[] from the original pev and list of forcing indices
  // Returns moves from index 0 up to lastForcingIndex + 1 (one move beyond the last forcing position)
  const buildShortMovesFromIndices = useCallback((pev: PositionEvaluation, forcingIndices: number[]): ShortMove[] => {
    if (forcingIndices.length === 0) return [];

    const lastForcingIndex = forcingIndices[forcingIndices.length - 1];
    const lanLine = pev.lines[0].lanLine;
    const lanMoves = lanLine.trim().split(' ').filter(m => m.trim() !== '');

    // Return moves from start up to one move beyond the last forcing position
    // Clamp to available moves
    const endIndex = Math.min(lastForcingIndex + 2, lanMoves.length);
    const movesToInclude = lanMoves.slice(0, endIndex);

    return convertLanLineToShortMoves(movesToInclude, pev.fen);
  }, []);

  const setupWorkers = useCallback(async () => {
    // Set up only the number of instances we're actually using
    const promises = [];
    for (let i = 0; i < numInstances; i++) {
      promises.push(analyzers[i].setupWorker());
    }
    await Promise.all(promises);
    workersSetupRef.current = true;
    isTerminatingWorkersRef.current = false;
    setStatus(AnalyzerStatus.Idle);
  }, [numInstances, analyzers]);

  const terminateWorkers = useCallback(() => {
    isTerminatingWorkersRef.current = true;
    // Terminate all analyzer instances
    for (let i = 0; i < MAX_INSTANCES; i++) {
      try {
        analyzers[i].terminateWorker();
      } catch (error) {
        if (error instanceof AnalyzeInterruptedError) {
          // This error is expected when terminating workers during analysis, so we can ignore it
          console.log(`Worker ${i} terminated during analysis - this is expected.`);
        } else {
          console.error(`Error terminating worker ${i}:`, error);
        }
      }
    }

    if (findForcingLinePromiseRef.current) {
      findForcingLinePromiseRef.current.reject(
        new Error('Workers terminated during analysis')
      );
      findForcingLinePromiseRef.current = null;
    }

    // reset state
    isAnalyzingRef.current = false;
    queueRef.current = [];
    instanceBusyRef.current = [];
    workersSetupRef.current = false;
    setStatus(AnalyzerStatus.Uninitialized);
    currentOptionsRef.current = null;
    originalPevRef.current = null;
    setLocalEvaluations([]);
    setForcingMoves([]);
    // Don't reset isTerminatingWorkersRef here - keep it true until workers are set up again
    // This prevents race conditions where analyze promises reject after terminateWorkers completes
  }, [analyzers]);

  const cancel = useCallback(() => {
    if (!isAnalyzingRef.current) return;

    // Stop all active analyzers
    for (let i = 0; i < numInstances; i++) {
      if (instanceBusyRef.current[i]) {
        analyzers[i].stop();
      }
    }

    if (findForcingLinePromiseRef.current) {
      findForcingLinePromiseRef.current.reject(new Error('Analysis cancelled'));
      findForcingLinePromiseRef.current = null;
    }

    isAnalyzingRef.current = false;
    queueRef.current = [];
    instanceBusyRef.current = [];
    setStatus(AnalyzerStatus.Idle);
    currentOptionsRef.current = null;
    originalPevRef.current = null;
    setLocalEvaluations([]);
  }, [numInstances, analyzers]);

  const findForcingLine = useCallback((pev: PositionEvaluation, partialOptions: FindForcingLineOptions): Promise<ShortMove[]> => {
    // Check if workers have been set up
    if (!workersSetupRef.current) {
      throw new Error('Workers are not initialized. Call setupWorkers() first.');
    }

    // Check if the input pev has only one good move - if not, return empty array
    if (!doesOnlyOneGoodMoveExist(pev)) {
      return Promise.resolve([]);
    }

    // Set up default options
    const defaultOptions: Required<FindForcingLineOptions> = {
      minDepth: 18,
      maxLineLength: 12,
      maxSecondsPerPosition: 10 * 60,
    };

    const options: Required<FindForcingLineOptions> = { ...defaultOptions, ...partialOptions };
    currentOptionsRef.current = options;

    // Store the original pev
    originalPevRef.current = pev;

    // Generate the fens that we will analyze
    const fens = generateFens(pev, options.maxLineLength);

    if (fens.length === 0) {
      console.error('No positions to analyze');
      return Promise.resolve([]);
    }

    // Cancel any ongoing analysis
    if (isAnalyzingRef.current) {
      cancel();
    }

    // Initialize queue and instance busy states
    queueRef.current = [...fens]; // Copy all FENs into the queue
    instanceBusyRef.current = new Array(numInstances).fill(false);

    const promise = new Promise<ShortMove[]>((resolve, reject) => {
      // Check if already analyzing
      if (isAnalyzingRef.current) {
        reject(new Error(`Already analyzing`));
        return;
      }

      // Set up state for new analysis
      isAnalyzingRef.current = true;
      setLocalEvaluations([]);
      setForcingMoves([]);
      setStatus(AnalyzerStatus.Analyzing);
      findForcingLinePromiseRef.current = { resolve, reject };
    });

    return promise;
  }, [analyzers, numInstances, cancel, generateFens]);


  // Helper function to find contiguous forcing indices
  const findForcingIndices = useCallback((evaluations: {index: number, pev: PositionEvaluation}[]): number[] => {
    const sortedEvals = [...evaluations].sort((a, b) => a.index - b.index);
    const forcingIndices: number[] = [];

    for (const { index, pev } of sortedEvals) {
      // Must be contiguous odd indices (1, 3, 5, 7, ...)
      if (index !== forcingIndices.length * 2 + 1) break;

      // Must have only one good move
      if (!doesOnlyOneGoodMoveExist(pev)) break;

      forcingIndices.push(index);
    }

    return forcingIndices;
  }, []);

  // Process positions using queue-based work distribution
  useEffect(() => {
    if (!isAnalyzingRef.current) return;
    if (status !== AnalyzerStatus.Analyzing) return;

    const options = currentOptionsRef.current;
    if (!options) return;

    // Check if all work is complete (queue empty and all instances idle)
    const allInstancesIdle = instanceBusyRef.current.every((busy) => !busy);
    if (queueRef.current.length === 0 && allInstancesIdle) {
      // Analysis complete - resolve with whatever forcing line we found
      const originalPev = originalPevRef.current;
      if (originalPev && findForcingLinePromiseRef.current) {
        const forcingIndices = findForcingIndices(localEvaluations);
        const shortMoves = buildShortMovesFromIndices(originalPev, forcingIndices);

        // If we didn't find any forcing moves but the original position has only one good move, return just that move
        if (shortMoves.length < 1 && doesOnlyOneGoodMoveExist(originalPev)) {
          const firstMoveLan = originalPev.lines[0].lanLine.trim().split(' ')[0];
          const result = [lanToShortMove(firstMoveLan)];
          setForcingMoves(result);
          findForcingLinePromiseRef.current.resolve(result);
          findForcingLinePromiseRef.current = null;
          return;
        }

        setForcingMoves(shortMoves);
        findForcingLinePromiseRef.current.resolve(shortMoves);
        findForcingLinePromiseRef.current = null;
      }

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
      const { fen: nextFen, index } = queueRef.current.shift()!;

      // Check if we already have this evaluation at the required depth
      if (nextFen in evaluations && evaluations[nextFen].depth >= options.minDepth) {
        // Use existing evaluation
        setLocalEvaluations((prev) => [...prev, { index, pev: evaluations[nextFen]}]);
        // Don't mark as busy, just continue to next iteration
        continue;
      }

      // Mark instance as busy
      instanceBusyRef.current[i] = true;

      // Prepare analysis options
      const analyzeOptions: any = {
        maxDepth: options.minDepth,
        numLines: 2,
      };

      if (options.maxSecondsPerPosition > 0) {
        analyzeOptions.maxSeconds = options.maxSecondsPerPosition;
      }

      // Start analysis
      analyzers[i]
        .analyze(nextFen, analyzeOptions)
        .then((evaluation) => {
          // Add to evaluations
          setEvaluations((evs) => ({ ...evs, [nextFen]: evaluation }));
          setLocalEvaluations((prev) => [...prev, { index, pev: evaluation }]);

          // Mark instance as not busy
          instanceBusyRef.current[i] = false;
        })
        .catch((error) => {
          if (isTerminatingWorkersRef.current && error instanceof AnalyzeInterruptedError) {
            return // Expected error when terminating workers during analysis, so we can ignore it
          }

          console.error(`Error analyzing position (instance ${i}):`, error);
          // Mark instance as not busy even on error
          instanceBusyRef.current[i] = false;
        });
    }
  }, [status, localEvaluations, numInstances, analyzers, evaluations, setEvaluations, findForcingIndices, buildShortMovesFromIndices]);

  // Check for early completion - when we have enough forcing moves or found a non-forcing move
  useEffect(() => {
    if (!isAnalyzingRef.current) return;
    if (localEvaluations.length < 1) return;

    const options = currentOptionsRef.current;
    const originalPev = originalPevRef.current;
    if (!options || !originalPev) return;

    const sortedEvals = [...localEvaluations].sort((a, b) => a.index - b.index);
    const forcingIndices = findForcingIndices(localEvaluations);

    // Calculate the forcing line length (number of moves we would return)
    // We return moves from 0 to lastForcingIndex + 1, so length is lastForcingIndex + 2
    const forcingLineLength = forcingIndices.length > 0 ? forcingIndices[forcingIndices.length - 1] + 2 : 0;

    // Check if we should complete early
    const hasEnoughMoves = forcingLineLength >= options.maxLineLength;
    const foundNonForcingMove =
      sortedEvals.length > forcingIndices.length &&
      sortedEvals[forcingIndices.length].index === forcingIndices.length * 2 + 1;

    if (hasEnoughMoves || foundNonForcingMove) {
      // Stop all active analyzers immediately
      for (let i = 0; i < numInstances; i++) {
        if (instanceBusyRef.current[i]) {
          analyzers[i].stop();
        }
      }

      // Build the result
      const shortMoves = buildShortMovesFromIndices(originalPev, forcingIndices);

      // Update state
      setForcingMoves(shortMoves);
      setStatus(AnalyzerStatus.Idle);

      // Resolve promise
      if (findForcingLinePromiseRef.current) {
        findForcingLinePromiseRef.current.resolve(shortMoves);
        findForcingLinePromiseRef.current = null;
      }

      // Clean up
      isAnalyzingRef.current = false;
      queueRef.current = [];
      instanceBusyRef.current = [];
    }
  }, [localEvaluations, numInstances, analyzers, findForcingIndices, buildShortMovesFromIndices]);

  return {
    findForcingLine,
    forcingMoves,
    status,
    setupWorkers,
    terminateWorkers,
    cancel,
  };
}
