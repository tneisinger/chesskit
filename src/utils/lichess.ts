import { PieceColor } from '../types/chess';
import { ParsedPGN, Header } from 'pgn-parser';

export function getUserColor(pgn: ParsedPGN, username: string): PieceColor | null {
  const whiteHeader = getHeader(pgn, 'White');
  const blackHeader = getHeader(pgn, 'Black');
  if (whiteHeader && username === whiteHeader.value) return PieceColor.WHITE;
  if (blackHeader && username === blackHeader.value) return PieceColor.BLACK;
  return null;
}

export function getHeader(pgn: ParsedPGN, headerName: string): Header | undefined {
  if (pgn.headers == undefined) return undefined;
  const header = pgn.headers.find(({ name }) => name === headerName);
  if (header == undefined) {
    throw new Error(`No ${headerName} header found in Lichess pgn`);
  }
  return header;
}
