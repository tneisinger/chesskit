import React, { useEffect, useRef } from 'react';
import { Move } from 'cm-chess/src/Chess';
import { makeMoveHistoryHtml } from '../utils/movesDisplay';
// import type { GamePuzzle } from '../types/puzzle';

interface Props {
  history: Move[];
  currentMove: Move | undefined;
  changeCurrentMove: (newCurrentMove?: Move) => void;

  // If defined, these moves will be visually highlighted in some way
  keyMoves?: Move[];

  // gamePuzzles?: GamePuzzle[];
  useMobileLayout?: boolean,
  showVariations?: boolean,
}

const MovesDisplay = ({
  history,
  currentMove,
  changeCurrentMove,
  keyMoves,
  // gamePuzzles,
  useMobileLayout = false,
  showVariations = true,
}: Props) => {

  const topOfDisplay = useRef<HTMLDivElement>(null);

  // If the new currentMove is undefined, that means that the user is viewing the very
  // beginning of the game. In that case, scroll to the top of the MovesDisplay.
  useEffect(() => {
    if (currentMove == undefined && topOfDisplay.current) {
      topOfDisplay.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMove]);

  const classes = ['flex flex-col overflow-y-scroll no-scrollbar w-full flex-1 min-h-0 px-3'];
  if (useMobileLayout) classes.push('flex-row flex-wrap content-start');

  return (
    <div className={classes.join(' ')}>
      <div ref={topOfDisplay} />
      {makeMoveHistoryHtml({
        moves: history,
        currentMove,
        changeCurrentMove,
        keyMoves,
        // gamePuzzles,
        useMobileLayout,
        showVariations,
      })}
    </div>
  );
};

export default MovesDisplay;
