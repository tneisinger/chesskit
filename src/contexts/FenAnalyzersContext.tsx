'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { PositionEvaluation, Evaluations } from '@/types/chess';
import useFenAnalyzer, { AnalyzeOptions, AnalyzeInterruptedError } from '@/hooks/useFenAnalyzer';
import { AnalyzerStatus } from '@/types/analyzer';
import { useBookPositions } from '@/contexts/BookPositionsContext';

const NUM_INSTANCES = 8;

interface QueueItem {
  fen: string;
  options?: AnalyzeOptions;
  resolve: (value: PositionEvaluation) => void;
  reject: (reason: any) => void;
  cancelled: boolean;
}

interface FenAnalyzersContextType {
  analyze: (fen: string, options?: AnalyzeOptions) => Promise<PositionEvaluation>;
  stop: () => Promise<void>;
  newGame: () => Promise<void>;
  setupWorkers: () => Promise<void>;
  evaluations: Evaluations;
  setEvaluations: React.Dispatch<React.SetStateAction<Evaluations>>;
  latestEvaluations: Evaluations;
  engineName: string | null;
  availableThreads: number | null;
  status: AnalyzerStatus;
}

const FenAnalyzersContext = createContext<FenAnalyzersContextType | undefined>(undefined);

interface FenAnalyzersProviderProps {
  children: ReactNode;
}

