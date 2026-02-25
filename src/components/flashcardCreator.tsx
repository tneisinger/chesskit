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
  addShortMoveLinesToCmChess,
  colorToMove,
  getColor,
  getLineFromCmMove,
  getMainLineParentOfVariation,
  isInVariation,
  renderPgn
} from '@/utils/cmchess';
import { Flashcard } from "@/db/schema";
import { createFlashcard, getAllFlashcards, CreateFlashcardInput } from '@/app/flashcards/actions';
import { FindForcingLinesOptions, Output as ForcingLineFinder } from '@/hooks/useForcingLineFinder';
import { useFlashcardContext } from '@/contexts/FlashcardContext';

interface Props {
  game: GameData;
  evaluations: Evaluations;
  currentMove: Move | undefined;
  hasGameBeenAnalyzed: boolean;
  forcingLineFinder: ForcingLineFinder;
  isCreatingFlashcard: boolean;
  changeIsCreatingFlashcard: (b: boolean) => void;
}

const FlashcardCreator = ({
  game,
  evaluations,
  currentMove,
  hasGameBeenAnalyzed,
  forcingLineFinder,
  isCreatingFlashcard,
  changeIsCreatingFlashcard,
}: Props) => {
  const [gameFlashcards, setGameFlashcards] = useState<Flashcard[] | null>(null);
  const [awaitingUserConfirm, setAwaitingUserConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flashcards created in this session
  const [createdFlashcards, setCreatedFlashcards] = useState<CreateFlashcardInput[]>([]);

  const { refreshDueCount } = useFlashcardContext();


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


  const getFlashcardMove = useCallback((): Move | null => {
    if (currentMove == undefined) return null;
    // The flashcard move is the move that represents the starting position
    // of the flashcard. If we are in a variation, the flashcard move should
    // be the mainLine parent of the variation.
    let flashcardMove = currentMove;
    if (isInVariation(currentMove)) {
      const parent = getMainLineParentOfVariation(currentMove);
      if (parent == null) throw new Error('parent was null');
      flashcardMove = parent;
    }
    if (!isPositionFlashcardWorthy(flashcardMove)) return null;
    return flashcardMove;
  }, [currentMove, isPositionFlashcardWorthy]);

  const makeFlashcardData = useCallback(async (): Promise<CreateFlashcardInput> => {
    const flashcardMove = getFlashcardMove();
    if (flashcardMove == null) throw new Error('flashcardMove was null');

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
    const options: FindForcingLinesOptions = { minDepth: 18, maxLines: 1, maxLineLength: 11 };
    const forcingLines = await forcingLineFinder.findForcingLines(flashcardMove.fen, options);

    let areLinesForcing = false;
    if (forcingLines.length > 0) {
      areLinesForcing = true;
      addShortMoveLinesToCmChess(cmChess, forcingLines, flashcardMoveOfCmChess);
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
  }, [game, getFlashcardMove, evaluations])


  const makeFlashcardPositionHtml = useCallback((): ReactElement => {
    const flashcardMove = getFlashcardMove();
    if (flashcardMove == null) throw new Error('flashcardMove was null');
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


  // Return true if a flashcard could be made from the currentMove position,
  // or if in a variation whose mainline parent position could be a flashcard.
  const isPositionFlashcardRelevant = useCallback((): boolean => {
    if (currentMove == undefined) return false;

    // If we are in a variation that derives from a flashcard worthy position,
    // return true.
    if (isInVariation(currentMove)) {
      const parent = getMainLineParentOfVariation(currentMove);
      if (parent && isPositionFlashcardWorthy(parent)) return true;
    }

    // If the current position is flashcard worthy, return true
    if (isPositionFlashcardWorthy(currentMove)) return true;

    return false;
  }, [currentMove]);


  const shouldDisableFlashcardBtn = useCallback((): boolean => {
    // Disable the button if we already have a flashcard for this position
    if (doesFlashcardAlreadyExistForThisPosition()) return true;

    // Don't disable the button if the current position could be a flashcard,
    // or if we are in a variation whose mainline parent could be a flashcard.
    if (isPositionFlashcardRelevant()) return false;

    // Otherwise, the button should be disabled.
    return true;
  }, [isPositionFlashcardRelevant, doesFlashcardAlreadyExistForThisPosition]);


  const hasFlashcardBeenCreatedForThisPositionOrVariation = useCallback((): boolean => {
    const flashcardMove = getFlashcardMove();
    if (flashcardMove == null) return false;
    return createdFlashcards.some((fc) => fc.positionIdx === flashcardMove.ply);
  }, [getFlashcardMove, createdFlashcards]);


  const makeForcingLineSearchInfo = useCallback((): ReactElement => {
    const wrapContent = (content: ReactElement): ReactElement => {
      return <p className="text-sm mt-2 text-center">{content}</p>;
    }

    if (forcingLineFinder.isSearching) {
      if (forcingLineFinder.forcingMoves.length === 0) {
        return wrapContent(<>Looking for forcing moves</>);
      } else {
      const len = forcingLineFinder.forcingMoves.length;
        return wrapContent( <>{len} forcing move{len === 1 ? '' : 's'} found so far</>);
      }
    }

    return <></>;
  }, [forcingLineFinder]);


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
      <div className="w-full p-5 flex flex-col items-center gap-4 bg-background-page rounded-md">
        {content}
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    changeIsCreatingFlashcard(true);

    const flashcardData = await makeFlashcardData();

    try {
      const result = await createFlashcard(flashcardData);

      if (result.success) {
        await refreshDueCount();
        setCreatedFlashcards((fcs) => [...fcs, flashcardData]);
      } else {
        setError(result.error || 'Failed to create flashcard');
      }
    } catch (error) {
      console.error('Error creating flashcard:', error);
      setError('An unexpected error occurred');
    } finally {
      changeIsCreatingFlashcard(false);
      setAwaitingUserConfirm(false);
    }
  };


  if (!hasGameBeenAnalyzed) {
    return <></>;
  }


  if (isCreatingFlashcard) {
    return wrapContent(
      <div className="flex flex-col items-center justify-center">
        <p>Creating Flashcard</p>
        <Spinner white />
        {makeForcingLineSearchInfo()}
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


  if (hasFlashcardBeenCreatedForThisPositionOrVariation()) {
    return wrapContent(
      <div className="text-center flex flex-col gap-4">
        <h2 className="text-xl font-bold">Flashcard Created</h2>
        <p>Flashcard created for the position after {makeFlashcardPositionHtml()}</p>
      </div>
    );
  }


  return wrapContent(
    <>
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
    </>
  );
}

export default FlashcardCreator;
