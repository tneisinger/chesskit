'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Flashcard } from '@/db/schema';
import Chessboard from '@/components/Chessboard';
import Button, { ButtonStyle } from '@/components/button';
import { reviewFlashcard } from '@/app/flashcards/actions';
import { ReviewQuality } from '@/utils/supermemo2';
import { useRouter } from 'next/navigation';
import { MoveJudgement, PieceColor, ShortMove } from '@/types/chess';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import { loadPgnIntoCmChess } from '@/utils/cmchess';
import { Move } from 'cm-chess/src/Chess';
import { judgeLines } from '@/utils/chess';

interface Props {
  flashcards: Flashcard[];
  stats: {
    total: number;
    due: number;
    learning: number;
    mature: number;
  };
}

const FlashcardReview = ({ flashcards, stats }: Props) => {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userAttemptedMove, setUserAttemptedMove] = useState<ShortMove | null>(null);
  const [opponentMove, setOpponentMove] = useState<Move | undefined | null>(null);
  const [lineJudgements, setLineJudgements] = useState<MoveJudgement[]>([]);

  const timeoutRef = useRef<number>(0);

  const currentFlashcard = flashcards[currentIndex];

  if (!currentFlashcard) {
    return (
      <div className="text-center py-12 bg-background-page rounded-md">
        <p className="text-xl mb-2">All flashcards reviewed!</p>
        <p className="text-gray-400">Great job! Check back later for more reviews.</p>
      </div>
    );
  }

  const {
    cmchess,
    history,
    setHistory,
    currentMove,
    setCurrentMove,
    playMove,
    reset,
  } = useChessboardEngine();

  const isUsersTurn = useCallback(() => {
    const fc = flashcards[currentIndex];
    if (fc == undefined) return false;
    const ply = currentMove ? currentMove.ply : 0;
    if (ply % 2 === 0) {
      return fc.userColor === PieceColor.WHITE;
    } else {
      return fc.userColor == PieceColor.BLACK;
    }
  }, [currentIndex, currentMove]);

  useEffect(() => {
    reset();
    const fc = flashcards[currentIndex];
    if (fc) {
      if (fc.bestLines) {
        setLineJudgements(judgeLines(fc.userColor, fc.bestLines));
      }
      loadPgnIntoCmChess(fc.pgn, cmchess.current);
      const cmhistory = cmchess.current.history();
      setHistory(cmhistory);

      // Set to one move before the target position so that we can animate into
      // the target position.
      setCurrentMove(cmhistory.find((m) => m.ply === fc.positionIdx - 1));
      setOpponentMove(cmhistory.find((m) => m.ply === fc.positionIdx));
    } else {
      setLineJudgements([]);
      setOpponentMove(null);
    }
  }, [currentIndex]);

  useEffect(() => {
    if (opponentMove) {
      timeoutRef.current = window.setTimeout(() => {
        setCurrentMove(opponentMove);
        setOpponentMove(null);
      }, 1000);
    }

    // Cleanup: clear timeouts
    return () => {
      if (timeoutRef.current !== 0) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = 0;
      }
    };
  }, [opponentMove]);

  const handleReveal = () => {
    setShowAnswer(true);
  };

  const handleRate = async (quality: ReviewQuality) => {
    setIsSubmitting(true);

    try {
      const result = await reviewFlashcard(currentFlashcard.id, quality);

      if (result.success) {
        // Move to next flashcard or finish
        if (currentIndex < flashcards.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setShowAnswer(false);
          setUserAttemptedMove(null);
        } else {
          // All done - refresh to show updated stats
          router.refresh();
        }
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('An error occurred while submitting review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserMove = (move: ShortMove) => {
    setUserAttemptedMove(move);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Progress indicator */}
      <div className="text-sm text-gray-400">
        Card {currentIndex + 1} of {flashcards.length}
      </div>

      {/* Chessboard */}
      <div className="w-full max-w-xl">
        <Chessboard
          currentMove={currentMove}
          boardSize={600}
          orientation={currentFlashcard.userColor}
          allowInteraction={isUsersTurn()}
          playMove={playMove}
          afterUserMove={handleUserMove}
          animate={true}
        />
      </div>

      {/* Review Section */}
      <div className="bg-background-page p-6 rounded-md w-full max-w-xl">
        <h2 className="text-lg font-semibold mb-4">Find the best move</h2>

        {userAttemptedMove && !showAnswer && (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500 rounded">
            <p className="text-sm text-blue-200">
              You played: {userAttemptedMove.from}{userAttemptedMove.to}
              {userAttemptedMove.promotion || ''}
            </p>
          </div>
        )}

        {showAnswer ? (
          <>
            {currentFlashcard.bestLines && currentFlashcard.bestLines.length > 0 && (
              <>
                <h3 className="text-md font-semibold mb-2">Best Lines:</h3>
                <div className="space-y-2 mb-4">
                  {currentFlashcard.bestLines.map((line, idx) => (
                    <div key={idx} className="p-2 bg-background rounded border border-gray-600">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Line {idx + 1}</span>
                        <span className="text-xs font-mono text-gray-300">
                          {line.score.key === 'cp'
                            ? `${(line.score.value / 100).toFixed(2)}`
                            : `M${line.score.value}`}
                        </span>
                      </div>
                      <p className="text-sm font-mono text-foreground">{line.lanLine}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Rating buttons */}
            <div className="mt-6">
              <p className="text-sm mb-3 text-gray-400">How well did you know this?</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleRate(ReviewQuality.Again)}
                  disabled={isSubmitting}
                  buttonStyle={ButtonStyle.Normal}
                >
                  Again
                  <span className="block text-xs text-gray-400">Forgot completely</span>
                </Button>
                <Button
                  onClick={() => handleRate(ReviewQuality.Hard)}
                  disabled={isSubmitting}
                  buttonStyle={ButtonStyle.Normal}
                >
                  Hard
                  <span className="block text-xs text-gray-400">Difficult recall</span>
                </Button>
                <Button
                  onClick={() => handleRate(ReviewQuality.Good)}
                  disabled={isSubmitting}
                  buttonStyle={ButtonStyle.Normal}
                >
                  Good
                  <span className="block text-xs text-gray-400">Correct with effort</span>
                </Button>
                <Button
                  onClick={() => handleRate(ReviewQuality.Easy)}
                  disabled={isSubmitting}
                  buttonStyle={ButtonStyle.Primary}
                >
                  Easy
                  <span className="block text-xs text-gray-400">Perfect recall</span>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Button
            onClick={handleReveal}
            buttonStyle={ButtonStyle.Primary}
            disabled={isSubmitting}
          >
            Show Answer
          </Button>
        )}
      </div>

      {/* Stats reminder */}
      <div className="text-xs text-gray-500">
        Remaining today: {stats.due - currentIndex - 1}
      </div>
    </div>
  );
};

export default FlashcardReview;
