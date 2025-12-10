import { PieceColor } from '@/types/chess'

export interface Chapter {
  title: string,
  notes?: string,
  pgn: string,
}

export interface Lesson {
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
