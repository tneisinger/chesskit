import { useMemo } from 'react';
import type { Lesson, LineStats } from '@/types/lesson';
import { getLinesFromPGN } from '@/utils/pgn';
import { convertSanLineToLanLine } from '@/utils/chess';

export interface ChapterCompletionRatio {
	completedCount: number;
	totalCount: number;
}

/**
 * Calculates the completion ratio for each chapter in a lesson.
 * Returns an array where each element corresponds to a chapter with its completed/total line counts.
 *
 * @param lesson - The lesson containing chapters with PGN data (can be undefined)
 * @param lines - The record of line stats showing which lines are complete
 * @returns Array of completion ratios {completedCount, totalCount} for each chapter, or empty array if lesson is undefined
 *
 * @example
 * const ratios = useChapterCompletionRatios(lesson, lines);
 * if (ratios.length > 0) {
 *   const chapterProgress = `${ratios[0].completedCount}/${ratios[0].totalCount}`;
 * }
 */
export function useChapterCompletionRatios(
	lesson: Lesson | undefined,
	lines: Record<string, LineStats>[]
): ChapterCompletionRatio[] {
	return useMemo(() => {
		if (!lesson) {
			return [];
		}

		return lesson.chapters.map((chapter, idx) => {
			const sanLines = getLinesFromPGN(chapter.pgn);
			const lanLines = sanLines.map((l) =>
				convertSanLineToLanLine(l.split(/\s+/))
			);

			let completedCount = 0;
			let totalCount = 0;

			lanLines.forEach((line) => {
				const lineKey = line.join(' ');
				totalCount++;
				if (lines[idx] && lines[idx][lineKey]?.isComplete) {
					completedCount++;
				}
			});

			return { completedCount, totalCount };
		});
	}, [lesson, lines]);
}
