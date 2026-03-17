import { useState, useCallback, useEffect, useRef, ReactElement } from "react";
import { GameData, MoveJudgement } from "@/types/chess";
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
  makeMoveJudgement,
  isMoveJudgementWorseThan,
  doesOnlyOneGoodMoveExist
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
import { FindForcingLineOptions, Output as ForcingLineFinder} from '@/hooks/useForcingLineFinderParallel';
import { AnalyzerStatus } from '@/types/analyzer';
import { useFlashcardContext } from '@/contexts/FlashcardContext';
import usePrevious from "@/hooks/usePrevious";
import { useFenAnalyzers } from '@/contexts/FenAnalyzersContext';

interface Props {
  game: GameData;
  currentMove: Move | undefined;
  hasGameBeenAnalyzed: boolean;
  forcingLineFinder: ForcingLineFinder;
  isCreatingFlashcard: boolean;
  changeIsCreatingFlashcard: (b: boolean) => void;
}

const FlashcardCreator = ({
  game,
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

  const previousMove = usePrevious(currentMove);

  const flashcardMoveAwaitingConfirmRef = useRef<Move | null>(null);

  const { refreshDueCount } = useFlashcardContext();
  const context = useFenAnalyzers();
  const evaluations = context.evaluations;


  // Returns true if the given move represents a position that is flashcard worthy.
  const isPositionFlashcardWorthy = useCallback((move: Move, isFlashcardRecommended = false) => {

    // Return false if it is not the user's turn
    if (game.userColor === getColor(move)) return false;

    // If there is no next move, then there is no move to judge.
    if (move.next == undefined) return false;

    // A flashcard is recommended if the move was worse than an inaccuracy
    if (isFlashcardRecommended) {
      const j = makeMoveJudgement(move.fen, move.next.fen, evaluations);
      if (j == undefined) return false;
      return isMoveJudgementWorseThan(MoveJudgement.Inaccurate, j);
    }

    return true;
  }, [game, evaluations]);


  const getFlashcardMove = useCallback((): Move | null => {
    if (currentMove == undefined) return null;
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

    const cmChess = new CmChess();
    const moves = getLineFromCmMove(flashcardMove);
    let flashcardMoveOfCmChess: Move | undefined;
    moves.forEach((m) => flashcardMoveOfCmChess = cmChess.move(m.san));
    if (flashcardMoveOfCmChess == undefined) throw new Error('lastMove was undefined');
    if (flashcardMoveOfCmChess.fen !== flashcardMove.fen) throw new Error('fens do not match');

    const evaluation = evaluations[flashcardMove.fen];
    if (evaluation == undefined) throw new Error('evaluation was undefined');

    let areLinesForcing = false;

    if (doesOnlyOneGoodMoveExist(evaluation)) {
      areLinesForcing = true;

      // Stop current analyses and find forcing line
      await context.stop();

      const options: FindForcingLineOptions = { minDepth: 18, maxLineLength: 11 };
      const forcingLine = await forcingLineFinder.findForcingLine(evaluation, options);

      if (forcingLine.length > 0) {
        addShortMoveLinesToCmChess(cmChess, [forcingLine], flashcardMoveOfCmChess);
      } else {
        console.warn('No forcing line found, even though only one good move exists according to evaluation');
      }
    }

    // When there are no forcing lines, add the good moves from evaluations to cmChess.
    if (!areLinesForcing) {
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
  }, [game, getFlashcardMove, evaluations, context.stop, forcingLineFinder])


  const makeFlashcardPositionHtml = useCallback((): ReactElement => {
    const flashcardMove = getFlashcardMove();
    if (flashcardMove == null) return <></>;
    if (flashcardMove.next == undefined) throw new Error('flashcardMove.next was undefined');
    const mj = getMoveJudgement(flashcardMove.next, convertEvaluationsToGameEvals(evaluations));
    const color = getMoveJudgementColor(mj);
    const moveNumberString = makeMoveNumberString(flashcardMove.fen);
    return <span className="ml-1 font-bold">{moveNumberString} <span style={{ color, marginLeft: 4 }}>{flashcardMove.san}</span></span>;
  }, [getFlashcardMove]);

  const shouldHighlightFlashcardBtn = useCallback((): boolean => {
    if (currentMove === undefined) return false;

    if (isInVariation(currentMove)) {
      const parent = getMainLineParentOfVariation(currentMove);
      if (parent && isPositionFlashcardWorthy(parent, true)) return true;
    }

    return isPositionFlashcardWorthy(currentMove, true);
  }, [currentMove, game])


  const doesFlashcardAlreadyExistForThisPosition = useCallback((): boolean => {
    if (currentMove == undefined) return false;
    if (gameFlashcards == null) throw new Error('gameFlashcards was null');
    return gameFlashcards.map((fc) => fc.positionIdx).includes(currentMove.ply);
  }, [currentMove, gameFlashcards]);


  const isPositionFlashcardRelevant = useCallback((): boolean => {
    if (currentMove == undefined) return false;

    if (isInVariation(currentMove)) {
      const parent = getMainLineParentOfVariation(currentMove);
      if (parent && isPositionFlashcardWorthy(parent)) return true;
    }

    if (isPositionFlashcardWorthy(currentMove)) return true;

    return false;
  }, [currentMove]);


  const shouldDisableFlashcardBtn = useCallback((): boolean => {
    if (doesFlashcardAlreadyExistForThisPosition()) return true;
    if (isPositionFlashcardRelevant()) return false;
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

    if (forcingLineFinder.forcingMoves.length > 0) {
      const len = forcingLineFinder.forcingMoves.length;
      return wrapContent(<>{len} forcing move{len === 1 ? '' : 's'} found so far</>);
    } else {
      if (forcingLineFinder.status === AnalyzerStatus.Analyzing ||
          forcingLineFinder.status === AnalyzerStatus.Initializing
      ) {
        return wrapContent(<>Looking for forcing moves</>);
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


  // When the user navigates to a different move, reset confirmation state if needed
  useEffect(() => {
    if (currentMove === previousMove) return;
    if (!awaitingUserConfirm) return;

    const flashcardMove = getFlashcardMove();
    if (flashcardMove == null || flashcardMove !== flashcardMoveAwaitingConfirmRef.current) {
      setAwaitingUserConfirm(false);
      flashcardMoveAwaitingConfirmRef.current = null;
    }
  }, [previousMove, currentMove, awaitingUserConfirm, getFlashcardMove]);


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
      flashcardMoveAwaitingConfirmRef.current = null;
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


  if (awaitingUserConfirm && flashcardMoveAwaitingConfirmRef.current != null) {
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
              onClick={() => {
                setAwaitingUserConfirm(false);
                flashcardMoveAwaitingConfirmRef.current = null;
              }}
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
            onClick={() => {
              const flashcardMove = getFlashcardMove();
              if (flashcardMove == null) throw new Error('flashcardMove was null');
              setAwaitingUserConfirm(true);
              flashcardMoveAwaitingConfirmRef.current = flashcardMove;
            }}
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
