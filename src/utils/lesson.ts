import {
  Lesson,
  MAX_CHAPTERS,
  MAX_CHAPTER_TITLE_LENGTH,
  MAX_PGN_LENGTH,
  MAX_LESSON_TITLE_LENGTH,
  MAX_DISPLAY_LINE_PLIES,
  LineStats,
} from "@/types/lesson";
import { getLinesFromPGN } from "./pgn";
import { convertSanLineToLanLine } from "./chess";
import { Move } from 'cm-chess/src/Chess';
import { getLanLineFromCmMove } from "./cmchess";

export function sortLessonsByTitle(lessons: Lesson[]): void {
  lessons.sort((a, b) => {
    const stripArticles = (str: string) => {
      return str.replace(/^(the|a|an)\s+/i, '').trim();
    };
    const strippedA = stripArticles(a.title);
    const strippedB = stripArticles(b.title);
    return strippedA.localeCompare(strippedB);
  })
}

export function performLessonLimitChecks(
  lesson: Lesson,
): { success: boolean; error?: string } {

  // Check if lesson has too many chapters
  if (lesson.chapters.length > MAX_CHAPTERS) {
    return {
      success: false,
      error: `A lesson cannot have more than ${MAX_CHAPTERS} chapters.`,
    };
  }

  // Check if any chapter PGN is too long
  for (const [i, c] of lesson.chapters.entries()) {
    if (c.pgn.length > MAX_PGN_LENGTH) {
      return {
        success: false,
        error: `The PGN of chapter ${i + 1} is too long. Reduce the moves section by ${c.pgn.length - MAX_PGN_LENGTH} characters.`
      };
    }
  };

  // Check if lesson title is too long
  if (lesson.title.length > MAX_LESSON_TITLE_LENGTH) {
    return {
      success: false,
      error: `The lesson title is too long. Please limit it to ${MAX_LESSON_TITLE_LENGTH} characters.`
    };
  }

  // Check if display line is too long
  if (lesson.displayLine && lesson.displayLine.length > MAX_DISPLAY_LINE_PLIES) {
    return {
      success: false,
      error: `The display line cannot have more than ${MAX_DISPLAY_LINE_PLIES} moves.`,
    }
  }

  // Check if a chapter title is too long
  for (const [i, c] of lesson.chapters.entries()) {
    if (c.title.length > MAX_CHAPTER_TITLE_LENGTH) {
      return {
        success: false,
        error: `The title of chapter ${i + 1} is too long. Reduce it by ${c.title.length - MAX_CHAPTER_TITLE_LENGTH} characters.`,
      }
    }
  }

  return { success: true };
}

// Create a record from a lanLine string to a LineStats object. There will be an
// entry for each line in the pgn.
export function makeLineStatsRecord(pgn: string): Record<string, LineStats> {
  const result: Record<string, LineStats> = {};
  const sanLines = getLinesFromPGN(pgn);
  const lanLines = sanLines.map((l) => convertSanLineToLanLine(l.split(/\s+/)));
  lanLines.forEach((line) => {
    result[line.join(' ')] = { isComplete: false };
  });
  return result;
}

export function getRelevantLessonLines(
  lines: Record<string, LineStats>,
  currentMove: Move | undefined,
  options?: { incompleteLinesOnly: boolean },
): string[] {
  if (lines == undefined) return [];
  if (currentMove == undefined) return Object.keys(lines);
  const currentMoveLine = getLanLineFromCmMove(currentMove);
  const relevantLines: string[] = [];
  Object.keys(lines).forEach((k) => {
    if (options?.incompleteLinesOnly && lines[k].isComplete) return;
    const line = k.split(' ');
    let isRelevant = true;
    for (let i = 0; i < currentMoveLine.length; i++) {
      if (currentMoveLine[i] !== line[i]) {
        isRelevant = false;
        break;
      }
    }
    if (isRelevant) relevantLines.push(k);
  });
  return relevantLines;
}
