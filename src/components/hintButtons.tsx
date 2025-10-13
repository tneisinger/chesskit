import React, { useState, useEffect } from 'react';
import { Move } from 'cm-chess/src/Chess';
import { getFen } from '../utils/chess';

export interface Props {
  currentMove: Move | undefined;
  giveHint: () => void;
  showMove: () => void;
  disabled?: boolean;
}

const HintButtons = ({
  currentMove,
  giveHint,
  showMove,
  disabled = false,
}: Props) => {
  const [hintedPosition, setHintedPosition] = useState<string | null>(null);
  const [isShowingMove, setIsShowingMove] = useState(false);

  useEffect(() => {
    setHintedPosition(null);
    setIsShowingMove(false);
  }, [currentMove])

  const handleHintBtnClick = () => {
    setHintedPosition(getFen(currentMove));
    giveHint();
  }

  const handleShowMoveBtnClick = () => {
    setIsShowingMove(true);
    showMove();
  }

  const renderButton = () => {
    if (hintedPosition === getFen(currentMove)) {
      return (
        <button
          onClick={handleShowMoveBtnClick}
          disabled={disabled != undefined ? disabled : isShowingMove}
        >Show Move</button>
      );
    } else {
      return (
        <button
          className='cursor-pointer'
          onClick={handleHintBtnClick}
          disabled={disabled}
        >
          Hint
        </button>
      );
    }
  }

  return renderButton();
}

export default HintButtons;
