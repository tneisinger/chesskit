declare module 'cm-chess/src/Chess' {
  import { ShortMove } from 'chess.js';

  export enum COLOR {
    white = 'w',
    black = 'b',
  }

  export enum FEN {
    empty = '8/8/8/8/8/8/8/8 w - - 0 1',
    start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  }

  export enum EVENT_TYPE {
      illegalMove = "illegalMove",
      legalMove = "legalMove",
      undoMove = "undoMove",
      initialized = "initialized"
  }

  export type PIECE = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

  export interface Move {
    color: COLOR;
    fen: string;
    flags: string;
    from: string;
    next?: Move;
    piece: PIECE;
    ply: number;
    previous?: Move;
    san: string;
    to: string;
    variation: Move[];
    variations: Move[][];
  }

  export interface ChessProps {
    fen: string;
    pgn: string;
    chess960: boolean;
    sloppy: boolean;
  }

  declare class Chess {
    constructor(ChessProps?);

    fen(): string;

    setUpFen(): string;

    header(): Map<string, string>;

    gameOver(move?: Move): boolean | undefined;

    inDraw(move?: Move): boolean;

    inStalemate(move?: Move): boolean;

    insufficientMaterial(move?: Move): boolean;

    inThreefoldRepetition(move?: Move): boolean;

    inCheckmate(move?: Move): boolean;

    inCheck(move?: Move): boolean;

    history(): Move[];

    lastMove(): Move | undefined;

    load(fen: string);

    // TODO: fix this
    loadPgn(pgn: string, sloppy?: boolean);

    move(move: string | ShortMove, previousMove?: Move, sloppy?: boolean): Move | undefined;

    moves(): string[];

    validateMove(move: string, previousMove?: string): Move | null;

    renderPgn(
      renderHeader?: boolean,
      renderComments?: boolean,
      renderNags?: boolean,
    ): string;

    // TODO: fix this
    pieces(type?: unknown, color?: unknown, move?: Move): string[];

    turn(): COLOR;

    undo(move?: Move);

    plyCount(): number;

    fenOfPly(plyNumber: number): string;
  }
}
