import { useEffect, useState, useCallback } from "react";
import { GameData, GameEvaluation, MoveJudgement, PositionEvaluation } from "@/types/chess";
import Button, { ButtonStyle } from "./button";
import { Move } from 'cm-chess/src/Chess';
import { makeMoveJudgements } from "@/utils/chess";
import { getColor, isInVariation } from "@/utils/cmchess";
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

    // Don't highlight the button if we are in a variation.
    if (isInVariation(currentMove)) return false;

    // If it is the user's turn and there is a next move...
    if (game.userColor !== getColor(currentMove) && currentMove.next) {
      // Highlight the button if the judgement of the next move is bad enough
      const highlightedJudgements: MoveJudgement[] = [
        MoveJudgement.Blunder,
        MoveJudgement.Mistake,
      ]
      const j = moveJudgements[currentMove.next.fen]
      return highlightedJudgements.includes(j);
    }
    return false;
  }, [currentMove, game])

  const shouldDisableFlashcardBtn = useCallback((): boolean => {
    if (currentMove == undefined) return true;
    if (isInVariation(currentMove)) return true;

    // If it is the users turn and there is a next move...
    if (game.userColor !== getColor(currentMove) && currentMove.next) {
      // If the judgement of the next move is bad enough, enable the
      // 'Make Flashcard' button.
      const btnEnabledJudgements = [
        MoveJudgement.Blunder,
        MoveJudgement.Mistake,
        MoveJudgement.Inaccurate,
      ];
      const j = moveJudgements[currentMove.next.fen]
      return !btnEnabledJudgements.includes(j);
    }

    // Otherwise, the button should be disabled.
    return true;
  }, [currentMove, game]);


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
