import {
  GameData,
  GameResult,
  FenParts,
  ChessWebsite,
  MoveJudgement,
  PieceColor,
  ShortMove,
  Evaluation,
  GameEvals,
  GameEvaluation,
  PositionEvaluation,
  TimeControl,
} from '../types/chess';
import { Chess as ChessJS } from 'chess.js';
import { Chess as CmChess, Move, FEN  } from 'cm-chess/src/Chess';
import { Move as ChessJsMove } from 'chess.js';
import { assertUnreachable, average, pluralizeWord } from '.';
import { povDiff } from '@/utils/winningChances';
import { ChessMoveColors } from '@/constants/colors';
import { getBookPosition, isBookPosition } from '@/utils/bookPositions';
import { parse } from 'pgn-parser'
import { parseLanMove } from './stockfish';

/**
 * Try to play a move into a ChessJS or CmChess object. Throw an error if the move
  * is not played.
 */
export function performMove(
  move: string | ShortMove,
  chess: ChessJS | CmChess
): ChessJsMove {
  const result = chess.move(move);
  if (!result) throw new Error(`Bad move ${move} in fen ${chess.fen()}`)
  return result as ChessJsMove;
}

export function areMovesEqual(m1: ShortMove, m2: ShortMove): boolean {
  if ((m1.promotion || m2.promotion) && m1.promotion !== m2.promotion) return false;
  return (m1.from === m2.from && m1.to === m2.to);
}

/**
 * Return true if two move strings (aka sans) represent the same move.
 */
export function areSansEquivalent(fen: string, m1: string, m2: string): boolean {
  const chessjs1 = new ChessJS();
  const chessjs2 = new ChessJS();
  chessjs1.load(fen);
  chessjs2.load(fen);
  performMove(m1, chessjs1);
  performMove(m2, chessjs2);
  return chessjs1.fen() === chessjs2.fen();
}

export function areLinesEqual(line1: ShortMove[], line2: ShortMove[]): boolean {
  if (line1.length !== line2.length) return false;
  for (let i = 0; i < line1.length; i++) {
    if (!areMovesEqual(line1[i], line2[i])) return false;
  }
  return true;
}

/**
 * Return true if the two lines are the same. Each input line should be any array
 * of move sans. This function will assume the normal starting position if no fen
 * is provided on input.
 */
export function areSanLinesEqual(line1: string[], line2: string[], fen?: string): boolean {
  if (line1.length !== line2.length) return false;
  const chessjs1 = new ChessJS();
  const chessjs2 = new ChessJS();
  if (fen) {
    chessjs1.load(fen);
    chessjs2.load(fen);
  }
  for (let i = 0; i < line1.length; i++) {
    performMove(line1[i], chessjs1);
    performMove(line2[i], chessjs2);
    if (chessjs1.fen() !== chessjs2.fen()) return false;
  }
  return true;
}

export function convertLanLineToShortMoves(line: string[], fen?: string): ShortMove[] {
  const chessjs = new ChessJS();
  if (fen) chessjs.load(fen);
  line.forEach((lan) => {
    performMove(lanToShortMove(lan), chessjs);
  })
  return chessjs.history({ verbose: true }) as ShortMove[];
}

export function convertLanLineToSanLine(line: string[], fen?: string): string[] {
  const chessjs = new ChessJS();
  if (fen) chessjs.load(fen);
  line.forEach((lan) => {
    performMove(lanToShortMove(lan), chessjs);
  })
  return chessjs.history() as string[];
}

export function convertSanLineToShortMoves(line: string[], fen?: string): ShortMove[] {
  const chessjs = new ChessJS();
  if (fen) chessjs.load(fen);
  line.forEach((move) => {
    performMove(move, chessjs);
  })
  return chessjs.history({ verbose: true }) as ShortMove[];
}

