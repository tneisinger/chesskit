import { describe, it, expect } from 'vitest';
import {
  promoteToMainLine,
  promoteLine,
  loadPgnIntoCmChess,
  getVariations,
  renderPgn,
  doHistoriesMatch,
  playForcingLineIntoCmChess,
  getEvaluationsFromMoveForward,
} from './cmchess';
import { convertLanLineToSanLine } from './chess';
import { Evaluations, PieceColor } from '@/types/chess';
import { Chess as CmChess, Move } from 'cm-chess/src/Chess';

describe('promoteToMainLine', () => {
  it('should promote the main line (no-op)', () => {
    const pgn = '1. e4 e5 (1... c5) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Get a move from the main line
    const mainLineMove = history[1]; // e5

    // Promote the main line move
    const { cmchess: newCmChess } = promoteToMainLine(cmchess, mainLineMove);
    const newHistory = newCmChess.history();

    // The main line should remain the same
    expect(newHistory[0].san).toBe('e4');
    expect(newHistory[1].san).toBe('e5');
    expect(newHistory[2].san).toBe('Nf3');
    expect(newHistory[3].san).toBe('Nc6');
  });

  it('should promote a variation to main line', () => {
    // Create a PGN with a main line and a variation
    const pgn = '1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Get the first move of the variation (1... c5)
    const firstMoveWithVariation = history.find((m) => (m.variations.length > 0));
    if (firstMoveWithVariation == undefined) throw new Error('firstMoveWithVariation undefined');
    const variationMove = firstMoveWithVariation.variations[0][0]; // c5

    // Promote the variation to main line
    const { cmchess: newCmChess, move: newMove } = promoteToMainLine(cmchess, variationMove);
    const newHistory = newCmChess.history();

    // The new main line should start with e4 c5
    expect(newHistory[0].san).toBe('e4');
    expect(newHistory[1].san).toBe('c5');
    expect(newHistory[2].san).toBe('Nf3');
    expect(newHistory[3].san).toBe('d6');

    // The old main line should now be a variation
    expect(newHistory[1].variations.length).toBeGreaterThan(0);
    expect(newHistory[1].variations[0][0].san).toBe('e5');

    // the newMove should be the second move in the new history
    expect(newMove).toBe(newHistory[1]);
  });

  it('should promote a variation to main line when third move of variation given', () => {
    // Create a PGN with a main line and a variation
    const pgn = '1. e4 e5 (1... c5 2. Nf3 d6 3. Bb5+) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Get the third move of the variation (d6)
    const firstMoveWithVariation = history.find((m) => (m.variations.length > 0));
    if (firstMoveWithVariation == undefined) throw new Error('firstMoveWithVariation undefined');
    const variationMove = firstMoveWithVariation.variations[0][2]; // d6

    // Promote the variation to main line
    const { cmchess: newCmChess, move: newMove } = promoteToMainLine(cmchess, variationMove);
    const newHistory = newCmChess.history();

    // The new main line should start with e4 c5
    expect(newHistory[0].san).toBe('e4');
    expect(newHistory[1].san).toBe('c5');
    expect(newHistory[2].san).toBe('Nf3');
    expect(newHistory[3].san).toBe('d6');
    expect(newHistory[4].san).toBe('Bb5+');

    // The old main line should now be a variation
    expect(newHistory[1].variations.length).toBeGreaterThan(0);
    expect(newHistory[1].variations[0][0].san).toBe('e5');
    expect(newHistory[1].variations[0][1].san).toBe('Nf3');
    expect(newHistory[1].variations[0][2].san).toBe('Nc6');

    // the newMove should be the fourth move in the new history
    expect(newMove).toBe(newHistory[3]);
  });

  it('should promote a nested variation', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 (2... Nf6 3. Nc3 (3. d4)) 3. Bb5 a6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Navigate to the nested variation: 3. d4
    const fourthMove = history[3]; // Nc6
    const nc3Move = fourthMove.variations[0][1]; // Nc3
    const d4Move = nc3Move.variations[0][0]; // d4

    // Promote the nested variation
    const { cmchess: newCmChess, move: newMove } = promoteToMainLine(cmchess, d4Move);
    const newHistory = newCmChess.history();

    // The new main line should be: e4 e5 Nf3 Nf6 d4
    expect(newHistory[0].san).toBe('e4');
    expect(newHistory[1].san).toBe('e5');
    expect(newHistory[2].san).toBe('Nf3');
    expect(newHistory[3].san).toBe('Nf6');
    expect(newHistory[4].san).toBe('d4');

    const expectedVariations = [
      'e4 e5 Nf3 Nf6 d4',
      'e4 e5 Nf3 Nc6 Bb5 a6',
      'e4 e5 Nf3 Nf6 Nc3',
    ];
    const lanVariations = getVariations(newHistory).map((v) => v.map((m) => `${m.from}${m.to}`));
    const variations = lanVariations.map((v) => convertLanLineToSanLine(v).join(' '));
    expect(variations.length).toBe(3);
    expectedVariations.forEach((ev) => expect(variations).toContain(ev));

    // the newMove should be the fifth move in the new history
    expect(newMove).toBe(newHistory[4]);
  });

  it('should preserve all variations after promotion', () => {
    const pgn = '1. e4 e5 (1... c5) (1... c6) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);

    // Get all variations before promotion
    const linesBefore = getVariations(cmchess.history());
    const linesCountBefore = linesBefore.length;

    // Promote a variation
    const secondMove = cmchess.history()[1];
    const c5Move = secondMove.variations[0][0];
    const { cmchess: newCmChess, move: newMove } = promoteToMainLine(cmchess, c5Move);

    // Get all variations after promotion
    const newHistory = newCmChess.history();
    const linesAfter = getVariations(newHistory);

    // Should have the same number of lines
    expect(linesAfter.length).toBe(linesCountBefore);

    const expectedVariations = [
      'e4 c5',
      'e4 e5 Nf3 Nc6',
      'e4 c6',
    ];
    const lanVariations = getVariations(newHistory).map((v) => v.map((m) => `${m.from}${m.to}`));
    const variations = lanVariations.map((v) => convertLanLineToSanLine(v).join(' '));
    expect(variations.length).toBe(3);
    expectedVariations.forEach((ev) => expect(variations).toContain(ev));

    // the newMove should be the second move in the new history
    expect(newMove).toBe(newHistory[1]);
  });

  it('should throw error when move is not found', () => {
    const pgn1 = '1. e4 e5 2. Nf3 Nc6 *';
    const pgn2 = '1. d4 d5 2. c4 c6 *';

    const cmchess1 = loadPgnIntoCmChess(pgn1);
    const cmchess2 = loadPgnIntoCmChess(pgn2);

    // Try to promote a move from a different game
    const moveFromDifferentGame = cmchess2.history()[0];

    expect(() => {
      promoteToMainLine(cmchess1, moveFromDifferentGame);
    }).toThrow('Move not found in any variation');
  });

  it('should work with deep variation trees', () => {
    const pgn = '1. e4 e5 (1... c5 2. Nf3 (2. Nc3 Nc6 (2... d6)) 2... d6) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);

    // Get a move deep in the variation tree
    const secondMove = cmchess.history()[1]; // e5
    const nf3Move = secondMove.variations[0][1]; // Nf3

    // Promote this variation
    const { cmchess: newCmChess, move: newMove } = promoteToMainLine(cmchess, nf3Move);
    const newHistory = newCmChess.history();

    // The new main line should include the promoted path
    expect(newHistory[0].san).toBe('e4');
    expect(newHistory[1].san).toBe('c5');
    expect(newHistory[2].san).toBe('Nf3');
    expect(newHistory[3].san).toBe('d6');

    const expectedVariations = [
      'e4 c5 Nf3 d6',
      'e4 e5 Nf3 Nc6',
      'e4 c5 Nc3 Nc6',
      'e4 c5 Nc3 d6',
    ];
    const lanVariations = getVariations(newHistory).map((v) => v.map((m) => `${m.from}${m.to}`));
    const variations = lanVariations.map((v) => convertLanLineToSanLine(v).join(' '));
    expect(variations.length).toBe(expectedVariations.length);
    expectedVariations.forEach((ev) => expect(variations).toContain(ev));

    // the newMove should be the third move in the new history
    expect(newMove).toBe(newHistory[2]);
  });

  it('should handle promoting a line that continues beyond the move', () => {
    const pgn = '1. e4 e5 (1... c5 2. Nf3 d6 3. d4 cxd4) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Get the second move in the variation (Nf3 after c5)
    const secondMove = history[1];
    const nf3Move = secondMove.variations[0][1];

    // Promote the variation
    const { cmchess: newCmChess, move: newMove } = promoteToMainLine(cmchess, nf3Move);
    const newHistory = newCmChess.history();

    // The entire variation should be promoted, not just up to the move
    expect(newHistory[0].san).toBe('e4');
    expect(newHistory[1].san).toBe('c5');
    expect(newHistory[2].san).toBe('Nf3');
    expect(newHistory[3].san).toBe('d6');
    expect(newHistory[4].san).toBe('d4');
    expect(newHistory[5].san).toBe('cxd4');

    const expectedVariations = [
      'e4 c5 Nf3 d6 d4 cxd4',
      'e4 e5 Nf3 Nc6',
    ];
    const lanVariations = getVariations(newHistory).map((v) => v.map((m) => `${m.from}${m.to}`));
    const variations = lanVariations.map((v) => convertLanLineToSanLine(v).join(' '));
    expect(variations.length).toBe(expectedVariations.length);
    expectedVariations.forEach((ev) => expect(variations).toContain(ev));

    // the newMove should be the third move in the new history
    expect(newMove).toBe(newHistory[2]);
  });
});

