import React, { useState, useCallback, useEffect } from 'react';
import Button, { ButtonSize, ButtonStyle } from './button';
import { makePgnFromHistory, shortMoveToLan } from '../utils/chess';
import { getVariations } from '@/utils/cmchess';
import { Move } from 'cm-chess/src/Chess';
import { Lesson, Mode } from '../types/lesson'
import { updateLesson } from '@/app/openings/actions';
import { updateUserLesson } from '@/app/my-openings/actions';
// import useStore from '../zustand/store';

interface Props {
  lines: string[];
  currentMove: Move | undefined;
  lesson: Lesson;
  currentChapterIdx: number;
  history: Move[];
  mode: Mode;
  onEditModeBtnClick: () => void;
  onDeleteMoveBtnClick: () => void;
  onDiscardChangesBtnClick: () => void;
  setupNextLine: (nextMode: Mode) => void;
}

const LessonControls = ({
  lines,
  currentMove,
  lesson,
  currentChapterIdx,
  history,
  mode,
  onEditModeBtnClick,
  onDeleteMoveBtnClick,
  onDiscardChangesBtnClick,
  setupNextLine,
}: Props) => {
  // const zState = useStore((state) => state);

  const [isHistorySameAsLesson, setIsHistorySameAsLesson] = useState(true);

  const onSaveBtnClick = useCallback(async () => {
    const newPgn = makePgnFromHistory(history);

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
        // window.location.reload();
      } else {
        alert(`Failed to save changes: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving lesson:', error);
      alert('An unexpected error occurred while saving changes');
    }
  }, [history, lesson, currentChapterIdx]);

  // Whenever history or lines changes, check if history is the same as lesson
  // and update the `isHistorySameAsLesson` state accordingly
  useEffect(() => {
    const hLines = getVariations(history);
    if (hLines.length !== lines.length) {
      setIsHistorySameAsLesson(false);
      return;
    }
    const hLanLines = hLines.map((l) =>
      l.map((m) => shortMoveToLan(m)).join(' ')
    );
    for (let i = 0; i < lines.length; i++) {
      const idx = hLanLines.indexOf(lines[i]);
      if (idx === -1) {
        setIsHistorySameAsLesson(false);
        return;
      } else {
        hLanLines.splice(idx, 1);
      }
    }
    setIsHistorySameAsLesson(hLanLines.length === 0);
  }, [history, lines]);

  return (
    <div className="flex flex-col flex-wrap items-center mb-2 [&_h4]:mt-1 [&_h4]:mb-3">
      <h4>You are in {mode} Mode</h4>
      {mode !== Mode.Edit && (
        <Button
          onClick={onEditModeBtnClick}
          buttonSize={ButtonSize.Small}
        >
          Edit Lesson
        </Button>
      )}
      {mode === Mode.Edit && (
        <div className="w-full flex flex-row">
          <div className="flex flex-col w-1/2 items-center justify-center [&_button+button]:mt-2">
            <Button
              onClick={onSaveBtnClick}
              disabled={isHistorySameAsLesson}
              buttonSize={ButtonSize.Small}
              buttonStyle={ButtonStyle.Danger}
            >
              Save Changes
            </Button>
            <Button
              onClick={onDeleteMoveBtnClick}
              disabled={currentMove == undefined}
              buttonSize={ButtonSize.Small}
              buttonStyle={ButtonStyle.Danger}
            >
              Delete Move
            </Button>
          </div>
          <div className="flex flex-col w-1/2 items-center justify-center [&_button+button]:mt-2">
            <Button
              onClick={onDiscardChangesBtnClick}
              disabled={isHistorySameAsLesson}
              buttonSize={ButtonSize.Small}
            >
              Discard Changes
            </Button>
            <Button
              onClick={() => setupNextLine(Mode.Practice)}
              buttonSize={ButtonSize.Small}
            >
              Practice Mode
            </Button>
          </div>
        </div>
      )}
    </div >
  );
};

export default LessonControls;
