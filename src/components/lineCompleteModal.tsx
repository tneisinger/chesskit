import { useCallback } from 'react';
import Modal from '@/components/modal';
import Button, { ButtonSize } from "@/components/button";
import { Mode } from '@/types/lesson';

interface Props {
  show: boolean;
  onClose: () => void;
  setupNextLine: (nextMode?: Mode) => void;
  restartCurrentLine: (nextMode?: Mode) => void;
  changeChapter: (idx: number) => void;
  isNextLineInAnotherChapter: () => boolean;
  getIdxOfNextIncompleteChapter: () => number | null;
  areAllLinesComplete: () => boolean;
}

const LineCompleteModal = ({
  show,
  onClose,
  setupNextLine,
  restartCurrentLine,
  changeChapter,
  isNextLineInAnotherChapter,
  getIdxOfNextIncompleteChapter,
  areAllLinesComplete,
}: Props) => {

  const handleChangeChapter = useCallback((idx: number | null) => {
    if (idx == null) return;
    changeChapter(idx);
  }, [changeChapter]);

  return (
    <Modal show={show}>
      <div className='bg-background-page/97 px-4 py-4 rounded-md'>
        <div className='text-center mb-2 text-2xl font-bold text-nowrap'>
          {areAllLinesComplete() ? (
            <>All Lines Complete!</>
          ) : (
            <>Line Complete!</>
          )}
        </div>
        <div className='flex flex-row gap-4 justify-center'>
          <Button
            buttonSize={ButtonSize.Small}
            onClick={() => {
              restartCurrentLine()
              onClose();
            }}
          >
            Replay Line
          </Button>
          {isNextLineInAnotherChapter() && (
            <Button
              buttonSize={ButtonSize.Small}
              onClick={() => {
                handleChangeChapter(getIdxOfNextIncompleteChapter())
                onClose();
              }}
            >
              Next Chapter
            </Button>
          )}
          {!areAllLinesComplete() && !isNextLineInAnotherChapter() && (
            <Button
              buttonSize={ButtonSize.Small}
              onClick={() => {
                setupNextLine()
                onClose();
              }}
            >
              Next Line
            </Button>
          )}
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

export default LineCompleteModal;
