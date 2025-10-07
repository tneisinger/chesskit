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

  return (
    <span>{n}.</span>
  );
};

export default MoveNum;
