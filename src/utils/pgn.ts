import { parse as parsePGN, ParsedPGN } from 'pgn-parser';
import { GameResult, PieceColor } from '@/types/chess';
import { Chess as ChessJS } from 'chess.js';

export function getStartTime(pgn: ParsedPGN): number | undefined {
  if (pgn.headers == undefined) return undefined;

  const utcDateStr = pgn.headers.find((h) => h.name == 'UTCDate');
  if (utcDateStr == undefined) return undefined;

  const timeStr = pgn.headers.find((h) => h.name === 'UTCTime');
  if (timeStr == undefined) return undefined;

  const [year, month, day] = utcDateStr.value.split(/\D/);
  const dateString = `${year}-${month}-${day}T${timeStr.value}Z`;
  const timestamp = Date.parse(dateString);

  if (isNaN(timestamp)) return undefined;

  return timestamp;
}

export function getGameResult(pgnString: string): GameResult | undefined {
  if (/1\/2-1\/2$/.test(pgnString)) return GameResult.Draw;
  if (/1-0$/.test(pgnString)) return GameResult.WhiteWins;
  if (/0-1$/.test(pgnString)) return GameResult.BlackWins;
  const chessjs = new ChessJS();
  try {
    chessjs.loadPgn(pgnString);
  } catch (error) {
    console.log('failed to load pgn!');
    console.log(pgnString);
  }
  if (chessjs.isCheckmate()) {
    const turn = chessjs.turn();
    if (turn === 'w') return GameResult.BlackWins;
    if (turn === 'b') return GameResult.WhiteWins;
  }
  if (chessjs.isStalemate()) return GameResult.Draw;

  // If we couldn't get the game result from the moves, try to get it from the
  // pgn 'Result' header.
  const { Result } = chessjs.getHeaders();
  if (Result != undefined) {
    if (Result === GameResult.WhiteWins) return GameResult.WhiteWins;
    if (Result === GameResult.BlackWins) return GameResult.BlackWins;
    if (Result === GameResult.Draw) return GameResult.Draw;
    return Result as GameResult;
  }
  return undefined;
}

export function getTimeControl(pgn: ParsedPGN): string | undefined {
  if (pgn.headers == undefined) return undefined;

  const timeControl = pgn.headers.find((h) => h.name == 'TimeControl');
  if (timeControl == undefined) return undefined;
  return timeControl.value;
}

export function getPlayerElo(pgn: ParsedPGN, color: PieceColor): number | undefined {
  if (pgn.headers == undefined) return undefined;

  let keyName = 'WhiteElo';
  if (color === PieceColor.BLACK) keyName = 'BlackElo'

  const elo = pgn.headers.find((h) => h.name == keyName);
  if (elo == undefined) return undefined;

  const value = parseInt(elo.value);
  if (isNaN(value)) return undefined;

  return value;
}

export function getPlayerName(pgn: ParsedPGN, color: PieceColor): string | undefined {
  if (pgn.headers == undefined) return undefined;

  let keyName = 'White';
  if (color === PieceColor.BLACK) keyName = 'Black'

  const playerName = pgn.headers.find((h) => h.name == keyName);
  if (playerName == undefined) return undefined;

  return playerName.value;
}

export function getLinesFromPGN(pgnString: string): string[] {
  if (pgnString === '') return [];
  const parserOutput = parsePGN(pgnString);
  if (parserOutput.length !== 1) throw new Error('pgn must contain exactly one game');
  const pgn = parserOutput[0];
  if (pgn.moves == undefined || pgn.moves.length < 1) return [];
  const result = [];
  result.push(pgn.moves.map((m) => m.move).join(' '));

  const addSublines = (lineBeforeMove: string, pgnMove: ParsedPGN['moves'][0]) => {
    if (pgnMove.ravs == undefined) return;
    pgnMove.ravs.forEach((rav) => {
      const ravMoves = rav.moves.map((m) => m.move).join(' ');
      result.push(
        (lineBeforeMove + ' ' + ravMoves).trim()
      );
      rav.moves.forEach((m, i) => {
        const additionalMoves = rav.moves.slice(0, i).map((m) => m.move).join(' ');
        addSublines(lineBeforeMove + ` ${additionalMoves}`, m)
      });
    });
  }

  let lineBeforeMove = '';
  pgn.moves.forEach((m) => {
    addSublines(lineBeforeMove, m);
    lineBeforeMove += ` ${m.move}`;
  });

  return result;
}

export function makePgnParserErrorMsg(error: any): string {
  if (error.name !== 'SyntaxError') return 'Unknown error';

  if (error.found && error.location) {
    return (
      `Unexpected '${error.found}' found at line ${error.location.start.line}, \
       column ${error.location.start.column}`
    )
  }

  if (error.location && error.found === null) {
    return (
      `No character found at line ${error.location.start.line}, column \
      ${error.location.start.column}`
    )
  }

  return 'Unknown syntax error';
}
