import { useCallback } from 'react';
import Button, { ButtonSize, ButtonStyle } from './button';
import { Move } from 'cm-chess/src/Chess';

interface Props {
  onDiscardChangesBtnClick: () => void;
  onSaveChangesBtnClick: () => void;
  onDeleteFlashcardBtnClick: () => void;
  doUnsavedChangesExist: boolean;
}

const FlashcardEditButtons = ({
  onDiscardChangesBtnClick,
  onSaveChangesBtnClick,
  onDeleteFlashcardBtnClick,
  doUnsavedChangesExist,
}: Props) => {
  return (
    <div className="flex flex-row flex-wrap justify-center items-center bg-background-page rounded-md w-full p-3 gap-3">
      <span>
        <Button
          onClick={onSaveChangesBtnClick}
          disabled={!doUnsavedChangesExist}
          buttonSize={ButtonSize.Small}
          buttonStyle={ButtonStyle.Primary}
        >
          Save
        </Button>
      </span>
      <span>
        <Button
          onClick={onDiscardChangesBtnClick}
          disabled={!doUnsavedChangesExist}
          buttonSize={ButtonSize.Small}
        >
          Discard Changes
        </Button>
      </span>
      <span>
        <Button
          onClick={onDeleteFlashcardBtnClick}
          buttonSize={ButtonSize.Small}
          buttonStyle={ButtonStyle.Danger}
        >
          Delete Flashcard
        </Button>
      </span>
    </div>
  );
}

export default FlashcardEditButtons;
