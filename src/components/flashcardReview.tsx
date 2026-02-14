'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Flashcard } from '@/db/schema';
import Chessboard from '@/components/Chessboard';
import BlinkOverlay from '@/components/blinkOverlay';
import Button, { ButtonSize, ButtonStyle } from '@/components/button';
import NewMovesDisplay, { ContextMenuItems } from '@/components/newMovesDisplay';
import EngineDisplay from '@/components/engineDisplay';
import ArrowButtons from '@/components/arrowButtons';
import AltMoveModal from '@/components/altMoveModal';
import FlashcardFeedback from './flashcardFeedback';
import DeleteFlashcardModal, { DeleteStatus } from './deleteFlashcardModal';
import FlashcardEditButtons from './flashcardEditButtons';
import FlashcardDetails from './flashcardDetails';
import HintButtons from '@/components/hintButtons';
import { Arrow } from '@/components/cmChessboard';
import { MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers';
import { ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows';
import { reviewFlashcard, updateFlashcardPgn, deleteFlashcard } from '@/app/flashcards/actions';
import { ReviewQuality } from '@/utils/supermemo2';
import { useRouter } from 'next/navigation';
import { MoveJudgement, PieceColor, ShortMove, Evaluations } from '@/types/chess';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import useChessAnalyzer from '@/hooks/useChessAnalyzer';
import useEngineArrowCreator from '@/hooks/useEngineArrowCreator';
import {
  areCmMovesEqual,
  colorToMove,
  doHistoriesMatch,
  getLanLineFromCmMove,
  getLastMoveOfLine,
  getLineFromCmMove,
  isInVariation,
  loadPgnIntoCmChess,
  renderPgn,
  Marker,
} from '@/utils/cmchess';
import { Move } from 'cm-chess/src/Chess';
import {
  areLinesEqual,
  convertLanLineToShortMoves,
  judgeScores,
  judgePevAgainstBestScore,
  isMoveJudgementWorseThan,
} from '@/utils/chess';
import { LineStats, Mode } from '@/types/lesson';
import { makeLineStatsRecord, getRelevantLessonLines, getNextMoves } from '@/utils/lesson';
import { useCountdown } from '@/hooks/useCountdown';
import CountdownClock from '@/components/countdownClock';
import useWindowSize from '@/hooks/useWindowSize';
import { getRandom } from '@/utils';
import usePrevious from '@/hooks/usePrevious';
import { FEN } from 'cm-chess/src/Chess';

const MOVE_INCREMENT_SECONDS = 5;
const GOOD_JUDGEMENTS = [MoveJudgement.Best, MoveJudgement.Excellent, MoveJudgement.Good];

// TODO: Setup flashcard grading
// Easy - No mistakes and remainingTime >= starting time
// Good - No mistakes and remainingTime > 0
// Hard - No mistakes but remainingTime === 0
// Again - 1 or more mistakes

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
  const [flashcardIndex, setFlashcardIndex] = useState(0);

  const currentFlashcard = flashcards[flashcardIndex];

  if (!currentFlashcard) {
    return (
      <div className="text-center py-12 bg-background-page rounded-md">
        <p className="text-xl mb-2">All flashcards reviewed!</p>
        <p className="text-gray-400">Great job! Check back later for more reviews.</p>
      </div>
    );
  }

  const [showAnswer, setShowAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userAttemptedMove, setUserAttemptedMove] = useState<ShortMove | null>(null);
  const [opponentFirstMove, setOpponentFirstMove] = useState<Move | undefined | null>(null);
  const [moveJudgements, setMoveJudgements] = useState<MoveJudgement[]>([]);
  const [areLinesForcing, setAreLinesForcing] = useState<boolean | null>(null);
  const [lines, setLines] = useState<Record<string, LineStats>>({});
  const [wrongAnswerBlinkTrigger, setWrongAnswerBlinkTrigger] = useState(0);
  const [wrongAnswerCount, setWrongAnswerCount] = useState(0)
  const [currentMode, setCurrentMode] = useState<Mode>(Mode.Practice);
  const [showAltMoveModal, setShowAltMoveModal] = useState(false);
  const [showDeleteFlashcardModal, setShowDeleteFlashcardModal] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>(DeleteStatus.NotStarted);
  const [isReplay, setIsReplay] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [hasUserCompletedFlashcard, setHasUserCompletedFlashcard] = useState(false);
  const [numHintsGiven, setNumHintsGiven] = useState(0);
  const [numShowMovesGiven, setNumShowMovesGiven] = useState(0);
  const [boardFenOverride, setBoardFenOverride] = useState<string | undefined>(undefined);
  const [isGradingMove, setIsGradingMove] = useState(false);
  const [moveGrade, setMoveGrade] = useState<{ san: string, grade: MoveJudgement } | null>(null);

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

  const numIncompleteLinesRef = useRef<number | null>(null);
  const totalLinesRef = useRef<number | null>(null);

  const router = useRouter();

  // Create a countdown for the countdownClock component (15 seconds)
  const {
    remainingTime,
    pause: pauseClock,
    unpause: unpauseClock,
    isPaused,
    addTime: addTimeToClock,
    reset: resetClock,
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
    deleteMove,
    promoteVariationToMainLine,
    promoteVariation,
  } = useChessboardEngine();

  const [evaluations, setEvaluations] = useState<Evaluations>({});
  const [isCurrentMoveAnalysisOn, setIsCurrentMoveAnalysisOn] = useState(false);
  const [engineDepth, setEngineDepth] = useState(20);
  const [numEngineLines, setNumEngineLines] = useState(2);

  const {
    engineName,
    fenBeingAnalyzed,
    analyzeFen,
  } = useChessAnalyzer(
    evaluations,
    setEvaluations,
    isCurrentMoveAnalysisOn,
    currentMove,
    engineDepth,
    numEngineLines,
  );

  useEngineArrowCreator(
    isCurrentMoveAnalysisOn,
    evaluations,
    currentMove,
    (newArrows) => setArrows(newArrows),
  );

  const previousMove = usePrevious(currentMove);
  const previousLines = usePrevious(lines);

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
    console.log('quality', quality);
    setIsSubmitting(false);
    // try {
    //   const result = await reviewFlashcard(currentFlashcard.id, quality);

    //   if (result.success) {
    //     // Move to next flashcard or finish
    //     if (flashcardIndex < flashcards.length - 1) {
    //       setFlashcardIndex(flashcardIndex + 1);
    //       setShowAnswer(false);
    //       setUserAttemptedMove(null);
    //     } else {
    //       // All done - refresh to show updated stats
    //       router.refresh();
    //     }
    //   } else {
    //     alert(`Error: ${result.error}`);
    //   }
    // } catch (error) {
    //   console.error('Error submitting review:', error);
    //   alert('An error occurred while submitting review');
    // } finally {
    //   setIsSubmitting(false);
    // }
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


  // The user should play an alternative move if 'areLinesForcing' is true and
  // every relevantLine is complete.
  const shouldUserPlayAnAlternativeMove = useCallback((relevantLines: string[]): boolean => {
    if (!areLinesForcing) return false;
    return relevantLines.every((rLine => lines[rLine].isComplete));
  }, [areLinesForcing, lines]);

  const getJudgementOfCorrectMove = useCallback((move: Move): MoveJudgement => {
    const fc = flashcards[flashcardIndex];
    if (fc == undefined) throw new Error('flashcard was undefined');
    const i = fc.bestMoves.map((bm) => bm.moveSan).indexOf(move.san);
    if (i < 0) throw new Error('correct move not found in bestMoves');
    if (moveJudgements[i] == undefined) throw new Error('moveJudgements[i] was undefined');
    if (i === 0) return MoveJudgement.Best;
    return moveJudgements[i];
  }, [moveJudgements, flashcards, flashcardIndex])


  const handleCorrectUserMove = useCallback((relevantLines: string[]) => {
    if (currentMove == undefined) throw new Error('currentMove was undefined');

    // If areLinesForcing, then the only correct move is the best move.
    // If we have reached this point in the code, we can assume that the user
    // played the best move.
    if (areLinesForcing) {
      setMoveGrade({ san: currentMove.san, grade: MoveJudgement.Best });
    } else {
      const j = getJudgementOfCorrectMove(currentMove);
      setMoveGrade({ san: currentMove.san, grade: j });
    }

    // Check if the user should play an alternative move.
    if (shouldUserPlayAnAlternativeMove(relevantLines)) {
      if (remainingTime > 0) addTimeToClock(MOVE_INCREMENT_SECONDS);
      setShowAltMoveModal(true);
      return;
    }

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
  }, [lines, currentMove, remainingTime, addTimeToClock, setupOpponentMoveTimeout,
      shouldUserPlayAnAlternativeMove, markCurrentLineComplete, areLinesForcing]);


  const gradeMove = useCallback(async (move: Move): Promise<MoveJudgement> => {
    // TODO: Complete this
    const fc = flashcards[flashcardIndex];
    if (fc == undefined) throw new Error('flashcard was undefined');
    if (fc.bestMoves[0] == undefined) throw new Error('fc.bestLines was empty');
    const pev = await analyzeFen(move.fen);
    return judgePevAgainstBestScore(fc.bestMoves[0].score, pev);
  }, [analyzeFen, flashcards, flashcardIndex]);


  const handleMoveThatWasNotInFlashcardPgn = useCallback(async () => {
    if (currentMove == undefined) throw new Error('currentMove was undefined');
    if (areLinesForcing) {
      handleIncorrectUserMove();
    } else {
      setIsGradingMove(true);
      const judgement = await gradeMove(currentMove);
      setIsGradingMove(false);
      setMoveGrade({ san: currentMove.san, grade: judgement });
      if (isMoveJudgementWorseThan(MoveJudgement.Good, judgement)) {
        handleIncorrectUserMove();
      }
    }
  }, [currentMove, areLinesForcing, handleIncorrectUserMove, gradeMove, handleIncorrectUserMove]);


  const handleUserMove = useCallback(() => {
    // If in edit mode, we don't need to do anything.
    if (currentMode === Mode.Edit) return;

    if (currentMove == undefined) throw new Error('currentMove was undefined');
    const move: ShortMove = { from: currentMove.from, to: currentMove.to };
    setUserAttemptedMove(move);

    const relevantLines = getRelevantLessonLines(lines, currentMove);

    // If there are no relevant lines, then the user played a move that was not in
    // the flashcard pgn.
    if (relevantLines.length < 1) {
      handleMoveThatWasNotInFlashcardPgn();
      return;
    }

    // If there are relevant lines, then a correct move has been played.
    handleCorrectUserMove(relevantLines);
  }, [lines, currentMove, handleMoveThatWasNotInFlashcardPgn, handleCorrectUserMove, currentMode]);


  // Setup timeouts that will reset the board and play the opponent move
  // that will put the board back into the target position of the current
  // flashcard
  const setupResetBoardTimeouts = useCallback((delay = 800) => {
    const fc = flashcards[flashcardIndex];
    const cmhistory = cmchess.current.history();
    const newCurrentMove = cmhistory.find((m) => m.ply === fc.positionIdx - 1);
    const opponentMove = cmhistory.find((m) => m.ply === fc.positionIdx);

    resetBoardTimeoutRef.current = window.setTimeout(() => {
      setCurrentMove(newCurrentMove);
    }, delay);

    opponentMoveTimeoutRef.current = window.setTimeout(() => {
      setOpponentFirstMove(opponentMove);
    }, delay + 200);
  }, [flashcardIndex, flashcards, cmchess.current]);


  const isCurrentMoveAtEndOfALine = useCallback((): boolean => {
    const relevantLines = getRelevantLessonLines(lines, currentMove);
    const currentLine = getLineFromCmMove(currentMove);
    const matchingLine = relevantLines.find((line) => {
      const relevantLine = convertLanLineToShortMoves(line.split(' '));
      return areLinesEqual(relevantLine, currentLine);
    });
    if (matchingLine == undefined) return false;
    if (lines[matchingLine] == undefined) return false;
    return true;
  }, [lines, currentMove]);


  const handleReplayFlashcardBtnClick = useCallback((resetBoardDelay = 500) => {
    const fc = flashcards[flashcardIndex];
    setLines(makeLineStatsRecord(fc.pgn));
    setHasUserCompletedFlashcard(false);
    setIsCurrentMoveAnalysisOn(false);
    setMoveGrade(null);
    setWrongAnswerCount(0);
    setIsReplay(true);
    setupResetBoardTimeouts(resetBoardDelay);
    resetClock();
    setNumHintsGiven(0);
    setNumShowMovesGiven(0);
  }, [flashcards, flashcardIndex, setupResetBoardTimeouts, resetClock]);


  const deleteMoves = useCallback((move: Move) => {
    if (currentMode !== Mode.Edit) return;
    deleteMove(move, true);
  }, [deleteMove, currentMode]);


  const promoteToMainLine = useCallback((move: Move) => {
    if (currentMode !== Mode.Edit) return;
    promoteVariationToMainLine(move);
  }, [promoteVariationToMainLine, currentMode]);


  const promoteMoveVariation = useCallback((move: Move) => {
    if (currentMode !== Mode.Edit) return;
    promoteVariation(move);
  }, [promoteVariation, currentMode]);


  const doUnsavedFlashcardChangesExist = useCallback((): boolean => {
    const fc = flashcards[flashcardIndex];
    if (fc == undefined) return false;
    const originalHistory = loadPgnIntoCmChess(fc.pgn).history();
    return !doHistoriesMatch(originalHistory, history);
  }, [history, flashcards, flashcardIndex]);


  const discardUnsavedChanges = useCallback(() => {
    if (!doUnsavedFlashcardChangesExist()) return;
    const fc = flashcards[flashcardIndex];
    if (fc == undefined) return;
    const currentMoveLine = getLanLineFromCmMove(currentMove);
    cmchess.current.loadPgn(fc.pgn);
    const newHistory = cmchess.current.history();
    const lastCommonMove = getLastMoveOfLine(currentMoveLine, newHistory);
    setHistory(newHistory);
    setCurrentMove(lastCommonMove);
  }, [history, flashcards, flashcardIndex, currentMove]);


  const saveFlashcardPgnChanges = useCallback(async () => {
    if (!doUnsavedFlashcardChangesExist()) return;
    const pgn = renderPgn(cmchess.current);

    try {
      const result = await updateFlashcardPgn(currentFlashcard.id, pgn);

      if (result.success) {
        // Refresh the page data to reflect the saved changes
        router.refresh();
      } else {
        console.error('Error saving flashcard:', result.error);
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving flashcard PGN:', error);
      alert('An error occurred while saving changes');
    }
  }, [doUnsavedFlashcardChangesExist, currentFlashcard, router]);


  const handleConfirmedFlashcardDelete = useCallback(async () => {
    setDeleteStatus(DeleteStatus.Deleting);

    try {
      const result = await deleteFlashcard(currentFlashcard.id);

      if (result.success) {
        setDeleteStatus(DeleteStatus.Success);
      } else {
        console.error('Error deleting flashcard:', result.error);
        setDeleteStatus(DeleteStatus.Failed);
      }
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      setDeleteStatus(DeleteStatus.Failed);
    }
  }, [currentFlashcard]);


  const giveHint = useCallback(() => {
    const nextMoves = getNextMoves(lines, currentMove);
    if (nextMoves.length < 1) return;
    const uniqueFromSquares = new Set(nextMoves.map((m) => m.from));
    const newMarkers: Marker[] = [];
    uniqueFromSquares.forEach((from) => {
      newMarkers.push({ square: from, type: MARKER_TYPE.circle });
    });
    setMarkers(newMarkers);
    setNumHintsGiven((n) => n + 1);
  }, [lines, currentMove]);


  const showMoves = useCallback(() => {
    const nextMoves = getNextMoves(lines, currentMove);
    if (nextMoves.length < 1) return;
    const newArrows = nextMoves.map(
      (m) => ({ type: ARROW_TYPE.info, from: m.from, to: m.to })
    );
    setMarkers([]);
    setArrows(newArrows);
    setNumShowMovesGiven((n) => n + 1);
  }, [lines, currentMove]);


  const handleModeBtnClick = useCallback(() => {
    // Switching to Practice mode
    if (currentMode === Mode.Edit) {
      setCurrentMode(Mode.Practice);
      handleReplayFlashcardBtnClick(250);
    }

    // Switching to Edit mode
    if (currentMode === Mode.Practice) {
      pauseClock();
      discardUnsavedChanges();
      setCurrentMode(Mode.Edit);
    }
  }, [currentMode, pauseClock, handleReplayFlashcardBtnClick, discardUnsavedChanges]);


  const handleNextFlashcardBtnClick = useCallback(() => {
    if (flashcardIndex < flashcards.length - 1) {
      setBoardFenOverride(FEN.empty);
      setFlashcardIndex((i) => i + 1);
      setCurrentMode(Mode.Practice);
    }
  }, [flashcardIndex, flashcards]);


  const makeContextMenu = useCallback((): ContextMenuItems => {
    return ({
      'Delete from here forward': {
        isDisabled: (move: Move) => !areLinesForcing || move.ply <= currentFlashcard.positionIdx + 1,
        handler: (move: Move) => deleteMoves(move),
      },
      'Promote to main line': {
        isDisabled: (move: Move) => !areLinesForcing || !isInVariation(move),
        handler: (move: Move) => promoteToMainLine(move),
      },
      'Promote line': {
        isDisabled: (move: Move) => !areLinesForcing  || !isInVariation(move),
        handler: (move: Move) => promoteMoveVariation(move)
      },
    });
  }, [areLinesForcing, currentFlashcard]);


  // Whenever lines changes, update the numIncompleteLines and totalLines refs
  useEffect(() => {
    if (Object.keys(lines).length < 1) {
      numIncompleteLinesRef.current = null;
      totalLinesRef.current = null;
      return;
    }

    let numIncomplete = 0;
    let numLines = 0;
    Object.values(lines).forEach((v) => {
      numLines++;
      if (!v.isComplete) numIncomplete++;
    });
    numIncompleteLinesRef.current = numIncomplete;
    totalLinesRef.current = numLines;
  }, [lines]);


  // When lines changes...
  useEffect(() => {
    if (previousLines === lines) return;
    if (numIncompleteLinesRef.current === null) return;
    if (totalLinesRef.current === null) return;

    const haveAnyLinesBeenCompleted = numIncompleteLinesRef.current < totalLinesRef.current;

    // If areLinesForcing is true, then the user has to complete every line in the pgn.
    // If there are incomplete lines, reset the board so the user can solve the next line.
    if (areLinesForcing) {
      // If there are incomplete lines and at least one line has been completed,
      // that means that the user just solved a line but there are more lines
      // left to be solved.
      if (numIncompleteLinesRef.current > 0 && haveAnyLinesBeenCompleted) {
        // Add time to the clock if time hasn't run out
        if (remainingTime > 0) addTimeToClock(MOVE_INCREMENT_SECONDS);
        setupResetBoardTimeouts();
      }
    }

    // If there are no incomplete lines, then the flashcard is complete.
    // Also, if areLinesForcing is false (aka this is not a forcing line flashcard) and
    // ANY lines have been completed, then the flashcard is complete.
    if (numIncompleteLinesRef.current === 0 || (!areLinesForcing && haveAnyLinesBeenCompleted)) {
      // Pause the clock and mark the flashcard complete
      pauseClock();
      setHasUserCompletedFlashcard(true);
    }
  }, [lines, areLinesForcing, previousLines, setupResetBoardTimeouts, pauseClock]);


  // When the flashcardIndex changes...
  useEffect(() => {
    resetChessboardEngine();
    setIsReplay(false);
    setWrongAnswerCount(0);
    setHasUserCompletedFlashcard(false);
    setMoveGrade(null);
    setNumHintsGiven(0);
    setNumShowMovesGiven(0);
    numIncompleteLinesRef.current = null;
    totalLinesRef.current = null;

    const fc = flashcards[flashcardIndex];
    if (fc != undefined) {
      if (fc.bestMoves.length < 2) throw new Error('flashcard has fewer than two elements in bestMoves');
      const judgements = judgeScores(fc.userColor, fc.bestMoves.map(({score}) => score));
      setMoveJudgements(judgements);

      // If the judgement of the second best move is one of the GOOD_JUDGEMENTS,
      // that means that there are at least two 'good enough' answers to this flashcard.
      // In that case, set areLinesForcing to false. Otherwise, set areLinesForcing to true.
      if (GOOD_JUDGEMENTS.includes(judgements[1])) {
        setAreLinesForcing(false);
      } else {
        setAreLinesForcing(true);
      }

      // Reset the clock for the new flashcard
      resetClock();

      loadPgnIntoCmChess(fc.pgn, cmchess.current);
      const cmhistory = cmchess.current.history();
      setHistory(cmhistory);

      // Set to one move before the target position so that we can animate into
      // the target position.
      setCurrentMove(cmhistory.find((m) => m.ply === fc.positionIdx - 1));
      setOpponentFirstMove(cmhistory.find((m) => m.ply === fc.positionIdx));
      setLines(makeLineStatsRecord(fc.pgn))
      setBoardFenOverride(undefined);
    } else {
      setMoveJudgements([]);
      setAreLinesForcing(null);
      setOpponentFirstMove(null);
      setLines({});
    }
  }, [flashcardIndex, resetClock]);


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


  // When wrongAnswerCount changes...
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
    // If currentMove hasn't changed, do nothing
    if (areCmMovesEqual(currentMove, previousMove)) return;

    // If this is the end of a line, do nothing
    if (isCurrentMoveAtEndOfALine()) return;

    // Do nothing if not in Practice mode
    if (currentMode !== Mode.Practice) return;

    // Toggle the pause state of the clock based on if it is the user's turn or not
    isUsersTurn() ? unpauseClock() : pauseClock();
  }, [isUsersTurn, currentMode]);


  // This useEffect handles the situation where a line ends with an opponent move.
  // It should mark the line complete.
  useEffect(() => {
    // If currentMove hasn't changed, do nothing
    if (areCmMovesEqual(currentMove, previousMove)) return;

    // If not in practice mode, do nothing
    if (currentMode !== Mode.Practice) return;

    // If it is not the user's turn, do nothing.
    if (colorToMove(currentMove) !== flashcards[flashcardIndex].userColor) return;

    // If there are nextMoves, then there are still moves to be played.
    // In that case, do nothing.
    const nextMoves = getNextMoves(lines, currentMove, {incompleteLinesOnly: true});
    if (nextMoves.length > 0) return;

    // If we have reached this point, then a line has been completed.
    markCurrentLineComplete();
  }, [lines, currentMove, flashcards, flashcardIndex, currentMode])


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
    <NewMovesDisplay
      history={history}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      useMobileLayout={false}
      showVariations={true}
      contextMenu={makeContextMenu()}
    />
  );

  const arrowButtons = (
    <ArrowButtons
      history={history}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      marginTop={0}
    />
  );

  const rightColumnWidth = 300;
  const columnGapWidth = 8;
  const mainDivWidth = boardSize + rightColumnWidth + columnGapWidth;

  const engineDisplay = (
    <EngineDisplay
      isEngineOn={isCurrentMoveAnalysisOn}
      setIsEngineOn={(b) => setIsCurrentMoveAnalysisOn(b)}
      evaluations={evaluations}
      currentMove={currentMove}
      engineMaxDepth={engineDepth}
      engineName={engineName ? engineName : undefined}
      isEvaluating={fenBeingAnalyzed != null}
      maxLineLengthPx={rightColumnWidth}
      numLines={numEngineLines}
      isSwitchDisabled={currentMode === Mode.Practice}
      switchDisabledTooltip='Complete the flashcard to unlock the engine'
      showMoveJudgements={false}
      colorLineScores={true}
    />
  );


  return (
    <div className="flex flex-col items-center gap-3" style={{ width: mainDivWidth }}>

      {/* First row  */}
      <div className="flex flex-row w-full max-w-[1400px]">

        {/* Left Column - Chessboard */}
        <div className="relative" style={{ width: boardSize }}>
          <BlinkOverlay blinkCount={wrongAnswerBlinkTrigger} />
          <AltMoveModal
            show={showAltMoveModal}
            onClose={() => {
              setShowAltMoveModal(false);
              performWrongAnswerActions({ indicateThatTheMoveWasWrong: false });
            }}
          />
          <DeleteFlashcardModal
            show={showDeleteFlashcardModal}
            onClose={() => {
              setShowDeleteFlashcardModal(false);
              setDeleteStatus(DeleteStatus.NotStarted);
            }}
            onNextFlashcardBtnClick={() => console.log('next flashcard')}
            onConfirmedFlashcardDelete={handleConfirmedFlashcardDelete}
            deleteStatus={deleteStatus}
          />
          <Chessboard
            currentMove={currentMove}
            boardSize={boardSize}
            orientation={currentFlashcard.userColor}
            allowInteraction={currentMode === Mode.Edit ? true : isUsersTurn()}
            playMove={playMove}
            afterUserMove={handleUserMove}
            animate={true}
            markers={markers}
            fenOverride={boardFenOverride}
            arrows={arrows}
          />
        </div>

        {/* Right column */}
        <div className="flex justify-end" style={{width: rightColumnWidth + columnGapWidth}}>
          <div className="flex" style={{width: rightColumnWidth, height: boardSize }}>
            <div className="flex flex-col items-center w-full flex-1 gap-2">
              {currentMode === Mode.Edit && (
                <>
                  <div className="flex bg-background-page w-full rounded-md min-h-4">
                    {engineDisplay}
                  </div>
                  <div className="flex flex-col w-full flex-1 min-h-0 overflow-y-scroll no-scrollbar">
                    {movesDisplay}
                  </div>
                  <FlashcardEditButtons
                    onDiscardChangesBtnClick={discardUnsavedChanges}
                    onSaveChangesBtnClick={saveFlashcardPgnChanges}
                    onDeleteFlashcardBtnClick={() => setShowDeleteFlashcardModal(true)}
                    doUnsavedChangesExist={doUnsavedFlashcardChangesExist()}
                    showSaveAndUndoBtns={areLinesForcing === true}
                  />
                </>
              )}
              {currentMode !== Mode.Edit && (
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex flex-col gap-4 w-full bg-background-page rounded-md p-2 text-center">
                    <h1 className="text-2xl font-bold">Flashcard Review</h1>
                    <p>Card {flashcardIndex + 1} of {flashcards.length}</p>
                    <div className="flex gap-4 text-sm text-gray-400 justify-center">
                      <div>Total: <span className="font-semibold text-foreground">{stats.total}</span></div>
                      <div>Due: <span className="font-semibold text-foreground">{stats.due}</span></div>
                      <div>Learning: <span className="font-semibold text-foreground">{stats.learning}</span></div>
                      <div>Mature: <span className="font-semibold text-foreground">{stats.mature}</span></div>
                    </div>
                  </div>
                  <FlashcardDetails flashcard={currentFlashcard} />
                  <FlashcardFeedback
                    dueFlashcards={flashcards}
                    flashcardIndex={flashcardIndex}
                    currentMove={currentMove}
                    isFlashcardComplete={hasUserCompletedFlashcard}
                    onReplayFlashcardBtnClick={handleReplayFlashcardBtnClick}
                    onNextFlashcardBtnClick={() => {
                      setBoardFenOverride(FEN.empty);
                      setFlashcardIndex((i) => i + 1);
                    }}
                    numWrongAnswers={wrongAnswerCount}
                    numHintsGiven={numHintsGiven}
                    numShowMovesGiven={numShowMovesGiven}
                    isGradingMove={isGradingMove}
                    moveGrade={moveGrade}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Second Row  */}
      <div className="flex flex-row w-full max-w-[1400px]">

        {/* Left Column */}
        <div className="relative" style={{ width: boardSize }}>
          <div className="flex justify-center">
            <div className="flex flex-1 justify-between items-center">
              <div className="basis-32">
                <HintButtons
                  currentMove={currentMove}
                  giveHint={giveHint}
                  showMove={showMoves}
                  hintButtonText="Show Hint"
                  showButtonText="Show Move"
                  buttonSize={ButtonSize.Normal}
                />
              </div>
              <div className="ml-auto mr-auto">
                {currentMode === Mode.Practice && (
                  <Button
                    onClick={handleModeBtnClick}
                    disabled={!hasUserCompletedFlashcard}
                  >
                    Edit Flashcard
                  </Button>
                )}
                {currentMode === Mode.Edit && (
                  <div className="flex flex-row gap-4">
                    <Button onClick={handleModeBtnClick}>
                      Replay
                    </Button>
                    {(hasUserCompletedFlashcard && flashcardIndex < flashcards.length - 1) && (
                      <Button buttonStyle={ButtonStyle.Primary} onClick={handleNextFlashcardBtnClick}>
                        Next Flashcard
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end basis-32">
                <CountdownClock remainingTime={remainingTime} isPaused={isPaused} />
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex justify-center" style={{width: rightColumnWidth, marginLeft: columnGapWidth}}>
            {currentMode === Mode.Edit && arrowButtons}
        </div>
      </div>

      {/*
      <div>
        {// Review Section }
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
              {currentFlashcard.bestLines.length > 0 && (
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

              {// Rating buttons }
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

        {// Stats reminder }
        <div className="text-xs text-gray-500">
          Remaining today: {stats.due - flashcardIndex - 1}
        </div>
      </div>
      */}
    </div>
  );
};

export default FlashcardReview;
