'use client';

import { useState } from 'react';
import type { Lesson } from "@/types/lesson";
import Link from "next/link";
import Button, { ButtonStyle, ButtonSize } from "@/components/button";
import PositionPreview from "@/components/PositionPreview";
import { getLinesFromPGN } from "@/utils/pgn";
import useWindowSize from '@/hooks/useWindowSize';

interface LessonDisplayProps {
	/**
	 * A Lesson object containing lesson details
	 */
  lesson: Lesson;
	/**
	 * The size of the board in pixels
	 */
	boardSize?: number;
	/**
		* A function to handle deletion of the lesson
	 */
  handleDelete: (title: string) => void;
	/**
		* A boolean indicating if the lesson is currently being deleted
	 */
  isDeletingLesson: boolean;
}

/**
 * Gets the display line for a lesson.
 * If displayLine is set, uses that. Otherwise, gets the first 3 moves from the first chapter.
 */
function getDisplayLine(lesson: Lesson): string[] {
	// Use displayLine if it exists
	if (lesson.displayLine && lesson.displayLine.length > 0) {
		return lesson.displayLine;
	}

	// Fallback to first 3 moves from first chapter
	if (lesson.chapters.length === 0) return [];

	const firstChapter = lesson.chapters[0];
	const lines = getLinesFromPGN(firstChapter.pgn);

	if (lines.length === 0) return [];

	// Get the first line and split it into moves
	const moves = lines[0].split(/\s+/);

	// Return first 3 moves
	return moves.slice(0, 3);
}

/**
* A component that displays a PositionPreview and lesson details.
 */
export default function LessonDisplay({
  lesson,
  boardSize = 200,
  handleDelete,
  isDeletingLesson,
}: LessonDisplayProps) {
  const displayLine = getDisplayLine(lesson);
  const [isHovered, setIsHovered] = useState(false);

	const windowSize = useWindowSize();
	const isMobile = windowSize.width ? windowSize.width <= 768 : false;

  const classes = ['flex items-center gap-4 p-4 rounded hover:bg-background-page border border-foreground/10'];
  if (isMobile) classes.push('flex-col');

  return (
    <li
      key={lesson.title}
      className={classes.join(' ')}
      onMouseEnter={(_e) => setIsHovered(true)}
      onMouseLeave={(_e) => setIsHovered(false)}
    >

      {/* Lesson Info */}
      <div className="flex flex-col flex-1 gap-2">
        <Link
          href={`/openings/${encodeURIComponent(lesson.title)}`}
          className="text-xl font-semibold text-foreground hover:text-color-btn-primary-hover no-underline"
        >
          {lesson.title}
        </Link>
        <div className="text-sm text-foreground/60">
          {lesson.chapters.length} {lesson.chapters.length === 1 ? 'chapter' : 'chapters'}
        </div>
      </div>

      {/* Board Preview */}
      <Link
        href={`/openings/${encodeURIComponent(lesson.title)}`}
        className="flex-shrink-0"
      >
        <PositionPreview
          line={displayLine}
          orientation={lesson.userColor}
          size={boardSize}
          cycleLineMoves={isHovered}
        />
      </Link>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/openings/${encodeURIComponent(lesson.title)}/edit`}
          className="text-sm text-[#aaa] hover:text-color-btn-primary-hover px-3 py-2 rounded hover:bg-foreground/10 no-underline"
        >
          Edit
        </Link>
        <Button
          buttonStyle={ButtonStyle.Danger}
          buttonSize={ButtonSize.Small}
          onClick={() => handleDelete(lesson.title)}
          disabled={isDeletingLesson}
        >
          {isDeletingLesson ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </li>
  )
}
