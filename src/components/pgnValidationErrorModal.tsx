import Modal from '@/components/modal';
import Button, { ButtonSize, ButtonStyle } from "@/components/button";

interface Props {
  show: boolean;
  onClose: () => void;
  errorMessage: string;
}

const PgnValidationErrorModal = ({ show, onClose, errorMessage }: Props) => {
  return (
    <Modal show={show}>
      <div className='flex flex-col bg-background-page/97 px-9 pb-4 pt-2 rounded-md gap-4'>
        <h3 className='text-center mt-2 mb-0 text-2xl font-bold text-nowrap'>
          Invalid PGN
        </h3>
        <p className="text-center">
          {errorMessage}
        </p>
        <div className="flex flex-row gap-6 justify-center">
          <Button
            onClick={onClose}
            buttonSize={ButtonSize.Small}
            buttonStyle={ButtonStyle.Primary}
          >
            OK
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default PgnValidationErrorModal;
