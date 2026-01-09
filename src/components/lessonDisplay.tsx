'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
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
  * A boolean indicating if the Add to My Repertoire button should be shown
   */
  showAddToRepertoireBtn?: boolean;
	/**
		* A function to handle add the lesson to My Repertoire
	 */
  handleAddToRepertoireBtnClick?: (lesson: Lesson) => void;

  /**
  * A boolean indicating if the 'Publish Opening' button should be shown
   */
  showPublishOpeningBtn?: boolean;

	/**
		* A function to handle publishing the opening to the Openings page
	 */
  handlePublishOpeningBtnClick?: (lesson: Lesson) => void;


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
  showAddToRepertoireBtn = false,
  handleAddToRepertoireBtnClick,
  showPublishOpeningBtn = false,
  handlePublishOpeningBtnClick,
  handleDelete,
  isDeletingLesson,
  isModifiable = false,
  viewUrl,
  editUrl,
}: LessonDisplayProps) {
  if (showAddToRepertoireBtn && !handleAddToRepertoireBtnClick) {
    throw new Error("handleAddToRepertoireBtnClick must be provided if showAddToRepertoireBtn is true");
  }

  if (showPublishOpeningBtn && !handlePublishOpeningBtnClick) {
    throw new Error("handlePublishOpeningBtnClick must be provided if showPublishOpeningBtn is true");
  }

  if (showAddToRepertoireBtn && showPublishOpeningBtn) {
    throw new Error("Cannot show both Add to Repertoire and Publish Opening buttons at the same time");
  }

  const pathname = usePathname();
  const displayLine = getDisplayLine(lesson);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLLIElement>(null);

  // Use custom URLs or default to system lesson URLs
  const lessonViewUrl = viewUrl || `/openings/${encodeURIComponent(lesson.title)}`;
  const baseEditUrl = editUrl || `/openings/${encodeURIComponent(lesson.title)}/edit`;

  // Add returnUrl query parameter to edit URL
  const lessonEditUrl = `${baseEditUrl}?returnUrl=${encodeURIComponent(pathname)}`;

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


  const numChaptersString = `${lesson.chapters.length} ${lesson.chapters.length === 1 ? 'chapter' : 'chapters'}`;
  let totalLines = 0;
  lesson.chapters.forEach((c) => totalLines += getLinesFromPGN(c.pgn).length);
  const numLinesString = `${totalLines} ${totalLines === 1 ? 'line' : 'lines'}`;

  const classes = ['flex flex-col items-center gap-4 p-4 pt-3 pb-0 rounded bg-background-page border border-foreground/10 max-w-96'];

  return (
    <li
      ref={elementRef}
      key={lesson.title}
      className={classes.join(' ')}
      onMouseEnter={(_e) => setIsHovered(true)}
      onMouseLeave={(_e) => setIsHovered(false)}
    >

      {/* Lesson Info */}
      <div className="flex flex-col w-full">
        <Link href={lessonViewUrl}>
          <div
            className="text-xl font-semibold text-foreground hover:text-color-btn-primary-hover no-underline text-center mb-1"
          >
            {lesson.title}
          </div>
        </Link>
        <Link href={lessonViewUrl}>
          <div className="text-sm text-foreground/60 text-center mb-2">
            {numChaptersString} ({numLinesString})
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
        {/* Action Buttons - only render if isModifiable is true */}
        <div className={`flex flex-row ${isModifiable ? 'justify-between' : 'justify-around'} my-1.5`}>
          {showAddToRepertoireBtn && (
            <Button
              onClick={() => {
                if (handleAddToRepertoireBtnClick) handleAddToRepertoireBtnClick(lesson)
              }}
              buttonSize={ButtonSize.Small}
            >
              Add to My Repertoire
            </Button>
          )}
          {showPublishOpeningBtn && (
            <Button
              onClick={() => {
                if (handlePublishOpeningBtnClick) handlePublishOpeningBtnClick(lesson)
              }}
              buttonSize={ButtonSize.Small}
            >
              Publish Opening
            </Button>
          )}
          {isModifiable && (
            <div className="flex flex-grow justify-end gap-3">
              <Button
                href={lessonEditUrl}
                buttonSize={ButtonSize.Small}
              >
                Edit
              </Button>
              <Button
                onClick={() => handleDelete(lesson.title)}
                disabled={isDeletingLesson}
                buttonSize={ButtonSize.Small}
                buttonStyle={ButtonStyle.Danger}
              >
                {isDeletingLesson ? "Deleting..." : "Delete"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
