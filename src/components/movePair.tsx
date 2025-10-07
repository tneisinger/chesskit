import React from 'react';
import { Move as MoveData } from 'cm-chess/src/Chess';
import MoveNum from '@/components/moveNum';
import Move from '@/components/move';
import { areMovesEqual } from '@/utils/cmchess';

export interface Props {
  whiteMove?: MoveData;
  blackMove?: MoveData;
  currentMove?: MoveData;
  isLast?: boolean;
  inVariation?: boolean;
  keyMoves?: MoveData[];
  changeCurrentMove: (newCurrentMove?: MoveData) => void;
  useMobileLayout?: boolean;
}

const MovePair = (props: Props) => {

  if (props.blackMove == undefined && props.whiteMove == undefined) {
    throw new Error('whiteMove and blackMove were both undefined');
  }

  // Predicate to check if the given move is equal to one of the keyMoves. If there are no
  // key moves, return false.
  const isKeyMove = (move?: MoveData): boolean => {
    if (props.keyMoves && props.keyMoves.length > 0 && move)
      return props.keyMoves.some((km) => areMovesEqual(km, move));
    return false;
  }

  const innerHtml = (
    <React.Fragment>
      <MoveNum {...props} />
      <Move
        move={props.whiteMove}
        isKeyMove={isKeyMove(props.whiteMove)}
        color='w' {...props}
      />
      {(!props.isLast || props.blackMove) && (
        <Move
          move={props.blackMove}
          isKeyMove={isKeyMove(props.blackMove)}
          color='b' {...props}
        />
      )}
    </React.Fragment>
  );

  if (props.inVariation) return innerHtml;

  // const classes = [styles.mainLineMovePair];
  // if (props.useMobileLayout) classes.push(styles.mobileLayout);

  return (
    <div>
      {innerHtml}
    </div>
  );
  // return (
  //   <div className={classes.join(' ')}>
  //     {innerHtml}
  //   </div>
  // );
};

export default MovePair;
