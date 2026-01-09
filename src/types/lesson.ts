import { PieceColor } from '@/types/chess'

export const MAX_CHAPTERS = 10;
export const MAX_CHAPTER_TITLE_LENGTH = 28;
export const MAX_PGN_LENGTH = 2500;
export const MAX_LESSON_TITLE_LENGTH = 28;
export const MAX_DISPLAY_LINE_PLIES = 20;

export interface Chapter {
  title: string,
  notes?: string,
  pgn: string,
}

export interface Lesson {
  id?: number;
  title: string;
  userColor: PieceColor;
  chapters: Chapter[];
  displayLine?: string[],
}

export interface LineStats {
  isComplete: boolean,
}

export enum Mode {
  Learn = 'Learn',
  Practice = 'Practice',
  Explore = 'Explore',
  Edit = 'Edit',
}
