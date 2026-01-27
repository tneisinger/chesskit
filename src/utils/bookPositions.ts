import type { Evaluation, GameData } from '@/types/chess';
import { bookPositions, BookPosition, BookPos } from '@/utils/bookPositionsData';
import { getFenStringsOfGame } from '@/utils/chess';

export const commonOpeningPositions = [
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6',  // Sicilian Defense
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', // French Defense
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -', // Ruy López
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', // Caro-Kann Defense
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -', // Italian Game
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6', // Scandinavian
  'rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -', // Pirc Defense
  'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', // Alekhine's Defense
  'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3', // King's Gambit
  'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3', // Scotch Game
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq -', // Vienna Game
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3', // Queen's Gambit
  'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -', // Slav Defense
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -', // King's Indian Defense
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq -', // Nimzo-Indian Defense
  'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq -', // Queen's Indian Defense
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/6P1/PP2PP1P/RNBQKBNR b KQkq -', // Catalan Opening
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/5N2/PP2PPPP/RNBQKB1R w KQkq -', // Bogo-Indian Defense
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq d6', // Grünfeld Defense
  'rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq f6', // Dutch Defense
  'rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR b KQkq -', // Trompowsky Attack
  'rnbqkb1r/pp1ppppp/5n2/2p5/2PP4/8/PP2PPPP/RNBQKBNR w KQkq c6', // Benoni Defense
  'rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq b6', // Benko Gambit
  'rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq -', // Accelerated London
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq -', // London System
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -', // Reti Opening
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3',  // English Opening
  'rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq f3', // Bird's Opening
  'rnbqkbnr/ppp1pppp/8/3p4/8/5NP1/PPPPPP1P/RNBQKB1R b KQkq -', // King's Indian Attack
  'rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPP1P/RNBQKBNR b KQkq -', // King's Fianchetto Opening
  'rnbqkbnr/pppppppp/8/8/8/1P6/P1PPPPPP/RNBQKBNR b KQkq -', // Nimzowitsch-Larsen Attack
  'rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b KQkq b3', // Polish Opening (Orangutan)
  'rnbqkbnr/pppppppp/8/8/6P1/8/PPPPPP1P/RNBQKBNR b KQkq g3', // Grob Opening
  'rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq -', // Queen's Gambit Accepted
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -', // Queen's Gambit Declined
  'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq -', // Semi Slav
  'rnbqkbnr/ppp1pppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR b KQkq e3', // Blackmar Gambit
  'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq e6', // Englund Gambit
  'rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -', // Modern Defense 1. d4
  'rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', // Modern Defense 1. e4
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/4PN2/PPP2PPP/RNBQKB1R b KQkq -', // Colle System
  'rnbqkb1r/pppppppp/5n2/8/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq -', // Accelerated London Nf6
  'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', // Nimzowitsch Defense
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -', // Indian Defense
];

export const possibleEnPassantSquares = [
  'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
  'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
]

// If the input fen has '-' as the enpassant value, return an array containing
// the 16 alternative versions of the input fen with all the
// possibleEnPassantSquares as the en passant value. This function is useful
// because some fen generators will not specify the enpassant square if there
// is not a pawn that can capture en passant. Other fen generators always specify
// the en passant square when a pawn moves two squares. The fens in this
// file and in 'bookPositions' always specify the en passant square when
// a pawn moves two squares.
export function makeAltFensWithEnPassantSquares(fen: string): string[] {
  const [ps, color, castling, enp, halfM, fullM] = fen.split(' ');
  if (enp !== '-') return [];
  return possibleEnPassantSquares.map((sq) => (
    [ps, color, castling, sq, halfM, fullM].join(' ')
  ));

}

function makeKey(fen: string): string {
  const [placement, color, castling, enpassant] = fen.split(' ');
  return `${placement} ${color} ${castling} ${enpassant}`;
}

export function isBookPosition(fen: string): boolean {
  if (makeKey(fen) in bookPositions) return true;

  const altFens = makeAltFensWithEnPassantSquares(fen);
  if (altFens.length < 1) return false;

  for (let i = 0; i < altFens.length; i++) {
    if (makeKey(altFens[i]) in bookPositions) return true;
  }
  return false;
}

export function getBookPosition(fen: string): BookPosition | undefined {
  const makeBookPosition = (bp: BookPos): BookPosition => {
    const evaluation: Evaluation = { ...bp.eval, fen } as Evaluation;
    return { ...bp, eval: evaluation };
  }

  const bp = bookPositions[makeKey(fen)];
  if (bp) return makeBookPosition(bp);

  const altFens = makeAltFensWithEnPassantSquares(fen);
  for (let i = 0; i < altFens.length; i++) {
    const bp = bookPositions[makeKey(altFens[i])];
    if (bp) return makeBookPosition(bp);
  }
}

export function getOpening(game: GameData): string | null {
  let result = null;
  const fens = getFenStringsOfGame(game).slice(0, 20);
  for (const fen of fens) {
    if (commonOpeningPositions.includes(makeKey(fen))) {
      const bookPosition = getBookPosition(fen);
      if (bookPosition) result = bookPosition.name;
    }
  }
  return result;
}

export function shortenOpeningName(openingName: string, maxLength = 16): string {
  if (openingName.length > maxLength) {
    const fullWords = openingName.slice(0, maxLength).split(' ').slice(0,-1);
    return fullWords.join(' ');
  }
  return openingName;
}

export function isCommonPos(fen: string): boolean {
  if (commonOpeningPositions.includes(makeKey(fen))) return true;
  const altFens = makeAltFensWithEnPassantSquares(fen);
  for (let i = 0; i < altFens.length; i++) {
    const altKey = makeKey(altFens[i]);
    if (commonOpeningPositions.includes(altKey)) return true;
  }
  return false;
}
