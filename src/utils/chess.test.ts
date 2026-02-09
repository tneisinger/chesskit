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
  makeMovesOnlyPGN,
  areFensEqual,
  extrapolatePositionEvaluation,
} from './chess';
import { PieceColor, ShortMove } from '@/types/chess';
import { Chess as ChessJS } from 'chess.js';
import { Chess as CmChess } from 'cm-chess/src/Chess';
import { FEN } from 'cm-chessboard/src/Chessboard';

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

  describe('makeMovesOnlyPGN', () => {
    it('should remove headers', () => {
      const input = '\
[Event "?"]\n\
[Site "?"]\n\
[Date "????.??.??"]\n\
[Round "?"]\n\
[White "?"]\n\
[Black "?"]\n\
[Result "*"]\n\
[Link "https://www.chess.com/analysis/game/pgn/3ukp349RWn/analysis"]\n\n\
1. e4 c5 2. Nf3 Nc6 3. d4 *';
      const output = '1. e4 c5 2. Nf3 Nc6 3. d4 *';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

    it('should handle alternative lines', () => {
      const input = '\
[Link "https://www.chess.com/analysis/game/pgn/3ukp349RWn/analysis"]\n\n\
1. e4 c5 2. Nf3 (2. d4) 2... Nc6 3. d4 *';
      const output = '1. e4 c5 2. Nf3 (2. d4) 2... Nc6 3. d4 *';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

    it('should handle alternative lines within alternative lines', () => {
      const input = '\
[Event "?"]\n\
1. e4 c5 2. Nf3 (2. d4 cxd4 (2... d5)) 2... Nc6 3. d4 *';
      const output = '1. e4 c5 2. Nf3 (2. d4 cxd4 (2... d5)) 2... Nc6 3. d4 *';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

    it('should handle multiple alternative sublines', () => {
      const input = '\
[Event "?"]\n\
1. e4 c5 2. Nf3 (2. d4 cxd4 (2... d5) 3. c3 (3. Nf3)) 2... Nc6 3. d4 *';
      const output = '1. e4 c5 2. Nf3 (2. d4 cxd4 (2... d5) 3. c3 (3. Nf3)) 2... Nc6 3. d4 *';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

    it('should handle multiple alternative lines', () => {
      const input = '\
[Event "?"]\n\
1. e4 c5 2. Nf3 (2. d4 cxd4 (2... d5) 3. c3 (3. Nf3)) (2. c3) 2... Nc6 3. d4 *';
      const output = '1. e4 c5 2. Nf3 (2. d4 cxd4 (2... d5) 3. c3 (3. Nf3)) (2. c3) 2... Nc6 3. d4 *';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

    it('should remove comments', () => {
      const input = '\
[Event "?"]\n\
1. e4 c5 {The Sicilian Defense.} 2. Nf3 (2. d4 cxd4 (2... d5) 3. c3 (3. Nf3)) (2. c3) 2... Nc6 3. d4 *';
      const output = '1. e4 c5 2. Nf3 (2. d4 cxd4 (2... d5) 3. c3 (3. Nf3)) (2. c3) 2... Nc6 3. d4 *';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

    it('should remove annotations', () => {
      const input = '\
[Event "?"]\n\
1. e4! c5? 2. Nf3!! d6?? 3. d4!? cxd4?! 4. Nxd4 *';
      const output = '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 *';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

    it('should handle different game results', () => {
      const input1 = '[Event "?"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0';
      const output1 = '1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0';
      expect(makeMovesOnlyPGN(input1)).toBe(output1);

      const input2 = '[Event "?"]\n1. e4 e5 2. Nf3 Nc6 0-1';
      const output2 = '1. e4 e5 2. Nf3 Nc6 0-1';
      expect(makeMovesOnlyPGN(input2)).toBe(output2);

      const input3 = '[Event "?"]\n1. e4 e5 2. Nf3 Nc6 1/2-1/2';
      const output3 = '1. e4 e5 2. Nf3 Nc6 1/2-1/2';
      expect(makeMovesOnlyPGN(input3)).toBe(output3);
    })

    it('should handle empty moves with result only', () => {
      const input = '[Event "?"]\n[Result "*"]\n*';
      const output = '*';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

    it('should handle variation starting with black move at move 1', () => {
      const input = '1. e4 (1. d4 d5) 1... e5 *';
      const output = '1. e4 (1. d4 d5) 1... e5 *';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

    it('should preserve multiple variations at the same move', () => {
      const input = '1. e4 (1. d4) (1. c4) (1. Nf3) 1... e5 *';
      const output = '1. e4 (1. d4) (1. c4) (1. Nf3) 1... e5 *';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

    it('should handle complex nested variations', () => {
      const input = '1. e4 e5 2. Nf3 (2. Bc4 Nf6 (2... Bc5 3. Nf3 (3. Nc3))) 2... Nc6 *';
      const output = '1. e4 e5 2. Nf3 (2. Bc4 Nf6 (2... Bc5 3. Nf3 (3. Nc3))) 2... Nc6 *';
      expect(makeMovesOnlyPGN(input)).toBe(output);
    })

  });

  describe('areFensEqual', () => {
    it('should return true on two identical fens', () => {
      const fen1 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
      const fen2 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
      expect(areFensEqual(fen1, fen2)).toBe(true);
    });
    it('should return false on two different fens', () => {
      const fen1 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
      const fen2 = FEN.start;
      expect(areFensEqual(fen1, fen2)).toBe(false);
    });
    it("should return false when 'allowEnpassantDif' is not set and one en passant value is '-'", () => {
      const fen1 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      const fen2 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
      expect(areFensEqual(fen1, fen2)).toBe(false);
      expect(areFensEqual(fen2, fen1)).toBe(false);
    });
    it("should return true when 'allowEnpassantDif' is set and one en passant value is '-'", () => {
      const fen1 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      const fen2 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
      expect(areFensEqual(fen1, fen2, { allowEnpassantDif: true })).toBe(true);
      expect(areFensEqual(fen2, fen1, { allowEnpassantDif: true })).toBe(true);
    });
    it("should return false when 'allowEnpassantDif' is set and the en passant values are different squares", () => {
      const fen1 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
      const fen2 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
      expect(areFensEqual(fen1, fen2, { allowEnpassantDif: true })).toBe(false);
      expect(areFensEqual(fen2, fen1, { allowEnpassantDif: true })).toBe(false);
    });
  });

  describe('extrapolatePositionEvaluation', () => {
    it('should extrapolate a position evaluation with cp score', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const pev = {
        depth: 20,
        fen: startingFen,
        score: { key: 'cp' as const, value: 30 },
        lines: [
          { score: { key: 'cp' as const, value: 30 }, lanLine: 'e2e4 e7e5 g1f3' },
          { score: { key: 'cp' as const, value: 25 }, lanLine: 'd2d4 d7d5 g1f3' },
        ],
      };

      const result = extrapolatePositionEvaluation(pev);

      // Should return 2 position evaluations (one for each line)
      expect(result.length).toBe(2);

      // First extrapolated position (after e2e4)
      expect(result[0].fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
      expect(result[0].score.key).toBe('cp');
      expect(result[0].score.value).toBe(30); // cp score stays the same
      expect(result[0].depth).toBe(20);
      expect(result[0].extrapolationDepth).toBe(1);
      expect(result[0].lines.length).toBe(1);
      expect(result[0].lines[0].lanLine).toBe('e7e5 g1f3'); // Remaining moves

      // Second extrapolated position (after d2d4)
      expect(result[1].fen).toBe('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1');
      expect(result[1].score.key).toBe('cp');
      expect(result[1].score.value).toBe(25);
      expect(result[1].extrapolationDepth).toBe(1);
    });

    it('should extrapolate a position evaluation with positive mate score', () => {
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
      const pev = {
        depth: 20,
        fen,
        score: { key: 'mate' as const, value: 1 },
        lines: [
          { score: { key: 'mate' as const, value: 1 }, lanLine: 'h5f7' },
        ],
      };

      const result = extrapolatePositionEvaluation(pev);

      expect(result.length).toBe(1);
      expect(result[0].score.key).toBe('mate');
      expect(result[0].score.value).toBe(0); // Mate in 1 becomes mate in 0
      expect(result[0].extrapolationDepth).toBe(1);
      expect(result[0].lines.length).toBe(0); // Next line shows mate in 1
    });

    it('should extrapolate a position evaluation with negative mate score', () => {
      const fen = 'rnbqkbnr/pppp1ppp/8/4p3/5PP1/8/PPPPP2P/RNBQKBNR b KQkq g3 0 2';
      const pev = {
        depth: 20,
        fen,
        score: { key: 'mate' as const, value: -1 },
        lines: [
          { score: { key: 'mate' as const, value: -1 }, lanLine: 'd8h4' },
        ],
      };

      const result = extrapolatePositionEvaluation(pev);

      expect(result.length).toBe(1);
      expect(result[0].score.key).toBe('mate');
      expect(result[0].score.value).toBe(0); // Mate in -1 becomes mate in 0
      expect(result[0].lines.length).toBe(0); // No lines
    });

    it('should handle a PositionEvaluation with no lines', () => {
      const fen = 'rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const pev = {
        depth: 20,
        fen,
        score: { key: 'mate' as const, value: 0 },
        lines: [],
      };

      const result = extrapolatePositionEvaluation(pev);

      expect(result.length).toBe(0);
    });

    it('should increment extrapolationDepth when already set', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const pev = {
        depth: 20,
        fen: startingFen,
        score: { key: 'cp' as const, value: 30 },
        lines: [
          { score: { key: 'cp' as const, value: 30 }, lanLine: 'e2e4 e7e5' },
        ],
        extrapolationDepth: 2,
      };

      const result = extrapolatePositionEvaluation(pev);

      expect(result.length).toBe(1);
      expect(result[0].extrapolationDepth).toBe(3); // Should increment from 2 to 3
    });

    it('should handle multiple lines with different scores', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const pev = {
        depth: 20,
        fen: startingFen,
        score: { key: 'cp' as const, value: 30 },
        lines: [
          { score: { key: 'cp' as const, value: 30 }, lanLine: 'e2e4 e7e5' },
          { score: { key: 'cp' as const, value: 28 }, lanLine: 'd2d4 d7d5' },
          { score: { key: 'cp' as const, value: 20 }, lanLine: 'g1f3 g8f6' },
        ],
      };

      const result = extrapolatePositionEvaluation(pev);

      expect(result.length).toBe(3);

      // Verify each extrapolated position has the correct score
      expect(result[0].score.value).toBe(30);
      expect(result[1].score.value).toBe(28);
      expect(result[2].score.value).toBe(20);

      // Verify each has the correct FEN (different first moves)
      expect(result[0].fen).toContain('4P3'); // e4
      expect(result[1].fen).toContain('3P4'); // d4
      expect(result[2].fen).toContain('5N2'); // Nf3
    });

    it('should handle single move in lanLine', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const pev = {
        depth: 20,
        fen: startingFen,
        score: { key: 'cp' as const, value: 30 },
        lines: [
          { score: { key: 'cp' as const, value: 30 }, lanLine: 'e2e4' }, // Only one move
        ],
      };

      const result = extrapolatePositionEvaluation(pev);

      expect(result.length).toBe(1);
      expect(result[0].lines.length).toBe(0); // No lines created
    });

    it('should preserve depth from original evaluation', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const pev = {
        depth: 25, // Non-standard depth
        fen: startingFen,
        score: { key: 'cp' as const, value: 30 },
        lines: [
          { score: { key: 'cp' as const, value: 30 }, lanLine: 'e2e4 e7e5' },
        ],
      };

      const result = extrapolatePositionEvaluation(pev);

      expect(result[0].depth).toBe(25); // Should preserve the original depth
    });

    it('should handle mate in 3 correctly', () => {
      const fen = '2rq1rk1/1p6/p3p1NQ/1b1n1p2/2pP3b/P1P2N1P/1P3PP1/R5K1 w - - 0 22';
      const pev = {
        depth: 20,
        fen,
        score: { key: 'mate' as const, value: 3 },
        lines: [
          { score: { key: 'mate' as const, value: 3 }, lanLine: 'h6h8 g8f7 f3e5 f7e8 h8f8' }, // Any move
        ],
      };

      const result = extrapolatePositionEvaluation(pev);

      expect(result.length).toBe(1);
      expect(result[0].score.key).toBe('mate');
      expect(result[0].score.value).toBe(2); // Mate in 3 becomes mate in 2

      const result2 = extrapolatePositionEvaluation(result[0]);
      expect(result2[0].score.key).toBe('mate');
      expect(result2[0].score.value).toBe(2); // Mate in 2 stays mate in 2

      const result3 = extrapolatePositionEvaluation(result2[0]);
      expect(result3[0].score.key).toBe('mate');
      expect(result3[0].score.value).toBe(1); // Mate in 2 becomes mate in 1

      const result4 = extrapolatePositionEvaluation(result3[0]);
      expect(result4[0].score.key).toBe('mate');
      expect(result4[0].score.value).toBe(1); // Mate in 1 stays mate in 1

      const result5 = extrapolatePositionEvaluation(result4[0]);
    });

    it('should handle mate in 2 for black correctly', () => {
      const fen = '4k3/1prb4/1p4p1/2p1P3/2p4P/P2pNB2/nr3BRn/1R2K3 b - - 0 1';
      const pev = {
        depth: 20,
        fen,
        score: { key: 'mate' as const, value: -2 },
        lines: [
          { score: { key: 'mate' as const, value: -2 }, lanLine: 'd3d2 e1e2 a2c3' }, // Any move
        ],
      };
      const result = extrapolatePositionEvaluation(pev);
      console.log(result[0]);

      expect(result.length).toBe(1);
      expect(result[0].score.key).toBe('mate');
      expect(result[0].score.value).toBe(-1); // Mate in -2 becomes mate in -1

      const result2 = extrapolatePositionEvaluation(result[0]);
      console.log(result2[0]);
      expect(result2[0].score.key).toBe('mate');
      expect(result2[0].score.value).toBe(-1); // Mate in -1 stays mate in -1

      const result3 = extrapolatePositionEvaluation(result2[0]);
      console.log(result3[0]);
      expect(result3[0].score.key).toBe('mate');
      expect(result3[0].score.value).toBe(0); // Mate in -1 becomes mate in 0
      expect(result3[0].lines.length).toBe(0);
    });
  });
});
