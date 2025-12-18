import { useState, useCallback, useEffect } from 'react';
import Button, { ButtonSize, ButtonStyle } from './button';
import { makePgnFromHistory } from '../utils/chess';
import { Move } from 'cm-chess/src/Chess';
import { Lesson, Mode } from '../types/lesson'
import { updateLesson } from '@/app/openings/actions';
import { updateUserLesson } from '@/app/my-openings/actions';

interface Props {
  lines: string[];
  currentMove: Move | undefined;
  lesson: Lesson;
  currentChapterIdx: number;
  history: Move[];
  mode: Mode;
  fallbackMode: Mode;
  onEditModeBtnClick: () => void;
  deleteCurrentMove: () => void;
  onDiscardChangesBtnClick: () => void;
  setupNextLine: (nextMode: Mode) => void;
}

const EditLessonControls = ({
  lines,
  currentMove,
  lesson,
  currentChapterIdx,
  history,
  mode,
  fallbackMode,
  onEditModeBtnClick,
  deleteCurrentMove,
  onDiscardChangesBtnClick,
  setupNextLine,
}: Props) => {
  const [savedPgn, setSavedPgn] = useState('');

  const [timeEditModeEntered, setTimeEditModeEntered] = useState<number | null>(null);

  useEffect(() => {
    if (lesson && lesson.chapters[currentChapterIdx]) {
      setSavedPgn(lesson.chapters[currentChapterIdx].pgn);
    }
  }, [lesson, currentChapterIdx])

  useEffect(() => {
    if (mode === Mode.Edit) {
      setTimeEditModeEntered(Date.now());
    } else {
      setTimeEditModeEntered(null);
    }
  }, [mode])

  // This function is needed because the move history does not update instantly when switching to
  // edit mode. Using this function in 'doUnsavedChangesExist' prevents that function from
  // returning true for a brief moment while the history is being updated.
  const hasBeenInEditModeForMoreThanTwoSeconds = useCallback(() => {
    if (timeEditModeEntered == null) return false;
    const currentTime = Date.now();
    const diff = currentTime - timeEditModeEntered;
    return diff > 1000;
  }, [timeEditModeEntered])

  const doUnsavedChangesExist = useCallback((newPgn?: string) => {
    if (!hasBeenInEditModeForMoreThanTwoSeconds()) return false;
    if (newPgn == undefined) newPgn = makePgnFromHistory(history);
    return savedPgn !== newPgn;
  }, [savedPgn, history, timeEditModeEntered]);

  const handleDeleteMoveBtnClick = useCallback(() => {
    deleteCurrentMove();
  }, [deleteCurrentMove])

  const onSaveBtnClick = useCallback(async () => {
    const newPgn = makePgnFromHistory(history);
    if (!doUnsavedChangesExist(newPgn)) return;

		// Show confirmation dialog
		const confirmed = window.confirm(
			'Are you sure you want to save these changes?'
		);

		if (!confirmed) {
			return;
		}

    // Create updated lesson with the new PGN for the current chapter
    const updatedChapters = [...lesson.chapters];
    updatedChapters[currentChapterIdx] = {
      ...updatedChapters[currentChapterIdx],
      pgn: newPgn,
    };

    const updatedLesson: Lesson = {
      ...lesson,
      chapters: updatedChapters,
    };

    try {
      let result;

      // Check if this is a user lesson (has id) or system lesson (uses title)
      if (lesson.id !== undefined) {
        // User lesson - update via updateUserLesson
        result = await updateUserLesson(lesson.id, updatedLesson);
      } else {
        // System lesson - update via updateLesson
        result = await updateLesson(lesson.title, updatedLesson);
      }

      if (result.success) {
        // Reload the page to show the updated lesson
        window.location.reload();
      } else {
        alert(`Failed to save changes: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving lesson:', error);
      alert('An unexpected error occurred while saving changes');
    }
  }, [history, lesson, currentChapterIdx]);

  const onStopEditingBtnClick = useCallback(() => {
    if (doUnsavedChangesExist()) {
      // Show confirmation dialog
      const confirmed = window.confirm(
        'You have unsaved changes that will be lost.\nDo you want to discard these changes?'
      );

      if (!confirmed) {
        return;
      }
    }
    setupNextLine(fallbackMode)
  }, [fallbackMode, doUnsavedChangesExist])

  return (
    <div className="flex flex-col items-center mb-1">
      <h4 className='mt-2 mb-1'>You are in {mode} Mode</h4>
      {mode !== Mode.Edit && (
        <Button
          onClick={onEditModeBtnClick}
          buttonSize={ButtonSize.Small}
        >
          Edit Lesson
        </Button>
      )}
      {mode === Mode.Edit && (
        <>
          <div className="flex flex-row w-full items-center justify-evenly [&_button+button]:mt-2">
            <Button
              onClick={onSaveBtnClick}
              disabled={!doUnsavedChangesExist()}
              buttonSize={ButtonSize.Small}
              buttonStyle={ButtonStyle.Danger}
            >
              Save Changes
            </Button>
            <Button
              onClick={handleDeleteMoveBtnClick}
              disabled={currentMove == undefined}
              buttonSize={ButtonSize.Small}
            >
              Delete Move
            </Button>
          </div>
          <div className="flex flex-row w-full items-center justify-evenly [&_button+button]:mt-2">
            <Button
              onClick={onDiscardChangesBtnClick}
              disabled={!doUnsavedChangesExist()}
              buttonSize={ButtonSize.Small}
            >
              Undo Changes
            </Button>
            <Button
              onClick={() => console.log('Add chapter not implemented yet')}
              buttonSize={ButtonSize.Small}
            >
              Add Chapter
            </Button>
          </div>
          <div className="flex flex-row w-full items-center justify-evenly [&_button+button]:mt-2">
            <Button
              onClick={onStopEditingBtnClick}
              buttonSize={ButtonSize.Small}
            >
              Stop Editing
            </Button>
          </div>
      </>
    )}
    </div >
  );
};

export default EditLessonControls;
