  import React from 'react'
  import Switch from 'react-switch';
  import { Move } from 'cm-chess/src/Chess';
  import { GameEvals, Evaluation, MoveJudgement } from '@/types/chess';
  import { getFen, getMoveJudgementColor, getMoveJudgement } from '@/utils/chess';
  import { getScoreFromEvaluation, makeScoreString, MultiPV } from '@/utils/stockfish';
  import { isBookPosition } from '@/utils/bookPositions';
  import EvalerLine from '@/components/evalerLine';
  // import useStore from '../zustand/store'

  const showDevButtons = false;

  export interface Props {
    isEngineOn: boolean;
    setIsEngineOn: (isOn: boolean) => void;
    currentMove: Move | undefined;
    gameEvals: GameEvals;
    engineLines: Record<string, MultiPV[]>
    numLines: number;
    isEvaluating: boolean;
    evalerMaxDepth?: number;
    engineName?: string;
    isSwitchDisabled?: boolean;
    maxLineLength?: number;
    includeOnOffSwitch?: boolean;
    switchDisabledMsg?: string;
  }

  const EvalerDisplay = ({
    isEngineOn,
    setIsEngineOn,
    currentMove,
    gameEvals,
    evalerMaxDepth,
    numLines,
    engineName = 'Engine loading...',
    engineLines,
    isSwitchDisabled = false,
    maxLineLength,
    isEvaluating,
    includeOnOffSwitch = true,
    switchDisabledMsg,
  }: Props) => {
    // const { settings } = useStore((state) => state);

    const handleSwitchChange = (checked: boolean) => {
      setIsEngineOn(checked);
    }

    const getEvaluation = (): Evaluation | undefined => {
      return gameEvals[getFen(currentMove)];
    }

    const makeMoveJudgementString = (mj?: MoveJudgement): string => {
      if (!isEngineOn) return '';

      if (currentMove && isBookPosition(currentMove.fen)) {
        return `${currentMove.san} is a book move`;
      }

      if (mj && currentMove) {
        return `${currentMove.san} is ${mj}`;
      }

      if (isEvaluating) return 'evaluating...';

      return '';
    }

    const moveJudgementColor = (mj?: MoveJudgement): string | undefined => {
      const fen = currentMove ? currentMove.fen : undefined;
      return getMoveJudgementColor(mj, fen);
    }

    const makeEvaluationString = (e: Evaluation | undefined): string => {
      if (e == undefined) return '';
      return makeScoreString(getScoreFromEvaluation(e))
    }

    const evaluation = getEvaluation();
    let depthString: string | undefined = undefined;
    if (isEngineOn && evaluation) {
      depthString = `Depth ${evaluation.depth}`;
      if (evalerMaxDepth && evalerMaxDepth >= evaluation.depth) {
        depthString += `/${evalerMaxDepth}`;
      }
    }

    const currentMoveLines: (MultiPV | undefined)[] = new Array(numLines).fill(undefined);
    if (isEngineOn && engineLines[(getFen(currentMove))]) {
      engineLines[(getFen(currentMove))].forEach((line, i) => {
        currentMoveLines[i] = line;
      });
    }

    const debug = () => {
      console.log('debug');
    }

    const mj = getMoveJudgement(currentMove, gameEvals);

    return (
      <div className="block w-full">
        <div className="flex flex-row items-center justify-between">
          <span className="text-xl w-12 text-right">
            {isEngineOn && makeEvaluationString(evaluation)}
          </span>
          <div className="text-center text-xs h-8 flex flex-col justify-center items-center">
            <div>{engineName}</div>
            {depthString && (
              <div>{depthString}</div>
            )}
          </div>
          <div className="w-14 h-7">
            {includeOnOffSwitch && (
              <Switch
                onChange={handleSwitchChange}
                checked={isEngineOn}
                disabled={isSwitchDisabled}
              />
            )}
          </div>
        </div>
        <div className="text-center my-3 h-5 [&>span]:font-bold">
          {(!isEngineOn && isSwitchDisabled && switchDisabledMsg) ? (
            <div>{switchDisabledMsg}</div>
          ) : (
            <span style={{ color: moveJudgementColor(mj) }}>
              {makeMoveJudgementString(mj)}
            </span>
          )}
        </div>
        <div>
          {currentMoveLines.map((line, i) => {
            let key = i.toString();
            if (line) key = `${line.multipv} ${line.lanLine.join('')}`;
            return (
              <EvalerLine
                key={key}
                fen={getFen(currentMove)}
                line={line}
                maxLineLength={maxLineLength}
              />
            );
          })}
        </div>
        {showDevButtons && (<button onClick={debug}>debug</button>)}
      </div>
    )
  }

  export default EvalerDisplay;
