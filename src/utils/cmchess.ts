import { Chess as CmChess, COLOR, Move } from 'cm-chess/src/Chess';
import { MarkerTypeConfig } from 'cm-chessboard/src/extensions/markers/Markers';
import ChessJS from '@/chessjs';
import { Square, Move as ChessJsMove } from 'chess.js';
import { PieceColor, ShortMove } from '@/types/chess';
import {
  isSubline,
  performMove,
  shortMoveToLan,
  lanToShortMove,
  areMovesEqual as areShortMovesEqual,
  convertSanLineToLanLine,
} from '@/utils/chess';
import { getLinesFromPGN } from './pgn';

export function areMovesEqual(m1: Move | undefined, m2: Move | undefined): boolean {
  if (m1 == undefined || m2 == undefined) return false;

  return (
    m1.fen === m2.fen &&
    m1.ply === m2.ply &&
    m1.san === m2.san &&
    m1.flags === m2.flags
  );
}

export interface Marker {
  square: string;
  type: MarkerTypeConfig;
}

/**
 * Get the legal moves from a cmchess instance. Cmchess doesn't have a moves method to
 * get the legal moves (like chess.js does), so we use chessjs to do that.
 */
export function getLegalMoves(
  cmchess: CmChess,
  square?: string,
): ChessJsMove[] {
  const chessjs = new ChessJS();
  if (!Boolean(chessjs.load(cmchess.fen()))) throw new Error('Failed to load fen');
  return chessjs.moves({ square: square as Square, verbose: true }) as ChessJsMove[];
}

/**
 * Create a new CmChess instance that is at the given move. The history of the returned
 * CmChess instance will contain the full line up to the given move.
 */
export function newCmChessFromMove(move: Move): CmChess {
  const cmchess = new CmChess();
  move.variation.slice(0, move.ply).forEach((move) => cmchess.move(move.san));
  return cmchess;
}

export function newCmChessFromHistory(history: Move[]): CmChess {
  const cmchess = new CmChess();
  history.forEach((move) => {
    cmchess.move(move.san);
  });
  return cmchess;
}

export function resetCmChess(cmchess: CmChess, move?: Move): void {
  const history = cmchess.history()
  for (let i = 0; i < history.length; i++) {
    cmchess.undo();
  }

  if (move) {
    move.variation.slice(0, move.ply).forEach((move) => cmchess.move(move.san));
  }
}

/**
 * Convert a PieceColor to the cm-chess type COLOR
 */
export function toColor(pieceColor: PieceColor): COLOR {
  return pieceColor === PieceColor.WHITE ? COLOR.white : COLOR.black;
}

export function getLineFromCmMove(move: Move | undefined): Move[] {
  const result: Move[] = [];
  let currentObject = move;
  while (currentObject) {
    result.unshift(currentObject);
    currentObject = currentObject.previous;
  }
  return result;
}

export function getLanLineFromCmMove(move: Move | undefined): string[] {
  return getLineFromCmMove(move).map((m) => shortMoveToLan(m));
}

export function getSanLine(moves: Move[], fen?: string): string[] {
  const chessjs = new ChessJS();
  if (fen) chessjs.load(fen);
  moves.forEach((move) => performMove(move, chessjs));
  return chessjs.history() as string[];
}

export function getVariations(
  history: Move[],
  priorMoves: ShortMove[] = [],
  subLine?: ShortMove[],
): ShortMove[][] {
  const result: ShortMove[][] = [];
  const mainLine = [...priorMoves, ...(history as ShortMove[])];
  if (subLine == undefined || isSubline(subLine, mainLine)) {
    result.push(mainLine);
  }
  history.forEach((move) => {
    if (move.variations.length > 0) {
      move.variations.forEach((variation) => {
        const prior = getLineFromCmMove(move).slice(0, -1);
        getVariations(variation, prior).forEach((v) => {
          if (subLine == undefined || isSubline(subLine, v)) result.push(v)
        });
      });
    }
  })
  return result;
}

// Moves are equal if they have identical lines.
export function areCmMovesEqual(m1: Move | undefined, m2: Move | undefined): boolean {
  const line1 = getLineFromCmMove(m1);
  const line2 = getLineFromCmMove(m2);
  if (line1.length !== line2.length) return false;
  for (let i = 0; i < line1.length; i++) {
    if (!areMovesEqual(line1[i], line2[i])) return false;
  }
  return true;
}

