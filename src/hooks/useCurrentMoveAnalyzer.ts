import { useState, useEffect, useCallback, useRef } from 'react';
import { Evaluations, PositionEvaluation } from '@/types/chess';
import { Move } from 'cm-chess/src/Chess';
import useFenAnalyzer, { StockfishSettings, AnalyzeInterruptedError } from '@/hooks/useFenAnalyzer';
import { getFen } from '@/utils/chess';
import usePrevious from '@/hooks/usePrevious';
import { areCmMovesEqual } from '@/utils/cmchess';

const MAX_INSTANCES = 8;

export enum AnalyzerStatus {
  Uninitialized = 'Uninitialized',
  Initializing = 'Initializing',
  Idle = 'Idle',
  Analyzing = 'Analyzing',
}

export interface UseCurrentMoveAnalyzerOptions {
  depth?: number;
  numLines?: number;
}

export interface Output {
  setupWorkers: () => Promise<void>;
  terminateWorkers: () => Promise<void>;
  status: AnalyzerStatus;
  isOn: boolean;
  setIsOn: (value: boolean) => void;
  latestEvaluations: Evaluations;
  engineName: string | null;
  depth: number;
  numLines: number;
}

interface InstanceInfo {
  isBusy: boolean;
  currentFen: string | null;
  startTime: number | null;
}

