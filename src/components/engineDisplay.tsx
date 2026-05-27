import Switch from 'react-switch';
import { Move, FEN } from 'cm-chess/src/Chess';
import { PositionEvaluation, Evaluations, MoveJudgement } from '@/types/chess';
import { getFen, getMoveJudgementColor, judgeLines, makeMoveJudgement } from '@/utils/chess';
import { makeScoreString, MultiPV } from '@/utils/stockfish';
import { isBookPosition } from '@/utils/bookPositions';
import EvalerLine from '@/components/evalerLine';
import { useCallback, useEffect, useState } from 'react';
import { colorToMove } from '@/utils/cmchess';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Output as CurrentMoveAnalyzer } from '@/hooks/useCurrentMoveAnalyzer';
import { AnalyzerStatus } from '@/types/analyzer';
import SvgIcon, { Svg } from '@/components/svgIcon';

const showDevButtons = false;

export interface Props {
  currentMoveAnalyzer: CurrentMoveAnalyzer;
  currentMove: Move | undefined;
  evaluations: Evaluations;
  isSwitchDisabled?: boolean;
  maxLineLengthPx: number;
  includeOnOffSwitch?: boolean;
  switchDisabledMsg?: string;
  switchDisabledTooltip?: string;
  showMoveJudgements?: boolean;
  colorLineScores?: boolean;
  depth?: number;
  changeDepth?: (newDepth: number) => void;
}

