import Button, { ButtonSize, ButtonStyle } from './button';
import { Flashcard } from '@/db/schema';

interface Props {
  flashcard: Flashcard;
  onDiscardChangesBtnClick: () => void;
  onSaveChangesBtnClick: () => void;
  onDeleteFlashcardBtnClick: () => void;
  doUnsavedChangesExist: boolean;
  areLinesForcing: boolean;
  onAreLinesChangingChange: (value: boolean) => void;
}

const FlashcardEditButtons = ({
  flashcard,
  onDiscardChangesBtnClick,
  onSaveChangesBtnClick,
  onDeleteFlashcardBtnClick,
  doUnsavedChangesExist,
  areLinesForcing,
  onAreLinesChangingChange,
}: Props) => {
  return (
    <div className="flex flex-col justify-center items-center bg-background-page rounded-md w-full p-3 gap-3">
      <div className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          id="pgn-lines-only"
          checked={areLinesForcing}
          onChange={(e) => onAreLinesChangingChange(e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
        <label htmlFor="pgn-lines-only" className="cursor-pointer select-none">
          Pgn Lines Only
        </label>
      </div>
      <div className="flex flex-row flex-wrap justify-center items-center w-full gap-3">
          <span>
            <Button
              onClick={onSaveChangesBtnClick}
              disabled={!doUnsavedChangesExist}
              buttonSize={ButtonSize.Small}
              buttonStyle={ButtonStyle.Primary}
            >
              Save Changes
            </Button>
          </span>
          <span>
            <Button
              onClick={onDiscardChangesBtnClick}
              disabled={!doUnsavedChangesExist}
              buttonSize={ButtonSize.Small}
            >
              Undo Changes
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
    </div>
  );
}

export default FlashcardEditButtons;
