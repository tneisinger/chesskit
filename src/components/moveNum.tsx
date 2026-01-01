import React from 'react';
import { Move } from 'cm-chess/src/Chess';

export interface Props {
  whiteMove?: Move;
  blackMove?: Move;
  inVariation?: boolean;
}

const MoveNum = ({ whiteMove, blackMove, inVariation }: Props) => {

  const move: Move | undefined = (whiteMove == undefined) ? blackMove : whiteMove;

  if (move == undefined) throw new Error('both moves undefined');

  const n = move.ply - Math.floor(move.ply / 2);

  const classes = ['flex-[0_0_24%] text-gray-200'];

  if (inVariation) classes.push('pr-2 inline-block first:pl-0');

  return (
    <span className={classes.join(' ')}>{n}.</span>
  );
};

export default MoveNum;