export function convertSanLineToLanLine(line: string[], fen?: string): string[] {
  const chessjs = new ChessJS();
  if (fen) chessjs.load(fen);
  line.forEach((move) => {
    performMove(move, chessjs);
  })
  const moves = chessjs.history({ verbose: true }) as ShortMove[];
  return moves.map((m) => shortMoveToLan(m));
}

/**
 * Return true if line1 is equal to the start of line2. Each input line should be any array
 * of move sans. This function will assume the normal starting position if no fen
 * is provided on input.
 */
export function isSubline(line1: ShortMove[], line2: ShortMove[]): boolean {
  if (line1.length > line2.length) return false;
  return areLinesEqual(line1, line2.slice(0, line1.length));
}

export function getSharedMoves(line1: ShortMove[], line2: ShortMove[]): ShortMove[] {
  const result: ShortMove[] = [];
  let shortestLength = line1.length;
  if (shortestLength > line2.length) shortestLength = line2.length;
  for (let i = 0; i < shortestLength; i++) {
    if (areMovesEqual(line1[i], line2[i])) {
      result.push(line1[i]);
    } else {
      return result;
    }
  }
  return result;
}

/**
 * Given a fen string, return which color is to play next
 */
export function getNextToPlay(fen: string): PieceColor | null {
  const regex = /^\S* ([w|b]).*/

  const matches = fen.match(regex);
  if (matches) {
    const [, color] = matches;
    return (color === 'w') ? PieceColor.WHITE : PieceColor.BLACK;
  }
  return null;
}

export function getFenParts(fen: string): FenParts {
  // To validate the fen, attempt to load it with chess.js. If the fen is invalid, chessjs will
  // throw an exception. ChessJS will throw an exception if the empty fen is given, so skip this
  // step if fen === FEN.empty
  const chessjs = new ChessJS();
  if (fen !== FEN.empty) {
    chessjs.load(fen);
  }

  const [placement, color, castling, enPasSq, halfClock, fullMoveNum] = fen.split(' ');
  return {
    piecePlacement: placement,
    activeColor: color === 'w' ? PieceColor.WHITE : PieceColor.BLACK,
    castling,
    enPassantSquare: enPasSq,
    halfMoveClock: Number(halfClock),
    fullMoveNumber: Number(fullMoveNum),
  };
}

// Given a fen string, return the number of plys that have been played.
export function getPlyFromFen(fen: string): number {
  const { activeColor, fullMoveNumber } = getFenParts(fen);
  const basePly = 2 * (fullMoveNumber - 1);
  return activeColor === PieceColor.BLACK ? basePly + 1 : basePly;
}

// Given a fen string, get the index of the position in the game.
export function getPositionIdx(fen: string): number {
  const { activeColor, fullMoveNumber } = getFenParts(fen);
  const posIdxForWhite = (fullMoveNumber - 1) * 2;
  if (activeColor === PieceColor.WHITE) return posIdxForWhite;
  return posIdxForWhite + 1;
}

export function getGameWebsite(game: GameData): ChessWebsite | undefined {
  if (game.url) {
    for (const website of Object.values(ChessWebsite)) {
      if (game.url.includes(website)) return website;
    }
  }
  return undefined;
}

/**
 * Convert a ShortMove to a normal notation string.
 * @example shortMoveToSan({ from: 'b1', to: 'c3' }, startpos)
 *   Returns 'Nc3'
 */
export function shortMoveToSan(move: ShortMove, fen: string): string {
  const chessjs = new ChessJS();
  if (!Boolean(chessjs.load(fen))) throw new Error(`Failed to load fen string ${fen}`);
  if (!chessjs.move(move as ShortMove)) throw new Error(`Failed to play move ${move}`);
  const history = chessjs.history();
  return history[history.length - 1] as string;
}

/**
 * Convert a san string to a ShortMove
 * @example sanToShortMove(Nc3, startpos)
 *   Returns '{ from: 'b1', to: 'c3' }'
 */
