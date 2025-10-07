import { Evaluation, PieceColor, ShortMove } from '../types/chess'
import { getNextToPlay } from './chess';

// LAN stands for Long Algebraic Notation
export function parseLanMove(str: string): ShortMove | undefined {
  const regex = /([a-h][1-8])([a-h][1-8])([qrbn])?/;
  const match = str.match(regex);
  if (match == null) return undefined;
  const [, from, to, promotion] = match;
  if (from == undefined || to == undefined) return undefined;
  const result: ShortMove = { from, to };
  if (promotion) result.promotion = promotion;
  return result;
}

export interface BestMoveInfo {
  bestmove: string | null;
  ponder?: string;
}

export function parseIsStockfishReady(line: string): boolean {
  return /^readyok/.test(line);
}

export function parseLoadNnueAttempt(line: string): boolean | undefined {
  if (/^Failed to download eval file/.test(line)) return false;
  if (/^Load eval file success: 0/.test(line)) return false;
  if (/^Load eval file success: 1/.test(line)) return true;
}

export function parseBestMoveLine(line: string): BestMoveInfo | undefined {
  if (!/^bestmove /.test(line)) return undefined;

  const result: BestMoveInfo = { bestmove: null };
  if (/^bestmove \(none\)/.test(line)) return result;

  const bestMove = parseStringWithRegex(/^bestmove (\w+)/, line);

  if (bestMove != undefined) result.bestmove = bestMove;

  const ponder = parseStringWithRegex(/ ponder (\w+)/, line);
  if (ponder) result.ponder = ponder;

  return result;
}

export interface Score {
  key: 'cp' | 'mate',
  value: number,
}

export interface StockfishInfo {
  depth?: number;
  seldepth?: number;
  multipv?: number;
  score?: Score;
  nodes?: number;
  nps?: number;
  hashfull?: number;
  time?: number;
  pv?: string;
  currmove?: string;
  currmovenumber?: number;
  string?: string;
}

// Parse a stockfish message that starts with `info`.
// If `fen` is defined and a score is parsed, this function will make the score value
// objective (positive if white is better, negative if black is better).
export function parseInfoLine(
  line: string,

  // By default, stockfish gives score values from the perspective of the color to move,
  // so if the color to move is worse, the score value will be negative. If you want the
  // score value to always be negative when black is worse, set this parameter to the fen
  // string of the position being analyzed and this function will make sure that the sign
  // of the score value is objective (positive if white is better, negative if black
  // is better).
  fen?: string,
): StockfishInfo | undefined {
  if (!/^info /.test(line)) return undefined;

  const info: StockfishInfo = {};
  info.depth = parseIntWithRegex(/ depth (\d+)/, line);
  info.seldepth = parseIntWithRegex(/ seldepth (\d+)/, line);
  info.multipv = parseIntWithRegex(/ multipv (\d+)/, line);
  info.score = parseKeyValueIntWithRegex(/ score (\w+) (-?\d+)/, line) as Score;
  info.nodes = parseIntWithRegex(/ nodes (\d+)/, line);
  info.nps = parseIntWithRegex(/ nps (\d+)/, line);
  info.hashfull = parseIntWithRegex(/ hashfull (\d+)/, line);
  info.time = parseIntWithRegex(/ time (\d+)/, line);
  info.pv = parseStringWithRegex(/ pv ([\w\s]+)/, line);
  info.currmove = parseStringWithRegex(/ currmove (\w+)/, line);
  info.currmovenumber = parseIntWithRegex(/ currmovenumber (\d+)/, line);
  info.string = parseStringWithRegex(/ string (.+)$/, line);

  // Delete any keys in `info` that have undefined values.
  (Object.keys(info) as (keyof StockfishInfo)[]).forEach(
    (key) => info[key] === undefined && delete info[key]);

  if (Object.keys(info).length < 1) return undefined;

  // If we have a fen and a score, use the fen to determine if it is black to move.
  // If it is black to move, flip the sign of the score value.
  if (fen && info.score) {
    if (getNextToPlay(fen) === PieceColor.BLACK) info.score.value *= -1;
  }

  return info;
}

export function parseName(line: string): string | undefined {
  if (!/^id name /.test(line)) return undefined;
  return parseStringWithRegex(/ name (.+)$/, line);
}

// This function will try to parse the first regex group as an integer.
function parseIntWithRegex(regex: RegExp, str: string): number | undefined {
  const match = str.match(regex);
  if (match == null) return undefined;
  return parseInt(match[1]);
}

// This function expects to find at least one group in the regex match.
function parseStringWithRegex(regex: RegExp, str: string): string | undefined {
  const match = str.match(regex);
  if (match == null) return undefined;
  return match[1];
}

// This function expects to find at least two groups in the regex match.
// It will try to parse the second group as an integer.
function parseKeyValueIntWithRegex(
  regex: RegExp,
  str: string
): { key: string, value: number } | undefined {
  const match = str.match(regex);
  if (match == null) return undefined;
  return {
    key: match[1],
    value: parseInt(match[2]),
  };
}

export interface MultiPV {
  depth: number;
  multipv: number;
  score: Score;
  lanLine: string[];
}

export type Lines = Record<string, MultiPV[]>;

// Convert an evaluation score to a pretty string
export function makeScoreString(score: Score): string {
  if (score.key === 'cp') {
    let v = score.value / 100;
    v = Math.round(v * 10) / 10;
    let result = '';
    if (v > 0) result += '+';
    return result + v.toFixed(1);
  }
  if (score.key === 'mate') {
    if (score.value > 0) {
      return `#+${score.value}`;
    }
    return `#${score.value}`;
  }
  throw new Error(`Unexpected key ${score.key}`);
}

export function getScoreFromEvaluation(e: Evaluation): Score {
  let result: Partial<Score> = {};

  if (e.cp != undefined) {
    result.key = 'cp';
    result.value = e.cp;
  } else if (e.mate != undefined) {
    result.key = 'mate';
    result.value = e.mate;
  }

  return result as Score;
}
