import React from 'react';
import { Move } from 'cm-chess/src/Chess';
// import type { GamePuzzle } from '../types/puzzle';
// import { getFirstIncompleteGamePuzzle } from '../utils/puzzle';
import { isMoveInMainLine } from '../utils/chess';
import ArrowButton from './arrowButton';
import { Svg } from './svgIcon';

interface Props {
  history: Move[];
  currentMove: Move | undefined;
  changeCurrentMove: (newCurrentMove?: Move) => void;
  // gamePuzzles?: GamePuzzle[];
  excludeStartAndEndBtns?: boolean;
}

const ArrowButtons = ({
  history,
  currentMove,
  changeCurrentMove,
  // gamePuzzles = [],
  excludeStartAndEndBtns = false,
}: Props) => {
  // const firstIncompletePuzzle = getFirstIncompleteGamePuzzle(gamePuzzles);

  // if (firstIncompletePuzzle) {
  //   history = history.slice(0, firstIncompletePuzzle.puzzle.moveIdx);
  // }

  const doesNextMoveExist = (): boolean => {
    if (history.length > 0 && currentMove == undefined) return true;
    if (currentMove) {
      if (isMoveInMainLine(currentMove, history)) {
        const nextMoveIdx = currentMove.ply;
        return Boolean(currentMove.next && history.length > nextMoveIdx);
      } else {
        return Boolean(currentMove.next);
      }
    }
    return false;
  }

  const canGoToLastMove = (): boolean => {
    if (history.length < 1) return false;
    const lastMove = history[history.length - 1];
    const inMainLine = isMoveInMainLine(currentMove, history);
    if (currentMove && currentMove.ply > lastMove.ply && inMainLine) return false;
    return Boolean(history.length > 0 && lastMove !== currentMove);
  }

  const goToPrev = () => {
    if (currentMove) {
      if (currentMove.previous) {
        changeCurrentMove(currentMove.previous);
      } else {
        changeCurrentMove(undefined);
      }
    }
  }

  const goToNext = () => {
    if (currentMove == undefined && history.length > 0) changeCurrentMove(history[0]);
    if (currentMove && currentMove.next) changeCurrentMove(currentMove.next);
  }

  const goToLast = () => {
    if (history.length > 0) changeCurrentMove(history[history.length - 1]);
  }

  return (
    <div className="m-1 mb-0 [&>button]:mr-2 [&>button:last-child]:mr-0">
      {!excludeStartAndEndBtns && (
        <ArrowButton
          arrow={Svg.ArrowBeginning}
          onClick={() => changeCurrentMove(undefined)}
          disabled={currentMove == undefined}
        />
      )}
      <ArrowButton
        arrow={Svg.ArrowLeft}
        onClick={goToPrev}
        disabled={currentMove == undefined}
      />
      <ArrowButton
        arrow={Svg.ArrowRight}
        onClick={goToNext}
        disabled={!doesNextMoveExist()}
      />
      {!excludeStartAndEndBtns && (
        <ArrowButton
          arrow={Svg.ArrowEnding}
          onClick={goToLast}
          disabled={!canGoToLastMove()}
        />
      )}
    </div>
  );
};

export default ArrowButtons;