export function sanToShortMove(san: string, fen: string): ShortMove {
  const chessjs = new ChessJS();
  if (!Boolean(chessjs.load(fen))) throw new Error(`Failed to load fen string ${fen}`);
  if (!chessjs.move(san)) throw new Error(`Failed to play move ${san}`);
  const history = chessjs.history({ verbose: true });
  return history[history.length - 1] as ShortMove;
}

// export function sanToLan(san: string, fen: string): string {
//   const chessjs = new ChessJS();
//   chessjs.load(fen);
//   performMove(san, chessjs);
//   const history = chessjs.history({ verbose: true });
//   const shortMove: ShortMove = (history[history.length - 1] as ShortMove);
//   return shortMoveToLan(shortMove);
// }

// export function lanToSan(lan: string, fen: string): string {
//   const chessjs = new ChessJS();
//   chessjs.load(fen);
//   performMove(lanToShortMove(lan), chessjs);
//   const history = chessjs.history() as string[];
//   return history[history.length - 1];
// }

export function lanToShortMove(lan: string): ShortMove {
  const move = parseLanMove(lan);
  if (move == undefined) throw new Error(`Failed to parse lan ${lan}`);
  return move;
}

export function shortMoveToLan(shortMove: ShortMove): string {
  const { from, to, promotion } = shortMove;
  const result = `${from}${to}`;
  if (promotion == undefined) return result;
  return result + promotion;
}

/**
 * Given an array of fen strings from one game, sort them in the order that they occurred
 * in the game. This function does check for game validity. The sorting occurs in place
 * and the input list is returned.
 */
export function sortFenStrings(fens: string[]): string[] {
  fens.sort((fen1, fen2) => {
    const { fullMoveNumber: fullMove1, activeColor: color1 } = getFenParts(fen1);
    const { fullMoveNumber: fullMove2, activeColor: color2 } = getFenParts(fen2);
    if (fullMove1 < fullMove2) return -1;
    if (fullMove1 > fullMove2) return 1;
    if (color1 === PieceColor.WHITE && color2 === PieceColor.BLACK) return -1;
    if (color1 === PieceColor.BLACK && color2 === PieceColor.WHITE) return 1;

    if (color1 === color2) {
      throw new Error(
        `Found two fens with same fullMove ${fullMove1} and same color ${color1}`
      );
    }

    throw new Error('Unknown error occurred');
  });
  return fens;
}

export function getFen(move: Move | undefined): string {
  if (move == undefined) return FEN.start;
  return move.fen;
}

/**
 * Return the maximum shift value for the given MoveJudgement.
 */
export function maxShiftOf(mj: MoveJudgement): number {
  switch (mj) {
    case MoveJudgement.Best:
      return 0;
    case MoveJudgement.Excellent:
      return 0.015;
    case MoveJudgement.Good:
      return 0.05;
    case MoveJudgement.Inaccurate:
      return 0.1;
    case MoveJudgement.Mistake:
      return 0.25;
    case MoveJudgement.Blunder:
      return Infinity;
    default:
      assertUnreachable(mj);
  }
}

/**
 * Produce a MoveJudgement for the given shift value. This function will never return
 * MoveJudgment.Best. Whether or not a move is best cannot be determined by the shift
 * value. We should rely on the output of Stockfish to determine which move is best.
 * Therefore, this function needs to be used in conjunction with a stockfish output to
 * generate a true MoveJudgement.
 */
export function judgeShift(shift: number): MoveJudgement {
  const judgements = [
    MoveJudgement.Excellent,
    MoveJudgement.Good,
    MoveJudgement.Inaccurate,
    MoveJudgement.Mistake,
  ];
  const judgement = judgements.find((j) => shift <= maxShiftOf(j));
  return judgement ? judgement : MoveJudgement.Blunder;
}

