import { useState, useEffect, useCallback, useRef } from 'react';
import { Evaluations, PositionEvaluation } from '@/types/chess';
import { Move } from 'cm-chess/src/Chess';
import { Output as FenAnalyzerOutput } from '@/hooks/useFenAnalyzer';
import { getFen } from '@/utils/chess';
import usePrevious from '@/hooks/usePrevious';
import { areCmMovesEqual } from '@/utils/cmchess';
import { AnalyzerStatus } from '@/types/analyzer';

export interface UseCurrentMoveAnalysisOptions {
  depth?: number;
  numLines?: number;
}

export interface Output {
  isOn: boolean;
  setIsOn: (value: boolean) => void;
  isAnalyzing: boolean;
  latestEvaluation: PositionEvaluation | null;
}

export default function useCurrentMoveAnalysis(
  evaluations: Evaluations,
  setEvaluations: React.Dispatch<React.SetStateAction<Evaluations>>,
  currentMove: Move | undefined,
  fenAnalyzer: FenAnalyzerOutput,
  options?: UseCurrentMoveAnalysisOptions
): Output {
  const depth = options?.depth ?? 20;
  const numLines = options?.numLines ?? 2;

  const [isOn, setIsOn] = useState(false);
  const currentFenRef = useRef<string | null>(null);

  const prevIsOn = usePrevious(isOn);
  const previousMove = usePrevious(currentMove);

  const doWeAlreadyHaveEvaluation = useCallback((fen: string): boolean => {
    const fenEval = evaluations[fen];
    if (fenEval && fenEval.depth >= depth) return true;
    return false;
  }, [evaluations, depth]);

  const analyzeCurrentMove = useCallback(async () => {
    if (!currentMove) {
      currentFenRef.current = null;
      return;
    }

    const fen = getFen(currentMove);

    // Don't analyze if we already have this evaluation
    if (doWeAlreadyHaveEvaluation(fen)) {
      currentFenRef.current = null;
      return;
    }

    try {
      // Always stop first (it's a no-op if not analyzing)
      console.log('stopping');
      await fenAnalyzer.stop();
      console.log('stopped');

      // Track the FEN we're about to analyze
      currentFenRef.current = fen;

      // Analyze the position
      console.log('analyze');
      const evaluation = await fenAnalyzer.analyze(fen, {
        maxDepth: depth,
        numLines: numLines,
      });
      console.log('evaluation:');
      console.log(evaluation);

      // Add to evaluations
      setEvaluations((evs) => ({ ...evs, [fen]: evaluation }));

      // Clear the current FEN when done
      currentFenRef.current = null;
    } catch (error: any) {
      currentFenRef.current = null;
      console.error('Error analyzing current move:', error);
    }
  }, [currentMove, fenAnalyzer, depth, numLines, doWeAlreadyHaveEvaluation, setEvaluations]);

  // When isOn changes to false, stop analysis
  useEffect(() => {
    if (prevIsOn && !isOn) {
      fenAnalyzer.stop();
      currentFenRef.current = null;
    }
  }, [isOn, prevIsOn, fenAnalyzer]);

  // When isOn is true and currentMove changes, analyze the position
  useEffect(() => {
    // If isOn has changed from false to true, analyze.
    if (isOn && prevIsOn === false) {
      analyzeCurrentMove();
      return;
    }

    // If currentMove hasn't actually changed, do nothing.
    if (areCmMovesEqual(currentMove, previousMove)) return;

    if (isOn) {
      analyzeCurrentMove();
    } else {
      currentFenRef.current = null;
    }
  }, [isOn, prevIsOn, currentMove, previousMove, analyzeCurrentMove]);

  // Compute derived values
  const currentMoveFen = currentMove ? getFen(currentMove) : null;

  // Check if the latest evaluation is for the current move
  const isLatestEvaluationForCurrentMove =
    fenAnalyzer.latestEvaluation !== null &&
    fenAnalyzer.latestEvaluation.fen === currentMoveFen;

  // We're analyzing the current move if:
  // 1. isOn is true
  // 2. fenAnalyzer is analyzing
  // 3. Either the ref matches current FEN OR the latestEvaluation matches
  const isAnalyzingCurrentMove =
    isOn &&
    fenAnalyzer.status === AnalyzerStatus.Analyzing &&
    (currentFenRef.current === currentMoveFen || isLatestEvaluationForCurrentMove);

  const latestEvaluationForCurrentMove =
    isLatestEvaluationForCurrentMove ? fenAnalyzer.latestEvaluation : null;

  return {
    isOn,
    setIsOn,
    isAnalyzing: isAnalyzingCurrentMove,
    latestEvaluation: latestEvaluationForCurrentMove,
  };
}
