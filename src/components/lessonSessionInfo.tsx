import React, { useCallback } from 'react';
import { Move } from 'cm-chess/src/Chess';
// import useStore from '../zustand/store'
import { shouldUseMobileLayout } from '@/utils/mobileLayout';
import HintButtons, { Props as HintButtonsProps } from '@/components/hintButtons';
import { LineStats, Mode } from '@/types/lesson';

interface Props extends HintButtonsProps {
  changeCurrentMove: (newCurrentMove?: Move) => void;
  history: Move[];
  isSessionLoading: boolean;
  isLineComplete: boolean;
  lines: Record<string, LineStats>
  lineProgressIdx: number;
  mode: Mode;
  fallbackMode: Mode;
  setupNextLine: (nextMode: Mode) => void;
  restartCurrentLine: (nextMode: Mode) => void;
}

const LessonSessionInfo = ({
  currentMove,
  giveHint,
  showMove,
  isSessionLoading,
  lines,
  lineProgressIdx,
  mode,
  fallbackMode,
  isLineComplete,
  setupNextLine,
  restartCurrentLine,
}: Props) => {
  // const { windowSize } = useStore((state) => state);

  const areAllLinesComplete = useCallback((): boolean => {
    return Object.values(lines).every((line) => line.isComplete);
  }, [lines]);

  const getLinesCompletedRatio = useCallback((): string => {
    const completedLines = Object.values(lines).filter((line) => line.isComplete).length;
    const totalLines = Object.values(lines).length;
    return `${completedLines}/${totalLines}`;
  }, [lines]);

  const classes = ['w-full flex flex-row items-center justify-between min-h-[34px]'];
  // if (shouldUseMobileLayout(windowSize)) {
    // Add mobile layout styles if needed
  // }

  const isOnUnsolvedPosition = (): boolean => {
    if (currentMove == undefined) {
      return lineProgressIdx === 0;
    }
    return currentMove.ply === lineProgressIdx;
  }

  const shouldShowHintBtns = (): boolean => {
    if (isSessionLoading) return false;
    if (isLineComplete) return false;
    if (mode === Mode.Learn) return false;
    if (areAllLinesComplete()) return false;
    return true;
  }

  if (Object.keys(lines).length === 0) {
    return (
      <div className={classes.join(' ')}>
        <div>
          <span>No lines exist yet</span>
        </div>
      </div>
    )
  }

  return (
    <div className={classes.join(' ')}>
      <div>
        <span>Lines Completed: {getLinesCompletedRatio()}</span>
      </div>
      <div className="[&>*+*]:ml-4">
        {mode !== Mode.Edit && (
          <>
            <button
              className='cursor-pointer'
              onClick={() => restartCurrentLine(fallbackMode)}
            >
              Restart Line
            </button>

            {/* This button restarts the current line in the alternate mode (either Learn or Practice) */}
            <button
              className='cursor-pointer'
              onClick={() => fallbackMode === Mode.Learn ?
                  restartCurrentLine(Mode.Practice) : restartCurrentLine(Mode.Learn)
              }
            >
              {fallbackMode === Mode.Learn ? Mode.Practice : Mode.Learn} Line
            </button>

            {shouldShowHintBtns() && (
              <HintButtons
                currentMove={currentMove}
                giveHint={giveHint}
                showMove={showMove}
                disabled={!isOnUnsolvedPosition()}
              />
            )}
            {isLineComplete && !areAllLinesComplete() && (
              <button
                className='cursor-pointer'
                onClick={() => setupNextLine(fallbackMode)}
              >
                Next Line
              </button>
            )}
          </>
        )}
        {areAllLinesComplete() && (
          <span>Done!</span>
        )}
      </div>
    </div>
  );
};

export default LessonSessionInfo;
