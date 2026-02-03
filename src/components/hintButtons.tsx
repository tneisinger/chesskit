import { useState, useEffect, useCallback, useRef } from 'react';
import { Move } from 'cm-chess/src/Chess';
import { getFen } from '../utils/chess';
import Button, { ButtonSize } from '@/components/button';

export interface Props {
  currentMove: Move | undefined;
  giveHint: () => void;
  showMove: () => void;
  disabled?: boolean;
  hintButtonText?: string;
  showButtonText?: string;
}

const HintButtons = ({
  currentMove,
  giveHint,
  showMove,
  disabled = false,
  hintButtonText = 'Hint',
  showButtonText = 'Show',
}: Props) => {
  const timeoutRef = useRef<number>(0);

  const [hintedPosition, setHintedPosition] = useState<string | null>(null);
  const [isShowingMove, setIsShowingMove] = useState(false);
  const [disableButtons, setDisableButtons] = useState(disabled);

  const showDebugButtons = false;

  const debug = () => {
    console.log('debug');
  };

  // Add a small delay before disabling buttons to prevent flickering
  useEffect(() => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setDisableButtons(disabled);
      timeoutRef.current = 0;
    }, 200);
    return () => window.clearTimeout(timeoutRef.current);
  }, [disabled]);

  const shouldDisableShowBtn = useCallback((): boolean => {
    if (disabled === true) return true;
    if (isShowingMove) return true;
    return disabled != undefined ? disabled : isShowingMove;
  }, [disabled, isShowingMove]);

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

  return (
    <>
      {(hintedPosition === getFen(currentMove)) ? (
        <Button
          buttonSize={ButtonSize.Small}
          onClick={handleShowMoveBtnClick}
          disabled={shouldDisableShowBtn()}
        >
          {showButtonText}
        </Button>
      ) : (
        <Button
          buttonSize={ButtonSize.Small}
          onClick={handleHintBtnClick}
          disabled={disableButtons}
        >
          {hintButtonText}
        </Button>
      )}
      {showDebugButtons && (
        <>
          <button onClick={debug}>debug!</button>
        </>
      )}
    </>
  );
}

export default HintButtons;