export function isMoveInMainLine(move: Move | undefined, history: Move[]): boolean {
  if (move == undefined) return true;
  for (let i = 0; i < history.length; i++) {
    if (move.variation[i].san !== history[i].san
      || move.variation[i].ply !== history[i].ply) return false;
  }
  return true;
}

export function getFenStringsOfGame(
  game: GameData,
  sliceEnd?: number,
): string[] {
  const result = [];
  const chessjs = new ChessJS();

  const parsedPgn = parsePGN(game.pgn)[0];
  let moves = parsedPgn.moves;
  if (sliceEnd != undefined) {
    moves = moves.slice(0, sliceEnd);
  }

  for (const move of moves) {
    if (!chessjs.move(move.move)) throw new Error(`invalid move ${move.move}`);
    result.push(chessjs.fen());
  }
  return result;
}

export function doesFenOccurInGame(game: GameData, fen: string): boolean {
  if (fen === FEN.start) return true;
  const gameFens = getFenStringsOfGame(game);
  return gameFens.includes(fen);
}

/**
 * Get the number of points scored by the user in the given game. If the game doesn't have
 * a result, return undefined.
 */
export function getGameScore(game: GameData): number | undefined {
  if (game.result == undefined) return undefined;

  if (game.result === GameResult.Draw) return 0.5;

  if (game.result === GameResult.WhiteWins) {
    return game.userColor === PieceColor.WHITE ? 1 : 0;
  }

  if (game.result === GameResult.BlackWins) {
    return game.userColor === PieceColor.BLACK ? 1 : 0;
  }
}

export function getAvgScore(games: GameData[]): number | undefined {
  const scores: number[] = [];
  games.forEach((game) => {
    const score = getGameScore(game);
    if (score != undefined) scores.push(score);
  });

  if (scores.length < 1) return undefined;
  return average(scores);
}

// Stockfish gives moves that look like this: e2e4 e7e5 d7d8q
// Use this function to convert a string like that to something more like Nf6 or e4.
export function changeStockfishMovesToSans(stockfishMoves: string[], fen: string): string[] {
  const result: string[] = [];
  const re = /^([a-h][1-8])([a-h][1-8])([qrbn])?/;
  const chessjs = new ChessJS();

  // Try to load the fen string into chessjs to make sure it is valid.
  chessjs.load(fen);

  stockfishMoves.forEach((stockfishMove) => {
    if (!re.test(stockfishMove)) throw new Error(`Invalid stockfishMove ${stockfishMove}`);
    const matchArray = stockfishMove.match(re);
    if (matchArray == null) throw new Error(`Failed to parse stockfishMove ${stockfishMove}`);
    const [, from, to, promotion] = matchArray;
    const move = chessjs.move({ from, to, promotion });
    if (!move) throw new Error(`Invalid move ${stockfishMove} with fen ${chessjs.fen()}`);
    result.push(move.san);
  })
  return result;
}

export function wasBestMovePlayed(
  fen1: string,
  fen2: string,
  gameEvals: GameEvals
): boolean | undefined {
  const eval1 = gameEvals[fen1];
  if (eval1 == undefined || eval1.bestMove == undefined) return undefined;

  const chessjs = new ChessJS();

  // try to load fen1 into chessjs. If this fails, chessjs will throw an error.
  chessjs.load(fen1);

  if (!chessjs.move(eval1.bestMove)) {
    throw new Error(`Failed to play bestMove ${eval1.bestMove}`);
  }

  return fen2 === chessjs.fen();
}

export function makeMoveJudgement(
  fen1: string,
  fen2: string,
  ev: GameEvals | GameEvaluation,
): MoveJudgement | undefined {
  if (isGameEvaluation(ev)) {
    ev = convertGameEvaluationToGameEvals(ev);
  }
  if (wasBestMovePlayed(fen1, fen2, ev)) return MoveJudgement.Best;

  const evalBefore = ev[fen1];
  const evalAfter = ev[fen2];

  if (evalBefore && evalAfter
    && evalBefore.depth >= 20
    && evalAfter.depth >= 20
  ) {

    const color = getNextToPlay(fen1);
    if (!color) throw new Error(`Failed to get color from fen ${fen1}`);

    return judgeShift(povDiff(color, evalBefore, evalAfter));
  }
}

