import Modal from '@/components/modal';
import Button, { ButtonSize } from "@/components/button";

interface Props {
  show: boolean;
  onClose: () => void;
  onReplayFlashcardBtnClick: () => void;
  onNextFlashcardBtnClick: () => void;
  numWrongAnswers: number;
}

const FlashcardCompleteModal = ({
  show,
  onClose,
  onReplayFlashcardBtnClick,
  onNextFlashcardBtnClick,
  numWrongAnswers,
}: Props) => {

  return (
    <Modal show={show}>
      <div className='bg-background-page/97 px-4 py-4 rounded-md'>
        <h3 className='text-center mb-2 text-2xl font-bold text-nowrap'>
          Flashcard Complete!
        </h3>
        <p className="mb-3 text-center">
          You made {numWrongAnswers} {numWrongAnswers === 1 ? 'mistake' : 'mistakes'}
        </p>
        <div className='flex flex-row gap-4 justify-center'>
          <Button
            buttonSize={ButtonSize.Small}
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
          <Button
            buttonSize={ButtonSize.Small}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default FlashcardCompleteModal;