export default function useCurrentMoveAnalyzer(
  numInstances: number,
  evaluations: Evaluations,
  setEvaluations: React.Dispatch<React.SetStateAction<Evaluations>>,
  currentMove: Move | undefined,
  stockfishSettings?: StockfishSettings,
  options?: UseCurrentMoveAnalyzerOptions
): Output {
  if (numInstances < 1) throw new Error('numInstances must be at least 1');
  if (numInstances > MAX_INSTANCES) throw new Error(`numInstances cannot exceed ${MAX_INSTANCES}`);

  const depth = options?.depth ?? 20;
  const numLines = options?.numLines ?? 2;

  // Create maximum number of analyzer instances (must be unconditional for Rules of Hooks)
  const analyzers = [
    useFenAnalyzer({...stockfishSettings, id: 'cma-1', initializeImmediately: false}),
    useFenAnalyzer({...stockfishSettings, id: 'cma-2', initializeImmediately: false}),
    useFenAnalyzer({...stockfishSettings, id: 'cma-3', initializeImmediately: false}),
    useFenAnalyzer({...stockfishSettings, id: 'cma-4', initializeImmediately: false}),
    useFenAnalyzer({...stockfishSettings, id: 'cma-5', initializeImmediately: false}),
    useFenAnalyzer({...stockfishSettings, id: 'cma-6', initializeImmediately: false}),
    useFenAnalyzer({...stockfishSettings, id: 'cma-7', initializeImmediately: false}),
    useFenAnalyzer({...stockfishSettings, id: 'cma-8', initializeImmediately: false}),
  ];

  const [isOn, setIsOn] = useState(false);
  const [status, setStatus] = useState<AnalyzerStatus>(AnalyzerStatus.Uninitialized);
  const [latestEvaluations, setLatestEvaluations] = useState<Evaluations>({});
  const [engineName, setEngineName] = useState<string | null>(null);

  const workersSetupRef = useRef(false);
  const instanceInfoRef = useRef<InstanceInfo[]>(
    Array(MAX_INSTANCES).fill(null).map(() => ({
      isBusy: false,
      currentFen: null,
      startTime: null,
    }))
  );
  const currentMoveAnalysisRef = useRef<{fen: string, instanceIndex: number} | null>(null);

  const prevIsOn = usePrevious(isOn);
  const previousMove = usePrevious(currentMove);

  const doWeAlreadyHaveEvaluation = useCallback((fen: string): boolean => {
    const fenEval = evaluations[fen];
    if (fenEval && fenEval.depth >= depth) return true;
    return false;
  }, [evaluations, depth]);

  const setupWorkers = useCallback(async () => {
    setStatus(AnalyzerStatus.Initializing);
    // Set up only the number of instances we're actually using
    const promises = [];
    for (let i = 0; i < numInstances; i++) {
      promises.push(analyzers[i].setupWorker());
    }
    await Promise.all(promises);
    workersSetupRef.current = true;
  }, [numInstances, analyzers]);

  const terminateWorkers = useCallback(async () => {
    // Terminate all analyzer instances
    for (let i = 0; i < MAX_INSTANCES; i++) {
      try {
        analyzers[i].terminateWorker();
      } catch (error) {
        if (error instanceof AnalyzeInterruptedError) {
          console.log(`Worker ${i} terminated during analysis - this is expected.`);
        } else {
          console.error(`Error terminating worker ${i}:`, error);
        }
      }
    }

    // Reset state
    workersSetupRef.current = false;
    instanceInfoRef.current = instanceInfoRef.current.map(() => ({
      isBusy: false,
      currentFen: null,
      startTime: null,
    }));
    currentMoveAnalysisRef.current = null;
    setStatus(AnalyzerStatus.Uninitialized);
    setLatestEvaluations({});
    setEngineName(null);
  }, [analyzers]);

  const findFreeOrLongestRunningInstance = useCallback((): number => {
    // Find a free instance first
    for (let i = 0; i < numInstances; i++) {
      if (!instanceInfoRef.current[i].isBusy) return i;
    }

    // All busy, find longest running
    let longestIndex = 0;
    let longestTime = 0;
    for (let i = 0; i < numInstances; i++) {
      const startTime = instanceInfoRef.current[i].startTime;
      if (startTime) {
        const elapsed = Date.now() - startTime;
        if (elapsed > longestTime) {
          longestTime = elapsed;
          longestIndex = i;
        }
      }
    }
    return longestIndex;
  }, [numInstances]);

  const analyzeCurrentMove = useCallback(async () => {
    if (!currentMove) {
      currentMoveAnalysisRef.current = null;
      setStatus(AnalyzerStatus.Idle);
      return;
    }

    if (!workersSetupRef.current) {
      console.error('Workers not set up. Call setupWorkers() first.');
      return;
    }

    const fen = getFen(currentMove);

    // Check if we already have evaluation at required depth
    if (doWeAlreadyHaveEvaluation(fen)) {
      currentMoveAnalysisRef.current = null;
      setStatus(AnalyzerStatus.Idle);
      return;
    }

    // Check if we're already analyzing this exact FEN
    if (currentMoveAnalysisRef.current?.fen === fen) {
      return;
    }

    // Check if ANY instance is currently analyzing this FEN
    const existingInstanceIndex = instanceInfoRef.current
      .slice(0, numInstances)
      .findIndex(info => info.isBusy && info.currentFen === fen);

    if (existingInstanceIndex !== -1) {
      // This FEN is already being analyzed - just update our reference to track it
      currentMoveAnalysisRef.current = { fen, instanceIndex: existingInstanceIndex };
      setStatus(AnalyzerStatus.Analyzing);
      return;
    }

    // Find which instance to use
    let instanceIndex: number;

    // First, check if we were analyzing a previous position
    if (currentMoveAnalysisRef.current) {
      const prevInstanceIndex = currentMoveAnalysisRef.current.instanceIndex;

      // If that instance is still busy, reuse it (stop and reassign)
      if (instanceInfoRef.current[prevInstanceIndex].isBusy) {
        instanceIndex = prevInstanceIndex;
      } else {
        // Otherwise, find a free or longest-running instance
        instanceIndex = findFreeOrLongestRunningInstance();
      }
    } else {
      instanceIndex = findFreeOrLongestRunningInstance();
    }

    // Stop if busy
    if (instanceInfoRef.current[instanceIndex].isBusy) {
      try {
        await analyzers[instanceIndex].stop();
      } catch (error) {
        console.error('Error stopping analyzer:', error);
      }
    }

    // Update ref to mark as busy
    instanceInfoRef.current[instanceIndex] = {
      isBusy: true,
      currentFen: fen,
      startTime: Date.now(),
    };

    currentMoveAnalysisRef.current = { fen, instanceIndex };
    setStatus(AnalyzerStatus.Analyzing);

    // Analyze
    try {
      const evaluation = await analyzers[instanceIndex].analyze(fen, {
        maxDepth: depth,
        numLines: numLines,
      });

      // Add to evaluations store (latestEvaluations is updated via useEffect watching latestEvaluation)
      setEvaluations((evs) => ({ ...evs, [fen]: evaluation }));

      // Mark as free
      instanceInfoRef.current[instanceIndex] = {
        isBusy: false,
        currentFen: null,
        startTime: null,
      };

      // Update status if this was the current move analysis
      if (currentMoveAnalysisRef.current?.fen === fen) {
        currentMoveAnalysisRef.current = null;

        // Check if any other instances are still busy
        const anyBusy = instanceInfoRef.current.slice(0, numInstances).some(info => info.isBusy);
        if (!anyBusy) {
          setStatus(AnalyzerStatus.Idle);
        }
      }
    } catch (error: any) {
      console.error('Error analyzing current move:', error);

      // Mark as free
      instanceInfoRef.current[instanceIndex] = {
        isBusy: false,
        currentFen: null,
        startTime: null,
      };

      // Update status if this was the current move analysis
      if (currentMoveAnalysisRef.current?.fen === fen) {
        currentMoveAnalysisRef.current = null;

        // Check if any other instances are still busy
        const anyBusy = instanceInfoRef.current.slice(0, numInstances).some(info => info.isBusy);
        if (!anyBusy) {
          setStatus(AnalyzerStatus.Idle);
        }
      }
    }
  }, [currentMove, depth, numLines, analyzers, findFreeOrLongestRunningInstance, doWeAlreadyHaveEvaluation, setEvaluations, numInstances]);

  // Update latestEvaluations whenever any analyzer's latestEvaluation changes
  useEffect(() => {
    if (!isOn) return;

    setLatestEvaluations(prev => {
      const updated = { ...prev };

      for (let i = 0; i < numInstances; i++) {
        const latestEval = analyzers[i].latestEvaluation;
        if (latestEval && latestEval.fen) {
          // Only update if this evaluation is newer/deeper than what we have
          const existing = updated[latestEval.fen];
          if (!existing || latestEval.depth >= existing.depth) {
            updated[latestEval.fen] = latestEval;
          }
        }
      }

      return updated;
    });
  }, [
    isOn,
    numInstances,
    analyzers[0].latestEvaluation,
    analyzers[1].latestEvaluation,
    analyzers[2].latestEvaluation,
    analyzers[3].latestEvaluation,
    analyzers[4].latestEvaluation,
    analyzers[5].latestEvaluation,
    analyzers[6].latestEvaluation,
    analyzers[7].latestEvaluation,
  ]);

  // When isOn changes to false, stop all analysis
  useEffect(() => {
    if (prevIsOn && !isOn) {
      // Stop all instances
      for (let i = 0; i < numInstances; i++) {
        if (instanceInfoRef.current[i].isBusy) {
          analyzers[i].stop().catch(error => {
            console.error(`Error stopping analyzer ${i}:`, error);
          });
          instanceInfoRef.current[i] = {
            isBusy: false,
            currentFen: null,
            startTime: null,
          };
        }
      }
      currentMoveAnalysisRef.current = null;
      setLatestEvaluations({});
      setStatus(AnalyzerStatus.Idle);
    }
  }, [isOn, prevIsOn, numInstances, analyzers]);

  // When isOn is true and currentMove changes, analyze
  useEffect(() => {
    // If isOn has changed from false to true, analyze
    if (isOn && prevIsOn === false) {
      analyzeCurrentMove();
      return;
    }

    // If currentMove hasn't actually changed, do nothing
    if (areCmMovesEqual(currentMove, previousMove)) return;

    if (isOn) {
      analyzeCurrentMove();
    } else {
      currentMoveAnalysisRef.current = null;
    }
  }, [isOn, prevIsOn, currentMove, previousMove, analyzeCurrentMove]);


  // Set the engineName based on the first analyzer that reports an engineName.
  // This assumes all analyzers are the same engine, which should be true in our use case.
  // Also, if we're initializing and get an engineName, switch to Idle since we're ready to analyze.
  useEffect(() => {
    if (!engineName && analyzers[0].engineName) {
      setEngineName(analyzers[0].engineName);
      if (status === AnalyzerStatus.Initializing) {
        setStatus(AnalyzerStatus.Idle);
      }
    }
  }, [engineName, analyzers[0].engineName, status]);


  return {
    setupWorkers,
    terminateWorkers,
    status,
    isOn,
    setIsOn,
    latestEvaluations,
    engineName,
    depth,
    numLines,
  };
}
