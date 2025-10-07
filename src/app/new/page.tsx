'use client';

import Chessboard from '@/components/Chessboard';
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

  const orientation = PieceColor.WHITE;

  return (
    <div>
      <Chessboard
        orientation={orientation}
        currentMove={currentMove}
        playMove={playMove}
      />
      <div className="p-2">
        <ArrowButtons
          history={history}
          currentMove={currentMove}
          changeCurrentMove={setCurrentMove}
        />
      </div>
      <MovesDisplay
        history={history}
        currentMove={currentMove}
        changeCurrentMove={setCurrentMove}
      />
    </div>
  );
}
