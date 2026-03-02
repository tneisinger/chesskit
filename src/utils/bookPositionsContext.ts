import { BookPositions, BookPosition } from "@/types/bookPositions";
import { makeKey, makeAltFensWithEnPassantSquares } from "./bookPositions";

export function isBookPosition(fen: string, bookPositions: BookPositions): boolean {
  if (makeKey(fen) in bookPositions) return true;

  const altFens = makeAltFensWithEnPassantSquares(fen);
  if (altFens.length < 1) return false;

  for (let i = 0; i < altFens.length; i++) {
    if (makeKey(altFens[i]) in bookPositions) return true;
  }
  return false;
}

export function getBookPosition(fen: string, bookPositions: BookPositions): BookPosition | undefined {
  const bp = bookPositions[makeKey(fen)];
  if (bp) return bp;

  const altFens = makeAltFensWithEnPassantSquares(fen);
  for (let i = 0; i < altFens.length; i++) {
    const bp = bookPositions[makeKey(altFens[i])];
    if (bp) return bp;
  }
}
