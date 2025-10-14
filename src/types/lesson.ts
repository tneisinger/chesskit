import { PieceColor } from '@/types/chess'

export interface Lesson {
  title: string;
  userColor: PieceColor;
  pgn: string;
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
