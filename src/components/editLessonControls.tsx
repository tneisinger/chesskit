import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Button, { ButtonSize, ButtonStyle } from './button';
import { makePgnFromHistory } from '../utils/chess';
import { Move } from 'cm-chess/src/Chess';
import { Lesson, Mode } from '../types/lesson'
import { updateLesson } from '@/app/openings/actions';
import { updateUserLesson } from '@/app/my-repertoire/actions';
import { MAX_CHAPTERS } from "@/types/lesson";

interface Props {
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
  openAddNewChapterModal: () => void;
  doUnsavedChangesExist: (newPgn?: string) => boolean;
  savedLines: string[];
}

const EditLessonControls = ({
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
  openAddNewChapterModal,
  doUnsavedChangesExist,
  savedLines,
}: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    // Don't allow the user to stop editing if there are no saved lines.
    if (savedLines.length < 1) return;

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

  const onAddChapterBtnClick = useCallback(() => {
    if (lesson.chapters.length >= MAX_CHAPTERS) {
      window.alert(`Cannot add more than ${MAX_CHAPTERS} chapters to a lesson.`);
      return;
    }
    if (doUnsavedChangesExist()) {
      window.alert("Save or undo your changes before adding a chapter.");
      return;
    }
    openAddNewChapterModal();
  }, [doUnsavedChangesExist]);

  const onDeleteChapterBtnClick = useCallback(async () => {
    // Don't allow deleting if it's the last chapter
    if (lesson.chapters.length <= 1) {
      alert('Cannot delete the last chapter. A lesson must have at least one chapter.');
      return;
    }

		// Show confirmation dialog
		const confirmed = window.confirm(
			'Are you sure you want to delete this chapter?'
		);

		if (!confirmed) {
			return;
		}

    try {
      // Remove the current chapter from the chapters array
      const updatedChapters = lesson.chapters.filter((_, idx) => idx !== currentChapterIdx);

      // Calculate the next chapter index after deletion
      let nextChapterIdx: number;
      if (currentChapterIdx >= updatedChapters.length) {
        // If we deleted the last chapter, wrap around to the first
        nextChapterIdx = 0;
      } else {
        // Otherwise, stay at the same index (which now points to the next chapter)
        nextChapterIdx = currentChapterIdx;
      }

      const updatedLesson: Lesson = {
        ...lesson,
        chapters: updatedChapters,
      };

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
        // Create new URL with updated chapterIdx query parameter
        const params = new URLSearchParams(searchParams);
        params.set('chapterIdx', nextChapterIdx.toString());

        // Redirect to the same page with the next chapter selected
        router.push(`${pathname}?${params.toString()}`);
      } else {
        alert(`Failed to delete chapter: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting chapter:', error);
      alert('An unexpected error occurred while deleting the chapter');
    }
  }, [lesson, currentChapterIdx, router, pathname, searchParams]);

  return (
    <div className="flex flex-col items-center mb-2.5">
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
        <div className="flex flex-row w-full items-center justify-evenly">
          <div className="flex flex-col gap-2 items-center justify-evenly">
            <Button
              onClick={handleDeleteMoveBtnClick}
              disabled={currentMove == undefined}
              buttonSize={ButtonSize.Small}
            >
              Delete Move
            </Button>
            <Button
              onClick={onAddChapterBtnClick}
              buttonSize={ButtonSize.Small}
              disabled={lesson.chapters.length >= MAX_CHAPTERS || doUnsavedChangesExist()}
            >
              Add Chapter
            </Button>
            <Button
              onClick={onSaveBtnClick}
              disabled={!doUnsavedChangesExist()}
              buttonSize={ButtonSize.Small}
              buttonStyle={ButtonStyle.Danger}
            >
              Save Changes
            </Button>
          </div>
          <div className="flex flex-col gap-2 items-center justify-evenly">
            <Button
              onClick={onStopEditingBtnClick}
              buttonSize={ButtonSize.Small}
              disabled={savedLines.length < 1}
            >
              Stop Editing
            </Button>
            <Button
              onClick={onDeleteChapterBtnClick}
              buttonSize={ButtonSize.Small}
            >
              Delete Chapter
            </Button>
            <Button
              onClick={onDiscardChangesBtnClick}
              disabled={!doUnsavedChangesExist()}
              buttonSize={ButtonSize.Small}
            >
              Undo Changes
            </Button>
          </div>
      </div>
    )}
    </div >
  );
};

export default EditLessonControls;