export function getMoveJudgement(
  currentMove: Move | undefined,
  gameEvals: GameEvals,
): MoveJudgement | undefined {
  if (currentMove && currentMove.previous) {
    const judgement = makeMoveJudgement(
      currentMove.previous.fen,
      currentMove.fen,
      gameEvals,
    );
    return judgement;
  }
}

// Get a css hex color string for a corresponding MoveJudgement. If `fen` is given,
// the fen will be used to determine if the position is a book position. If it is a book
// position, the function will return the hex color for a book move. If `fen` is not defined,
// this function will just return the color of the MoveJudgement. If both `mj` and `fen` are
// undefined, return undefined;
export function getMoveJudgementColor(mj?: MoveJudgement, fen?: string): string | undefined {
  if (fen && isBookPosition(fen)) return ChessMoveColors.Book;
  if (mj == undefined) return undefined;
  switch (mj) {
    case MoveJudgement.Best:
    case MoveJudgement.Excellent:
      return ChessMoveColors.Excellent;
    case MoveJudgement.Good:
      return ChessMoveColors.Good;
    case MoveJudgement.Inaccurate:
      return ChessMoveColors.Inaccurate;
    case MoveJudgement.Mistake:
      return ChessMoveColors.Mistake;
    case MoveJudgement.Blunder:
      return ChessMoveColors.Blunder;
    default:
      assertUnreachable(mj);
  }
}

export function getBestMoveSan(fen: string, gameEvals: GameEvals): string | undefined {
  const bestMove = gameEvals[fen].bestMove;
  if (bestMove) return shortMoveToSan(bestMove, fen);
}

export function isColorToMove(fen: string, color: PieceColor): boolean {
  const { activeColor } = getFenParts(fen);
  return activeColor === color;
};

// Make the string that describes the move number (ply) that was just played.
// For example, if you give this function the fen that results from
// `1. e4 e5 2. Nc3 Nf6 3. f4`, this function will return '3.'
//
// If you give this function a fen that results from `1. e4 e5 2. Nc3 Nf6 3. f4 d5`,
// this function will return '3...'
export function makeMoveNumberString(fen: string): string {
  const { activeColor, fullMoveNumber } = getFenParts(fen);
  let moveNum = fullMoveNumber;
  let punctuation = '.';
  if (activeColor === PieceColor.WHITE) {
    moveNum -= 1;
    punctuation = '...';
  }
  return `${moveNum}${punctuation}`;
}

export function getMaterialCount(fen: string): { white: number, black: number } {
  const result = { white: 0, black: 0 };
  const { piecePlacement } = getFenParts(fen);
  for (let i = 0; i < piecePlacement.length; i++) {
    const charScore = scoreFenPieceChar(piecePlacement.charAt(i));
    if (charScore) {
      if (charScore.color === PieceColor.BLACK) result.black += charScore.value;
      if (charScore.color === PieceColor.WHITE) result.white += charScore.value;
    }
  }
  return result;
}

function scoreFenPieceChar(char: string): { value: number; color: PieceColor } | null {
  if (char.length > 1) throw new Error('Expected a single character');
  if (char === 'p') return { value: 1, color: PieceColor.BLACK };
  if (char === 'n') return { value: 3, color: PieceColor.BLACK };
  if (char === 'b') return { value: 3, color: PieceColor.BLACK };
  if (char === 'r') return { value: 5, color: PieceColor.BLACK };
  if (char === 'q') return { value: 9, color: PieceColor.BLACK };

  if (char === 'P') return { value: 1, color: PieceColor.WHITE };
  if (char === 'N') return { value: 3, color: PieceColor.WHITE };
  if (char === 'B') return { value: 3, color: PieceColor.WHITE };
  if (char === 'R') return { value: 5, color: PieceColor.WHITE };
  if (char === 'Q') return { value: 9, color: PieceColor.WHITE };

  return null;
}

