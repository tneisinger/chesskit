import { useState, useEffect, useCallback, useRef } from 'react';
import { Evaluations } from '@/types/chess';
import { Output as FenAnalyzerOutput } from '@/hooks/useFenAnalyzer';
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

export default function usePgnAnalyzer(
  evaluations: Evaluations,
  setEvaluations: React.Dispatch<React.SetStateAction<Evaluations>>,
  fenAnalyzer: FenAnalyzerOutput,
  defaultDepth: number = 20,
  defaultNumLines: number = 2
): Output {
  const [fensToAnalyze, setFensToAnalyze] = useState<string[]>([]);
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);
  const [status, setStatus] = useState(AnalysisStatus.NotStarted);
  const [pgnEvaluations, setPgnEvaluations] = useState<Evaluations>({});

  const isAnalyzingRef = useRef(false);
  const currentOptionsRef = useRef<Required<AnalyzePgnOptions> | null>(null);
  const currentlyAnalyzingFenRef = useRef<string | null>(null);

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

  const cancel = useCallback(() => {
    if (!isAnalyzingRef.current) return;

    fenAnalyzer.stop();
    isAnalyzingRef.current = false;
    currentlyAnalyzingFenRef.current = null;
    setStatus(AnalysisStatus.NotStarted);
    setFensToAnalyze([]);
    setCurrentPositionIndex(0);
    currentOptionsRef.current = null;
  }, [fenAnalyzer]);

  const analyzePgn = useCallback((pgn: string, partialOptions?: AnalyzePgnOptions) => {
    // Set up default options
    const defaultOptions: Required<AnalyzePgnOptions> = {
      analyzeVariations: true,
      depth: defaultDepth,
      numLines: defaultNumLines,
      maxSecondsPerPosition: 0,
    };

    const options: Required<AnalyzePgnOptions> = { ...defaultOptions, ...partialOptions };
    currentOptionsRef.current = options;

    // Generate FENs from PGN
    const fens = generateFensFromPgn(pgn, options.analyzeVariations);

    if (fens.length === 0) {
      console.error('No positions to analyze');
      return;
    }

    // Cancel any ongoing analysis
    if (isAnalyzingRef.current) {
      cancel();
    }

    // Set up state for new analysis
    setFensToAnalyze(fens);
    setCurrentPositionIndex(0);
    setPgnEvaluations({});
    currentlyAnalyzingFenRef.current = null;
    isAnalyzingRef.current = true;
    setStatus(AnalysisStatus.Analyzing);
  }, [generateFensFromPgn, defaultDepth, defaultNumLines, cancel]);

  // Process positions
  useEffect(() => {
    if (!isAnalyzingRef.current) return;
    if (status !== AnalysisStatus.Analyzing) return;
    if (currentlyAnalyzingFenRef.current !== null) return; // Already analyzing a position

    if (currentPositionIndex >= fensToAnalyze.length) {
      // Analysis complete
      isAnalyzingRef.current = false;
      setStatus(AnalysisStatus.Complete);
      return;
    }

    const options = currentOptionsRef.current;
    if (!options) return;

    const nextFen = fensToAnalyze[currentPositionIndex];

    // Check if we already have this evaluation at the required depth
    if (nextFen in evaluations && evaluations[nextFen].depth >= options.depth) {
      // Use existing evaluation
      setPgnEvaluations((prev) => ({ ...prev, [nextFen]: evaluations[nextFen] }));
      setCurrentPositionIndex((prev) => prev + 1);
      return;
    }

    // Mark as analyzing
    currentlyAnalyzingFenRef.current = nextFen;

    // Analyze this position
    const analyzeOptions: any = {
      maxDepth: options.depth,
      numLines: options.numLines,
    };

    if (options.maxSecondsPerPosition > 0) {
      analyzeOptions.maxSeconds = options.maxSecondsPerPosition;
    }

    fenAnalyzer.analyze(nextFen, analyzeOptions)
      .then((evaluation) => {
        // Add to both evaluations stores
        setEvaluations((evs) => ({ ...evs, [nextFen]: evaluation }));
        setPgnEvaluations((prev) => ({ ...prev, [nextFen]: evaluation }));

        // Clear analyzing flag
        currentlyAnalyzingFenRef.current = null;

        // Move to next position
        setCurrentPositionIndex((prev) => prev + 1);
      })
      .catch((error) => {
        console.error('Error analyzing position:', error);

        // Clear analyzing flag
        currentlyAnalyzingFenRef.current = null;

        // Move to next position even on error
        setCurrentPositionIndex((prev) => prev + 1);
      });
  }, [currentPositionIndex, fensToAnalyze, status, fenAnalyzer, evaluations, setEvaluations]);

  const progress = fensToAnalyze.length > 0
    ? Math.round((currentPositionIndex / fensToAnalyze.length) * 100)
    : 0;

  return {
    analyzePgn,
    cancel,
    status,
    progress,
    currentPosition: currentPositionIndex,
    totalPositions: fensToAnalyze.length,
    pgnEvaluations,
  };
}
