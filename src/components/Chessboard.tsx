'use client';

import { useState, useEffect } from 'react';
import CmChessboard, {Props as CmChessboardProps} from '@/components/cmChessboard';
import { BORDER_TYPE } from 'cm-chessboard/src/Chessboard';

type Props = Omit<CmChessboardProps,
  | 'showCoordinates'
  | 'borderType'
  | 'cssClass'
  | 'setPiecesAfterOrientationIsSet'
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
      showCoordinates={true}
      borderType={BORDER_TYPE.none}
      cssClass='green'
      moveSound={moveSound}
      takeSound={takeSound}
    />
  );
}
export default Chessboard;