export function stringToTimeControl(s: string): TimeControl {
  if (s.includes('/')) {
    const [_, seconds] = s.split('/');
    const numDays = Math.round(parseInt(seconds) / (24 * 60 * 60));
    return { numDaysPerMove: numDays }
  }
  const limitSeconds = Math.round(parseInt(s));
  let incrementSeconds = 0;
  if (s.includes('+')) {
    const [_limit, increment] = s.split('+');
    incrementSeconds = parseInt(increment);
  }
  return {
    limitSeconds,
    incrementSeconds,
  }
}

export function timeControlToReadableString(tc: TimeControl): string {
  if ('numDaysPerMove' in tc) {
    const numDays = tc.numDaysPerMove;
    return `${numDays} ${pluralizeWord(numDays, 'day')}`
  }
  const limitMinutes = tc.limitSeconds / 60;
  if (tc.incrementSeconds === 0) {
    return `${limitMinutes} min`;
  }
  return `${limitMinutes} | ${tc.incrementSeconds}`;
}

export function timeControlToPgnString(tc: TimeControl): string {
  if ('numDaysPerMove' in tc) {
    return `1/${tc.numDaysPerMove * (24 * 60 * 60)}`
  }
  if (tc.incrementSeconds === 0) {
    return `${tc.limitSeconds}`;
  } else {
    return `${tc.limitSeconds}+${tc.incrementSeconds}`;
  }
}

export function makeReadableTimeControl(s: string): string {
  return timeControlToReadableString(stringToTimeControl(s));
}

export function makePgnStringFromHistory(history: Move[]): string {
  const chessjs = new ChessJS();
  history.forEach((move) => {
    if (!chessjs.move(move)) throw new Error(`Invalid move ${move}`);
  })
  const pgn = chessjs.pgn();
  try {
    parse(pgn);
    return pgn;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'SyntaxError') {
        return `${pgn} *`;
      }
    }
  }
  throw new Error('Failed to makePgnStringFromHistory');
}

// Create a pgn string from a chessjs.history() or a cmchess.history()
// This function will recursively add variations to the pgn string.
export function makePgnFromHistory(
  history: Move[],
  includeVariations = true,
  isVariation = false,
): string {
  let output = '';
  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    const moveNumber = Math.ceil(move.ply / 2);

    // A pgn always starts with a move number. Variations also always
    // start with a move number. If we are in a variation that begins
    // with a black move, we must follow the move number with '...'.
    // Otherwise, just follow the move number with a single '.'.
    if (i === 0) {
      if (move.ply % 2 === 1) {
        output += `${moveNumber}. `;
      } else {
        output += `${moveNumber}... `;
      }
    }

    // If the move is a white move (and i !== 0) we need to add a move number
    // before we add the move.
    if (i > 0 && move.ply % 2 === 1) {
      output += `${moveNumber}. `;
    }

    output += move.san;

    // If the move has variations, recursively add the variations to the pgn.
    if (move.variations.length > 0 && includeVariations) {
      for (const variation of move.variations) {
        output += ' (';
        output += makePgnFromHistory(variation, includeVariations, true);
        output += ')';
      }
      // Only add move number if there are more moves following
      if (move.ply % 2 === 1 && i < history.length - 1) output += ` ${moveNumber}...`
    }
    output += ' ';
  }

  // Determine the game result if not currently in a variation
  if (!isVariation) {
    const chessjs = new ChessJS();
    history.forEach((move) => performMove(move, chessjs));
    let gameResult = '*';
    if (chessjs.isCheckmate()) {
      gameResult = chessjs.turn() === 'w' ? '0-1' : '1-0';
    } else if (chessjs.isDraw() || chessjs.isStalemate()) {
      gameResult = '1/2-1/2';
    }
    output += gameResult;
  }

  return output.trim();
}

