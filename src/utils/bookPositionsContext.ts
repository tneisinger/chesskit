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
  let bookPosition = bookPositions[makeKey(fen)];
  if (bookPosition == undefined) {
    const altFens = makeAltFensWithEnPassantSquares(fen);
    for (let i = 0; i < altFens.length; i++) {
      bookPosition = bookPositions[makeKey(altFens[i])];
      if (bookPosition != undefined) break;
    }
  }

  if (bookPosition) {
    // Replace pev.fen with the input fen because move clocks may differ
    bookPosition.pev.fen = fen;
  }
  return bookPosition;
}
