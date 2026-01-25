import Modal from '@/components/modal';
import Button, { ButtonSize } from "@/components/button";

interface Props {
  show: boolean;
  onClose: () => void;
}

const AltMoveModal = ({
  show,
  onClose,
}: Props) => {
  if (show) {
    return (
      <Modal show={show}>
        <div className='flex flex-col gap-5 bg-background-page/97 px-4 py-4 rounded-md'>
          <p className="text-center mt-2">
            That move is correct but an alternative move exists. Play an alternative move instead.
          </p>
          <div className="flex justify-center">
            <Button
              buttonSize={ButtonSize.Small}
              onClick={onClose}
            >
              Ok
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return <></>;
}

export default AltMoveModal;