export function makeMovesOnlyPGN(pgn: string): string {
  try {
    const parsed = parsePGN(pgn, { allowIncomplete: true });
    if (!parsed || parsed.length === 0) {
      return '';
    }

    const game = parsed[0];
    if (!game.moves || game.moves.length === 0) {
      return game.result || '*';
    }

    // Helper function to strip annotations from a move string
    const stripAnnotations = (moveStr: string): string => {
      // Remove annotations like !, ?, !!, ??, !?, ?!
      return moveStr.replace(/[!?]+/g, '');
    };

    // Helper function to process moves recursively (including variations)
    const processMoves = (moves: any[], startIndex: number = 0, isFirstMoveInVariation: boolean = false): string => {
      let output = '';
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const moveIndex = startIndex + i;

        // Add move number for white's moves (even indices)
        // Or for the first move in a variation if it's a black move
        if (moveIndex % 2 === 0) {
          const moveNum = Math.floor(moveIndex / 2) + 1;
          output += `${moveNum}. `;
        } else if (i === 0 && isFirstMoveInVariation) {
          // First move in variation is a black move, add move number with ...
          const moveNum = Math.floor(moveIndex / 2) + 1;
          output += `${moveNum}... `;
        }

        // Strip annotations from the move
        output += `${stripAnnotations(move.move)} `;

        // Handle variations
        if (move.ravs && move.ravs.length > 0) {
          for (const rav of move.ravs) {
            output += '(';
            if (rav.moves && rav.moves.length > 0) {
              // For variations, we need to figure out what move number to start with
              // The variation starts at the same position as the current move
              output += processMoves(rav.moves, moveIndex, true);
            }
            output += ') ';
          }

          // Add move number continuation if needed after variation
          if (moveIndex % 2 === 0 && i < moves.length - 1) {
            const moveNum = Math.floor(moveIndex / 2) + 1;
            output += `${moveNum}... `;
          }
        }
      }
      return output.trim();
    };

    let output = processMoves(game.moves);

    // Add the game result
    const result = game.result || '*';
    output += ` ${result}`;

    return output.trim();
  } catch (error) {
    console.error('Error parsing PGN in makeMovesOnlyPGN:', error);
    return '';
  }
}

export function isThreefoldRepetition(
  moves: (string | ShortMove)[],
  initialFen?: string
): boolean {
  const chessjs = new ChessJS();
  if (initialFen) chessjs.load(initialFen);
  moves.forEach((move) => {
    performMove(move, chessjs);
  })
  return chessjs.isThreefoldRepetition();
}

export function parsePGN(pgn: string, options?: { allowIncomplete?: boolean }) {
  if (options?.allowIncomplete) {
    try {
      return parse(pgn);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'SyntaxError') {
          // Try adding a game result to the end and parsing again
          try {
            return parse(`${pgn} *`);
          } catch {
            throw error;
          }
        }
      }
      throw error;
    }
  }
  return parse(pgn);
}

export function cleanPGN(pgn: string): string | undefined {
  const trimmedPgn = pgn.trim();
  try {
    parse(trimmedPgn);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'SyntaxError') {
        // Try adding a game result to the end and parsing again
        try {
          parse(`${trimmedPgn} *`);
        } catch {
          throw error;
        }
        return `${trimmedPgn} *`;
      }
    }
    throw error;
  }
  return trimmedPgn;
}

