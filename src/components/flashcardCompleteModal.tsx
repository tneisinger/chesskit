import Modal from '@/components/modal';
import Button, { ButtonSize, ButtonStyle } from "@/components/button";

interface Props {
  show: boolean;
  onClose: () => void;
  onReplayFlashcardBtnClick: () => void;
  onNextFlashcardBtnClick: () => void;
  numWrongAnswers: number;
  numHintsGiven?: number;
  numShowMovesGiven?: number;
}

const FlashcardCompleteModal = ({
  show,
  onClose,
  onReplayFlashcardBtnClick,
  onNextFlashcardBtnClick,
  numWrongAnswers,
  numHintsGiven,
  numShowMovesGiven,
}: Props) => {

  return (
    <Modal show={show}>
      <div className='bg-background-page/97 px-9 pb-4 pt-2 rounded-md'>
        <div className='fixed w-full flex justify-end pr-11'>
          <span
            className="bg-stone-600 hover:bg-stone-500 pt-0.5 px-1.5 rounded-xl font-bold text-sm cursor-pointer"
            onClick={() => onClose()}
          >
            X
          </span>
        </div>
        <h3 className='text-center mt-3 mb-2 text-2xl font-bold text-nowrap'>
          Flashcard Complete!
        </h3>
        <div className="mb-5">
          <p className="text-center">
            You made {numWrongAnswers} {numWrongAnswers === 1 ? 'mistake' : 'mistakes'}
          </p>
          {Boolean(numHintsGiven) && (
            <p className="text-center">
              You used {numHintsGiven} {numHintsGiven === 1 ? 'hint' : 'hints'}
            </p>
          )}
          {Boolean(numShowMovesGiven) && (
            <p className="text-center">
              You asked to see {numShowMovesGiven} {numShowMovesGiven === 1 ? 'move' : 'moves'}
            </p>
          )}
        </div>
        <div className='flex flex-row gap-4 justify-center'>
          <Button
            buttonSize={ButtonSize.Small}
            buttonStyle={ButtonStyle.Primary}
            onClick={() => {
              onNextFlashcardBtnClick();
              onClose();
            }}
          >
            Next Flashcard
          </Button>
          <Button
            buttonSize={ButtonSize.Small}
            onClick={() => {
              onReplayFlashcardBtnClick();
              onClose();
            }}
          >
            Replay Flashcard
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default FlashcardCompleteModal;
