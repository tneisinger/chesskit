import { useState, useCallback, useEffect, ReactElement } from "react";
import { GameData, Evaluations, MoveJudgement } from "@/types/chess";
import Button, { ButtonStyle } from "./button";
import { Chess as CmChess, Move } from 'cm-chess/src/Chess';
import Spinner from '@/components/spinner';
import {
  judgeLines,
  lanToShortMove,
  getScoredBestMovesFromPev,
  makeMoveNumberString,
  getMoveJudgement,
  convertEvaluationsToGameEvals,
  getMoveJudgementColor,
  makeMoveJudgement
} from '@/utils/chess';
import {
  colorToMove,
  getColor,
  getLineFromCmMove,
  getMainLineParentOfVariation,
  isInVariation,
  renderPgn
} from '@/utils/cmchess';
import { Flashcard } from "@/db/schema";
import { createFlashcard, getAllFlashcards, CreateFlashcardInput } from '@/app/flashcards/actions';
import { Output as ChessAnalyzerOutput } from '@/hooks/useChessAnalyzer';

interface Props {
  game: GameData;
  evaluations: Evaluations;
  currentMove: Move | undefined;
  hasGameBeenAnalyzed: boolean;
  addForcingLinesToCmChess: ChessAnalyzerOutput['addForcingLinesToCmChess'];
  isCreatingFlashcard: boolean;
  changeIsCreatingFlashcard: (b: boolean) => void;
}

