import Modal from '@/components/modal';
import Button, { ButtonSize, ButtonStyle } from "@/components/button";

interface Props {
  show: boolean;
  onClose: () => void;
}

const SaveSuccessModal = ({ show, onClose }: Props) => {
  return (
    <Modal show={show}>
      <div className='flex flex-col bg-background-page/97 px-9 pb-4 pt-2 rounded-md gap-4'>
        <h3 className='text-center mt-2 mb-0 text-2xl font-bold text-nowrap'>
          Changes Saved
        </h3>
        <p className="text-center">
          Changes saved successfully.
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

export default SaveSuccessModal;
