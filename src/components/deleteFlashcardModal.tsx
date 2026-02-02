import Modal from '@/components/modal';
import Button, { ButtonSize, ButtonStyle } from "@/components/button";

export enum DeleteStatus {
  NotStarted = 'Not Started',
  Deleting = 'Deleting',
  Success = 'Delete Successful',
  Failed = 'Delete Failed',
}

interface Props {
  show: boolean;
  onClose: () => void;
  onNextFlashcardBtnClick: () => void;
  onConfirmedFlashcardDelete: () => void;
  deleteStatus: DeleteStatus;
}

const DeleteFlashcardModal = ({
  show,
  onClose,
  onNextFlashcardBtnClick,
  onConfirmedFlashcardDelete,
  deleteStatus,
}: Props) => {

  let h3Text = '';
  let msgText = '';
  let buttonsDiv = <></>;

  switch (deleteStatus) {
    case DeleteStatus.NotStarted:
      h3Text = 'Delete Flashcard?';
      msgText = 'Are you sure you want to delete this flashcard?'
      buttonsDiv = (
        <div className="flex flex-row gap-6 justify-center">
          <Button
            onClick={onConfirmedFlashcardDelete}
            buttonSize={ButtonSize.Small}
            buttonStyle={ButtonStyle.Danger}
          >
            Delete
          </Button>
          <Button
            onClick={onClose}
            buttonSize={ButtonSize.Small}
          >
            Cancel
          </Button>
        </div>
      );
      break;
    case DeleteStatus.Deleting:
      h3Text = 'Deleting Flashcard';
      msgText = 'The flashcard is being deleted.'
      // No buttons - modal is locked during deletion
      break;
    case DeleteStatus.Success:
      h3Text = 'Flashcard Deleted';
      msgText = 'The flashcard has been deleted.'
      buttonsDiv = (
        <div className="flex flex-row gap-6 justify-center">
          <Button
            onClick={() => {
              onNextFlashcardBtnClick();
              onClose();
            }}
            buttonSize={ButtonSize.Small}
            buttonStyle={ButtonStyle.Primary}
          >
            Ok, next flashcard
          </Button>
        </div>
      );
      break;
    case DeleteStatus.Failed:
      h3Text = 'Delete Failed';
      msgText = 'Something went wrong. Try again later.'
      buttonsDiv = (
        <div className="flex flex-row gap-6 justify-center">
          <Button
            onClick={onClose}
            buttonSize={ButtonSize.Small}
          >
            Close
          </Button>
        </div>
      );
      break;
    default:
      throw new Error('Default case of switch statement reached unexpectedly');
  }

  return (
    <Modal show={show}>
      <div className='flex flex-col bg-background-page/97 px-9 pb-4 pt-2 rounded-md gap-4'>
        <h3 className='text-center mt-2 mb-0 text-2xl font-bold text-nowrap'>
          {h3Text}
        </h3>
        <p className="text-center">
          {msgText}
        </p>
        {buttonsDiv}
      </div>
    </Modal>
  );
}

export default DeleteFlashcardModal;
