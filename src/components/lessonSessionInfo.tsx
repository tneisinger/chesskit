import React, { useCallback } from 'react';
import { Move } from 'cm-chess/src/Chess';
// import useStore from '../zustand/store'
import { shouldUseMobileLayout } from '@/utils/mobileLayout';
import HintButtons, { Props as HintButtonsProps } from '@/components/hintButtons';
import { LineStats, Mode, Lesson } from '@/types/lesson';
import { useChapterCompletionRatios } from '@/hooks/useChapterCompletionRatios';

interface Props extends HintButtonsProps {
  lesson: Lesson;
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
  changeMode: (newMode: Mode) => void;
}

const LessonSessionInfo = ({
  lesson,
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
  changeMode,
}: Props) => {
  // const { windowSize } = useStore((state) => state);

	const ratio = useChapterCompletionRatios(lesson, lines)[0];

  const areAllLinesComplete = useCallback((): boolean => {
    return Object.values(lines).every((line) => line.isComplete);
  }, [lines]);

  // Returns the next mode to toggle to (either Learn or Practice)
  const getNextToggleMode = useCallback((): Mode => {
    if (mode !== Mode.Learn && mode !== Mode.Practice) {
      return fallbackMode;
    }
    return (mode === Mode.Learn ? Mode.Practice : Mode.Learn);
  }, [mode, fallbackMode]);

  const classes = ['flex flex-row items-center justify-between min-h-[34px]'];
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
      <div className="[&>*+*]:ml-6">
        {mode !== Mode.Edit && (
          <>
            {lesson.chapters.length === 1 && (
              <span>{ratio.completedCount}/{ratio.totalCount}</span>
            )}
            <button
              className='cursor-pointer'
              onClick={() => restartCurrentLine(fallbackMode)}
            >
              Restart
            </button>

            {/* This button restarts the current line in the alternate mode (either Learn or Practice) */}
            {!isLineComplete && (
              <button
                className='cursor-pointer'
                onClick={() => changeMode(getNextToggleMode())}
              >
                {getNextToggleMode()}
              </button>
            )}

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
