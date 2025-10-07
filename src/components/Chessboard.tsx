'use client';

import { useState, useEffect } from 'react';
import CmChessboard, {Props as CmChessboardProps} from '@/components/cmChessboard';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import { PieceColor } from '@/types/chess';
import { BORDER_TYPE, MARKER_TYPE } from 'cm-chessboard/src/Chessboard';

type Props = Omit<CmChessboardProps,
  | 'showCoordinates'
  | 'borderType'
  | 'cssClass'
  | 'moveFromMarker'
  | 'moveToMarker'
  | 'setPiecesAfterOrientationIsSet'
  | 'boardSize'
>
const Chessboard = (props: Props) => {
  const [moveSound, setMoveSound] = useState<HTMLAudioElement | undefined>(undefined);
  const [takeSound, setTakeSound] = useState<HTMLAudioElement | undefined>(undefined);

  useEffect(() => {
    setMoveSound(new Audio('/assets/sound/move.mp3'));
    setTakeSound(new Audio('/assets/sound/capture.mp3'));
  }, [])

  return (
    <CmChessboard
      {...props}
      boardSize={600}
      showCoordinates={false}
      borderType={BORDER_TYPE.none}
      cssClass='green'
      moveSound={moveSound}
      takeSound={takeSound}
    />
  );
}
export default Chessboard;
