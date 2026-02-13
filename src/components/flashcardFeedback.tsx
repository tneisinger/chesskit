import { useCallback ,ReactElement } from "react";
import Button, { ButtonSize, ButtonStyle } from "@/components/button";
import Spinner from '@/components/spinner';
import { MoveJudgement } from "@/types/chess";
import { getJudgementColor } from '@/utils/chess';
import {  Move } from 'cm-chess/src/Chess';
import { Flashcard } from "@/db/schema";

interface Props {
  flashcard: Flashcard;
  currentMove: Move | undefined;
  isFlashcardComplete: boolean;
  isGradingMove: boolean;
  moveGrade: { san: string, grade: MoveJudgement } | null;
  onReplayFlashcardBtnClick: () => void;
  onNextFlashcardBtnClick: () => void;
  numWrongAnswers: number;
  numHintsGiven?: number;
  numShowMovesGiven?: number;
}

const FlashcardFeedback = ({
  flashcard,
  currentMove,
  isFlashcardComplete,
  isGradingMove,
  moveGrade,
  onReplayFlashcardBtnClick,
  onNextFlashcardBtnClick,
  numWrongAnswers,
  numHintsGiven,
  numShowMovesGiven,
}: Props) => {

  const wrapContent = (content: ReactElement): ReactElement => (
    <div className='flex flex-col w-full flex-1 bg-background-page p-6 rounded-md text-center gap-4 justify-center'>
      {content}
    </div>
  );

  const renderMoveGradeFeedback = useCallback((): ReactElement => {
    if (currentMove == undefined) throw new Error('currentMove was undefined');
    if (moveGrade == null) throw new Error('moveGrade was null');
    return (
      <div className="flex flex-col text-center gap-2">
        <p>
          {moveGrade.san} is <span style={{ color: getJudgementColor(moveGrade.grade) }}>{moveGrade.grade}</span>
        </p>
      </div>
    );
  }, [currentMove, moveGrade]);


  // Component return statements:

  if (isGradingMove) return wrapContent(
    <div className="flex flex-col items-center gap-4">
      <p>Evaluating Move</p>
      <Spinner white />
    </div>
  );

  if (isFlashcardComplete) return wrapContent(
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
  );


  if (!isFlashcardComplete && moveGrade) return wrapContent(
    renderMoveGradeFeedback()
  );


  if (!isFlashcardComplete) return wrapContent(
    <div className="flex flex-col">
      <p>Play a Move!</p>
    </div>
  );

  throw new Error('This error should be unreachable');
}

export default FlashcardFeedback;