export function FenAnalyzersProvider({ children }: FenAnalyzersProviderProps) {
  const { bookPositions } = useBookPositions();

  const [evaluations, setEvaluations] = useState<Evaluations>({});
  const [latestEvaluations, setLatestEvaluations] = useState<Evaluations>({});
  const [status, setStatus] = useState<AnalyzerStatus>(AnalyzerStatus.Uninitialized);

  const settings = {
    numThreads: 1,
    hashSize: 128,
    initializeImmediately: false,
    evaluations,
    setEvaluations,
    bookPositions,
  };

  // Create 8 useFenAnalyzer instances (unconditional for Rules of Hooks)
  const analyzers = [
    useFenAnalyzer({ ...settings, id: 'ctx-1' }),
    useFenAnalyzer({ ...settings, id: 'ctx-2' }),
    useFenAnalyzer({ ...settings, id: 'ctx-3' }),
    useFenAnalyzer({ ...settings, id: 'ctx-4' }),
    useFenAnalyzer({ ...settings, id: 'ctx-5' }),
    useFenAnalyzer({ ...settings, id: 'ctx-6' }),
    useFenAnalyzer({ ...settings, id: 'ctx-7' }),
    useFenAnalyzer({ ...settings, id: 'ctx-8' }),
  ];

  const queueRef = useRef<QueueItem[]>([]);
  const instanceBusyRef = useRef<boolean[]>(new Array(NUM_INSTANCES).fill(false));
  const activeItemsRef = useRef<(QueueItem | null)[]>(new Array(NUM_INSTANCES).fill(null));
  const workersSetupRef = useRef(false);
  // Ref to analyzers so processQueue can access them without stale closures
  const analyzersRef = useRef(analyzers);
  analyzersRef.current = analyzers;

  const processQueue = useCallback(() => {
    const analyzersCurrent = analyzersRef.current;

    for (let i = 0; i < NUM_INSTANCES; i++) {
      if (instanceBusyRef.current[i]) continue;
      if (queueRef.current.length === 0) break;

      // Find next non-cancelled item
      let item: QueueItem | undefined;
      while (queueRef.current.length > 0) {
        const candidate = queueRef.current.shift()!;
        if (!candidate.cancelled) {
          item = candidate;
          break;
        }
      }
      if (!item) break;

      instanceBusyRef.current[i] = true;
      activeItemsRef.current[i] = item;

      const currentItem = item;

      analyzersCurrent[i]
        .analyze(currentItem.fen, currentItem.options)
        .then((evaluation) => {
          instanceBusyRef.current[i] = false;
          activeItemsRef.current[i] = null;
          if (!currentItem.cancelled) {
            currentItem.resolve(evaluation);
          }
          processQueue();
        })
        .catch((error) => {
          instanceBusyRef.current[i] = false;
          activeItemsRef.current[i] = null;
          if (!currentItem.cancelled) {
            currentItem.reject(error);
          }
          processQueue();
        });
    }

    // Update status based on queue and busy states
    const anyBusy = instanceBusyRef.current.some(b => b);
    const hasQueue = queueRef.current.some(item => !item.cancelled);
    if (anyBusy || hasQueue) {
      setStatus(AnalyzerStatus.Analyzing);
    } else if (workersSetupRef.current) {
      setStatus(AnalyzerStatus.Idle);
    }
  }, []);

  const analyze = useCallback((fen: string, options?: AnalyzeOptions): Promise<PositionEvaluation> => {
    return new Promise((resolve, reject) => {
      const item: QueueItem = { fen, options, resolve, reject, cancelled: false };
      queueRef.current.push(item);
      processQueue();
    });
  }, [processQueue]);

  const stop = useCallback(async (): Promise<void> => {
    // Reject all queued items
    const pendingItems = [...queueRef.current];
    queueRef.current = [];
    for (const item of pendingItems) {
      if (!item.cancelled) {
        item.cancelled = true;
        item.reject(new AnalyzeInterruptedError('Analysis stopped'));
      }
    }

    // Cancel and reject active items, then stop their analyzers
    const stopPromises: Promise<void>[] = [];
    for (let i = 0; i < NUM_INSTANCES; i++) {
      const activeItem = activeItemsRef.current[i];
      if (activeItem && !activeItem.cancelled) {
        activeItem.cancelled = true;
        activeItem.reject(new AnalyzeInterruptedError('Analysis stopped'));
      }
      if (instanceBusyRef.current[i]) {
        stopPromises.push(
          analyzersRef.current[i].stop().catch(() => {})
        );
      }
    }

    await Promise.all(stopPromises);

    // Reset busy states
    instanceBusyRef.current = new Array(NUM_INSTANCES).fill(false);
    activeItemsRef.current = new Array(NUM_INSTANCES).fill(null);

    if (workersSetupRef.current) {
      setStatus(AnalyzerStatus.Idle);
    }
  }, []);

  const newGame = useCallback(async (): Promise<void> => {
    await stop();
    const promises = analyzersRef.current.map(a => a.newGame().catch(() => {}));
    await Promise.all(promises);
  }, [stop]);

  const setupWorkers = useCallback(async (): Promise<void> => {
    if (workersSetupRef.current) return;
    setStatus(AnalyzerStatus.Initializing);
    const promises = analyzersRef.current.map(a => a.setupWorker());
    await Promise.all(promises);
    workersSetupRef.current = true;
    setStatus(AnalyzerStatus.Idle);
  }, []);

  // Update latestEvaluations whenever any analyzer's latestEvaluation changes
  useEffect(() => {
    setLatestEvaluations(prev => {
      const updated = { ...prev };
      let changed = false;

      for (let i = 0; i < NUM_INSTANCES; i++) {
        const latestEval = analyzers[i].latestEvaluation;
        if (latestEval && latestEval.fen) {
          const existing = updated[latestEval.fen];
          if (!existing || latestEval.depth >= existing.depth) {
            updated[latestEval.fen] = latestEval;
            changed = true;
          }
        }
      }

      return changed ? updated : prev;
    });
  }, [
    analyzers[0].latestEvaluation,
    analyzers[1].latestEvaluation,
    analyzers[2].latestEvaluation,
    analyzers[3].latestEvaluation,
    analyzers[4].latestEvaluation,
    analyzers[5].latestEvaluation,
    analyzers[6].latestEvaluation,
    analyzers[7].latestEvaluation,
  ]);

  const engineName = analyzers[0].engineName;
  const availableThreads = analyzers[0].availableThreads;

  const value: FenAnalyzersContextType = {
    analyze,
    stop,
    newGame,
    setupWorkers,
    evaluations,
    setEvaluations,
    latestEvaluations,
    engineName,
    availableThreads,
    status,
  };

  return (
    <FenAnalyzersContext.Provider value={value}>
      {children}
    </FenAnalyzersContext.Provider>
  );
}

export function useFenAnalyzers(): FenAnalyzersContextType {
  const context = useContext(FenAnalyzersContext);
  if (context === undefined) {
    throw new Error('useFenAnalyzers must be used within a FenAnalyzersProvider');
  }
  return context;
}
