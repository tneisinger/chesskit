import { PieceColor } from '@/types/chess';
import { Score } from '@/utils/stockfish';

function toPov(color: PieceColor, diff: number): number {
  return color === PieceColor.WHITE ? diff : -diff;
}

function rawWinningChances(cp: number): number {
  return 2 / (1 + Math.exp(-0.004 * cp)) - 1;
}

function cpWinningChances(cp: number): number {
  return rawWinningChances(Math.min(Math.max(-1000, cp), 1000));
}

function mateWinningChances(mate: number): number {
  const cp = (21 - Math.min(10, Math.abs(mate))) * 100;
  const signed = cp * (mate > 0 ? 1 : -1);
  return rawWinningChances(signed);
}

function evalWinningChances(score: Score): number {
  if (score.key === 'mate') return mateWinningChances(score.value);
  return cpWinningChances(score.value);
}

// winning chances for a color
// 1  infinitely winning
// -1 infinitely losing
export function povChances(color: PieceColor, score: Score): number {
  return toPov(color, evalWinningChances(score));
}

// computes the difference, in winning chances, between two evaluations
// 1  = e1 is infinitely better than e2
// -1 = e1 is infinitely worse  than e2
export function povDiff(color: PieceColor, s1: Score, s2: Score): number {
  return (povChances(color, s1) - povChances(color, s2)) / 2;
}