describe('promoteLine', () => {
  it('should promote the main line (no-op)', () => {
    const pgn = '1. e4 e5 (1... c5) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Get a move from the main line
    const mainLineMove = history[1]; // e5

    // Promote the main line move
    const { cmchess: newCmChess } = promoteLine(cmchess, mainLineMove);
    const newHistory = newCmChess.history();

    // The main line should remain the same
    expect(newHistory[0].san).toBe('e4');
    expect(newHistory[1].san).toBe('e5');
    expect(newHistory[2].san).toBe('Nf3');
    expect(newHistory[3].san).toBe('Nc6');
  });

  it('should promote a variation to main line', () => {
    // Create a PGN with a main line and a variation
    const pgn = '1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Get the first move of the variation (1... c5)
    const firstMoveWithVariation = history.find((m) => (m.variations.length > 0));
    if (firstMoveWithVariation == undefined) throw new Error('firstMoveWithVariation undefined');
    const variationMove = firstMoveWithVariation.variations[0][0]; // c5

    // Promote the variation to main line
    const { cmchess: newCmChess, move: newMove } = promoteToMainLine(cmchess, variationMove);
    const newHistory = newCmChess.history();

    // The new main line should start with e4 c5
    expect(newHistory[0].san).toBe('e4');
    expect(newHistory[1].san).toBe('c5');
    expect(newHistory[2].san).toBe('Nf3');
    expect(newHistory[3].san).toBe('d6');

    // The old main line should now be a variation
    expect(newHistory[1].variations.length).toBeGreaterThan(0);
    expect(newHistory[1].variations[0][0].san).toBe('e5');

    // the newMove should be the second move in the new history
    expect(newMove).toBe(newHistory[1]);
  });

  it('should promote a nested variation up one level', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 (2... Nf6 3. Nc3 (3. d4)) 3. Bb5 a6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Navigate to the nested variation: 3. d4
    const fourthMove = history[3]; // Nc6
    const nc3Move = fourthMove.variations[0][1]; // Nc3
    const d4Move = nc3Move.variations[0][0]; // d4

    // Promote the nested variation
    const { cmchess: newCmChess, move: newMove } = promoteLine(cmchess, d4Move);
    const newHistory = newCmChess.history();

    // The main line should still be: e4 e5 Nf3 Nf6 d4
    expect(newHistory[0].san).toBe('e4');
    expect(newHistory[1].san).toBe('e5');
    expect(newHistory[2].san).toBe('Nf3');
    expect(newHistory[3].san).toBe('Nc6');
    expect(newHistory[4].san).toBe('Bb5');
    expect(newHistory[5].san).toBe('a6');

    expect(newHistory[3].variations[0][1].san).toBe('d4');
    expect(newHistory[3].variations[0][1].variations[0][0].san).toBe('Nc3');
    
    // the newMove should be found at the expected location.
    expect(newMove).toBe(newHistory[3].variations[0][1]);
  });

  it('should promote a more complex nested variation up one level', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 (2... d6 3. Bb5+ Bd7 4. Qe2 (4. Bxd7+ Nxd7 5. O-O (5. d4 exd4 6. Nxd4) 5... Qe7) 4... Nc6) 3. Bb5 a6';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Navigate to the nested variation: 3. d4
    const fourthMove = history[3]; // Nc6
    const qe2Move = fourthMove.variations[0][3]; // Qe2
    const castleMove = qe2Move.variations[0][2]; // O-O
    const exd4Move = castleMove.variations[0][1]; // exd4

    // Promote the nested variation
    const { cmchess: newCmChess, move: newMove } = promoteLine(cmchess, exd4Move);
    const newHistory = newCmChess.history();

    expect(newHistory[3].variations[0][3].variations[0][3].san).toBe('exd4');
    expect(newHistory[3].variations[0][3].variations[0][4].san).toBe('Nxd4');
    
    // the newMove should be found at the expected location.
    expect(newMove).toBe(newHistory[3].variations[0][3].variations[0][3]);
  });

  it('should promote a second child variation up one level', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 (2... d6 3. Bb5+ Bd7 (3... c6 4. Ba4 b5) (3... Ke7 4. d3) 4. Bxd7+) 3. Bb5';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Navigate to the nested variation: 3. d4
    const fourthMove = history[3]; // Nc6
    const Bd7Move = fourthMove.variations[0][2]; // Bd7
    const ke7Move = Bd7Move.variations[1][0]; // Ke7

    // Promote the nested variation
    const { cmchess: newCmChess, move: newMove } = promoteLine(cmchess, ke7Move);
    const newHistory = newCmChess.history();

    // The main line should still be: e4 e5 Nf3 Nc6 Bb5
    expect(newHistory[0].san).toBe('e4');
    expect(newHistory[1].san).toBe('e5');
    expect(newHistory[2].san).toBe('Nf3');
    expect(newHistory[3].san).toBe('Nc6');
    expect(newHistory[4].san).toBe('Bb5');

    // expect(renderPgn(newCmChess).trim()).toBe('1. e4 e5 2. Nf3 Nc6 (2... d6 3. Bb5+ Ke7 (3... Bd7 4. Bxd7+) (3... c6 4. Ba4 b5) 4. d3) 3. Bb5');
    expect(newHistory[3].variations[0][2].san).toBe('Ke7');
    expect(newHistory[3].variations[0][3].san).toBe('d3');
    
    // the newMove should be found at the expected location.
    expect(newMove).toBe(newHistory[3].variations[0][2]);
  });
});

