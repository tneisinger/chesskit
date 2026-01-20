import { parse as parsePGN, ParsedPGN } from 'pgn-parser';
import hash from 'string-hash';
import { getUserColor, getHeader } from '@/utils/lichess';
import { GameData, PieceColor, ChessWebsite } from '@/types/chess';
import {
  getStartTime,
  getGameResult,
  getTimeControl,
  getPlayerElo,
  getPlayerName,
} from '@/utils/pgn';
import { Options, DEFAULT_MAX_GAMES } from './common'

const defaultOptions: Options = {
  maxGames: DEFAULT_MAX_GAMES,
}

const urlBase = 'https://lichess.org';

/**
 * Get a user's recent lichess games
 * @param username The user whose games you want to get
 * @param maxGames The max number of games to get. (N most recent games)
 */
export async function fetchLichessGames(
  username: string,
  savedGames: GameData[],
  options = defaultOptions,
): Promise<GameData[]> {
  // Build the url to fetch from:
  const url = `${urlBase}/api/games/user/${username}?max=50`;

  // Make the request
  const response = await fetch(url);
  if (!response.ok) return Promise.reject(response);

  // Read, decode, and parse the pgn data
  const pgns: ParsedPGN[] = [];
  const pgnStrings: string[] = [];
  if (response.body != undefined) {
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let isReaderDone = false;
    while (!isReaderDone) {
      const { value, done } = await reader.read();
      if (value != undefined) {
        const rawPgnStrings = value.split(/\[Event ".+"\]/);
        rawPgnStrings.forEach((pgnString) => {
          try {
            const parseResult = parsePGN(pgnString);
            if (parseResult.length > 1) throw new Error('More than one pgn');
            const pgn = parseResult[0];
            if (pgn != undefined) {
              const variantHeader = getHeader(pgn, 'Variant');
              if (variantHeader && variantHeader.value === 'Standard') {
                pgns.push(pgn);
                pgnStrings.push(pgnString);
              }
            }
          } catch (reason) {
            console.log('The following pgn was not parsed:');
            console.log(pgnString);
            console.log(reason);
          }
        })
      }
      isReaderDone = done;
    }
  }

  const games: GameData[] = [];

  // Create the games from the pgns.
  for (let i = 0; i < pgns.length; i++) {
    const pgn = pgns[i];
    const pgnString = pgnStrings[i];

    const userColor = getUserColor(pgn, username);
    if (userColor == null) {
      throw new Error(`Failed to get userColor for ${username}`);
    }

    const siteHeader = getHeader(pgn, 'Site');

    const startTime = getStartTime(pgn);
    if (startTime == undefined) {
      throw new Error('Failed to get startTime from pgn')
    }

    const partialGameData: Omit<GameData, "gameId"> = {
      pgn: pgnString,
      startTime,
      result: getGameResult(pgnString),
      userColor,
      url: siteHeader ? siteHeader.value : undefined,
      timeControl: getTimeControl(pgn),
      whiteName: getPlayerName(pgn, PieceColor.WHITE),
      whiteElo: getPlayerElo(pgn, PieceColor.WHITE),
      blackName: getPlayerName(pgn, PieceColor.BLACK),
      blackElo: getPlayerElo(pgn, PieceColor.BLACK),
      website: ChessWebsite.Lichess,
    };

    const gameId = hash(JSON.stringify(partialGameData)).toString();
    const newGame: GameData = { gameId, ...partialGameData };
    games.push(newGame);
  }

  // Get the array of gameIds for all the games that we already have saved
  const gameIds: string[] = savedGames.map((g) => g.gameId);

  // Filter out any games that we already have.
  const newGames = games.filter((g) => !gameIds.includes(g.gameId));

  return newGames.slice(0, options.maxGames);
}
