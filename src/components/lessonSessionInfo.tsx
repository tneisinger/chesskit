import { useCallback } from 'react';
import { Move } from 'cm-chess/src/Chess';
import HintButtons, { Props as HintButtonsProps } from '@/components/hintButtons';
import { LineStats, Mode, Lesson } from '@/types/lesson';
import { useChapterCompletionRatios } from '@/hooks/useChapterCompletionRatios';
import Button, { ButtonSize } from '@/components/button';

interface Props extends HintButtonsProps {
  lesson: Lesson;
  changeCurrentMove: (newCurrentMove?: Move) => void;
  history: Move[];
  isSessionLoading: boolean;
  isLineComplete: boolean;
  areAllLinesComplete: () => boolean;
  isNextLineInAnotherChapter: () => boolean;
  getIdxOfNextIncompleteChapter: () => number | null;
  lines: Record<string, LineStats>[];
  lineProgressIdx: number;
  mode: Mode;
  fallbackMode: Mode;
  setupNextLine: (nextMode: Mode) => void;
  restartCurrentLine: (nextMode: Mode) => void;
  changeMode: (newMode: Mode) => void;
  currentChapterIdx: number;
  changeChapter: (idx: number) => void;
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
  areAllLinesComplete,
  isNextLineInAnotherChapter,
  getIdxOfNextIncompleteChapter,
  setupNextLine,
  restartCurrentLine,
  changeMode,
  changeChapter,
}: Props) => {

	const ratio = useChapterCompletionRatios(lesson, lines)[0];

  const handleChangeChapter = useCallback((idx: number | null) => {
    if (idx == null) return;
    changeChapter(idx);
  }, [changeChapter]);

  // Returns the next mode to toggle to (either Learn or Practice)
  const getNextToggleMode = useCallback((): Mode => {
    if (mode !== Mode.Learn && mode !== Mode.Practice) {
      return fallbackMode;
    }
    return (mode === Mode.Learn ? Mode.Practice : Mode.Learn);
  }, [mode, fallbackMode]);

  const classes = ['flex flex-row items-center justify-between min-h-[34px]'];

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
      <div className="[&>*+*]:ml-4">
        {mode !== Mode.Edit && (
          <>
            {lesson.chapters.length === 1 && (
              <span className='text-sm'>{ratio.completedCount}/{ratio.totalCount}</span>
            )}
            <Button
              buttonSize={ButtonSize.Small}
              onClick={() => restartCurrentLine(fallbackMode)}
            >
              Restart
            </Button>

            {/* This button restarts the current line in the alternate mode (either Learn or Practice) */}
            {!isLineComplete && (
              <Button
                buttonSize={ButtonSize.Small}
                onClick={() => changeMode(getNextToggleMode())}
              >
                {getNextToggleMode()}
              </Button>
            )}

            {shouldShowHintBtns() && (
              <HintButtons
                currentMove={currentMove}
                giveHint={giveHint}
                showMove={showMove}
                disabled={!isOnUnsolvedPosition()}
              />
            )}
            {isLineComplete && !areAllLinesComplete() && !isNextLineInAnotherChapter() && (
              <Button
                buttonSize={ButtonSize.Small}
                onClick={() => setupNextLine(fallbackMode)}
              >
                Next Line
              </Button>
            )}
          </>
        )}
        {isNextLineInAnotherChapter() && mode !== Mode.Edit && (
          <Button
            buttonSize={ButtonSize.Small}
            onClick={() => handleChangeChapter(getIdxOfNextIncompleteChapter())}
          >
            Next Chapter
          </Button>
        )}
        {areAllLinesComplete() && (
          <span>Done!</span>
        )}
      </div>
    </div>
  );
};

export default LessonSessionInfo;
