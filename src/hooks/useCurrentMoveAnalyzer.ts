import { useState, useEffect, useCallback, useRef } from 'react';
import { Evaluations } from '@/types/chess';
import { Move } from 'cm-chess/src/Chess';
import { AnalyzeInterruptedError } from '@/hooks/useFenAnalyzer';
import { getFen } from '@/utils/chess';
import usePrevious from '@/hooks/usePrevious';
import { areCmMovesEqual } from '@/utils/cmchess';
import { AnalyzerStatus } from '@/types/analyzer';
import { useFenAnalyzers } from '@/contexts/FenAnalyzersContext';

export interface UseCurrentMoveAnalyzerOptions {
  depth?: number;
  numLines?: number;
}

export interface Output {
  status: AnalyzerStatus;
  isOn: boolean;
  setIsOn: (value: boolean) => void;
  latestEvaluations: Evaluations;
  engineName: string | null;
  depth: number;
  numLines: number;
}

export default function useCurrentMoveAnalyzer(
  currentMove: Move | undefined,
  options?: UseCurrentMoveAnalyzerOptions
): Output {
  const depth = options?.depth ?? 20;
  const numLines = options?.numLines ?? 2;

  const fenAnalyzers = useFenAnalyzers();

  const [isOn, setIsOn] = useState(false);
  const [status, setStatus] = useState<AnalyzerStatus>(fenAnalyzers.status);

  const prevIsOn = usePrevious(isOn);
  const previousMove = usePrevious(currentMove);
  const currentAnalysisFenRef = useRef<string | null>(null);

  const doWeAlreadyHaveEvaluation = useCallback((fen: string): boolean => {
    const fenEval = fenAnalyzers.evaluations[fen];
    if (fenEval && fenEval.depth >= depth) return true;
    return false;
  }, [fenAnalyzers.evaluations, depth]);

  const analyzeCurrentMove = useCallback(async () => {
    const fen = getFen(currentMove);

    // Check if we already have evaluation at required depth
    if (doWeAlreadyHaveEvaluation(fen)) {
      currentAnalysisFenRef.current = null;
      setStatus(AnalyzerStatus.Idle);
      return;
    }

    // Check if we're already analyzing this exact FEN
    if (currentAnalysisFenRef.current === fen) {
      return;
    }

    currentAnalysisFenRef.current = fen;
    setStatus(AnalyzerStatus.Analyzing);

    try {
      await fenAnalyzers.analyze(fen, { maxDepth: depth, numLines });

      if (currentAnalysisFenRef.current === fen) {
        currentAnalysisFenRef.current = null;
        setStatus(AnalyzerStatus.Idle);
      }
    } catch (error: any) {
      if (error instanceof AnalyzeInterruptedError) {
        // Expected when navigating or stopping
      } else {
        console.error('Error analyzing current move:', error);
      }

      if (currentAnalysisFenRef.current === fen) {
        currentAnalysisFenRef.current = null;
        setStatus(AnalyzerStatus.Idle);
      }
    }
  }, [currentMove, depth, numLines, doWeAlreadyHaveEvaluation, fenAnalyzers.analyze]);

  // When isOn changes to false, stop analysis
  useEffect(() => {
    if (prevIsOn && !isOn) {
      fenAnalyzers.stop().catch(error => {
        console.error('Error stopping analyzers:', error);
      });
      currentAnalysisFenRef.current = null;
      setStatus(AnalyzerStatus.Idle);
    }
  }, [isOn, prevIsOn, fenAnalyzers.stop]);

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
      currentAnalysisFenRef.current = null;
    }
  }, [isOn, prevIsOn, currentMove, previousMove, analyzeCurrentMove]);


  useEffect(() => {
    if (status === AnalyzerStatus.Uninitialized && fenAnalyzers.status === AnalyzerStatus.Initializing) {
      setStatus(AnalyzerStatus.Initializing);
      return;
    }

    if (status === AnalyzerStatus.Initializing && fenAnalyzers.status === AnalyzerStatus.Idle) {
      setStatus(AnalyzerStatus.Idle);
      return;
    }

    if (fenAnalyzers.status === AnalyzerStatus.Uninitialized && status !== AnalyzerStatus.Uninitialized) {
      setStatus(AnalyzerStatus.Uninitialized);
      return;
    }
  }, [fenAnalyzers.status, status]);

  return {
    status,
    isOn,
    setIsOn,
    latestEvaluations: fenAnalyzers.latestEvaluations,
    engineName: fenAnalyzers.engineName,
    depth,
    numLines,
  };
}
