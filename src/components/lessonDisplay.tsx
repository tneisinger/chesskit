'use client';

import { useState, useEffect, useRef } from 'react';
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
  /**
   * A boolean indicating if the lesson is modifiable (editable/deletable)
   * The default is false.
   */
  isModifiable?: boolean;
  /**
   * Optional custom URL for viewing the lesson
   * Defaults to /openings/${title}
   */
  viewUrl?: string;
  /**
   * Optional custom URL for editing the lesson
   * Defaults to /openings/${title}/edit
   */
  editUrl?: string;
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
  isModifiable = false,
  viewUrl,
  editUrl,
}: LessonDisplayProps) {
  const displayLine = getDisplayLine(lesson);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLLIElement>(null);

  // Use custom URLs or default to system lesson URLs
  const lessonViewUrl = viewUrl || `/openings/${encodeURIComponent(lesson.title)}`;
  const lessonEditUrl = editUrl || `/openings/${encodeURIComponent(lesson.title)}/edit`;

	const windowSize = useWindowSize();
	const isMobile = windowSize.width ? windowSize.width <= 768 : false;

  // Set up intersection observer for mobile devices
  useEffect(() => {
    if (!isMobile || !elementRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        threshold: 0.5, // Consider visible when 50% of the element is in view
        rootMargin: '0px',
      }
    );

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isMobile]);

  // On desktop: use hover state, on mobile: use visibility state
  const shouldCycleLineMoves = isMobile ? isVisible : isHovered;

  const classes = ['flex flex-col items-center gap-4 p-4 pt-3 rounded bg-background-page border border-foreground/10 max-w-96'];
  if (isModifiable) (classes.push('pb-1'));

  return (
    <li
      ref={elementRef}
      key={lesson.title}
      className={classes.join(' ')}
      onMouseEnter={(_e) => setIsHovered(true)}
      onMouseLeave={(_e) => setIsHovered(false)}
    >

      {/* Lesson Info */}
      <div className="flex flex-col">
        <Link href={lessonViewUrl}>
          <div
            className="text-xl font-semibold text-foreground hover:text-color-btn-primary-hover no-underline text-center mb-2"
          >
            {lesson.title}
          </div>
        </Link>

        {/* Board Preview */}
        <Link href={lessonViewUrl}>
          <PositionPreview
            line={displayLine}
            orientation={lesson.userColor}
            size={boardSize}
            cycleLineMoves={shouldCycleLineMoves}
          />
        </Link>
        <div className={`flex flex-row ${isModifiable ? 'justify-between' : 'justify-around'} mt-1`}>
          <Link href={lessonViewUrl}>
            <div className="text-sm text-foreground/60 text-center mt-3">
              {lesson.chapters.length} {lesson.chapters.length === 1 ? 'chapter' : 'chapters'}
            </div>
          </Link>

          {/* Action Buttons - only render if isModifiable is true */}
          {isModifiable && (
            <div
              className="flex items-center justify-right cursor-default"
            >
              <Link
                href={lessonEditUrl}
                className="text-[#ccc] hover:text-color-btn-primary-hover px-2 py-0 rounded hover:bg-foreground/20 no-underline"
              >
                Edit
              </Link>
              <button
                onClick={() => handleDelete(lesson.title)}
                disabled={isDeletingLesson}
                className="text-[#ccc] cursor-pointer hover:text-color-btn-primary-hover px-2 py-0 my-2 ml-3 rounded hover:bg-foreground/20 no-underline"
              >
                {isDeletingLesson ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