const FlashcardCreator = ({
  game,
  evaluations,
  currentMove,
  hasGameBeenAnalyzed,
  addForcingLinesToCmChess,
  isCreatingFlashcard,
  changeIsCreatingFlashcard,
}: Props) => {
  const [gameFlashcards, setGameFlashcards] = useState<Flashcard[] | null>(null);
  const [awaitingUserConfirm, setAwaitingUserConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdFlashcards, setCreatedFlashcards] = useState<CreateFlashcardInput[]>([]);

  const getFlashcardMove = useCallback((): Move => {
    if (currentMove == undefined) throw new Error('currentMove was undefined');
    // The flashcard move is the move that represents the starting position
    // of the flashcard. If we are in a variation, the flashcard move should
    // be the mainLine parent of the variation.
    let flashcardMove = currentMove;
    if (isInVariation(currentMove)) {
      const parent = getMainLineParentOfVariation(currentMove);
      if (parent == null) throw new Error('parent was null');
      flashcardMove = parent;
    }
    return flashcardMove;
  }, [currentMove]);

  const makeFlashcardData = useCallback(async (): Promise<CreateFlashcardInput> => {
    const flashcardMove = getFlashcardMove();

    if (colorToMove(flashcardMove) !== game.userColor) {
      throw new Error("In the flashcardMove position, it is not the user's turn");
    }

    // Create a new CmChess object and play moves into it up to and including
    // the flashcardMove. Create the flashcardMoveOfCmChess variable, which will contain
    // a move that is identical to flashcardMove, but it is important that it comes from
    // our new instance of CmChess. We must use this new version of the flashcardMove in
    // the 'playForcingLineIntoCmChess' function.
    const cmChess = new CmChess();
    const moves = getLineFromCmMove(flashcardMove);
    let flashcardMoveOfCmChess: Move | undefined;
    moves.forEach((m) => flashcardMoveOfCmChess = cmChess.move(m.san));
    if (flashcardMoveOfCmChess == undefined) throw new Error('lastMove was undefined');
    if (flashcardMoveOfCmChess.fen !== flashcardMove.fen) throw new Error('fens do not match');

    // Try to get forcing lines.
    const addedLines = await addForcingLinesToCmChess(
      cmChess,
      flashcardMoveOfCmChess,
      { minDepth: 20, maxLines: 1, maxLineLength: 11, moveFoundCallback: (move) => console.log('MOVE FOUND:', move.san)},
    );

    addedLines.forEach((line) => {
      console.log(line.map((m) => m.san).join(' '));
    });

    // If a forcing line is found, set 'areLinesForcing' to true.
    let areLinesForcing = false;
    if (addedLines.length > 0) {
      areLinesForcing = true;
    }

    // When there are no forcing lines, add the good moves from evaluations to cmChess.
    if (!areLinesForcing) {
      const evaluation = evaluations[flashcardMove.fen];
      if (evaluation == undefined) throw new Error('evaluation was undefined');
      const lineJudgements = judgeLines(colorToMove(flashcardMove), evaluation.lines);
      const lineMoves = evaluation.lines.map((line) => lanToShortMove(line.lanLine.trim().split(' ')[0]));

      const goodJudgements = [MoveJudgement.Best, MoveJudgement.Excellent, MoveJudgement.Good];

      for (let i = 0; i < lineMoves.length; i++) {
        const judgement = lineJudgements[i];
        const lineMove = lineMoves[i];
        if (goodJudgements.includes(judgement)) {
          const moveResult = cmChess.move(lineMove, flashcardMoveOfCmChess);
          if (moveResult == undefined) throw new Error('moveResult was undefined');
        }
      }
    }

    const flashcardPev = evaluations[flashcardMove.fen];
    if (flashcardPev == undefined) throw new Error('flashcardPev was undefined');
    if (flashcardPev.lines.length < 2) throw new Error('Not enough evaluation lines to make flashcard');

    return {
      gameId: game.id,
      pgn: renderPgn(cmChess).trim(),
      positionIdx: flashcardMove.ply,
      userColor: game.userColor,
      bestMoves: getScoredBestMovesFromPev(flashcardPev),
      movePlayedInGame: { san: flashcardMove.san, lan: (flashcardMove.from + flashcardMove.to)},
      gameUrl: game.url,
    }
  }, [game, getFlashcardMove, evaluations, addForcingLinesToCmChess])


  const makeFlashcardPositionHtml = useCallback((): ReactElement => {
    const flashcardMove = getFlashcardMove();
    if (flashcardMove.next == undefined) throw new Error('flashcardMove.next was undefined');
    const mj = getMoveJudgement(flashcardMove.next, convertEvaluationsToGameEvals(evaluations));
    const color = getMoveJudgementColor(mj);
    const moveNumberString = makeMoveNumberString(flashcardMove.fen);
    return <span className="ml-1 font-bold">{moveNumberString} <span style={{ color, marginLeft: 4 }}>{flashcardMove.san}</span></span>;
  }, [getFlashcardMove]);

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


  const doesFlashcardAlreadyExistForThisPosition = useCallback((): boolean => {
    if (currentMove == undefined) return false;
    if (gameFlashcards == null) throw new Error('gameFlashcards was null');
    return gameFlashcards.map((fc) => fc.positionIdx).includes(currentMove.ply);
  }, [currentMove, gameFlashcards]);


  const shouldDisableFlashcardBtn = useCallback((): boolean => {
    // If in the starting position, the button should be disabled.
    if (currentMove == undefined) return true;

    // Disable the button if we already have a flashcard for this position
    if (doesFlashcardAlreadyExistForThisPosition()) return true;

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
  }, [currentMove, game, doesFlashcardAlreadyExistForThisPosition]);

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
    const j = makeMoveJudgement(move.fen, move.next.fen, evaluations);
    if (j == undefined) return false;
    return js.includes(j);
  }, [game, evaluations]);


  useEffect(() => {
    const getGameFlashcards = async () => {
      try {
        const userFlashcards = await getAllFlashcards();
        setGameFlashcards(userFlashcards.filter((fc) => fc.gameId === game.id));
      } catch (error) {
        console.error("Error fetching all user flashcards:", error);
      }
    };

    getGameFlashcards();
  }, [game]);

  const wrapContent = (content: ReactElement): ReactElement => {
    return (
      <div className="w-full h-full p-5 flex flex-col items-center gap-4 bg-background-page rounded-md">
        {content}
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    changeIsCreatingFlashcard(true);

    // TODO: Prevent creation of duplicate flashcards
    const flashcardData = await makeFlashcardData();

    try {
      const result = await createFlashcard(flashcardData);

      if (result.success) {
        setCreatedFlashcards((fcs) => [...fcs, flashcardData]);
      } else {
        setError(result.error || 'Failed to create flashcard');
      }
    } catch (error) {
      console.error('Error creating flashcard:', error);
      setError('An unexpected error occurred');
    } finally {
      changeIsCreatingFlashcard(false);
    }
  };

  useEffect(() => {
    if (gameFlashcards) console.log(gameFlashcards.length);
  }, [gameFlashcards]);


  if (isCreatingFlashcard) {
    return wrapContent(
      <div className="flex flex-col items-center justify-center">
        <p>Creating Flashcard</p>
        <Spinner white />
      </div>
    );
  }


  if (awaitingUserConfirm) {
    return wrapContent(
      <>
        <h2 className="text-xl font-semibold mb-0 text-center">Create Flashcard?</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="text-gray-300 text-center">
            <p>
              Create a flashcard for the position after {makeFlashcardPositionHtml()}?
            </p>
          </div>

          <div className='flex flex-row justify-evenly gap-3'>
            <Button
              type="submit"
              buttonStyle={ButtonStyle.Primary}
              disabled={isCreatingFlashcard}
            >
              {isCreatingFlashcard ? "Creating..." : 'Create'}
            </Button>
            <Button
              type="button"
              onClick={() => setAwaitingUserConfirm(false)}
              disabled={isCreatingFlashcard}
            >
              Cancel
            </Button>
          </div>
        </form>
      </>
    );
  }


  return (
    <div>
      {hasGameBeenAnalyzed && (
        <div className="w-full h-full p-5 flex flex-col items-center gap-4 bg-background-page rounded-md">
          <Button
            buttonStyle={shouldHighlightFlashcardBtn() ? ButtonStyle.Primary : ButtonStyle.Normal}
            onClick={() => setAwaitingUserConfirm(true)}
            disabled={shouldDisableFlashcardBtn()}
          >
            Create Flashcard
          </Button>
          {doesFlashcardAlreadyExistForThisPosition() && (
            <p className="text-sm text-center">Flashcard already exists</p>
          )}
        </div>
      )}
    </div>
  );
}

export default FlashcardCreator;
