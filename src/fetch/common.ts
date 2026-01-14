import { GameData } from '@/types/chess';

export const DEFAULT_MAX_GAMES = 30;

export interface Options {
  maxGames?: number;
  newGamesOnly?: boolean;
}

// Placeholder for Games type
export type Games = Record<string, GameData>;
