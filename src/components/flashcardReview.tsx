'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Flashcard } from '@/db/schema';
import Chessboard from '@/components/Chessboard';
import BlinkOverlay from '@/components/blinkOverlay';
import Button, { ButtonStyle } from '@/components/button';
import MovesDisplay from '@/components/movesDisplay';
import { reviewFlashcard } from '@/app/flashcards/actions';
import { ReviewQuality } from '@/utils/supermemo2';
import { useRouter } from 'next/navigation';
import { MoveJudgement, PieceColor, ShortMove } from '@/types/chess';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import { areCmMovesEqual, loadPgnIntoCmChess } from '@/utils/cmchess';
import { Move } from 'cm-chess/src/Chess';
import { judgeLines } from '@/utils/chess';
import { LineStats, Mode } from '@/types/lesson';
import { makeLineStatsRecord, getRelevantLessonLines, getNextMoves } from '@/utils/lesson';
import usePrevious from '@/hooks/usePrevious';
import { useCountdown } from '@/hooks/useCountdown';
import CountdownClock from '@/components/countdownClock';
import useWindowSize from '@/hooks/useWindowSize';
import { getRandom } from '@/utils';

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
  const [lines, setLines] = useState<Record<string, LineStats>>({});
  const [recentlyCompletedLine, setRecentlyCompletedLine] = useState<string | null>(null);
  const [wrongAnswerBlinkTrigger, setWrongAnswerBlinkTrigger] = useState(0);
  const [wrongAnswerCount, setWrongAnswerCount] = useState(0)
  const [currentMode, setCurrentMode] = useState<Mode>(Mode.Practice);

  const timeoutRef = useRef<number>(0);
  const wrongAnswerBlinkTimeoutRef = useRef<number>(0);
  const undoMoveTimeoutRef = useRef<number>(0);

  const currentFlashcard = flashcards[currentIndex];

  if (!currentFlashcard) {
    return (
      <div className="text-center py-12 bg-background-page rounded-md">
        <p className="text-xl mb-2">All flashcards reviewed!</p>
        <p className="text-gray-400">Great job! Check back later for more reviews.</p>
      </div>
    );
  }

  // Create a countdown for the countdownClock component (15 seconds)
  const {
    remainingTime,
    pause,
    unpause,
    reset: resetCountdown,
    isPaused,
    addTime,
  } = useCountdown(15);

  // Determine the board size
  const maxBoardSize = 600;
  const windowSize = useWindowSize();
  let boardSize: number;
  if (windowSize.width && windowSize.width < maxBoardSize) {
    boardSize = windowSize.width;
  } else {
    if (windowSize.width == undefined || windowSize.height == undefined) {
      boardSize = maxBoardSize;
    } else {
      // These values are based on the current layout and will need to updated if the
      // layout changes.
      const maxBoardWidth = Math.min(maxBoardSize, windowSize.width - 625);
      const maxBoardHeight = Math.min(maxBoardSize, windowSize.height - 175);
      boardSize = Math.min(maxBoardWidth, maxBoardHeight);
    }
  }

  const {
    cmchess,
    history,
    setHistory,
    currentMove,
    setCurrentMove,
    playMove,
    reset: resetChessboardEngine,
    undoLastMove,
  } = useChessboardEngine();

  const previousMove = usePrevious(currentMove);

  const performWrongAnswerActions = useCallback((options?: {indicateThatTheMoveWasWrong: boolean}) => {
    // By default, indicate that the move was wrong.
    if (options === undefined || options.indicateThatTheMoveWasWrong) {
      setWrongAnswerCount((blinkCount) => blinkCount + 1);
    } else {
      if (currentMove) undoLastMove();
    }
  }, [currentMove, undoLastMove]);

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
    resetChessboardEngine();
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
      setLines(makeLineStatsRecord(fc.pgn))
    } else {
      setLineJudgements([]);
      setOpponentMove(null);
      setLines({});
      setRecentlyCompletedLine(null);
      setWrongAnswerCount(0);
    }
  }, [currentIndex]);

  // Play the opponent move after a slight delay
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== 0) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = 0;
      }
    }
  }, []);

  useEffect(() => {
    // This prevents undoLastMove() from running on the initial render
    if (wrongAnswerCount < 1) return;

    wrongAnswerBlinkTimeoutRef.current = window.setTimeout(() => {
      const audio = new Audio('/assets/sound/incorrectWren.mp3');
      audio.play().catch(err => console.error('Error playing sound:', err));
      setWrongAnswerBlinkTrigger((v) => v + 1);
    }, 300);

    undoMoveTimeoutRef.current = window.setTimeout(() => {
      undoLastMove();
    }, 1300);

    // Cleanup: clear timeouts if effect re-runs or component unmounts
    return () => {
      if (wrongAnswerBlinkTimeoutRef.current !== 0) {
        window.clearTimeout(wrongAnswerBlinkTimeoutRef.current);
        wrongAnswerBlinkTimeoutRef.current = 0;
      }
      if (undoMoveTimeoutRef.current !== 0) {
        window.clearTimeout(undoMoveTimeoutRef.current);
        undoMoveTimeoutRef.current = 0;
      }
    };
  }, [wrongAnswerCount]);

  useEffect(() => {
    isUsersTurn() ? unpause() : pause();
  }, [isUsersTurn]);

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

  const handleUserMove = useCallback(() => {
    // setUserAttemptedMove(move); - TODO: This is claude code

    const relevantLines = getRelevantLessonLines(lines, currentMove);

    // If there are no relevant lines, the user has made a mistake.
    // Perform wrong answer actions and do nothing else.
    if (relevantLines.length < 1) {
      performWrongAnswerActions();
      return;
    }

    // If there are relevant lines, then a correct move has been played.
    // TODO: Handle alternative moves here

    const nextMoves = getNextMoves(lines, currentMove, {incompleteLinesOnly: true});

    // If there are nextMoves, then we need to schedule an opponent move to be played.
    if (nextMoves.length > 0) {
      // At this point, the user has played a correct move but there are more moves to play.

      // If time hasn't expired, add 5 seconds to the countdown clock.
      if (remainingTime > 0) addTime(5);

      // Pick a random next move (which should be an opponent move) and set up a timeout
      // that will play the move after a short delay.
      const nextMove = getRandom(nextMoves);
      timeoutRef.current = window.setTimeout(() => {
        playMove(nextMove!);
      }, 800);
    } else {
      console.log('line complete!!!');
    }
  }, [lines, currentMove, remainingTime]);

  const handleEditBtnClick = useCallback(() => {
    if (currentMode === Mode.Edit) {
      setCurrentMode(Mode.Practice);
    }
    if (currentMode === Mode.Practice) {
      setCurrentMode(Mode.Edit);
    }
  }, [currentMode]);

  const movesDisplay = (
    <MovesDisplay
      history={history}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      useMobileLayout={false}
      showVariations={false}
    />
  );

  return (
    <div className="flex flex-col items-center gap-3" style={{ width: boardSize + 500 }}>

      {/* First row - Board is center column  */}
      <div className="flex flex-row w-full max-w-[1400px] gap-3">

        {/* Left Column */}
        <div className="flex flex-col items-center flex-1">
          {currentMode === Mode.Edit && (
            <div className="text-sm text-gray-400 w-full bg-background-page">
              <p>Card Details</p>
              <p>Card {currentIndex + 1} of {flashcards.length}</p>
            </div>
          )}
        </div>

        {/* Center Column - Chessboard */}
        <div className="relative" style={{ width: boardSize }}>
          <BlinkOverlay blinkCount={wrongAnswerBlinkTrigger} />
          <Chessboard
            currentMove={currentMove}
            boardSize={boardSize}
            orientation={currentFlashcard.userColor}
            allowInteraction={isUsersTurn()}
            playMove={playMove}
            afterUserMove={handleUserMove}
            animate={true}
          />
        </div>

        {/* Right column */}
        <div className="flex flex-col items-center flex-1">
          {currentMode === Mode.Edit && (
            <div className="my-1 rounded-md p-1 w-full flex-1 min-h-0 overflow-y-scroll no-scrollbar bg-background-page">
              {movesDisplay}
            </div>
          )}
        </div>
      </div>

      {/* Second Row  */}
      <div className="flex flex-row w-full max-w-[1400px] gap-3">

        {/* Left Column */}
        <div className="flex flex-col items-center flex-1">
        </div>

        {/* Center Column */}
        <div className="relative" style={{ width: boardSize }}>
          <div className="flex justify-center">
            <div className="flex flex-1 justify-between">
              <Button onClick={handleEditBtnClick} >
                {currentMode !== Mode.Edit ? ( 'Edit Flashcard') : ( 'Stop Editing')}
              </Button>
            </div>
            <CountdownClock remainingTime={remainingTime} isPaused={isPaused} />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col items-center flex-1">
        </div>

      </div>

      <div>
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
    </div>
  );
};

export default FlashcardReview;
