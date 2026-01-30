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
import { areCmMovesEqual, colorToMove, getLineFromCmMove, loadPgnIntoCmChess } from '@/utils/cmchess';
import { Move } from 'cm-chess/src/Chess';
import { areLinesEqual, convertLanLineToShortMoves, judgeLines } from '@/utils/chess';
import { LineStats, Mode } from '@/types/lesson';
import { makeLineStatsRecord, getRelevantLessonLines, getNextMoves } from '@/utils/lesson';
import { useCountdown } from '@/hooks/useCountdown';
import CountdownClock from '@/components/countdownClock';
import useWindowSize from '@/hooks/useWindowSize';
import { getRandom } from '@/utils';
import usePrevious from '@/hooks/usePrevious';

const MOVE_INCREMENT_SECONDS = 5;

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

  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userAttemptedMove, setUserAttemptedMove] = useState<ShortMove | null>(null);
  const [opponentFirstMove, setOpponentFirstMove] = useState<Move | undefined | null>(null);
  const [lineJudgements, setLineJudgements] = useState<MoveJudgement[]>([]);
  const [lines, setLines] = useState<Record<string, LineStats>>({});
  const [wrongAnswerBlinkTrigger, setWrongAnswerBlinkTrigger] = useState(0);
  const [wrongAnswerCount, setWrongAnswerCount] = useState(0)
  const [currentMode, setCurrentMode] = useState<Mode>(Mode.Practice);
  const [numIncompleteLines, setNumIncompleteLines] = useState<number | null>(null);
  const [totalLines, setTotalLines] = useState<number | null>(null);

  const opponentMoveTimeoutRef = useRef<number>(0);
  const wrongAnswerBlinkTimeoutRef = useRef<number>(0);
  const undoMoveTimeoutRef = useRef<number>(0);
  const resetBoardTimeoutRef = useRef<number>(0);

  // Put all the timeouts into an array for easy cleanup
  const timeoutRefs = [
    opponentMoveTimeoutRef,
    wrongAnswerBlinkTimeoutRef,
    undoMoveTimeoutRef,
    resetBoardTimeoutRef,
  ]

  const currentFlashcard = flashcards[flashcardIndex];

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
    pause: pauseClock,
    unpause: unpauseClock,
    isPaused,
    addTime: addTimeToClock,
  } = useCountdown(15);

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
    const fc = flashcards[flashcardIndex];
    if (fc == undefined) return false;
    const ply = currentMove ? currentMove.ply : 0;
    if (ply % 2 === 0) {
      return fc.userColor === PieceColor.WHITE;
    } else {
      return fc.userColor == PieceColor.BLACK;
    }
  }, [flashcardIndex, currentMove, flashcards]);


  const handleReveal = () => {
    setShowAnswer(true);
  };


  const handleRate = async (quality: ReviewQuality) => {
    setIsSubmitting(true);
    try {
      const result = await reviewFlashcard(currentFlashcard.id, quality);

      if (result.success) {
        // Move to next flashcard or finish
        if (flashcardIndex < flashcards.length - 1) {
          setFlashcardIndex(flashcardIndex + 1);
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


  const handleIncorrectUserMove = useCallback(() => {
    performWrongAnswerActions();
  }, []);


  const setupOpponentMoveTimeout = useCallback((nextMoves: ShortMove[]) => {
    if (nextMoves.length < 1) throw new Error('nextMoves cannot be empty');
    if (colorToMove(currentMove) === flashcards[flashcardIndex].userColor) {
      throw new Error("Cannot setup opponent move timeout if it is not the opponent's turn");
    }

    // Pick a random next move (which should be an opponent move) and set up a timeout
    // that will play the move after a short delay.
    const nextMove = getRandom(nextMoves);
    opponentMoveTimeoutRef.current = window.setTimeout(() => {
      playMove(nextMove!);
    }, 800);
  }, [playMove, currentMove, flashcards, flashcardIndex]);


  const markCurrentLineComplete = useCallback(() => {
    const relevantLines = getRelevantLessonLines(lines, currentMove, { incompleteLinesOnly: true })
    const currentLine = getLineFromCmMove(currentMove);
    const matchingLine = relevantLines.find((line) => {
      const relevantLine = convertLanLineToShortMoves(line.split(' '));
      return areLinesEqual(relevantLine, currentLine);
    });
    if (matchingLine == undefined) {
      console.warn('matchingLine was undefined');
      return;
    }
    if (lines[matchingLine] == undefined) throw new Error('Line not found');
    if (lines[matchingLine].isComplete) return;
    const newLines = { ...lines };
    newLines[matchingLine].isComplete = true;
    setLines(newLines);
  }, [lines, currentMove]);


  const handleCorrectUserMove = useCallback(() => {
    // TODO: Handle alternative moves here

    const nextMoves = getNextMoves(lines, currentMove, {incompleteLinesOnly: true});

    // If there are nextMoves, then there are still moves to be played.
    if (nextMoves.length > 0) {
      // At this point, the user has played a correct move but there are more moves to play.
      // If time hasn't expired, add 5 seconds to the countdown clock.
      if (remainingTime > 0) addTimeToClock(MOVE_INCREMENT_SECONDS);
      setupOpponentMoveTimeout(nextMoves);
      return;
    }

    // If we have reached this point, then a line has been completed.
    markCurrentLineComplete();
  }, [lines, currentMove, remainingTime, setupOpponentMoveTimeout, markCurrentLineComplete]);


  const handleUserMove = useCallback(() => {
    // setUserAttemptedMove(move); - TODO: This is claude code

    const relevantLines = getRelevantLessonLines(lines, currentMove);

    // If there are no relevant lines, the user's move was incorrect
    if (relevantLines.length < 1) {
      handleIncorrectUserMove();
      return;
    }

    // If there are relevant lines, then a correct move has been played.
    handleCorrectUserMove();
  }, [lines, currentMove, handleIncorrectUserMove, handleCorrectUserMove]);


  // Setup timeouts that will reset the board and play the opponent move
  // that will put the board back into the target position of the current
  // flashcard
  const setupResetBoardTimeouts = useCallback(() => {
    const fc = flashcards[flashcardIndex];
    const cmhistory = cmchess.current.history();
    const newCurrentMove = cmhistory.find((m) => m.ply === fc.positionIdx - 1);
    const opponentMove = cmhistory.find((m) => m.ply === fc.positionIdx);

    resetBoardTimeoutRef.current = window.setTimeout(() => {
      setCurrentMove(newCurrentMove);
    }, 800);

    opponentMoveTimeoutRef.current = window.setTimeout(() => {
      setOpponentFirstMove(opponentMove);
    }, 1000);
  }, [flashcardIndex, flashcards, cmchess.current]);


  const handleEditBtnClick = useCallback(() => {
    if (currentMode === Mode.Edit) {
      setCurrentMode(Mode.Practice);
    }
    if (currentMode === Mode.Practice) {
      setCurrentMode(Mode.Edit);
    }
  }, [currentMode]);


  // Whenever lines changes, update the numIncompleteLines and totalLines state values
  useEffect(() => {
    if (Object.keys(lines).length < 1) {
      setNumIncompleteLines(null);
      setTotalLines(null);
      return;
    }

    let numIncomplete = 0;
    let numLines = 0;
    Object.values(lines).forEach((v) => {
      numLines++;
      if (!v.isComplete) numIncomplete++;
    });
    setNumIncompleteLines(numIncomplete);
    setTotalLines(numLines);
  }, [lines]);


  // When numIncompleteLines or totalLines changes...
  useEffect(() => {
    if (numIncompleteLines === null) return;
    if (totalLines === null) return;

    // If there are incomplete lines and numIncompleteLines < totalLines,
    // that means that the user just solved a line but there are more lines
    // left to be solved.
    if (numIncompleteLines > 0 && numIncompleteLines < totalLines) {
      // Add time to the clock if time hasn't run out
      if (remainingTime > 0) addTimeToClock(MOVE_INCREMENT_SECONDS);
      setupResetBoardTimeouts();
    }

    if (numIncompleteLines === 0) {
      console.log('complete!');
    }
  }, [numIncompleteLines, totalLines, setupResetBoardTimeouts]);


  useEffect(() => {
    resetChessboardEngine();
    const fc = flashcards[flashcardIndex];
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
      setOpponentFirstMove(cmhistory.find((m) => m.ply === fc.positionIdx));
      setLines(makeLineStatsRecord(fc.pgn))
    } else {
      setLineJudgements([]);
      setOpponentFirstMove(null);
      setLines({});
      setWrongAnswerCount(0);
    }
  }, [flashcardIndex]);


  // Play the opponent move after a slight delay
  useEffect(() => {
    if (opponentFirstMove) {
      opponentMoveTimeoutRef.current = window.setTimeout(() => {
        setCurrentMove(opponentFirstMove);
        setOpponentFirstMove(null);
      }, 1000);
    }

    // Cleanup: clear the timeout
    return () => {
      if (opponentMoveTimeoutRef.current !== 0) {
        window.clearTimeout(opponentMoveTimeoutRef.current);
        opponentMoveTimeoutRef.current = 0;
      }
    };
  }, [opponentFirstMove]);


  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.forEach((timeoutRef) => {
        if (timeoutRef.current !== 0) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = 0;
        }
      })
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
    isUsersTurn() ? unpauseClock() : pauseClock();
  }, [isUsersTurn]);


  // This useEffect handles the situation where a line ends with an opponent move.
  // It should mark the line complete.
  useEffect(() => {
    // If currentMove hasn't changed, do nothing
    if (areCmMovesEqual(currentMove, previousMove)) return;

    // If it is not the user's turn, do nothing.
    if (colorToMove(currentMove) !== flashcards[flashcardIndex].userColor) return;

    // If there are nextMoves, then there are still moves to be played.
    // In that case, do nothing.
    const nextMoves = getNextMoves(lines, currentMove, {incompleteLinesOnly: true});
    if (nextMoves.length > 0) return;

    // If we have reached this point, then a line has been completed.
    markCurrentLineComplete();
  }, [lines, currentMove, flashcards, flashcardIndex])


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

  const movesDisplay = (
    <MovesDisplay
      history={history}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      useMobileLayout={false}
      showVariations={true}
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
              <p>Card {flashcardIndex + 1} of {flashcards.length}</p>
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
          Remaining today: {stats.due - flashcardIndex - 1}
        </div>
      </div>
    </div>
  );
};

export default FlashcardReview;