describe('doHistoriesMatch', () => {
  it('should return true for identical simple games', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *';
    const cmchess1 = loadPgnIntoCmChess(pgn);
    const cmchess2 = loadPgnIntoCmChess(pgn);

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(true);
  });

  it('should return true for identical games with variations', () => {
    const pgn = '1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 *';
    const cmchess1 = loadPgnIntoCmChess(pgn);
    const cmchess2 = loadPgnIntoCmChess(pgn);

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(true);
  });

  it('should return true for identical games with nested variations', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 (2... Nf6 3. Nc3 (3. d4)) 3. Bb5 a6 *';
    const cmchess1 = loadPgnIntoCmChess(pgn);
    const cmchess2 = loadPgnIntoCmChess(pgn);

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(true);
  });

  it('should return true for empty histories', () => {
    const cmchess1 = loadPgnIntoCmChess('*');
    const cmchess2 = loadPgnIntoCmChess('*');

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(true);
  });

  it('should return false for games with different moves', () => {
    const pgn1 = '1. e4 e5 2. Nf3 Nc6 *';
    const pgn2 = '1. e4 c5 2. Nf3 d6 *';
    const cmchess1 = loadPgnIntoCmChess(pgn1);
    const cmchess2 = loadPgnIntoCmChess(pgn2);

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(false);
  });

  it('should return false for games with different lengths', () => {
    const pgn1 = '1. e4 e5 2. Nf3 Nc6 3. Bb5 *';
    const pgn2 = '1. e4 e5 2. Nf3 Nc6 *';
    const cmchess1 = loadPgnIntoCmChess(pgn1);
    const cmchess2 = loadPgnIntoCmChess(pgn2);

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(false);
  });

  it('should return false when one has variations and the other does not', () => {
    const pgn1 = '1. e4 e5 (1... c5) 2. Nf3 Nc6 *';
    const pgn2 = '1. e4 e5 2. Nf3 Nc6 *';
    const cmchess1 = loadPgnIntoCmChess(pgn1);
    const cmchess2 = loadPgnIntoCmChess(pgn2);

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(false);
  });

  it('should return false when variations differ', () => {
    const pgn1 = '1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 *';
    const pgn2 = '1. e4 e5 (1... c6 2. d4 d5) 2. Nf3 Nc6 *';
    const cmchess1 = loadPgnIntoCmChess(pgn1);
    const cmchess2 = loadPgnIntoCmChess(pgn2);

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(false);
  });

  it('should return false when variation order differs', () => {
    const pgn1 = '1. e4 e5 (1... c5) (1... c6) 2. Nf3 Nc6 *';
    const pgn2 = '1. e4 e5 (1... c6) (1... c5) 2. Nf3 Nc6 *';
    const cmchess1 = loadPgnIntoCmChess(pgn1);
    const cmchess2 = loadPgnIntoCmChess(pgn2);

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(false);
  });

  it('should return true for games with multiple variations in same order', () => {
    const pgn = '1. e4 e5 (1... c5) (1... c6) 2. Nf3 Nc6 *';
    const cmchess1 = loadPgnIntoCmChess(pgn);
    const cmchess2 = loadPgnIntoCmChess(pgn);

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(true);
  });

  it('should return true after promotion operations that result in same structure', () => {
    const pgn = '1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 *';
    const cmchess1 = loadPgnIntoCmChess(pgn);

    // Promote c5 to main line
    const c5Move = cmchess1.history()[1].variations[0][0];
    const { cmchess: promoted } = promoteToMainLine(cmchess1, c5Move);

    // Create a PGN that already has c5 as main line
    const pgn2 = '1. e4 c5 (1... e5 2. Nf3 Nc6) 2. Nf3 d6 *';
    const cmchess2 = loadPgnIntoCmChess(pgn2);

    expect(doHistoriesMatch(promoted.history(), cmchess2.history())).toBe(true);
  });

  it('should return false when nested variation depth differs', () => {
    const pgn1 = '1. e4 e5 2. Nf3 Nc6 (2... Nf6 3. Nc3 (3. d4)) *';
    const pgn2 = '1. e4 e5 2. Nf3 Nc6 (2... Nf6 3. Nc3) *';
    const cmchess1 = loadPgnIntoCmChess(pgn1);
    const cmchess2 = loadPgnIntoCmChess(pgn2);

    expect(doHistoriesMatch(cmchess1.history(), cmchess2.history())).toBe(false);
  });
});

