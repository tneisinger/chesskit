'use client';

import React, { useState } from 'react';
import Chessboard from '@/components/Chessboard';
import { Arrow } from '@/components/cmChessboard';
import { ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows';
import ArrowButtons from '@/components/arrowButtons';
import MovesDisplay from '@/components/movesDisplay';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import { PieceColor } from '@/types/chess';

export default function Home() {
  const {
    history,
    currentMove,
    setCurrentMove,
    playMove,
  } = useChessboardEngine();

  const [arrows, setArrows] = useState<Arrow[]>([]);

  const handleButtonClick = () => {
    setArrows([{from: 'g2', to: 'g4', type: ARROW_TYPE.info}]);
  };

  const orientation = PieceColor.WHITE;

  return (
    <div>
      <Chessboard
        orientation={orientation}
        currentMove={currentMove}
        playMove={playMove}
        arrows={arrows}
        setArrows={setArrows}
      />
      <div className="p-2">
        <ArrowButtons
          history={history}
          currentMove={currentMove}
          changeCurrentMove={setCurrentMove}
        />
      </div>
      <button onClick={handleButtonClick}>Add arrows</button>
      <div className="w-80">
        <MovesDisplay
          history={history}
          currentMove={currentMove}
          changeCurrentMove={setCurrentMove}
        />
      </div>
    </div>
  );
}
