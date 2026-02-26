import { useEffect, useState, useRef, useCallback } from 'react';
import { detectStockfishFlavor, logStockfishDetection, type StockfishRecommendation } from '@/utils/stockfishDetector';

const LOGGING_ENABLED = false;

export interface UseStockfishResult {
  stockfish: Worker | undefined;
  isLoading: boolean;
  error: string | null;
  recommendation: StockfishRecommendation | null;
  setupWorker: () => void;
  terminateWorker: () => void;
}

export interface Options {
  initializeImmediately?: boolean;
}

const defaultOptions: Options = {
  initializeImmediately: true,
}

/**
 * React hook for loading and managing a Stockfish.js engine worker
 * Automatically detects and loads the best engine flavor for the user's device
 *
 * @returns {UseStockfishResult} Object containing:
 *   - stockfish: The Worker instance (undefined while loading)
 *   - isLoading: Whether the engine is being loaded
 *   - error: Error message if loading failed
 *   - recommendation: Details about the detected engine flavor
 *
 * @example
 * function MyComponent() {
 *   const { stockfish, isLoading, error, recommendation } = useStockfish();
 *
 *   if (isLoading) return <div>Loading engine...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!stockfish) return null;
 *
 *   // Use stockfish worker
 *   stockfish.postMessage('position startpos');
 * }
 */
export default function useStockfish(options: Options = defaultOptions): UseStockfishResult {
  const [stockfish, setStockfish] = useState<Worker | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<StockfishRecommendation | null>(null);

  // Trigger counter: increments to trigger worker initialization
  const [loadTrigger, setLoadTrigger] = useState(() =>
    (options.initializeImmediately ?? true) ? 1 : 0
  );

  // Use ref to avoid stale closure in cleanup function
  const stockfishRef = useRef<Worker | undefined>(undefined);

  // Setup worker function - can be called multiple times to recreate worker
  const setupWorker = useCallback(() => {
    setLoadTrigger(prev => prev + 1);
  }, []);

  // Terminate worker function
  const terminateWorker = useCallback(() => {
    if (stockfishRef.current) {
      if (LOGGING_ENABLED) console.log('Manually terminating Stockfish worker');
      stockfishRef.current.terminate();
      stockfishRef.current = undefined;
      setStockfish(undefined);
      setIsLoading(false);
      setError(null);
    }
  }, []);

  useEffect(() => {
    // Don't load if trigger is 0 (lazy initialization)
    if (loadTrigger === 0) return;

    // Don't load if already loading or worker exists
    if (isLoading || stockfishRef.current) return;

    let mounted = true;

    const loadEngine = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Detect the best engine flavor for this device
        const detected = detectStockfishFlavor();
        setRecommendation(detected);

        // Log the detection result
        if (LOGGING_ENABLED) logStockfishDetection(detected);

        // Try to load the recommended engine
        try {
          const worker = new Worker(`/stockfish18/${detected.fileName}`);

          // Set up error handler
          worker.onerror = (e) => {
            console.error('Stockfish Worker Error:', e);
            if (mounted) {
              setError(`Engine error: ${e.message}`);
            }
          };

          // Store in both state and ref
          if (mounted) {
            stockfishRef.current = worker;
            setStockfish(worker);
            setIsLoading(false);
            if (LOGGING_ENABLED) console.log(`✓ Stockfish ${detected.flavor} loaded successfully`);
          } else {
            // Component unmounted before loading completed
            worker.terminate();
          }
        } catch (loadError) {
          // If the recommended engine fails to load, try ASM-JS fallback
          console.error(`Failed to load ${detected.flavor}:`, loadError);

          if (detected.fileName !== 'stockfish-17.1-asm.js') {
            if (LOGGING_ENABLED) console.log('Attempting to load ASM-JS fallback...');

            try {
              const fallbackWorker = new Worker('/stockfish/stockfish-17.1-asm.js');

              fallbackWorker.onerror = (e) => {
                console.error('Stockfish Worker Error:', e);
                if (mounted) {
                  setError(`Engine error: ${e.message}`);
                }
              };

              if (mounted) {
                stockfishRef.current = fallbackWorker;
                setStockfish(fallbackWorker);
                setIsLoading(false);
                if (LOGGING_ENABLED) console.log('✓ Stockfish ASM-JS fallback loaded successfully');
              } else {
                fallbackWorker.terminate();
              }
            } catch (fallbackError) {
              console.error('Failed to load ASM-JS fallback:', fallbackError);
              if (mounted) {
                setError('Failed to load any Stockfish engine. Please check that the engine files are in /public/stockfish/');
                setIsLoading(false);
              }
            }
          } else {
            // Already tried ASM-JS, can't fallback further
            if (mounted) {
              setError('Failed to load Stockfish engine. Please check that the engine files are in /public/stockfish/');
              setIsLoading(false);
            }
          }
        }
      } catch (detectionError) {
        console.error('Error during Stockfish detection:', detectionError);
        if (mounted) {
          setError('Failed to detect appropriate engine');
          setIsLoading(false);
        }
      }
    };

    loadEngine();

    // Cleanup function
    return () => {
      mounted = false;

      // Terminate the worker if it exists
      // Use ref to avoid stale closure
      if (stockfishRef.current) {
        if (LOGGING_ENABLED) console.log('Terminating Stockfish worker on unmount');
        stockfishRef.current.terminate();
        stockfishRef.current = undefined;
      }
    };
  }, [loadTrigger]); // Re-run when loadTrigger changes

  return {
    stockfish,
    isLoading,
    error,
    recommendation,
    setupWorker,
    terminateWorker,
  };
}

/**
 * Simplified hook that only returns the worker (for backward compatibility)
 *
 * @deprecated Use the default useStockfish() export for better error handling
 */
export function useStockfishWorker(): Worker | undefined {
  const { stockfish } = useStockfish();
  return stockfish;
}
