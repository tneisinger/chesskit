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
  Edit = 'Edit',
  Explore = 'Explore',
  Practice = 'Practice',
}
