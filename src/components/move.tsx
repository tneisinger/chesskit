import React, { useRef, useEffect } from 'react';
import { Move as MoveType } from 'cm-chess/src/Chess';
import { areMovesEqual } from '../utils/cmchess';

export interface Props {
  move?: MoveType;
  color: 'w' | 'b';
  currentMove?: MoveType;
  isLast?: boolean;
  inVariation?: boolean;
  isKeyMove?: boolean;
  changeCurrentMove: (newCurrentMove?: MoveType) => void;
}

const Move = ({
  move,
  color,
  currentMove,
  isLast,
  inVariation,
  isKeyMove,
  changeCurrentMove,
}: Props) => {

  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current && move && currentMove && areMovesEqual(move, currentMove)) {
      containerRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentMove, move]);

  let content = '...';
  if (move) {
    content = move.san;
  } else if (isLast && color === 'b') {
    content = '';
  }

  const contentClasses = ['py-0.5 px-1.5 rounded'];

  if (move) {
    contentClasses.push('cursor-pointer');
    if (currentMove && areMovesEqual(move, currentMove)) {
      contentClasses.push('bg-[#3692e7]');
    }
  }

  if (isKeyMove) contentClasses.push('border border-red-600');

  const containerClasses = ['flex-[0_0_38%] dark:text-gray-400'];
  if (inVariation) {
    contentClasses.push('p-0');
    containerClasses.push('inline-block pr-2 last:p-0');
  }

  return (
    <span ref={containerRef} className={containerClasses.join(' ')}>
      <span
        className={contentClasses.join(' ')}
        onClick={() => {
          if (move) changeCurrentMove(move);
        }}
      >
        {content}
      </span>
    </span>
  );
};

export default Move;
