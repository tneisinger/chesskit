import type { ParsedPGN } from 'pgn-parser';
import { RequireOnlyOne } from '../utils';

export interface ShortMove {
  from: string;
  to: string;
  promotion?: string;
}

export enum PieceColor {
  WHITE = 'WHITE',
  BLACK = 'BLACK',
}

export enum ChessWebsite {
  Chesscom = 'chess.com',
  Lichess = 'lichess.org',
}

export interface GameData {
  id?: number;
  gameId: string;
  pgn: ParsedPGN;
  userColor: PieceColor;
  result?: GameResult;
  startTime: number;
  url?: string;
  createdAt?: Date;
  hasBeenCompletelyAnalyzed?: boolean;
  timeControl?: string;
  whiteName?: string;
  whiteElo?: number;
  blackName?: string;
  blackElo?: number;
}

export enum GameResult {
  WhiteWins = '1-0',
  BlackWins = '0-1',
  Draw = '1/2-1/2',
}

interface Eval {
  cp?: number;
  mate?: number;
  depth: number;
  fen: string;
  prevFen?: string;
  playedMove?: ShortMove;
  bestMove?: ShortMove;
}

export type Evaluation = RequireOnlyOne<Eval, 'cp' | 'mate'>

export type FenParts = {
  piecePlacement: string;
  activeColor: PieceColor;
  castling: string;
  enPassantSquare: string;
  halfMoveClock: number;
  fullMoveNumber: number;
};

/**
 * A map from fen strings to Evaluations for one chess game.
 */
export type GameEvals = Record<string, Evaluation>;

export enum MoveJudgement {
  Best = 'best',
  Excellent = 'excellent',
  Good = 'good',
  Inaccurate = 'inaccurate',
  Mistake = 'a mistake',
  Blunder = 'a blunder',
}

export type TimeControl =
  | DailyGameTimeControl
  | TimedGameTimeControl;

interface DailyGameTimeControl {
  numDaysPerMove: number;
}

interface TimedGameTimeControl {
  limitSeconds: number;
  incrementSeconds: number;
}
