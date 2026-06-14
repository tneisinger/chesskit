import { useCallback ,ReactElement } from "react";
import Button, { ButtonSize, ButtonStyle } from "@/components/button";
import Spinner from '@/components/spinner';
import { MoveJudgement, PieceColor } from "@/types/chess";
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
  onShowMistakeBtnClick: () => void;
  numWrongAnswers: number;
  numHintsGiven?: number;
  numShowMovesGiven?: number;
  useMobileLayout?: boolean;
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
  onShowMistakeBtnClick,
  numWrongAnswers,
  numHintsGiven,
  numShowMovesGiven,
  useMobileLayout = false,
}: Props) => {

  const getCurrentFlashcard = useCallback((): Flashcard | null => {
    if (dueFlashcards.length < 1) return null;
    const fc = dueFlashcards[flashcardIndex];
    if (fc == undefined) throw new Error('fc was undefined');
    return fc;
  }, [dueFlashcards, flashcardIndex])

  const wrapContent = (content: ReactElement): ReactElement => {
    if (useMobileLayout) return (
      <div className='flex flex-col w-full h-full flex-1 bg-background-page p-6 rounded-md text-center gap-3 justify-center items-center'>
        {content}
      </div>
    );
    return (
      <div className='flex flex-col w-full flex-1 bg-background-page p-6 rounded-md text-center gap-4 justify-center'>
        {content}
      </div>
    );
  };

  const renderBestMove = useCallback((): ReactElement => {
    const fc = getCurrentFlashcard();
    if (fc == null) return <></>;
    return <span style={{ color: getJudgementColor(MoveJudgement.Best) }}>{fc.bestMoves[0].moveSan}</span>;
  }, [getCurrentFlashcard]);

  const renderMoveGradeFeedback = useCallback((): ReactElement => {
    if (moveGrade == null) throw new Error('moveGrade was null');
    return (
        <p>
          {moveGrade.san} is <span style={{ color: getJudgementColor(moveGrade.grade) }}>{moveGrade.grade}</span>
        </p>
    );
  }, [moveGrade]);


  const fc = getCurrentFlashcard();

  const showMistakeBtn = ((fc == null || fc.movePlayedInGame == null) ? (
    <></>
  ) : (
    <Button
      buttonSize={ButtonSize.Small}
      buttonStyle={ButtonStyle.Danger}
      onClick={onShowMistakeBtnClick}
    >
      Show game mistake
    </Button>
  ));

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
      <h3 className='text-lg font-bold text-nowrap leading-2'>
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
      <div>
        {showMistakeBtn}
      </div>
    </>
  );


  if (isFlashcardComplete) return wrapContent(
    <>
      <h3 className='text-lg font-bold text-nowrap leading-2'>
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
      <div>
        {showMistakeBtn}
      </div>

    </>
  );


  if (!isFlashcardComplete && moveGrade) return wrapContent(
    <div className="text-lg">
      {renderMoveGradeFeedback()}
    </div>
  );

  if (!isFlashcardComplete && fc != null) return wrapContent(
    <div className="flex flex-col">
      <p>{fc.userColor === PieceColor.WHITE ? 'White' : 'Black'} to move</p>
    </div>
  );

  throw new Error('This error should be unreachable');
}

export default FlashcardFeedback;
