import { useCallback ,ReactElement } from "react";
import Button, { ButtonSize, ButtonStyle } from "@/components/button";
import Spinner from '@/components/spinner';
import { MoveJudgement } from "@/types/chess";
import { getJudgementColor } from '@/utils/chess';
import {  Move } from 'cm-chess/src/Chess';
import { Flashcard } from "@/db/schema";

interface Props {
  dueFlashcards: Flashcard[];
  flashcardIndex: number;
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
  dueFlashcards,
  flashcardIndex,
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

  const getCurrentFlashcard = useCallback((): Flashcard | null => {
    if (dueFlashcards.length < 1) return null;
    const fc = dueFlashcards[flashcardIndex];
    if (fc == undefined) throw new Error('fc was undefined');
    return fc;
  }, [dueFlashcards, flashcardIndex])

  const wrapContent = (content: ReactElement): ReactElement => (
    <div className='flex flex-col w-full flex-1 bg-background-page p-6 rounded-md text-center gap-4 justify-center'>
      {content}
    </div>
  );

  const renderBestMove = useCallback((): ReactElement => {
    const fc = getCurrentFlashcard();
    if (fc == null) return <></>;
    return <span style={{ color: getJudgementColor(MoveJudgement.Best) }}>{fc.bestMoves[0].moveSan}</span>;
  }, [getCurrentFlashcard]);

  const renderMoveGradeFeedback = useCallback((): ReactElement => {
    if (currentMove == undefined) throw new Error('currentMove was undefined');
    if (moveGrade == null) throw new Error('moveGrade was null');
    return (
        <p>
          {moveGrade.san} is <span style={{ color: getJudgementColor(moveGrade.grade) }}>{moveGrade.grade}</span>
        </p>
    );
  }, [currentMove, moveGrade]);


  // Component return statements:

  if (isGradingMove) return wrapContent(
    <div className="flex flex-col items-center gap-4">
      <p>Evaluating Move</p>
      <Spinner white />
    </div>
  );

  // If all the flashcards are complete
  if (isFlashcardComplete && flashcardIndex >= dueFlashcards.length - 1) return wrapContent(
    <>
      <h3 className='text-xl font-bold text-nowrap leading-2'>
        All Flashcards Complete!
      </h3>
      <div>
        {renderMoveGradeFeedback()}
        {(moveGrade && moveGrade.grade !== MoveJudgement.Best) && (
          <p className="text-md">The best move was {renderBestMove()}</p>
        )}
      </div>
      <div className='flex flex-row gap-4 justify-center'>
        <Button
          buttonSize={ButtonSize.Small}
          onClick={onReplayFlashcardBtnClick}
        >
          Replay Flashcard
        </Button>
      </div>
    </>
  );


  if (isFlashcardComplete) return wrapContent(
    <>
      <h3 className='text-xl font-bold text-nowrap leading-2'>
        Flashcard Complete!
      </h3>
      <div>
        {renderMoveGradeFeedback()}
        {(moveGrade && moveGrade.grade !== MoveJudgement.Best) && (
          <p className="text-md">The best move was {renderBestMove()}</p>
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
    <div className="text-lg">
      {renderMoveGradeFeedback()}
    </div>
  );


  if (!isFlashcardComplete) return wrapContent(
    <div className="flex flex-col">
      <p>Play a Move!</p>
    </div>
  );

  throw new Error('This error should be unreachable');
}

export default FlashcardFeedback;
