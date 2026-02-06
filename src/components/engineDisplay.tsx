import Switch from 'react-switch';
import { Move, FEN } from 'cm-chess/src/Chess';
import { PositionEvaluation, GameEvaluation, MoveJudgement } from '@/types/chess';
import { getFen, getMoveJudgementColor, judgeLines, makeMoveJudgement } from '@/utils/chess';
import { makeScoreString, MultiPV } from '@/utils/stockfish';
import { isBookPosition } from '@/utils/bookPositions';
import EvalerLine from '@/components/evalerLine';
import { useCallback, useEffect, useState } from 'react';
import { colorToMove } from '@/utils/cmchess';

const showDevButtons = false;

export interface Props {
  isEngineOn: boolean;
  setIsEngineOn: (isOn: boolean) => void;
  currentMove: Move | undefined;
  evaluations: GameEvaluation;
  numLines: number;
  isEvaluating: boolean;
  engineMaxDepth: number;
  engineName?: string;
  isSwitchDisabled?: boolean;
  maxLineLengthPx: number;
  includeOnOffSwitch?: boolean;
  switchDisabledMsg?: string;
  showMoveJudgements?: boolean;
  colorLineScores?: boolean;
}

const EngineDisplay = ({
  isEngineOn,
  setIsEngineOn,
  currentMove,
  evaluations,
  engineMaxDepth,
  numLines,
  engineName = 'Engine loading...',
  isSwitchDisabled = false,
  maxLineLengthPx,
  isEvaluating,
  includeOnOffSwitch = true,
  switchDisabledMsg,
  showMoveJudgements = true,
  colorLineScores = false,
}: Props) => {
  const [currentEvaluation, setCurrentEvaluation] = useState<PositionEvaluation | undefined>(undefined);

  const makeMoveJudgementString = useCallback((mj?: MoveJudgement): string => {
    if (!isEngineOn) return '';

    if (currentMove && isBookPosition(currentMove.fen)) {
      return `${currentMove.san} is a book move`;
    }

    if (mj && currentMove) {
      return `${currentMove.san} is ${mj}`;
    }

    if (isEvaluating) return 'evaluating...';

    return '';
  }, [isEngineOn, currentMove, isEvaluating]);

  const moveJudgementColor = useCallback((mj?: MoveJudgement): string | undefined => {
    const fen = currentMove ? currentMove.fen : undefined;
    return getMoveJudgementColor(mj, fen);
  }, [currentMove]);

  const makeEvaluationString = (e: PositionEvaluation | undefined): string => {
    if (e == undefined) return '';
    return makeScoreString(e.score)
  }

  const getMoveJudgement = useCallback((): (MoveJudgement | undefined) => {
    if (currentMove && currentMove.previous) {
      return makeMoveJudgement(
        currentMove.previous.fen,
        currentMove.fen,
        evaluations,
      )
    }
  }, [currentMove, evaluations]);

  const makeDepthString = useCallback((): string => {
    if (!isEngineOn) return '';
    const renderString = (d: number) => `Depth ${d}/${engineMaxDepth}`;

    if (currentEvaluation == undefined) return renderString(0);

    // Sometimes stockfish will return an evaluation at depth 20 before it is done evaluating.
    // We know it is done evaluating when it gives us a bestMove. Don't display a depth equal
    // to the engineMaxDepth until we have a bestMove.
    if (currentEvaluation.depth === engineMaxDepth && currentEvaluation.bestMove == undefined) {
      return renderString(currentEvaluation.depth - 1);
    }

    return renderString(currentEvaluation.depth);
  }, [isEngineOn, engineMaxDepth, currentEvaluation]);

  const debug = () => {
    console.log('debug');
  }

  useEffect(() => {
    setCurrentEvaluation(evaluations[getFen(currentMove)]);
  }, [evaluations, currentMove]);


  const currentMoveLines: (MultiPV | undefined)[] = new Array(numLines).fill(undefined);
  if (isEngineOn && currentEvaluation && currentEvaluation.lines) {
    currentEvaluation.lines.forEach((line, i) => {
      currentMoveLines[i] = {
        depth: currentEvaluation.depth,
        multipv: i + 1,
        score: line.score,
        lanLine: line.lanLine.split(' '),
      };
    });
  }

  const mj = showMoveJudgements ? getMoveJudgement() : undefined;

  let lineColors: string[] = [];
  if (colorLineScores && currentEvaluation) {
    const lineJudgements = judgeLines(colorToMove(currentMove), currentEvaluation.lines);
    lineColors = lineJudgements.map((j) => {
      switch (j) {
        case MoveJudgement.Best:
        case MoveJudgement.Excellent:
          return 'text-blue-500';
        case MoveJudgement.Good:
          return 'text-green-600';
        case MoveJudgement.Inaccurate:
          return 'text-yellow-300';
        case MoveJudgement.Mistake:
          return 'text-amber-500';
        case MoveJudgement.Blunder:
          return 'text-red-600';
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col py-0 px-0">
      <div className="flex flex-col flex-1 justify-center bg-stone-700 rounded-sm">
        <div className="flex flex-row items-center justify-between min-h-10 px-2">
          <span className="text-xl w-12 text-right">
            {isEngineOn && makeEvaluationString(currentEvaluation)}
          </span>
          <div className="text-center text-[12px]/4 h-8 flex flex-col justify-center items-center">
            <div>{engineName}</div>
            <div>{makeDepthString()}</div>
          </div>
          <div className="w-14 h-7">
            {includeOnOffSwitch && (
              <Switch
                onChange={(checked) => setIsEngineOn(checked)}
                checked={isEngineOn}
                disabled={isSwitchDisabled}
              />
            )}
          </div>
        </div>
        {(!isEngineOn && isSwitchDisabled && switchDisabledMsg) && (
          <div className="flex flex-col flex-1 min-h-9 items-center justify-center text-center text-sm">
            <span>{switchDisabledMsg}</span>
          </div>
        )}
        {isEngineOn && showMoveJudgements && (
          <div>
            <span style={{ color: moveJudgementColor(mj) }}>
              {makeMoveJudgementString(mj)}
            </span>
          </div>
        )}
      </div>
      {isEngineOn && (
        <div className="flex flex-col flex-1 justify-evenly">
          {currentMoveLines.map((line, i) => {
            let key = i.toString();
            if (line) key = `${line.multipv} ${line.lanLine.join('')}`;
            return (
              <EvalerLine
                key={key}
                fen={currentEvaluation ? currentEvaluation.fen : FEN.start}
                line={line}
                maxLineLengthPx={maxLineLengthPx}
                scoreColor={lineColors[i]}
              />
            );
          })}
        </div>
      )}
      {showDevButtons && (<button onClick={debug}>debug</button>)}
    </div>
  )
}

export default EngineDisplay;
