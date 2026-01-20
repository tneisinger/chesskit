import { parse as parsePGN } from 'pgn-parser';
import hash from 'string-hash';
import { GameData, PieceColor } from '@/types/chess';
import type { ChesscomGame } from '@/types/chesscom';
import {
  getStartTime,
  getGameResult,
  getTimeControl,
  getPlayerElo,
  getPlayerName,
} from '@/utils/pgn'
import { DEFAULT_MAX_GAMES, Options } from './common';
import { FEN } from 'cm-chess/src/Chess';

export function getUserColor(game: ChesscomGame, username: string): PieceColor | null {
  if (game.white.username === username) return PieceColor.WHITE;
  if (game.black.username === username) return PieceColor.BLACK;
  return null;
}

/**
 * Get a user's recent chess.com games
 */
export async function fetchChesscomGames(
  username: string,
  savedGames: GameData[],
  options?: Options,
): Promise<GameData[]> {
  let games: ChesscomGame[] = [];

  let archiveURLs: string[] | undefined = undefined;
  try {
    archiveURLs = await fetchChesscomMonthlyArchiveURLs(username);
  } catch (e) {
    return Promise.reject(e);
  }

  if (archiveURLs == undefined) throw new Error('archiveURLs should not be undefined');

  // Get the array of gameIds for all the games that we already have saved
  const gameIds: string[] = savedGames.map((g) => g.gameId);

  while (archiveURLs.length > 0 && shouldFetchMoreGames(games.length, options)) {
    const url = archiveURLs.pop();
    if (!url) break;

    const response = await fetch(url);
    if (!response.ok) return Promise.reject(response);

    const json = await response.json();

    // Filter out any games that we already have stored in zustand.
    const newGames = (json.games as ChesscomGame[]).filter((g) =>
      !gameIds.includes(getGameId(g, username)));

    games = [...games, ...newGames];
  }

  // Filter out any games that are not standard chess games.
  games = games.reduce((acc: ChesscomGame[], game) => {
    if (game.initial_setup !== FEN.start) return acc
    if (game.rules !== 'chess') return acc;
    return [...acc, game];
  }, []);

  // Sort the games by start_time or end_time, from newest to oldest
  games.sort((g1, g2) => {
    const t1 = g1.start_time ? g1.start_time : g1.end_time;
    const t2 = g2.start_time ? g2.start_time : g2.end_time;
    if (t1 && t2) return t2 - t1;
    return 0;
  });

  if (options && options.maxGames) games = games.slice(0, options.maxGames);

  // Convert ChesscomGame[] to GameData[] and return it.
  return games.map((game) => chesscomGameToGameData(game, username));
}

// Predicate to determine if more games should be fetched from chess.com
function shouldFetchMoreGames(numGames: number, options?: Options): boolean {
  if (options && options.maxGames) return numGames < options.maxGames;
  return numGames < DEFAULT_MAX_GAMES;
}

export async function fetchChesscomMonthlyArchiveURLs(
  username: string,
): Promise<string[]> {
  const url = `https://api.chess.com/pub/player/${username}/games/archives`;
  const response = await fetch(url);
  if (!response.ok) return Promise.reject(response);
  const json = await response.json();
  return json.archives;
}

function chesscomGameToGameData(game: ChesscomGame, username: string): GameData {
  const pgnString = game.pgn;
  const parsedPgn = parsePGN(game.pgn)[0];
  const userColor = getUserColor(game, username);
  if (userColor == null) {
    throw new Error(`Failed to get userColor for ${username}`);
  }

  const startTime = getStartTime(parsedPgn);
  if (startTime == undefined) {
    throw new Error('Failed to get startTime from pgn')
  }

  const partialGameData: Omit<GameData, "gameId"> = {
    pgn: pgnString,
    startTime,
    result: getGameResult(pgnString),
    userColor,
    url: game.url,
    timeControl: getTimeControl(parsedPgn),
    whiteName: getPlayerName(parsedPgn, PieceColor.WHITE),
    whiteElo: getPlayerElo(parsedPgn, PieceColor.WHITE),
    blackName: getPlayerName(parsedPgn, PieceColor.BLACK),
    blackElo: getPlayerElo(parsedPgn, PieceColor.BLACK),
  }

  const gameId = hash(JSON.stringify(partialGameData)).toString();
  return { gameId, ...partialGameData };
}

function getGameId(game: ChesscomGame, username: string): string {
  const gameData = chesscomGameToGameData(game, username);
  return gameData.gameId;
}
