import { useEffect } from 'react';
import { ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows';
import { Arrow } from '@/components/cmChessboard';
import { Evaluations, MoveJudgement, PositionEvaluation } from '@/types/chess';
import { getFen, judgeLines, lanToShortMove } from '@/utils/chess';
import { colorToMove } from '@/utils/cmchess';
import { Move } from 'cm-chess/src/Chess';

export default function useEngineArrowCreator(
  isCurrentMoveAnalysisOn: boolean,
  evaluations: Evaluations,
  latestEvaluation: PositionEvaluation | null,
  currentMove: Move | undefined,
  changeEngineArrows: (newArrows: Arrow[]) => void,
) {

  // When the engine is on, draw arrows on the board representing the best moves.
  useEffect(() => {
    // If currentMove analysis is not on, do nothing.
    if (!isCurrentMoveAnalysisOn) return;

    // If we don't have an evaluation for this position, do nothing.
    let ev = evaluations[getFen(currentMove)];
    if (ev == undefined && latestEvaluation == null) {
      return;
    }

    // If there is not an evaluation in 'evaluations', but there is a 'latestEvaluation'
    // with a matching fen, use the latestEvaluation.
    if (ev == undefined && latestEvaluation != null
      && latestEvaluation.fen === getFen(currentMove)) {
        ev = latestEvaluation;
    }

    const lineJudgements = judgeLines(colorToMove(currentMove), ev.lines);

    const newArrows: Arrow[] = [];

    // Make an arrow for each line
    for (let i = 0; i < ev.lines.length; i++ ) {
      // If the move is not good enough, don't make an arrow for it.
      if (lineJudgements[i] === MoveJudgement.Inaccurate) continue;
      if (lineJudgements[i] === MoveJudgement.Mistake) continue;
      if (lineJudgements[i] === MoveJudgement.Blunder) continue;

      // Get the 'from' and 'to' squares from the first move of this line.
      const { lanLine } = ev.lines[i];
      const firstLanMove = lanLine.trim().split(' ')[0];
      const { from, to } = lanToShortMove(firstLanMove);

      // Determine which ARROW_TYPE to use, which defines the color of the arrow.
      let arrowType;
      switch (lineJudgements[i]) {
        case MoveJudgement.Best:
        case MoveJudgement.Excellent:
          arrowType = ARROW_TYPE.info;
          break;
        case MoveJudgement.Good:
          arrowType = ARROW_TYPE.default;
          break;
        case MoveJudgement.Inaccurate:
          arrowType = ARROW_TYPE.warning;
          break;
        case MoveJudgement.Mistake:
        case MoveJudgement.Blunder:
          arrowType = ARROW_TYPE.danger;
          break;
      }

      // Create an Arrow and add it to our array of newArrows.
      newArrows.push({ type: arrowType, from, to });
    }

    // change the engineArrows
    changeEngineArrows(newArrows);
  }, [isCurrentMoveAnalysisOn, evaluations, latestEvaluation, currentMove])
}
