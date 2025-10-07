import * as Chess from 'chess.js';

// This fixes a TyperError bug:
// https://stackoverflow.com/questions/58598457/not-a-constructor-error-with-library-and-angular
const ChessJS = typeof Chess === "function" ? Chess : Chess.Chess;

export default ChessJS;
