import { useEffect, useState, useCallback } from "react";
import { GameData, GameEvaluation, MoveJudgement } from "@/types/chess";
import Button, { ButtonStyle } from "./button";
import { Move } from 'cm-chess/src/Chess';
import { makeMoveJudgements } from "@/utils/chess";
import { getColor, isInVariation } from "@/utils/cmchess";
import CreateFlashcardModal from "./createFlashcardModal";

const highlightedJudgements: MoveJudgement[] = [
  MoveJudgement.Blunder,
  MoveJudgement.Mistake,
]

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

  const getBestLines = useCallback(() => {
    if (!currentMove) return undefined;
    const posEval = gameEvaluation[currentMove.fen];
    return posEval?.lines;
  }, [currentMove, gameEvaluation]);

  const shouldHighlightFlashcardBtn = useCallback(() => {
    if (currentMove === undefined) return false;
    if (isInVariation(currentMove)) return false;
    if (game.userColor !== getColor(currentMove) && currentMove.next) {
      const j = moveJudgements[currentMove.next.fen]
      return highlightedJudgements.includes(j);
    }
  }, [currentMove, game])

  const bestLines = getBestLines();

  const shouldDisableFlashcardBtn = useCallback(() => {
    if (bestLines == undefined) return true;
    if (currentMove == undefined) return true;
    if (isInVariation(currentMove)) return true;
    return game.userColor === getColor(currentMove);
  }, [currentMove, game]);

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

      {currentMove && bestLines && (
        <CreateFlashcardModal
          show={showCreateFlashcardModal}
          game={game}
          currentMove={currentMove}
          bestLines={bestLines}
          onClose={() => setShowCreateFlashcardModal(false)}
        />
      )}
    </div>
  );
}

export default GameReviewButtons;
