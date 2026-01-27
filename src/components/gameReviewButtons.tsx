import { useEffect, useState } from "react";
import { GameData, GameEvaluation, MoveJudgement } from "@/types/chess";
import Button from "./button";
import { Move } from 'cm-chess/src/Chess';
import { getMoveJudgement, convertGameEvaluationToGameEvals } from "@/utils/chess";

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
  const [moveJudgement, setMoveJudgement] = useState<MoveJudgement | undefined>(undefined);

  useEffect(() => {
    const gameEvals = convertGameEvaluationToGameEvals(gameEvaluation);
    const j = getMoveJudgement(currentMove, gameEvals);
    setMoveJudgement(j);
  }, [currentMove]);

  return (
    <div className="p-2 flex flex-col justify-center items-center w-full bg-background-page rounded-md gap-3">
      <div>
        <Button>
          Make Flashcard
        </Button>
      </div>
    </div>
  );
}

export default GameReviewButtons;
