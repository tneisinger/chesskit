  import Switch from 'react-switch';
  import { Move } from 'cm-chess/src/Chess';
  import { GameEvals, Evaluation, MoveJudgement } from '@/types/chess';
  import { getFen, getMoveJudgementColor, getMoveJudgement } from '@/utils/chess';
  import { getScoreFromEvaluation, makeScoreString, MultiPV } from '@/utils/stockfish';
  import { isBookPosition } from '@/utils/bookPositions';
  import EvalerLine from '@/components/evalerLine';

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
    maxLineLengthPx: number;
    includeOnOffSwitch?: boolean;
    switchDisabledMsg?: string;
    showMoveJudgements?: boolean;
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
    maxLineLengthPx,
    isEvaluating,
    includeOnOffSwitch = true,
    switchDisabledMsg,
    showMoveJudgements = true,
  }: Props) => {
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

    const mj = showMoveJudgements ? getMoveJudgement(currentMove, gameEvals) : undefined;

    return (
      <div className="flex flex-1 flex-col py-0 px-0">
        <div className="flex flex-col flex-1 justify-center bg-stone-700 rounded-sm">
          <div className="flex flex-row items-center justify-between min-h-10 px-2">
            <span className="text-xl w-12 text-right">
              {isEngineOn && makeEvaluationString(evaluation)}
            </span>
            <div className="text-center text-[12px]/4 h-8 flex flex-col justify-center items-center">
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
                  fen={getFen(currentMove)}
                  line={line}
                  maxLineLengthPx={maxLineLengthPx}
                />
              );
            })}
          </div>
        )}
        {showDevButtons && (<button onClick={debug}>debug</button>)}
      </div>
    )
  }

  export default EvalerDisplay;