const EngineDisplay = ({
  currentMoveAnalyzer,
  currentMove,
  evaluations,
  isSwitchDisabled = false,
  maxLineLengthPx,
  includeOnOffSwitch = true,
  switchDisabledMsg,
  switchDisabledTooltip,
  showMoveJudgements = true,
  colorLineScores = false,
  depth,
  changeDepth,
}: Props) => {
  const [currentEvaluation, setCurrentEvaluation] = useState<PositionEvaluation | undefined>(undefined);
  const [engineNameOrStatus, setEngineNameOrStatus] = useState<string>('engine uninitialized');
  const [showSettings, setShowSettings] = useState(false);

  const makeMoveJudgementString = useCallback((mj?: MoveJudgement): string => {
    if (!currentMoveAnalyzer.isOn) return '';

    if (currentMove && isBookPosition(currentMove.fen)) {
      return `${currentMove.san} is a book move`;
    }

    if (mj && currentMove) {
      return `${currentMove.san} is ${mj}`;
    }

    if (currentMoveAnalyzer.status === AnalyzerStatus.Analyzing) return 'evaluating...';

    return '';
  }, [currentMoveAnalyzer.isOn, currentMove, currentMoveAnalyzer.status]);

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
    if (!currentMoveAnalyzer.isOn) return '';
    const renderString = (d: number) => {
      if (d <= currentMoveAnalyzer.depth) {
        return `Depth ${d}/${currentMoveAnalyzer.depth}`;
      }
      return `Depth ${d}`;
    }

    if (currentEvaluation == undefined) return renderString(0);

    // Sometimes stockfish will return an evaluation at depth 20 before it is done evaluating.
    // We know it is done evaluating when it gives us a bestMove. Don't display a depth equal
    // to the engineMaxDepth until we have a bestMove.
    if (currentEvaluation.depth === currentMoveAnalyzer.depth && currentEvaluation.bestMove == undefined) {
      return renderString(currentEvaluation.depth - 1);
    }

    return renderString(currentEvaluation.depth);
  }, [currentMoveAnalyzer.isOn, currentMoveAnalyzer.depth, currentEvaluation]);


  const isSwitchDisabledInternal = useCallback((): boolean => {
    if (isSwitchDisabled) return true;
    if (currentMoveAnalyzer.status === AnalyzerStatus.Uninitialized) return true;
    if (currentMoveAnalyzer.status === AnalyzerStatus.Initializing) return true;
    return false;
  }, [isSwitchDisabled, currentMoveAnalyzer.status]);


  const debug = () => {
    console.log('debug');
  }

  useEffect(() => {
    const ev = evaluations[getFen(currentMove)];

    const latestEvaluation = currentMove ? currentMoveAnalyzer.latestEvaluations[getFen(currentMove)] : null;

    if (ev == undefined && latestEvaluation == null) {
      setCurrentEvaluation(undefined);
      return;
    }

    if (ev != undefined) {
      setCurrentEvaluation(ev);
      return;
    }

    if (latestEvaluation && getFen(currentMove) === latestEvaluation.fen) {
      setCurrentEvaluation(latestEvaluation);
      return;
    }
  }, [evaluations, currentMove, currentMoveAnalyzer.latestEvaluations]);


  useEffect(() => {
    if (currentMoveAnalyzer.engineName == null) {
      if (currentMoveAnalyzer.status === AnalyzerStatus.Uninitialized) {
        setEngineNameOrStatus('Engine uninitialized');
      } else if (currentMoveAnalyzer.status === AnalyzerStatus.Initializing) {
        setEngineNameOrStatus('Engine Loading...');
      } else if (currentMoveAnalyzer.status === AnalyzerStatus.Idle) {
        setEngineNameOrStatus('Engine Ready');
      }
    }

    if (currentMoveAnalyzer.engineName) {
      setEngineNameOrStatus(currentMoveAnalyzer.engineName);
    }
  }, [currentMoveAnalyzer.status, currentMoveAnalyzer.engineName]);


  const currentMoveLines: (MultiPV | undefined)[] = new Array(currentMoveAnalyzer.numLines).fill(undefined);
  if (currentMoveAnalyzer.isOn && currentEvaluation && currentEvaluation.lines) {
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

  // Settings menu view
  if (showSettings && depth !== undefined && changeDepth) {
    return (
      <div className="flex flex-1 flex-col py-0 px-0 relative">
        <div className="flex flex-col flex-1 justify-center bg-stone-700 rounded-sm p-4">
          <div className="flex flex-col items-center gap-4">
            <h3 className="text-md font-bold">Engine Settings</h3>
            <div className="flex flex-col items-center w-full">
              <label htmlFor="engineDepthSlider" className="mb-2 text-sm">
                Analysis Depth:
              </label>
              <div className="flex flex-col items-center w-1/2">
                <input
                  id="engineDepthSlider"
                  className="w-full accent-stone-300"
                  type="range"
                  min={16}
                  max={25}
                  value={depth}
                  onChange={(e) => changeDepth(Number(e.target.value))}
                />
                <span className="mt-1">{depth}</span>
              </div>
            </div>
          </div>
          {/* Close button */}
          <button
            onClick={() => setShowSettings(false)}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center hover:bg-stone-600 rounded"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
      </div>
    );
  }

  // Normal engine display view
  return (
    <div className="flex flex-1 flex-col py-0 px-0 relative">
      <div className="flex flex-col flex-1 justify-center bg-stone-700 rounded-sm">
        <div className="flex flex-row items-center justify-between min-h-10 px-2">
          <span className="text-xl w-12 text-right">
            {currentMoveAnalyzer.isOn && makeEvaluationString(currentEvaluation)}
          </span>
          <div className="text-center text-[12px]/4 h-8 flex flex-col justify-center items-center">
            <div>{engineNameOrStatus}</div>
            <div>{makeDepthString()}</div>
          </div>
          <div className="w-14 h-7">
            {includeOnOffSwitch && (
              isSwitchDisabled && switchDisabledTooltip ? (
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger onClick={(e) => e.preventDefault()} asChild>
                      <div>
                        <Switch
                          onChange={(checked) => currentMoveAnalyzer.setIsOn(checked)}
                          checked={currentMoveAnalyzer.isOn}
                          disabled={isSwitchDisabledInternal()}
                        />
                      </div>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-neutral-200 text-black px-3 py-2 rounded text-sm max-w-xs"
                        sideOffset={-10}
                        side="bottom"
                      >
                        {switchDisabledTooltip}
                        <Tooltip.Arrow className="fill-neutral-200" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              ) : (
                <Switch
                  onChange={(checked) => currentMoveAnalyzer.setIsOn(checked)}
                  checked={currentMoveAnalyzer.isOn}
                  disabled={isSwitchDisabledInternal()}
                />
              )
            )}
          </div>
        </div>
        {(!currentMoveAnalyzer.isOn && isSwitchDisabled && switchDisabledMsg) && (
          <div className="flex flex-col flex-1 min-h-9 items-center justify-center text-center text-sm">
            <span>{switchDisabledMsg}</span>
          </div>
        )}
        {currentMoveAnalyzer.isOn && showMoveJudgements && (
          <div>
            <span style={{ color: moveJudgementColor(mj) }}>
              {makeMoveJudgementString(mj)}
            </span>
          </div>
        )}
      </div>
      {currentMoveAnalyzer.isOn && (
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
      {/* Gear icon button - only show if depth/changeDepth props are provided and analyzer is on */}
      {depth !== undefined && changeDepth && currentMoveAnalyzer.isOn && (
        <button
          onClick={() => setShowSettings(true)}
          className="absolute bottom-1 right-1 w-6 h-6 flex items-center justify-center hover:bg-stone-600 rounded"
        >
          <SvgIcon svg={Svg.GearIcon} width={16} height={16} styles="fill-white" />
        </button>
      )}
      {showDevButtons && (<button onClick={debug}>debug</button>)}
    </div>
  )
}

export default EngineDisplay;
