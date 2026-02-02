import { describe, it, expect } from 'vitest';
import {
  promoteToMainLine,
  loadPgnIntoCmChess,
  getVariations,
} from './cmchess';
import { convertLanLineToSanLine } from './chess';

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
