'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/modal';
import Button, { ButtonStyle } from "@/components/button";
import { Chess as CmChess, Move } from 'cm-chess/src/Chess';
import { GameData, Evaluations, MoveJudgement } from '@/types/chess';
import { createFlashcard, CreateFlashcardInput } from '@/app/flashcards/actions';
import { judgeLines, lanToShortMove, getScoredBestMovesFromPev, makeMoveNumberString } from '@/utils/chess';
import {
  colorToMove,
  getLineFromCmMove,
  getMainLineParentOfVariation,
  isInVariation,
  renderPgn
} from '@/utils/cmchess';
import { Output as ChessAnalyzerOutput } from '@/hooks/useChessAnalyzer';

interface Props {
  show: boolean;
  game: GameData;
  currentMove: Move;
  onClose: () => void;
  evaluations: Evaluations;
  addForcingLinesToCmChess: ChessAnalyzerOutput['addForcingLinesToCmChess'];
}

const CreateFlashcardModal = ({
  show,
  game,
  currentMove,
  evaluations,
  onClose,
  addForcingLinesToCmChess,
}: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      setError(null);
    }
  }, [show]);


  const getFlashcardMove = useCallback((): Move => {
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
      { minDepth: 20, maxLines: 2, maxLineLength: 9, moveFoundCallback: (move) => console.log('MOVE FOUND:', move.san)},
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
    }
  }, [game, getFlashcardMove, evaluations, addForcingLinesToCmChess])


  const getFlashcardPositionString = useCallback((): string => {
    const flashcardMove = getFlashcardMove();
    const moveNumberString = makeMoveNumberString(flashcardMove.fen);
    return `${moveNumberString} ${flashcardMove.san}`;
  }, [getFlashcardMove]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // TODO: Prevent creation of duplicate flashcards
    const flashcardData = await makeFlashcardData();

    try {
      const result = await createFlashcard(flashcardData);

      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Failed to create flashcard');
      }
    } catch (error) {
      console.error('Error creating flashcard:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={show}>
      <div className='bg-background-page p-6 rounded-md max-w-lg w-full'>
        <h2 className="text-xl font-semibold mb-4 text-center">Create Flashcard</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="text-gray-300 text-center">
            <p>Create a flashcard for the position after {getFlashcardPositionString()}?</p>
          </div>

          <div className='flex flex-row justify-evenly gap-3'>
            <Button
              type="submit"
              buttonStyle={ButtonStyle.Primary}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : 'Create'}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CreateFlashcardModal;
