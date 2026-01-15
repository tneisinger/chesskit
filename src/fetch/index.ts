import { fetchLichessGames } from './lichess';
import { fetchChesscomGames } from './chesscom';
import { Options } from './common';
import { ChessWebsite } from '@/types/chess';
import { assertUnreachable } from '@/utils/index';
import type { GameData } from '@/types/chess';

export async function fetchGames(
  username: string,
  site: ChessWebsite,
  savedGames: GameData[],
  options?: Options,
): Promise<GameData[]> {
  let games: GameData[] = [];

  // Fetch the games from the specified website.
  switch (site) {
    case ChessWebsite.Chesscom:
      games = await fetchChesscomGames(username, savedGames, options)
      break;
    case ChessWebsite.Lichess:
      games = await fetchLichessGames(username, savedGames, options)
      break;
    default:
      return assertUnreachable(site);
  }

  // If options.newGamesOnly, filter out any games that aren't newer than the newest game
  // in savedGames. Return the remainder.
  if (options && options.newGamesOnly) {
    let newestGameTimestamp = 0;
    Object.values(savedGames).forEach((g) => {
      if (g.startTime > newestGameTimestamp) newestGameTimestamp = g.startTime
    })
    return games.filter((g) => g.startTime > newestGameTimestamp);
  }

  return games;
}
