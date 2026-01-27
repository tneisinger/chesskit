import { describe, it, expect } from 'vitest';
import { FEN } from 'cm-chessboard/src/Chessboard';
import {
  makeAltFensWithEnPassantSquares,
  isBookPosition,
  getBookPosition,
  isCommonPos,
  getOpening,
} from '@/utils/bookPositions';
import { GameData, PieceColor } from '@/types/chess';

describe('makeAltFensWithEnPassantSquares', () => {
  it('should return an empty array when the input fen has an en passant value', () => {
    const sicilian = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
    expect(makeAltFensWithEnPassantSquares(sicilian)).toEqual([]);
  })
  it('should return an array containing the 16 alternative fens with en passant squares', () => {
    const sicilian = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const result = makeAltFensWithEnPassantSquares(sicilian);
    expect(result).toEqual(expect.arrayContaining([
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq a3 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq a6 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq b3 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq b6 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c3 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d3 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e3 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f3 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq g3 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq g6 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq h3 0 2',
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq h6 0 2',
    ]))
  })
});

describe('isBookPosition', () => {
  it('should return true on FEN.start', () => {
    expect(isBookPosition(FEN.start)).toBe(true);
  });
  it('should return true on Sicilian fen position', () => {
    const sicilian = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
    expect(isBookPosition(sicilian)).toBe(true);
  });
  it('should return true on Sicilian fen position without en passant square specified', () => {
    const sicilian = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    expect(isBookPosition(sicilian)).toBe(true);
  });
  it('should return false on Sicilian fen position with incorrect en passant square specified', () => {
    const sicilian = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
    expect(isBookPosition(sicilian)).toBe(false);
  });
});

describe('getBookPosition', () => {
  it('should return a BookPosition on FEN.start', () => {
    const result = getBookPosition(FEN.start);
    expect(result).toBeDefined();
  });
  it('should return a BookPosition when the input is the Sicilian fen string', () => {
    const sicilian = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
    const result = getBookPosition(sicilian);
    expect(result).toBeDefined();
  });
  it('should return a BookPosition when the input is the Sicilian fen without the en passant square', () => {
    const sicilian = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const result = getBookPosition(sicilian);
    expect(result).toBeDefined();
  });
  it('should return the same result with en passant and without', () => {
    const sicilianWith = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const sicilianWithout = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const resultWith = getBookPosition(sicilianWith);
    const resultWithout = getBookPosition(sicilianWithout);
    expect(resultWith).toStrictEqual(resultWithout);
  });
});

describe('isCommonPos', () => {
  it('should return true on Sicilian fen position', () => {
    const sicilian = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
    expect(isCommonPos(sicilian)).toBe(true);
  });
  it('should return true on Sicilian fen position without en passant square specified', () => {
    const sicilian = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    expect(isCommonPos(sicilian)).toBe(true);
  });
  it('should return false on Sicilian fen position with incorrect en passant square specified', () => {
    const sicilian = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
    expect(isCommonPos(sicilian)).toBe(false);
  });
});

describe('getOpening', () => {
  it("should return a string containing 'sicilian' when input is a Sicilian game", () => {
    const game: GameData = { gameId: 'gameId', pgn: '1. e4 c5 2. Nc3 g6 *', userColor: PieceColor.BLACK, startTime: 4 };
    const result = getOpening(game);
    expect(result).not.toBeNull();
    expect(getOpening(game)).toMatch(/sicilian/i);
  });
  it("should return a string containing 'english' when input is an English game", () => {
    const game: GameData = { gameId: 'gameId', pgn: '1. c4 c5 2. Nf3 g6 *', userColor: PieceColor.BLACK, startTime: 4 };
    const result = getOpening(game);
    expect(result).not.toBeNull();
    expect(getOpening(game)).toMatch(/english/i);
  });
});
