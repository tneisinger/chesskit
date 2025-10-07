/**
 * This hook is designed to be used with the Chessboard component. Call this hook inside
 * the parent component in which you want to render the Chessboard component.
 */

import { useState, useRef, useEffect } from 'react';
import { Chess as CmChess, Move } from 'cm-chess/src/Chess';
import { ShortMove } from '../types/chess';
import { areMovesEqual } from '../utils/chess';
import {
  deleteMoveFromCmChess,
  getLastMoveOfLine,
  getLanLineFromCmMove,
} from '../utils/cmchess';

interface Options {
  // Because of how cmChess is implemented, there is no way for a cmChess history to
  // have a variation on the first move of the game. Because of that, this hook gives you
  // two choices:
  //
  // 1. If allowAltFirstMove === true, you will be able to play alternative first moves,
  // but the cmChess history will be completely erased every time you play an alternate
  // first move.
  //
  // 2. If allowAltFirstMove === false, you will not able to play alternative first moves.
  allowAltFirstMove?: boolean;

  // If this is set to true, do not allow variation creation. If a move is played that
  // would create a variation, overwrite the main line instead so that there is always
  // only one line of chess moves.
  alwaysOverwriteMainLine?: boolean;
}

const defaultOptions: Options = {
  allowAltFirstMove: false,
  alwaysOverwriteMainLine: false,
}

export default function useChessboardEngine(options = defaultOptions) {
  const [currentMove, setCurrentMove] = useState<Move | undefined>(undefined);

  const currentMoveRef = useRef(currentMove);

  useEffect(() => {
    currentMoveRef.current = currentMove;
  }, [currentMove])

  const [history, setHistory] = useState<Move[]>([]);

  const cmchess = useRef(new CmChess());

  const isAltFirstMove = (newMove: ShortMove): boolean => (
    currentMoveRef.current == undefined &&
    history.length > 0 &&
    !areMovesEqual(newMove, history[0])
  );

  const playMove = (newMove: ShortMove) => {
    if (options.allowAltFirstMove && isAltFirstMove(newMove)) {
      cmchess.current = new CmChess();
      const newCurrentMove = cmchess.current.move(newMove);
      if (!newCurrentMove) throw new Error('invalid move');
      setHistory(cmchess.current.history());
      setCurrentMove(newCurrentMove);
    }
    updateHistoryAndCurrentMove(newMove);
  }

  const reset = () => {
    cmchess.current = new CmChess();
    setHistory([...cmchess.current.history()]);
    setCurrentMove(undefined);
  }

  const undoLastMove = () => {
    if (currentMoveRef.current == undefined) return;
    cmchess.current.undo();
    setHistory([...cmchess.current.history()]);
    setCurrentMove(currentMoveRef.current.previous);
  }

  // Delete a move from cmchess and history. All subsequent moves and
  // variations will also be deleted. If changeCurrentMove is set to true,
  // change the currentMove to the move before the one that was deleted.
  const deleteMove = (move: Move, changeCurrentMove = false) => {
    cmchess.current = deleteMoveFromCmChess(cmchess.current, move);
    const history = cmchess.current.history();
    setHistory(history);
    if (changeCurrentMove) {
      const lanLine = getLanLineFromCmMove(move.previous);
      setCurrentMove(getLastMoveOfLine(lanLine, history));
    }
  }

  const updateHistoryAndCurrentMove = (newMove: ShortMove) => {
    const history = cmchess.current.history();

    // If no piece has moved yet, currentMove will be undefined. If the user plays the
    // first move in the history, set the first move in history as the current move.
    if (currentMoveRef.current == undefined && history.length > 0) {
      if (areMovesEqual(newMove, history[0])) {
        setCurrentMove(history[0]);
        return;
      }
    }

    // If we have a next move in our cmchess history, we need to check if this newly
    // played move is already in our history (either as the next move, or as a variation
    // of the next move.) If the newMove is in our history, then we don't want to add it.
    if (currentMoveRef.current && currentMoveRef.current.next) {
      // If the new move is equal to the next move, just setCurrentMove to the next move
      // in our history.
      if (areMovesEqual(newMove, currentMoveRef.current.next)) {
        setCurrentMove(currentMoveRef.current.next);
        return;
      }

      // If the new move is equal to one of the variations of the next move, just
      // setCurrentMove to that variation move.
      const varMoves = currentMoveRef.current.next.variations.map((variation) => variation[0]);
      const matches = varMoves.filter((firstMove) => areMovesEqual(firstMove, newMove));
      if (matches.length > 1) throw new Error('multiple first moves are equal');
      if (matches.length === 1) {
        setCurrentMove(matches[0]);
        return;
      }
    }

    // Otherwise, attempt to play the newMove. If CmChess successfully plays the move, add
    // the newMove to our history and update the currentMove.
    const move = cmchess.current.move(newMove, currentMoveRef.current);
    if (!move) throw new Error(`Invalid move ${newMove}`);

    // If the alwaysOverwriteMainLine option is set to true and this new move would create
    // a variation, do not create the new variation. Instead, reset cmchess and enter only
    // the new line moves into it.
    if (options.alwaysOverwriteMainLine && move.variation[0].ply !== 1) {
      cmchess.current = new CmChess();
      let newLine = move.variation;
      if (newLine[0].ply > 1 && move.previous) {
        newLine = [...move.previous.variation.slice(0, move.ply - 1), ...newLine];
      }
      newLine.forEach((m) => cmchess.current.move(m.san));
      const newHistory = cmchess.current.history();
      setHistory([...newHistory]);
      setCurrentMove(newHistory[newHistory.length - 1]);
    } else {
      setHistory([...cmchess.current.history()]);
      setCurrentMove(move);
    }

  }

  return {
    cmchess,
    history,
    setHistory,
    currentMove,
    setCurrentMove,
    playMove,
    reset,
    undoLastMove,
    deleteMove,
  };
}
