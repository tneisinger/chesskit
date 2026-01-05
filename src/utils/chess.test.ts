import { describe, it, expect } from 'vitest';
import {
  areMovesEqual,
  areLinesEqual,
  convertLanLineToShortMoves,
  convertSanLineToLanLine,
  getNextToPlay,
  getPlyFromFen,
  shortMoveToLan,
  lanToShortMove,
  getFenParts,
  isSubline,
  getSharedMoves,
  performMove,
  areSansEquivalent,
  makeMoveNumberString,
  timeControlToReadableString,
  stringToTimeControl,
  makePgnFromHistory,
} from './chess';
import { PieceColor, ShortMove } from '@/types/chess';
import { Chess as ChessJS } from 'chess.js';
import { Chess as CmChess } from 'cm-chess/src/Chess';

describe('chess utilities', () => {
  describe('areMovesEqual', () => {
    it('should return true for identical moves', () => {
      const move1: ShortMove = { from: 'e2', to: 'e4' } as ShortMove;
      const move2: ShortMove = { from: 'e2', to: 'e4' } as ShortMove;
      expect(areMovesEqual(move1, move2)).toBe(true);
    });

    it('should return false for different moves', () => {
      const move1: ShortMove = { from: 'e2', to: 'e4' } as ShortMove;
      const move2: ShortMove = { from: 'd2', to: 'd4' } as ShortMove;
      expect(areMovesEqual(move1, move2)).toBe(false);
    });

    it('should handle promotion correctly', () => {
      const move1: ShortMove = { from: 'e7', to: 'e8', promotion: 'q' } as ShortMove;
      const move2: ShortMove = { from: 'e7', to: 'e8', promotion: 'q' } as ShortMove;
      const move3: ShortMove = { from: 'e7', to: 'e8', promotion: 'r' } as ShortMove;

      expect(areMovesEqual(move1, move2)).toBe(true);
      expect(areMovesEqual(move1, move3)).toBe(false);
    });
  });

  describe('areLinesEqual', () => {
    it('should return true for identical lines', () => {
      const line1: ShortMove[] = [
        { from: 'e2', to: 'e4' } as ShortMove,
        { from: 'e7', to: 'e5' } as ShortMove,
      ];
      const line2: ShortMove[] = [
        { from: 'e2', to: 'e4' } as ShortMove,
        { from: 'e7', to: 'e5' } as ShortMove,
      ];
      expect(areLinesEqual(line1, line2)).toBe(true);
    });

    it('should return false for different length lines', () => {
      const line1: ShortMove[] = [{ from: 'e2', to: 'e4' } as ShortMove];
      const line2: ShortMove[] = [
        { from: 'e2', to: 'e4' } as ShortMove,
        { from: 'e7', to: 'e5' } as ShortMove,
      ];
      expect(areLinesEqual(line1, line2)).toBe(false);
    });
  });

  describe('getNextToPlay', () => {
    it('should return WHITE for starting position', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      expect(getNextToPlay(startingFen)).toBe(PieceColor.WHITE);
    });

    it('should return BLACK after white moves', () => {
      const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      expect(getNextToPlay(afterE4)).toBe(PieceColor.BLACK);
    });
  });

  describe('getPlyFromFen', () => {
    it('should return 0 for starting position', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      expect(getPlyFromFen(startingFen)).toBe(0);
    });

    it('should return 1 after white moves', () => {
      const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      expect(getPlyFromFen(afterE4)).toBe(1);
    });

    it('should return 2 after black moves', () => {
      const afterE4E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
      expect(getPlyFromFen(afterE4E5)).toBe(2);
    });
  });

  describe('getFenParts', () => {
    it('should parse starting position correctly', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const parts = getFenParts(startingFen);

      expect(parts.piecePlacement).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
      expect(parts.activeColor).toBe(PieceColor.WHITE);
      expect(parts.castling).toBe('KQkq');
      expect(parts.enPassantSquare).toBe('-');
      expect(parts.halfMoveClock).toBe(0);
      expect(parts.fullMoveNumber).toBe(1);
    });
  });

  describe('shortMoveToLan and lanToShortMove', () => {
    it('should convert between ShortMove and LAN notation', () => {
      const shortMove: ShortMove = { from: 'e2', to: 'e4' } as ShortMove;
      const lan = shortMoveToLan(shortMove);
      expect(lan).toBe('e2e4');

      const convertedBack = lanToShortMove(lan);
      expect(areMovesEqual(convertedBack, shortMove)).toBe(true);
    });

    it('should handle promotions', () => {
      const shortMove: ShortMove = { from: 'e7', to: 'e8', promotion: 'q' } as ShortMove;
      const lan = shortMoveToLan(shortMove);
      expect(lan).toBe('e7e8q');

      const convertedBack = lanToShortMove(lan);
      expect(areMovesEqual(convertedBack, shortMove)).toBe(true);
    });
  });

  describe('convertSanLineToLanLine', () => {
    it('should convert SAN line to LAN line', () => {
      const sanLine = ['e4', 'e5', 'Nf3', 'Nc6'];
      const lanLine = convertSanLineToLanLine(sanLine);

      expect(lanLine).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    });
  });

  describe('convertLanLineToShortMoves', () => {
    it('should convert LAN line to ShortMoves', () => {
      const lanLine = ['e2e4', 'e7e5'];
      const shortMoves = convertLanLineToShortMoves(lanLine);

      expect(shortMoves.length).toBe(2);
      expect(shortMoves[0].from).toBe('e2');
      expect(shortMoves[0].to).toBe('e4');
      expect(shortMoves[1].from).toBe('e7');
      expect(shortMoves[1].to).toBe('e5');
    });
  });

  describe('isSubline', () => {
    it('should return true when line1 is a subline of line2', () => {
      const line1: ShortMove[] = [
        { from: 'e2', to: 'e4' } as ShortMove,
      ];
      const line2: ShortMove[] = [
        { from: 'e2', to: 'e4' } as ShortMove,
        { from: 'e7', to: 'e5' } as ShortMove,
      ];
      expect(isSubline(line1, line2)).toBe(true);
    });

    it('should return false when line1 is longer than line2', () => {
      const line1: ShortMove[] = [
        { from: 'e2', to: 'e4' } as ShortMove,
        { from: 'e7', to: 'e5' } as ShortMove,
      ];
      const line2: ShortMove[] = [
        { from: 'e2', to: 'e4' } as ShortMove,
      ];
      expect(isSubline(line1, line2)).toBe(false);
    });
  });

  describe('getSharedMoves', () => {
    it('should return shared moves between two lines', () => {
      const line1: ShortMove[] = [
        { from: 'e2', to: 'e4' } as ShortMove,
        { from: 'e7', to: 'e5' } as ShortMove,
        { from: 'g1', to: 'f3' } as ShortMove,
      ];
      const line2: ShortMove[] = [
        { from: 'e2', to: 'e4' } as ShortMove,
        { from: 'e7', to: 'e5' } as ShortMove,
        { from: 'f1', to: 'c4' } as ShortMove,
      ];
      const shared = getSharedMoves(line1, line2);

      expect(shared.length).toBe(2);
      expect(shared[0].from).toBe('e2');
      expect(shared[1].from).toBe('e7');
    });
  });

  describe('performMove', () => {
    it('should play a valid move', () => {
      const chess = new ChessJS();
      const move = performMove('e4', chess);
      expect(move).toBeDefined();
      expect(move.san).toBe('e4');
    });

    it('should throw error for invalid move', () => {
      const chess = new ChessJS();
      expect(() => performMove('e5', chess)).toThrow();
    });
  });

  describe('areSansEquivalent', () => {
    it('should return true for equivalent SAN moves', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      expect(areSansEquivalent(fen, 'e4', 'e4')).toBe(true);
    });

    it('should return false for different moves', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      expect(areSansEquivalent(fen, 'e4', 'd4')).toBe(false);
    });
  });

  describe('makeMoveNumberString', () => {
    it('should create correct move number for white move', () => {
      const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      expect(makeMoveNumberString(afterE4)).toBe('1.');
    });

    it('should create correct move number for black move', () => {
      const afterE4E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
      expect(makeMoveNumberString(afterE4E5)).toBe('1...');
    });
  });

  describe('timeControl utilities', () => {
    it('should parse time control with increment', () => {
      const tc = stringToTimeControl('600+5');
      expect(tc).toEqual({
        limitSeconds: 600,
        incrementSeconds: 5,
      });
    });

    it('should parse time control without increment', () => {
      const tc = stringToTimeControl('300');
      expect(tc).toEqual({
        limitSeconds: 300,
        incrementSeconds: 0,
      });
    });

    it('should convert time control to readable string', () => {
      const tc = { limitSeconds: 600, incrementSeconds: 5 };
      expect(timeControlToReadableString(tc)).toBe('10 | 5');
    });

    it('should convert time control without increment to readable string', () => {
      const tc = { limitSeconds: 300, incrementSeconds: 0 };
      expect(timeControlToReadableString(tc)).toBe('5 min');
    });

    it('should handle daily time controls', () => {
      const tc = stringToTimeControl('1/86400');
      expect(tc).toEqual({
        numDaysPerMove: 1,
      });
    });
  });

  describe('makePgnFromHistory', () => {
    const testOnePGN = '1. e4 d5 2. d4 (2. c3) *';
    it(`should successfully recreate this PGN: ${testOnePGN}` , () => {
      const cmchess = new CmChess();
      cmchess.loadPgn(testOnePGN);
      const history = cmchess.history();
      expect(makePgnFromHistory(history)).toBe(testOnePGN);
    })
  });

});