// Return true if the two fens are equal. If options.allowEnpassantDif is true,
// then ignore differences in enpassant squares unless both fens have an enpassant square.
export function areFensEqual(
  fen1: string,
  fen2: string,
  options?: { allowEnpassantDif: boolean }
): boolean {
  const parts1 = getFenParts(fen1);
  const parts2 = getFenParts(fen2);

  if (parts1.piecePlacement !== parts2.piecePlacement) return false;
  if (parts1.activeColor !== parts2.activeColor) return false;
  if (parts1.castling !== parts2.castling) return false;
  if (parts1.halfMoveClock !== parts2.halfMoveClock) return false;
  if (parts1.fullMoveNumber !== parts2.fullMoveNumber) return false;

  if (options && options.allowEnpassantDif) {
    return parts1.enPassantSquare === '-' || parts2.enPassantSquare === '-';
  }
  return parts1.enPassantSquare === parts2.enPassantSquare;
}

export function convertPositionEvaluationToEvaluation(
  posEval: PositionEvaluation
): Evaluation {
  let partial = { depth: posEval.depth, fen: posEval.fen, bestMove: posEval.bestMove };
  if (posEval.score.key === 'cp') {
    return { ...partial, cp: posEval.score.value };
  }
  return { ...partial, mate: posEval.score.value };
}

export function convertGameEvaluationToGameEvals(
gev: GameEvaluation
): GameEvals {
  const result: GameEvals = {};
  for (const [fen, posEval] of Object.entries(gev)) {
    result[fen] = convertPositionEvaluationToEvaluation(posEval);
  }
  return result;
}

export function isPositionEvaluation(
  ev: Evaluation | PositionEvaluation
): ev is PositionEvaluation {
  return (ev as PositionEvaluation).score !== undefined;
}

export function isGameEvaluation(
  ev: GameEvals | GameEvaluation
): ev is GameEvaluation {
  const firstKey = Object.keys(ev)[0];
  if (firstKey == undefined) return false;
  const firstValue = ev[firstKey];
  return isPositionEvaluation(firstValue);
}

// Convert a GameEvaluation object to an array of PositionEvaluation objects,
// sorted by fen ply.
export function makeGameEvaluationArray(gev: GameEvaluation): PositionEvaluation[] {
  const gevArray = Object.values(gev).map((posEval) => posEval);
  gevArray.sort((a, b) => getPlyFromFen(a.fen) - getPlyFromFen(b.fen));
  return gevArray;
}

// Given a GameEvaluation object, produce a mapping of fenAfter strings
// to MoveJudgement for each move in the game.
export function makeMoveJudgements(
  gev: GameEvaluation
): Record<string, MoveJudgement> {
  const result: Record<string, MoveJudgement> = {};
  const gevArray = makeGameEvaluationArray(gev);

  // Make a copy of gev to avoid modifying the input object.
  // We may need to modify it by adding the starting position.
  const modifiedGev = {...gev };

  // Check gevArray starts with the starting position.
  const firstPly = getPlyFromFen(gevArray[0].fen);
  if (firstPly !== 0) {
    // If the first position is not ply 0, ensure it is ply 1.
    if (firstPly !== 1) throw new Error('GameEvaluation is missing evaluation for move 1');

    // If the first position is not the starting position, we need to
    // add the starting position evaluation to the front of the array.
    const startEval = getBookPosition(FEN.start)!.eval;
    const positionEvaluationForStart: PositionEvaluation = {
      depth: startEval.depth,
      fen: FEN.start,
      score: { key: 'cp', value: startEval.cp! },
      lines: [],
      bestMove: startEval.bestMove,
    }
    gevArray.unshift(positionEvaluationForStart);
    modifiedGev[FEN.start] = positionEvaluationForStart;
  }

  // Loop through each consecutive pair of fens and make a MoveJudgement for each move.
  for (let i = 0; i < gevArray.length - 1; i++) {
    const fenBefore = gevArray[i].fen;
    const fenAfter = gevArray[i + 1].fen;
    const judgement = makeMoveJudgement(fenBefore, fenAfter, modifiedGev);
    if (judgement == undefined) {
      throw new Error(`Failed to make move judgement for fens ${fenBefore} -> ${fenAfter}`);
    }
    result[fenAfter] = judgement;
  }
  return result;
}
