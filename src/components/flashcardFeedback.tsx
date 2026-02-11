import Button, { ButtonSize, ButtonStyle } from "@/components/button";

interface Props {
  isFlashcardComplete: boolean;
  onReplayFlashcardBtnClick: () => void;
  onNextFlashcardBtnClick: () => void;
  numWrongAnswers: number;
  numHintsGiven?: number;
  numShowMovesGiven?: number;
}

const FlashcardFeedback = ({
  isFlashcardComplete,
  onReplayFlashcardBtnClick,
  onNextFlashcardBtnClick,
  numWrongAnswers,
  numHintsGiven,
  numShowMovesGiven,
}: Props) => {
  return (
    <div className='flex flex-col w-full flex-1 bg-background-page p-6 rounded-md text-center gap-4 justify-end'>
      {isFlashcardComplete ? (
        <>
          <h3 className='text-xl font-bold text-nowrap'>
            Flashcard Complete!
          </h3>
          <div className="">
            <p className="text-sm">
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
              onClick={onReplayFlashcardBtnClick}
            >
              Replay
            </Button>
            <Button
              buttonSize={ButtonSize.Small}
              buttonStyle={ButtonStyle.Primary}
              onClick={onNextFlashcardBtnClick}
            >
              Next Flashcard
            </Button>
          </div>
        </>
      ) : (
        <div>Incomplete</div>
      )}
    </div>
  );

}

export default FlashcardFeedback;
