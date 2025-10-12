'use client';

import React, { useState } from 'react';
import Chessboard from '@/components/Chessboard';
import { Arrow, Marker } from '@/components/cmChessboard';
import { ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows';
import { MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers';
import ArrowButtons from '@/components/arrowButtons';
import MovesDisplay from '@/components/movesDisplay';
import EvalerDisplay from '@/components/evalerDisplay';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import useChessEvaler from '@/hooks/useChessEvaler';
import { PieceColor } from '@/types/chess';

export default function Home() {
  const {
    history,
    currentMove,
    setCurrentMove,
    playMove,
  } = useChessboardEngine();

  const [isEvaluatorOn, setIsEvaluatorOn] = useState(false);

  const {
    gameEvals,
    engineName,
    lines,
    evalDepth,
    fenBeingEvaluated,
    numLines,
  } = useChessEvaler(isEvaluatorOn, currentMove);

  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);

  const handleAddArrows = () => {
    setArrows([{from: 'g2', to: 'g4', type: ARROW_TYPE.info}]);
  };

  const handleAddMarkers = () => {
    setMarkers([{square: 'g4', type: MARKER_TYPE.dot}]);
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
        markers={markers}
        setMarkers={setMarkers}
      />
      <div className="p-2">
        <ArrowButtons
          history={history}
          currentMove={currentMove}
          changeCurrentMove={setCurrentMove}
        />
      </div>
      <div style={{ width: '250px', display: 'flex', flexDirection: 'column' }}>
        <EvalerDisplay
          isEngineOn={isEvaluatorOn}
          setIsEngineOn={setIsEvaluatorOn}
          gameEvals={gameEvals}
          currentMove={currentMove}
          evalerMaxDepth={evalDepth}
          engineName={engineName}
          engineLines={lines}
          isEvaluating={fenBeingEvaluated !== null}
          maxLineLength={3}
          numLines={numLines}
        />
        <MovesDisplay
          history={history}
          currentMove={currentMove}
          changeCurrentMove={setCurrentMove}
        />
      </div>
      <button onClick={handleAddArrows}>Add arrows</button>
      <button onClick={handleAddMarkers}>Add markers</button>
      <div className="w-80">
      </div>
    </div>
  );
}
