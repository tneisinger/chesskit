import React, { useRef, useEffect } from 'react';
import { Move as CmMove } from 'cm-chess/src/Chess';
import { areMovesEqual } from '../utils/cmchess';

export interface Props {
  move?: CmMove;
  color: 'w' | 'b';
  currentMove?: CmMove;
  isLast?: boolean;
  inVariation?: boolean;
  isKeyMove?: boolean;
  changeCurrentMove: (newCurrentMove?: CmMove) => void;
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

  // const contentClasses = [styles.moveContent];

  // if (color === 'w') {
  //   contentClasses.push(styles.whiteMove)
  // } else {
  //   contentClasses.push(styles.blackMove);
  // }

  // if (move) {
  //   contentClasses.push(styles.clickable);
  //   if (currentMove && areMovesEqual(move, currentMove)) {
  //     contentClasses.push(styles.isCurrentMove);
  //   }
  // }

  // if (isKeyMove) contentClasses.push(styles.keyMove);

  // const containerClasses = [styles.moveContainer, styles.whiteMove];
  // if (inVariation) {
  //   contentClasses.push(styles.inVariation);
  //   containerClasses.push(styles.inVariation);
  // }

  // return (
  //   <span ref={containerRef} className={containerClasses.join(' ')}>
  //     <span
  //       className={contentClasses.join(' ')}
  //       onClick={() => {
  //         if (move) changeCurrentMove(move);
  //       }}
  //     >
  //       {content}
  //     </span>
  //   </span>
  // );

  return (
    <span ref={containerRef}>
      <span
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
