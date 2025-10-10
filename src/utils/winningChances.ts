import { Evaluation, PieceColor } from '@/types/chess';

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

function evalWinningChances(ev: Evaluation): number {
  if (ev.mate != undefined) return mateWinningChances(ev.mate);
  return cpWinningChances(ev.cp);
}

// winning chances for a color
// 1  infinitely winning
// -1 infinitely losing
export function povChances(color: PieceColor, ev: Evaluation): number {
  return toPov(color, evalWinningChances(ev));
}

// computes the difference, in winning chances, between two evaluations
// 1  = e1 is infinitely better than e2
// -1 = e1 is infinitely worse  than e2
export function povDiff(color: PieceColor, e1: Evaluation, e2: Evaluation): number {
  return (povChances(color, e1) - povChances(color, e2)) / 2;
}