describe('playForcingLineIntoCmChess', () => {
  it('should return an empty array when position has more than one good move', () => {
    const pgn = '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Bc4 Nf6 5. f3 exf3 6. Nxf3 Bg4 7. Bxf7+ Kxf7 8. Ne5+ Ke8 9. Nxg4 *';
    const evaluations: Evaluations = {
      "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": {
        depth: 20,
        fen: "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        bestMove: {from: "d2", to: "d4"},
        score: { key:"cp", value: 42}, lines: [
          { score: { key: "cp", value: 42 }, lanLine:"d2d4 d7d5 e4e5"},
          { score: { key: "cp", value: 34}, lanLine:"b1c3 d7d5 g1f3 "}
        ],
      }
    };
    const cmChess = loadPgnIntoCmChess(pgn);
    const move = cmChess.history()[1];
    const pgnBefore = renderPgn(cmChess);

    const result = playForcingLineIntoCmChess(cmChess, move, evaluations, PieceColor.WHITE);
    expect(result.length).toBe(0);
    const pgnAfter = renderPgn(cmChess);
    expect(pgnBefore).toBe(pgnAfter);
  });


  it('should return an array with 5 elements when forcing line is 5 moves long', () => {
    const pgn = '1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 d6 6. Bc4 h6 7. e5 Bg4 *';

    const evaluations: Evaluations = {
      "r2qkbnr/pp2ppp1/2np3p/4P3/2B3b1/2N2N2/PP3PPP/R1BQK2R w KQkq - 1 8": {
        depth: 20,
        fen: "r2qkbnr/pp2ppp1/2np3p/4p3/2b3b1/2n2n2/pp3ppp/r1bqk2r w kqkq - 1 8",
        score: {
          key: "cp",
          value: 147
        },
        lines: [
          {
            score: {
              key: "cp",
              value: 147
            },
            lanLine: "d1b3 e7e6 b3b7 a8c8 c4b5 g4f3", 
          },
          {
            score: {
              key: "cp",
              value: 31
            },
            lanLine: "e5d6 d8d6 d1b3 e8c8 c4f7 e7e5",
          }
        ],
        bestMove: {
          from: "d1",
          to: "b3"
        }
      },
      "r2qkbnr/pp2ppp1/2np3p/4P3/2B3b1/1QN2N2/PP3PPP/R1B1K2R b KQkq - 2 8": {
        depth: 20,
        fen: "r2qkbnr/pp2ppp1/2np3p/4P3/2B3b1/1QN2N2/PP3PPP/R1B1K2R b KQkq - 2 8",
        score: {
          key: "cp",
          value: 147
        },
        lines: [
          {
            score: {
              key: "cp",
              value: 147
            },
            lanLine: "e7e6 b3b7 a8c8 c4b5 g4f3 g2f3 d8c7",
          },
          {
            score: {
              key: "cp",
              value: 219
            },
            lanLine: "d6d5 c4d5 e7e6 b3b7 e6d5 b7c6 g4d7",
          }
        ],
        bestMove: {
          from: "e7",
          to: "e6"
        }
      },
      "r2qkbnr/pp3pp1/2npp2p/4P3/2B3b1/1QN2N2/PP3PPP/R1B1K2R w KQkq - 0 9": {
        depth: 20,
        fen: "r2qkbnr/pp3pp1/2npp2p/4P3/2B3b1/1QN2N2/PP3PPP/R1B1K2R w KQkq - 0 9",
        score: {
          key: "cp",
          value: 158
        },
        lines: [
          {
            score: {
              key: "cp",
              value: 158
            },
            lanLine: "b3b7 a8c8 c4b5 g4f3 g2f3 d8c7",
          },
          {
            score: {
              key: "cp",
              value: -17
            },
            lanLine: "c1f4 g4f3 g2f3 d6d5 b3b7 g8e7",
          }
        ],
        bestMove: {
          from: "b3",
          to: "b7"
        }
      },
      "r2qkbnr/pQ3pp1/2npp2p/4P3/2B3b1/2N2N2/PP3PPP/R1B1K2R b KQkq - 0 9": {
        depth: 20,
        fen: "r2qkbnr/pQ3pp1/2npp2p/4P3/2B3b1/2N2N2/PP3PPP/R1B1K2R b KQkq - 0 9",
        score: {
          key: "cp",
          value: 143
        },
        lines: [
          {
            score: {
                key: "cp",
                value: 143
            },
            lanLine: "g4f3 g2f3 a8c8 c4b5 d8c7 b7c7 c8c7 b5a4"
          },
          {
            score: {
              key: "cp",
              value: 169
            },
            lanLine: "a8c8 c4b5 g4f3 g2f3 d8c7 b7c7 c8c7 b5a4 a7a6 c1e3 d6e5 a1c1 f7f5 e3b6 c7c8 c3d5 e6d5 a4c6 e8e7 e1g1 g8f6 c6b7 c8c1 f1c1 e7e6 b7c8 e6f7 c1c7 f8e7 a2a4 a6a5 b6a5 d5d4"
          }
        ],
        bestMove: {
          from: "g4",
          to: "f3"
        }
      },
      "r2qkbnr/pQ3pp1/2npp2p/4P3/2B5/2N2b2/PP3PPP/R1B1K2R w KQkq - 0 10": {
        depth: 20,
        fen: "r2qkbnr/pQ3pp1/2npp2p/4P3/2B5/2N2b2/PP3PPP/R1B1K2R w KQkq - 0 10",
        score: {
          key: "cp",
          value: 144
        },
        lines: [
          {
            score: {
              key: "cp",
              value: 144
            },
            lanLine: "g2f3 a8c8 c4b5 d8c7 b7c7 c8c7 b5a4 a7a6 c1e3 d6e5 a1c1 f7f5 c3d5 e6d5 a4c6 e8e7 e3b6 c7c8 e1g1 g8f6 c6b7 c8c1 f1c1 e7e6 c1c8 h8g8 b7a6 f8e7 c8c6 e7d6 a2a4 e6e7 a6c8 f6d7 a4a5 d7b6 a5b6 g8f8 b6b7 d6b8 c8e6 d5d4 c6c8 d4d3 g1f1 e5e4 e6f5 f8f5 c8b8 d3d2 f1e2"
          },
          {
            score: {
              key: "cp",
              value: -26
            },
            lanLine: "c4b5 d8c8 b7c8 a8c8 g2f3 d6e5 c1e3 f8b4 a2a3 b4c3 b2c3 e8e7 a1b1 e7f6 b5c6 c8c6 b1b8 c6c3 a3a4 g7g5 h2h4 f6g7 h4g5 h6g5 h1h8 g7h8 b8b7 h8g7 b7a7 g7g6"
          }
        ],
        bestMove: {
          from: "g2",
          to: "f3"
        }
      },
      "r2qkbnr/pQ3pp1/2npp2p/4P3/2B5/2N2P2/PP3P1P/R1B1K2R b KQkq - 0 10": {
        depth: 20,
        fen: "r2qkbnr/pQ3pp1/2npp2p/4P3/2B5/2N2P2/PP3P1P/R1B1K2R b KQkq - 0 10",
        score: {
          key: "cp",
          value: 144
        },
        lines: [
          {
            score: {
              key: "cp",
              value: 144
            },
            lanLine: "a8c8 c4b5 d8c7 b7c7 c8c7 b5a4 a7a6 c1e3 d6e5 a1c1 f7f5 e3b6 c7c8 c3d5 e6d5 a4c6 e8e7 e1g1 g8f6 f1d1"
          },
          {
            score: {
              key: "cp",
              value: 291
            },
            lanLine: "c6d4 c1e3 d8c8 b7e4 d4c2 e1e2 c2e3 f2e3 f7f5 e5f6 g8f6 e4e6 c8e6 c4e6 f8e7 h1d1 a8b8 b2b3 g7g5 d1d4"
          }
        ],
        bestMove: {
          from: "a8",
          to: "c8"
        }
      },
      "2rqkbnr/pQ3pp1/2npp2p/4P3/2B5/2N2P2/PP3P1P/R1B1K2R w KQk - 1 11": {
        depth: 20,
        fen: "2rqkbnr/pQ3pp1/2npp2p/4P3/2B5/2N2P2/PP3P1P/R1B1K2R w KQk - 1 11",
        score: {
          key: "cp",
          value: 161
        },
        lines: [
          {
            score: {
                key: "cp",
                value: 161
            },
            lanLine: "c4b5 d8c7 b7c7 c8c7 b5a4 a7a6 c1e3 d6e5 a1c1 f7f5 e3b6 c7c8 c3d5 e6d5 a4c6 e8e7 e1g1 g8f6 c6b7 c8c1 f1c1 e7e6 b7c8 e6f7 c1c7 f7g6 c8a6 f8b4 a2a3 b4d2 a3a4 h8a8 a6b5 d2b4 f3f4 e5e4 c7c6 b4d2 g1f1 g6f7 c6c2 d2b4"
          },
          {
            score: {
                key: "cp",
                value: 117
            },
            lanLine: "c1e3 c6e5 c4b5 e5d7 c3e4 c8c7 b7a6 d8c8 a6d6 c8b7 a1d1 f8d6 e4d6 e8e7 d6b7 c7b7 b5d7 b7d7 d1d7 e7d7 h1g1 g7g5 e3d4 f7f6 e1e2 e6e5 d4a7 g8e7 a7c5 e7d5 e2d3 d7c6 d3c4 h8d8 a2a4 d5b6 c5b6 c6b6 b2b4 d8d4 c4c3 d4h4"
          }
        ],
        bestMove: {
          from: "c4",
          to: "b5"
        }
      },
      "2rqkbnr/pQ3pp1/2npp2p/1B2P3/8/2N2P2/PP3P1P/R1B1K2R b KQk - 2 11": {
        depth: 20,
        fen: "2rqkbnr/pQ3pp1/2npp2p/1B2P3/8/2N2P2/PP3P1P/R1B1K2R b KQk - 2 11",
        score: {
          key: "cp",
          value: 169
        },
        lines: [
          {
            score: {
              key: "cp",
              value: 169
            },
            lanLine: "d8c7 b7c7 c8c7 b5a4 a7a6 c1e3 d6e5 a1c1 f7f5 c3d5 e6d5 a4c6 e8e7 e3b6 c7c8 e1g1 g8f6 c6b7 c8c1 f1c1 e7e6 c1c7 e5e4 c7c8 h8g8 b7a6 f8b4 a2a3 b4d2 c8c6 e6e7"
          },
          {
            score: {
              key: "cp",
              value: 204
            },
            lanLine: "d8d7 b7a6 d6d5 e1g1 f8c5 f1d1 g8e7 c3e4 c5b4 c1d2 e8g8 d2b4 c6b4 b5d7 b4a6 d7c8 f8c8 e4d6 c8c2 d1c1"
          }
        ],
        bestMove: {
          from: "d8",
          to: "c7"
        }
      }
    }

    const cmChess = loadPgnIntoCmChess(pgn);
    const historyBefore = [...cmChess.history()];
    const move = historyBefore[13];

    const result = playForcingLineIntoCmChess(cmChess, move, evaluations, PieceColor.WHITE);
    result.forEach((m) => console.log(m));
    expect(result.length).toBe(5);
    const historyAfter = [...cmChess.history()];
    expect(historyAfter.length - historyBefore.length).toBe(5);
  });
});

