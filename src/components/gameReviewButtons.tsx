import { useEffect, useState, useCallback } from "react";
import { GameData, GameEvaluation, MoveJudgement, PositionEvaluation } from "@/types/chess";
import Button, { ButtonStyle } from "./button";
import { Move } from 'cm-chess/src/Chess';
import { makeMoveJudgements } from "@/utils/chess";
import { getColor, getMainLineParentOfVariation, isInVariation } from "@/utils/cmchess";
import CreateFlashcardModal from "./createFlashcardModal";

interface Props {
  game: GameData;
  gameEvaluation: GameEvaluation;
  currentMove: Move | undefined;
}

const GameReviewButtons = ({
  game,
  gameEvaluation,
  currentMove,
}: Props) => {
  const [moveJudgements, setMoveJudgements] = useState<Record<string, MoveJudgement>>({});
  const [showCreateFlashcardModal, setShowCreateFlashcardModal] = useState(false);

  useEffect(() => {
    setMoveJudgements(makeMoveJudgements(gameEvaluation));
  }, [gameEvaluation]);

  const getEvaluationLines = useCallback((): PositionEvaluation['lines'] | undefined => {
    if (!currentMove) return undefined;
    const positionEvaluation = gameEvaluation[currentMove.fen];
    if (positionEvaluation) {
      return positionEvaluation.lines;
    }
  }, [currentMove, gameEvaluation]);


  const shouldHighlightFlashcardBtn = useCallback((): boolean => {
    // Don't highlight the button if in the starting position.
    if (currentMove === undefined) return false;

    // If we are in a variation that derives from a flashcard recommended position,
    // the flashcard button should be highlighted
    if (isInVariation(currentMove)) {
      const parent = getMainLineParentOfVariation(currentMove);
      if (parent && isPositionFlashcardWorthy(parent, true)) return true;
    }

    // Otherwise, just check the current move
    return isPositionFlashcardWorthy(currentMove, true);
  }, [currentMove, game])

  const shouldDisableFlashcardBtn = useCallback((): boolean => {
    // If in the starting position, the button should be disabled.
    if (currentMove == undefined) return true;

    // If we are in a variation that derives from a flashcard worthy position,
    // the flashcard button should not be disabled.
    if (isInVariation(currentMove)) {
      const parent = getMainLineParentOfVariation(currentMove);
      if (parent && isPositionFlashcardWorthy(parent)) return false;
    }

    // If the current position is flashcard worthy, the button should
    // not be disabled.
    if (isPositionFlashcardWorthy(currentMove)) return false;

    // Otherwise, the button should be disabled.
    return true;
  }, [currentMove, game]);

  // Returns true if the given move represents a position that is flashcard worthy.
  // If 'isFlashcardRecommended' is true, this function will only return true if
  // the move that was played in the position was bad enough that a flashcard is
  // not just acceptable, but recommended.
  const isPositionFlashcardWorthy = useCallback((
    move: Move,
    isFlashcardRecommended = false,
  ) => {
    // Return false if it is not the user's turn
    if (game.userColor === getColor(move)) return false;

    // If there is no next move, then there is no move to judge.
    if (move.next == undefined) return false;

    // If the judgement of the next move is bad enough, then this position
    // is flashcard worthy
    const js = [
      MoveJudgement.Blunder,
      MoveJudgement.Mistake,
    ];
    if (!isFlashcardRecommended) js.push(MoveJudgement.Inaccurate);
    const j = moveJudgements[move.next.fen]
    return js.includes(j);
  }, [game, moveJudgements]);


  const lines = getEvaluationLines();

  return (
    <div className="p-2 flex flex-col justify-center items-center w-full bg-background-page rounded-md gap-3">
      <div>
        <Button
          buttonStyle={shouldHighlightFlashcardBtn() ? ButtonStyle.Primary : ButtonStyle.Normal}
          onClick={() => setShowCreateFlashcardModal(true)}
          disabled={shouldDisableFlashcardBtn()}
        >
          Make Flashcard
        </Button>
      </div>

      {currentMove && lines && (
        <CreateFlashcardModal
          show={showCreateFlashcardModal}
          game={game}
          currentMove={currentMove}
          bestLines={lines}
          onClose={() => setShowCreateFlashcardModal(false)}
        />
      )}
    </div>
  );
}

export default GameReviewButtons;
