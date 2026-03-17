import { useState, useCallback, useRef } from 'react';
import { Evaluations } from '@/types/chess';
import { AnalyzeInterruptedError } from '@/hooks/useFenAnalyzer';
import { parse as parsePGN } from 'pgn-parser';
import { Chess as CmChess } from 'cm-chess/src/Chess';
import { AnalyzerStatus } from '@/types/analyzer';
import { getBookPosition } from '@/utils/bookPositionsContext';
import { useFenAnalyzers } from '@/contexts/FenAnalyzersContext';

export interface AnalyzePgnOptions {
  analyzeVariations?: boolean;
  depth?: number;
  numLines?: number;
  maxSecondsPerPosition?: number;
}

export interface Output {
  analyzePgn: (pgn: string, options?: AnalyzePgnOptions) => void;
  cancel: () => void;
  status: AnalyzerStatus;
  progress: number;
  currentPosition: number;
  totalPositions: number;
  pgnEvaluations: Evaluations;
}

export default function usePgnAnalyzerParallel(
  defaultDepth: number = 20,
  defaultNumLines: number = 2
): Output {
  const context = useFenAnalyzers();

  const [status, setStatus] = useState(AnalyzerStatus.Idle);
  const [pgnEvaluations, setPgnEvaluations] = useState<Evaluations>({});
  const [totalPositions, setTotalPositions] = useState(0);
  const [completedPositions, setCompletedPositions] = useState(0);

  const isAnalyzingRef = useRef(false);

  // Generate all FENs from the PGN
  const generateFensFromPgn = useCallback((pgn: string, analyzeVariations: boolean): string[] => {
    try {
      const parsedPgn = parsePGN(pgn)[0];
      if (!parsedPgn) return [];

      const fens: string[] = [];

      const processMoves = (moves: any[], cmchess: CmChess) => {
        moves.forEach((move) => {
          try {
            cmchess.move(move.move);
            fens.push(cmchess.fen());

            if (analyzeVariations && move.ravs && move.ravs.length > 0) {
              const positionBeforeVariations = cmchess.fen();

              move.ravs.forEach((rav: any) => {
                cmchess.load(positionBeforeVariations);
                cmchess.undo();

                if (rav.moves && rav.moves.length > 0) {
                  processMoves(rav.moves, cmchess);
                }

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

    context.stop().catch(() => {});

    isAnalyzingRef.current = false;
    setStatus(AnalyzerStatus.Idle);
    setTotalPositions(0);
    setCompletedPositions(0);
  }, [context.stop]);

  const analyzePgn = useCallback((pgn: string, partialOptions?: AnalyzePgnOptions) => {
    const defaultOptions: Required<Omit<AnalyzePgnOptions, 'maxSecondsPerPosition'>> & { maxSecondsPerPosition: number } = {
      analyzeVariations: true,
      depth: defaultDepth,
      numLines: defaultNumLines,
      maxSecondsPerPosition: 0,
    };

    const options = { ...defaultOptions, ...partialOptions };

    // Generate FENs from PGN
    const allFens = generateFensFromPgn(pgn, options.analyzeVariations);

    let fensToAnalyze: string[] = [];
    const bookEvaluations: Evaluations = {};

    // Check existing evaluations (includes book positions since useFenAnalyzer checks them)
    for (let i = 0; i < allFens.length; i++) {
      const existingEval = context.evaluations[allFens[i]];
      if (existingEval && existingEval.depth >= options.depth) {
        bookEvaluations[allFens[i]] = existingEval;
      } else {
        fensToAnalyze.push(allFens[i]);
      }
    }

    // If nothing was cached, set fensToAnalyze to allFens
    if (Object.keys(bookEvaluations).length < 1 && fensToAnalyze.length === 0) {
      fensToAnalyze = allFens;
    }

    if (allFens.length === 0) {
      console.error('No positions to analyze');
      return;
    }

    // Cancel any ongoing analysis
    if (isAnalyzingRef.current) {
      cancel();
    }

    // Set up state for new analysis
    setTotalPositions(allFens.length);

    if (Object.keys(bookEvaluations).length > 0) {
      setCompletedPositions(Object.keys(bookEvaluations).length);
      setPgnEvaluations(bookEvaluations);
    } else {
      setCompletedPositions(0);
      setPgnEvaluations({});
    }

    if (fensToAnalyze.length === 0) {
      // All positions already evaluated
      setStatus(AnalyzerStatus.Idle);
      setPgnEvaluations(bookEvaluations);
      return;
    }

    isAnalyzingRef.current = true;
    setStatus(AnalyzerStatus.Analyzing);

    // Submit all FENs to the context queue
    const promises = fensToAnalyze.map((fen) => {
      const analyzeOptions: any = {
        maxDepth: options.depth,
        numLines: options.numLines,
      };

      if (options.maxSecondsPerPosition > 0) {
        analyzeOptions.maxSeconds = options.maxSecondsPerPosition;
      }

      return context.analyze(fen, analyzeOptions)
        .then((evaluation) => {
          setPgnEvaluations((prev) => ({ ...prev, [fen]: evaluation }));
          setCompletedPositions((prev) => prev + 1);
        })
        .catch((error) => {
          if (error instanceof AnalyzeInterruptedError) {
            // Expected when cancelled
          } else {
            console.error(`Error analyzing position:`, error);
          }
          setCompletedPositions((prev) => prev + 1);
        });
    });

    Promise.allSettled(promises).then(() => {
      if (isAnalyzingRef.current) {
        isAnalyzingRef.current = false;
        setStatus(AnalyzerStatus.Idle);
      }
    });
  }, [
    generateFensFromPgn,
    defaultDepth,
    defaultNumLines,
    cancel,
    context.analyze,
    context.evaluations,
  ]);

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