describe('getEvaluationsFromMoveForward', () => {
  it('should return only the evaluation for a single move when it is the last move', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    const evaluations: Evaluations = {
      [history[0].fen]: {
        depth: 20,
        fen: history[0].fen,
        score: { key: "cp", value: 30 },
        lines: [{ score: { key: "cp", value: 30 }, lanLine: "e7e5" }],
      },
      [history[1].fen]: {
        depth: 20,
        fen: history[1].fen,
        score: { key: "cp", value: 25 },
        lines: [{ score: { key: "cp", value: 25 }, lanLine: "g1f3" }],
      },
      [history[2].fen]: {
        depth: 20,
        fen: history[2].fen,
        score: { key: "cp", value: 20 },
        lines: [{ score: { key: "cp", value: 20 }, lanLine: "b8c6" }],
      },
      [history[3].fen]: {
        depth: 20,
        fen: history[3].fen,
        score: { key: "cp", value: 15 },
        lines: [{ score: { key: "cp", value: 15 }, lanLine: "f1c4" }],
      },
    };

    // Get evaluations from the last move forward
    const lastMove = history[3];
    const result = getEvaluationsFromMoveForward(lastMove, evaluations);

    // Should only contain the last move's evaluation
    expect(Object.keys(result).length).toBe(1);
    expect(result[lastMove.fen]).toBeDefined();
    expect(result[lastMove.fen].score.value).toBe(15);
  });

  it('should return evaluations from the first move forward in a simple line', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    const evaluations: Evaluations = {
      [history[0].fen]: {
        depth: 20,
        fen: history[0].fen,
        score: { key: "cp", value: 30 },
        lines: [{ score: { key: "cp", value: 30 }, lanLine: "e7e5" }],
      },
      [history[1].fen]: {
        depth: 20,
        fen: history[1].fen,
        score: { key: "cp", value: 25 },
        lines: [{ score: { key: "cp", value: 25 }, lanLine: "g1f3" }],
      },
      [history[2].fen]: {
        depth: 20,
        fen: history[2].fen,
        score: { key: "cp", value: 20 },
        lines: [{ score: { key: "cp", value: 20 }, lanLine: "b8c6" }],
      },
      [history[3].fen]: {
        depth: 20,
        fen: history[3].fen,
        score: { key: "cp", value: 15 },
        lines: [{ score: { key: "cp", value: 15 }, lanLine: "f1c4" }],
      },
    };

    // Get evaluations from the first move forward
    const firstMove = history[0];
    const result = getEvaluationsFromMoveForward(firstMove, evaluations);

    // Should contain all four moves
    expect(Object.keys(result).length).toBe(4);
    expect(result[history[0].fen]).toBeDefined();
    expect(result[history[1].fen]).toBeDefined();
    expect(result[history[2].fen]).toBeDefined();
    expect(result[history[3].fen]).toBeDefined();
  });

  it('should return evaluations from a middle move forward', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    const evaluations: Evaluations = {
      [history[0].fen]: {
        depth: 20,
        fen: history[0].fen,
        score: { key: "cp", value: 30 },
        lines: [{ score: { key: "cp", value: 30 }, lanLine: "e7e5" }],
      },
      [history[1].fen]: {
        depth: 20,
        fen: history[1].fen,
        score: { key: "cp", value: 25 },
        lines: [{ score: { key: "cp", value: 25 }, lanLine: "g1f3" }],
      },
      [history[2].fen]: {
        depth: 20,
        fen: history[2].fen,
        score: { key: "cp", value: 20 },
        lines: [{ score: { key: "cp", value: 20 }, lanLine: "b8c6" }],
      },
      [history[3].fen]: {
        depth: 20,
        fen: history[3].fen,
        score: { key: "cp", value: 15 },
        lines: [{ score: { key: "cp", value: 15 }, lanLine: "f1b5" }],
      },
      [history[4].fen]: {
        depth: 20,
        fen: history[4].fen,
        score: { key: "cp", value: 10 },
        lines: [{ score: { key: "cp", value: 10 }, lanLine: "a7a6" }],
      },
      [history[5].fen]: {
        depth: 20,
        fen: history[5].fen,
        score: { key: "cp", value: 5 },
        lines: [{ score: { key: "cp", value: 5 }, lanLine: "b5a4" }],
      },
    };

    // Get evaluations from move 2 (Nf3) forward
    const middleMove = history[2];
    const result = getEvaluationsFromMoveForward(middleMove, evaluations);

    // Should contain moves from index 2 onwards (4 moves)
    expect(Object.keys(result).length).toBe(4);
    expect(result[history[2].fen]).toBeDefined();
    expect(result[history[3].fen]).toBeDefined();
    expect(result[history[4].fen]).toBeDefined();
    expect(result[history[5].fen]).toBeDefined();

    // Should not contain earlier moves
    expect(result[history[0].fen]).toBeUndefined();
    expect(result[history[1].fen]).toBeUndefined();
  });

  it('should include evaluations from variations', () => {
    const pgn = '1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Get the variation
    const firstMoveWithVariation = history.find((m) => m.variations.length > 0);
    if (!firstMoveWithVariation) throw new Error('No variation found');
    const variation = firstMoveWithVariation.variations[0];

    const evaluations: Evaluations = {
      [history[0].fen]: {
        depth: 20,
        fen: history[0].fen,
        score: { key: "cp", value: 30 },
        lines: [{ score: { key: "cp", value: 30 }, lanLine: "e7e5" }],
      },
      [history[1].fen]: {
        depth: 20,
        fen: history[1].fen,
        score: { key: "cp", value: 25 },
        lines: [{ score: { key: "cp", value: 25 }, lanLine: "g1f3" }],
      },
      [history[2].fen]: {
        depth: 20,
        fen: history[2].fen,
        score: { key: "cp", value: 20 },
        lines: [{ score: { key: "cp", value: 20 }, lanLine: "b8c6" }],
      },
      // Variation moves
      [variation[0].fen]: {
        depth: 20,
        fen: variation[0].fen,
        score: { key: "cp", value: 40 },
        lines: [{ score: { key: "cp", value: 40 }, lanLine: "g1f3" }],
      },
      [variation[1].fen]: {
        depth: 20,
        fen: variation[1].fen,
        score: { key: "cp", value: 35 },
        lines: [{ score: { key: "cp", value: 35 }, lanLine: "d7d6" }],
      },
      [variation[2].fen]: {
        depth: 20,
        fen: variation[2].fen,
        score: { key: "cp", value: 30 },
        lines: [{ score: { key: "cp", value: 30 }, lanLine: "d2d4" }],
      },
    };

    // Get evaluations from the first move (e4) forward
    const firstMove = history[0];
    const result = getEvaluationsFromMoveForward(firstMove, evaluations);

    // Should contain main line moves
    expect(result[history[0].fen]).toBeDefined();
    expect(result[history[1].fen]).toBeDefined();
    expect(result[history[2].fen]).toBeDefined();

    // Should also contain variation moves
    expect(result[variation[0].fen]).toBeDefined();
    expect(result[variation[1].fen]).toBeDefined();
    expect(result[variation[2].fen]).toBeDefined();

    // Total should be 6
    expect(Object.keys(result).length).toBe(6);
  });

  it('should handle nested variations', () => {
    const pgn = '1. e4 e5 (1... c5 2. Nf3 d6 (2... Nc6 3. d4)) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Get the first variation
    const firstMoveWithVariation = history.find((m) => m.variations.length > 0);
    if (!firstMoveWithVariation) throw new Error('No variation found');
    const variation1 = firstMoveWithVariation.variations[0];

    // Get the nested variation
    const variationMoveWithNested = variation1.find((m) => m.variations.length > 0);
    if (!variationMoveWithNested) throw new Error('No nested variation found');
    const variation2 = variationMoveWithNested.variations[0];

    const evaluations: Evaluations = {
      [history[0].fen]: {
        depth: 20,
        fen: history[0].fen,
        score: { key: "cp", value: 30 },
        lines: [{ score: { key: "cp", value: 30 }, lanLine: "e7e5" }],
      },
      [history[1].fen]: {
        depth: 20,
        fen: history[1].fen,
        score: { key: "cp", value: 25 },
        lines: [{ score: { key: "cp", value: 25 }, lanLine: "g1f3" }],
      },
      // First variation
      [variation1[0].fen]: {
        depth: 20,
        fen: variation1[0].fen,
        score: { key: "cp", value: 40 },
        lines: [{ score: { key: "cp", value: 40 }, lanLine: "g1f3" }],
      },
      [variation1[1].fen]: {
        depth: 20,
        fen: variation1[1].fen,
        score: { key: "cp", value: 35 },
        lines: [{ score: { key: "cp", value: 35 }, lanLine: "d7d6" }],
      },
      [variation1[2].fen]: {
        depth: 20,
        fen: variation1[2].fen,
        score: { key: "cp", value: 32 },
        lines: [{ score: { key: "cp", value: 32 }, lanLine: "d2d4" }],
      },
      // Nested variation
      [variation2[0].fen]: {
        depth: 20,
        fen: variation2[0].fen,
        score: { key: "cp", value: 38 },
        lines: [{ score: { key: "cp", value: 38 }, lanLine: "d2d4" }],
      },
      [variation2[1].fen]: {
        depth: 20,
        fen: variation2[1].fen,
        score: { key: "cp", value: 36 },
        lines: [{ score: { key: "cp", value: 36 }, lanLine: "c5d4" }],
      },
    };

    // Get evaluations from the first move forward
    const firstMove = history[0];
    const result = getEvaluationsFromMoveForward(firstMove, evaluations);

    // Should contain all evaluations including nested variations
    expect(result[history[0].fen]).toBeDefined();
    expect(result[history[1].fen]).toBeDefined();
    expect(result[variation1[0].fen]).toBeDefined();
    expect(result[variation1[1].fen]).toBeDefined();
    expect(result[variation1[2].fen]).toBeDefined();
    expect(result[variation2[0].fen]).toBeDefined();
    expect(result[variation2[1].fen]).toBeDefined();

    expect(Object.keys(result).length).toBe(7);
  });

  it('should handle sparse evaluations (missing some moves)', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    const evaluations: Evaluations = {
      // Only have evaluations for moves 0, 2, and 4 (skipping 1, 3, 5)
      [history[0].fen]: {
        depth: 20,
        fen: history[0].fen,
        score: { key: "cp", value: 30 },
        lines: [{ score: { key: "cp", value: 30 }, lanLine: "e7e5" }],
      },
      [history[2].fen]: {
        depth: 20,
        fen: history[2].fen,
        score: { key: "cp", value: 20 },
        lines: [{ score: { key: "cp", value: 20 }, lanLine: "b8c6" }],
      },
      [history[4].fen]: {
        depth: 20,
        fen: history[4].fen,
        score: { key: "cp", value: 10 },
        lines: [{ score: { key: "cp", value: 10 }, lanLine: "a7a6" }],
      },
    };

    // Get evaluations from the first move forward
    const firstMove = history[0];
    const result = getEvaluationsFromMoveForward(firstMove, evaluations);

    // Should only contain the three moves that have evaluations
    expect(Object.keys(result).length).toBe(3);
    expect(result[history[0].fen]).toBeDefined();
    expect(result[history[2].fen]).toBeDefined();
    expect(result[history[4].fen]).toBeDefined();

    // Missing moves should not be in result
    expect(result[history[1].fen]).toBeUndefined();
    expect(result[history[3].fen]).toBeUndefined();
    expect(result[history[5].fen]).toBeUndefined();
  });

  it('should return empty object when starting move has no evaluation and no later evaluations', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    const evaluations: Evaluations = {};

    // Get evaluations from a move forward
    const move = history[1];
    const result = getEvaluationsFromMoveForward(move, evaluations);

    // Should be empty
    expect(Object.keys(result).length).toBe(0);
  });

  it('should return evaluations from a variation move forward', () => {
    const pgn = '1. e4 e5 (1... c5 2. Nf3 d6 3. d4) 2. Nf3 Nc6 *';
    const cmchess = loadPgnIntoCmChess(pgn);
    const history = cmchess.history();

    // Get the variation
    const firstMoveWithVariation = history.find((m) => m.variations.length > 0);
    if (!firstMoveWithVariation) throw new Error('No variation found');
    const variation = firstMoveWithVariation.variations[0];

    const evaluations: Evaluations = {
      // Main line
      [history[0].fen]: {
        depth: 20,
        fen: history[0].fen,
        score: { key: "cp", value: 30 },
        lines: [{ score: { key: "cp", value: 30 }, lanLine: "e7e5" }],
      },
      [history[1].fen]: {
        depth: 20,
        fen: history[1].fen,
        score: { key: "cp", value: 25 },
        lines: [{ score: { key: "cp", value: 25 }, lanLine: "g1f3" }],
      },
      // Variation
      [variation[0].fen]: {
        depth: 20,
        fen: variation[0].fen,
        score: { key: "cp", value: 40 },
        lines: [{ score: { key: "cp", value: 40 }, lanLine: "g1f3" }],
      },
      [variation[1].fen]: {
        depth: 20,
        fen: variation[1].fen,
        score: { key: "cp", value: 35 },
        lines: [{ score: { key: "cp", value: 35 }, lanLine: "d7d6" }],
      },
      [variation[2].fen]: {
        depth: 20,
        fen: variation[2].fen,
        score: { key: "cp", value: 30 },
        lines: [{ score: { key: "cp", value: 30 }, lanLine: "d2d4" }],
      },
      [variation[3].fen]: {
        depth: 20,
        fen: variation[3].fen,
        score: { key: "cp", value: 28 },
        lines: [{ score: { key: "cp", value: 28 }, lanLine: "c5d4" }],
      },
    };

    // Get evaluations from the second move of the variation (Nf3 in variation)
    const variationMove = variation[1];
    const result = getEvaluationsFromMoveForward(variationMove, evaluations);

    // Should contain only the variation moves from index 1 onwards
    expect(Object.keys(result).length).toBe(3);
    expect(result[variation[1].fen]).toBeDefined();
    expect(result[variation[2].fen]).toBeDefined();
    expect(result[variation[3].fen]).toBeDefined();

    // Should not contain main line or earlier variation moves
    expect(result[history[0].fen]).toBeUndefined();
    expect(result[history[1].fen]).toBeUndefined();
    expect(result[variation[0].fen]).toBeUndefined();
  });
});
