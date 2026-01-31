import Modal from '@/components/modal';
import Button, { ButtonSize } from "@/components/button";

interface Props {
  show: boolean;
  onClose: () => void;
  onReplayFlashcardBtnClick: () => void;
  onNextFlashcardBtnClick: () => void;
}

const FlashcardCompleteModal = ({
  show,
  onClose,
  onReplayFlashcardBtnClick,
  onNextFlashcardBtnClick,
}: Props) => {

  return (
    <Modal show={show}>
      <div className='bg-background-page/97 px-4 py-4 rounded-md'>
        <div className='text-center mb-2 text-2xl font-bold text-nowrap'>
          Flashcard Complete!
        </div>
        <div className='flex flex-row gap-4 justify-center'>
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
            onClick={() => {
              onNextFlashcardBtnClick();
              onClose();
            }}
          >
            Next Flashcard
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
