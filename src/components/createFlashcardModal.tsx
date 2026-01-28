'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/modal';
import Button, { ButtonStyle } from "@/components/button";
import { Move } from 'cm-chess/src/Chess';
import { GameData, PieceColor } from '@/types/chess';
import { createFlashcard } from '@/app/flashcards/actions';
import { getColor } from '@/utils/cmchess';
import type { Score } from '@/utils/stockfish';

interface Props {
  show: boolean;
  game: GameData;
  currentMove: Move;
  bestLines?: {score: Score, lanLine: string}[];
  onClose: () => void;
}

const CreateFlashcardModal = ({ show, game, currentMove, bestLines, onClose }: Props) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      setError(null);
    }
  }, [show]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const positionIdx = currentMove.ply ?? 0;

      const result = await createFlashcard({
        gameId: game.id,
        pgn: game.pgn,
        positionIdx,
        userColor: game.userColor,
        bestLines,
      });

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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="text-gray-300">
            <p>Create a flashcard from this position?</p>
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