// Render the pgn of a cmchess instance, but add an "*" to the end of the pgn
// if no game result (ie "1-0", "0-1", "1/2-1/2", or "*") is at the end of the pgn.
// The reason to do this is because pgn-parser will fail to parse a pgn if it
// doesn't have a game result at the end.
export function renderPgn(
  cmchess: CmChess,
  renderHeader?: boolean,
  renderComments?: boolean,
  renderNags?: boolean,
): string {
  const pgn = cmchess.renderPgn(renderHeader, renderComments, renderNags);
  const lastWord = pgn.split(' ').slice(-1)[0];
  const gameResults = ['1-0', '0-1', '1/2-1/2', '*'];
  if (gameResults.includes(lastWord)) return pgn;
  return pgn + ' *';
}

/**
 * Get the last move of the lanLine from history. If the full line doesn't exist
 * in history, return the last move that was in the line. If lanLine is empty,
 * return undefined. If the lanLine is not in history at all, return undefined.
 * Undefined represents the starting position, which would be the first shared
 * position of the lanLine and the history if lanLine and history have no common
 * moves.
 */
export function getLastMoveOfLine(
  lanLine: string[],
  history: Move[]
): Move | undefined {
  if (lanLine.length === 0) return undefined;
  if (history.length === 0) return undefined;

  let nextMoves = [...history];
  let currentMove: Move = nextMoves.shift()!;

  for (let i = 0; i < lanLine.length; i++) {
    const move = lanToShortMove(lanLine[i]);
    if (areShortMovesEqual(move, currentMove)) {
      if (i === lanLine.length - 1) return currentMove;
      if (nextMoves.length === 0) return currentMove;
      currentMove = nextMoves.shift()!;
    } else {
      const v = currentMove.variations.find((v) => areShortMovesEqual(v[0], move));
      if (v == undefined) return currentMove.previous;
      if (i === lanLine.length - 1) return v[0];
      if (v.length === 1) return v[0];
      nextMoves = v.slice(1);
      currentMove = nextMoves.shift()!;
    }
  }
  return currentMove;
}

// Add the lanLine to cmchess. If the lanLine is already in cmchess, do nothing.
// Do not add any moves that already exist in cmchess, because cmchess will not
// prevent duplicate moves from being added. Return the last move of the lanLine
// from the history of cmchess (or undefined if lanLine is empty). If no moves overlap
// between lanLine and cmchess, that lanLine cannot be added to cmchess because cmchess
// does not allow variations from the starting position. In that case, return undefined.
export function addLineToCmChess(cmchess: CmChess, lanLine: string[]): Move | undefined {
  if (lanLine.length === 0) return undefined;

  let lastCommonMove = getLastMoveOfLine(lanLine, cmchess.history());

  const history = cmchess.history();

  // If cmchess has a history of moves and no moves overlap between lanLine and
  // cmchess, return undefined.
  if (history.length > 0 && lastCommonMove == undefined) return undefined;

  // If the lanLine is already in cmchess, just return the lastCommonMove.
  if (lastCommonMove && lastCommonMove.ply >= lanLine.length) return lastCommonMove;

  const ply = lastCommonMove ? lastCommonMove.ply : 0;
  const remainingMoves = lanLine.slice(ply).map(m => lanToShortMove(m));
  remainingMoves.forEach((move) => {
    lastCommonMove = cmchess.move(move, lastCommonMove);
  });
  return lastCommonMove;
}

// Create a new CmChess instance with the given move deleted. All subsequent
// moves and variations will also be deleted.
export function deleteMoveFromCmChess(cmchess: CmChess, move: Move): CmChess {
  const lines = getVariations(cmchess.history());
  const line = getLineFromCmMove(move);

  // Slice off the end of any lines that contain the move to delete.
  const slicedLines = lines.map((l) => isSubline(line, l) ? l.slice(0, line.length - 1) : l);
  const lanLines = slicedLines.map((l) => l.map((move) => shortMoveToLan(move)));

  const newCmChess = new CmChess();
  lanLines.forEach((l) => addLineToCmChess(newCmChess, l));
  return newCmChess;
}

export function loadPgnIntoCmChess(pgn: string, cmchess: CmChess): CmChess {
  try {
    cmchess.loadPgn(pgn.trim());
  } catch (error: any) {
    if (error instanceof Error) {
      if (error.name === 'SyntaxError') {
        // Try to fix the pgn by adding a game result if missing
        const fixedPgn = pgn + ' 1/2-1/2';
        try {
          cmchess.loadPgn(fixedPgn);
          return cmchess;
        } catch {
          console.log(fixedPgn);
          throw error;
        }
      }

    } else if (error.toString().includes('IllegalMoveException')) {
      // Some valid pgns cause cmchess to throw an IllegalMoveException.
      // In that case, load the lines manually
      cmchess = new CmChess();
      getLinesFromPGN(pgn).forEach((line) => {
        // Include if statement to satisfy the type checker.
        if (cmchess) addLineToCmChess(cmchess, convertSanLineToLanLine(line.split(' ')));
      });
      return cmchess;
    }
  }
  return cmchess;
}
