import { useEffect, useState, useCallback, useRef } from 'react';
import { AnalyzeInterruptedError } from '@/hooks/useFenAnalyzer';
import { PositionEvaluation } from "@/types/chess";
import { ShortMove } from '@/types/chess';
import {
  convertLanLineToFens,
  convertLanLineToShortMoves,
  doesOnlyOneGoodMoveExist,
  lanToShortMove
} from '@/utils/chess';
import { AnalyzerStatus } from '@/types/analyzer';
import { useFenAnalyzers } from '@/contexts/FenAnalyzersContext';

export interface FindForcingLineOptions {
  minDepth: number;
  maxLineLength: number;
  maxSecondsPerPosition?: number;
}

export interface Output {
  findForcingLine: (pev: PositionEvaluation, options: FindForcingLineOptions) => Promise<ShortMove[]>;
  forcingMoves: ShortMove[];
  status: AnalyzerStatus;
  cancel: () => void;
}

interface FenWithIndex {
  fen: string;
  index: number;
}

export default function useForcingLineFinderParallel(): Output {
  const fenAnalyzers = useFenAnalyzers();

  const [status, setStatus] = useState<AnalyzerStatus>(AnalyzerStatus.Idle);
  const [forcingMoves, setForcingMoves] = useState<ShortMove[]>([]);
  const [localEvaluations, setLocalEvaluations] = useState<{index: number, pev: PositionEvaluation}[]>([]);

  const isAnalyzingRef = useRef(false);
  const currentOptionsRef = useRef<Required<FindForcingLineOptions> | null>(null);
  const originalPevRef = useRef<PositionEvaluation | null>(null);

  // Promise resolution/rejection for current analysis
  const findForcingLinePromiseRef = useRef<{
    resolve: (value: ShortMove[]) => void;
    reject: (reason: any) => void;
  } | null>(null);

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
  const buildShortMovesFromIndices = useCallback((pev: PositionEvaluation, forcingIndices: number[]): ShortMove[] => {
    if (forcingIndices.length === 0) return [];

    const lastForcingIndex = forcingIndices[forcingIndices.length - 1];
    const lanLine = pev.lines[0].lanLine;
    const lanMoves = lanLine.trim().split(' ').filter(m => m.trim() !== '');

    const endIndex = Math.min(lastForcingIndex + 2, lanMoves.length);
    const movesToInclude = lanMoves.slice(0, endIndex);

    return convertLanLineToShortMoves(movesToInclude, pev.fen);
  }, []);

  // Helper function to find contiguous forcing indices
  const findForcingIndices = useCallback((evaluations: {index: number, pev: PositionEvaluation}[]): number[] => {
    const sortedEvals = [...evaluations].sort((a, b) => a.index - b.index);
    const forcingIndices: number[] = [];

    for (const { index, pev } of sortedEvals) {
      if (index !== forcingIndices.length * 2 + 1) break;
      if (!doesOnlyOneGoodMoveExist(pev)) break;
      forcingIndices.push(index);
    }

    return forcingIndices;
  }, []);

  const cancel = useCallback(() => {
    if (!isAnalyzingRef.current) return;

    fenAnalyzers.stop().catch(() => {});

    if (findForcingLinePromiseRef.current) {
      findForcingLinePromiseRef.current.reject(new Error('Analysis cancelled'));
      findForcingLinePromiseRef.current = null;
    }

    isAnalyzingRef.current = false;
    setStatus(AnalyzerStatus.Idle);
    currentOptionsRef.current = null;
    originalPevRef.current = null;
    setLocalEvaluations([]);
  }, [fenAnalyzers.stop]);

  const findForcingLine = useCallback((pev: PositionEvaluation, partialOptions: FindForcingLineOptions): Promise<ShortMove[]> => {
    // Reset forcingMoves state
    setForcingMoves([]);

    // Check if the input pev has only one good move
    if (doesOnlyOneGoodMoveExist(pev)) {
      const firstMoveLan = pev.lines[0].lanLine.trim().split(' ')[0];
      const result = [lanToShortMove(firstMoveLan)];
      setForcingMoves(result);
    } else {
      return Promise.resolve([]);
    }

    const defaultOptions: Required<FindForcingLineOptions> = {
      minDepth: 18,
      maxLineLength: 12,
      maxSecondsPerPosition: 10 * 60,
    };

    const options: Required<FindForcingLineOptions> = { ...defaultOptions, ...partialOptions };
    currentOptionsRef.current = options;
    originalPevRef.current = pev;

    const fens = generateFens(pev, options.maxLineLength);

    if (fens.length === 0) {
      // No positions to analyze. This happens when the first move is checkmate or ends the line.
      // Return the initial move we already identified.
      const firstMoveLan = pev.lines[0].lanLine.trim().split(' ')[0];
      const result = [lanToShortMove(firstMoveLan)];
      return Promise.resolve(result);
    }

    // Cancel any ongoing analysis
    if (isAnalyzingRef.current) {
      cancel();
    }

    isAnalyzingRef.current = true;
    setLocalEvaluations([]);
    setStatus(AnalyzerStatus.Analyzing);

    const promise = new Promise<ShortMove[]>((resolve, reject) => {
      findForcingLinePromiseRef.current = { resolve, reject };

      // Submit all FENs to the context queue
      for (const { fen, index } of fens) {
        // Check if we already have this evaluation at the required depth
        if (fenAnalyzers.evaluations[fen] && fenAnalyzers.evaluations[fen].depth >= options.minDepth) {
          setLocalEvaluations((prev) => [...prev, { index, pev: fenAnalyzers.evaluations[fen] }]);
          continue;
        }

        const analyzeOptions: any = {
          maxDepth: options.minDepth,
          numLines: 2,
        };

        if (options.maxSecondsPerPosition > 0) {
          analyzeOptions.maxSeconds = options.maxSecondsPerPosition;
        }

        fenAnalyzers.analyze(fen, analyzeOptions)
          .then((evaluation) => {
            setLocalEvaluations((prev) => [...prev, { index, pev: evaluation }]);
          })
          .catch((error) => {
            if (error instanceof AnalyzeInterruptedError) {
              // Expected when stopped/cancelled
            } else {
              console.error(`Error analyzing position:`, error);
            }
          });
      }
    });

    return promise;
  }, [fenAnalyzers.analyze, fenAnalyzers.evaluations, cancel, generateFens]);

  // Check for completion or early termination when localEvaluations changes
  useEffect(() => {
    if (!isAnalyzingRef.current) return;
    if (localEvaluations.length < 1) return;

    const options = currentOptionsRef.current;
    const originalPev = originalPevRef.current;
    if (!options || !originalPev) return;

    const fens = generateFens(originalPev, options.maxLineLength);
    const sortedEvals = [...localEvaluations].sort((a, b) => a.index - b.index);
    const forcingIndices = findForcingIndices(localEvaluations);

    const forcingLineLength = forcingIndices.length > 0 ? forcingIndices[forcingIndices.length - 1] + 2 : 0;

    // Check if we should complete early
    const hasEnoughMoves = forcingLineLength >= options.maxLineLength;
    const foundNonForcingMove =
      sortedEvals.length > forcingIndices.length &&
      sortedEvals[forcingIndices.length].index === forcingIndices.length * 2 + 1;
    const allComplete = localEvaluations.length >= fens.length;

    if (hasEnoughMoves || foundNonForcingMove || allComplete) {
      // Stop remaining analyses
      fenAnalyzers.stop().catch(() => {});

      const shortMoves = buildShortMovesFromIndices(originalPev, forcingIndices);

      // If we didn't find any forcing moves but the original position has only one good move
      if (shortMoves.length < 1 && doesOnlyOneGoodMoveExist(originalPev)) {
        const firstMoveLan = originalPev.lines[0].lanLine.trim().split(' ')[0];
        const result = [lanToShortMove(firstMoveLan)];
        setForcingMoves(result);

        if (findForcingLinePromiseRef.current) {
          findForcingLinePromiseRef.current.resolve(result);
          findForcingLinePromiseRef.current = null;
        }
      } else {
        setForcingMoves(shortMoves);

        if (findForcingLinePromiseRef.current) {
          findForcingLinePromiseRef.current.resolve(shortMoves);
          findForcingLinePromiseRef.current = null;
        }
      }

      isAnalyzingRef.current = false;
      setStatus(AnalyzerStatus.Idle);
    }
  }, [localEvaluations, findForcingIndices, buildShortMovesFromIndices, generateFens, fenAnalyzers.stop]);

  return {
    findForcingLine,
    forcingMoves,
    status,
    cancel,
  };
}
