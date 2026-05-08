'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
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
import { useFlashcardContext } from '@/contexts/FlashcardContext';
import { MoveJudgement, PieceColor, ShortMove } from '@/types/chess';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import useCurrentMoveAnalyzer from '@/hooks/useCurrentMoveAnalyzer';
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
  isMoveJudgementAtLeast,
  sanToShortMove,
  convertSanLineToShortMoves,
  areMovesEqual,
} from '@/utils/chess';
import { LineStats, Mode } from '@/types/lesson';
import { makeLineStatsRecord, getRelevantLessonLines, getNextMoves } from '@/utils/lesson';
import { useCountdown } from '@/hooks/useCountdown';
import CountdownClock from '@/components/countdownClock';
import useWindowSize from '@/hooks/useWindowSize';
import { getRandom } from '@/utils';
import usePrevious from '@/hooks/usePrevious';
import { FEN } from 'cm-chess/src/Chess';
import { useFenAnalyzers } from '@/contexts/FenAnalyzersContext';
import { parsePGN } from '@/utils/chess';
import { Chess as CmChess } from 'cm-chess/src/Chess';

const COUNTDOWN_START_TIME = 60 * 5;
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
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const { refreshDueCount } = useFlashcardContext();

  const currentFlashcard = flashcards[flashcardIndex];

  if (!currentFlashcard) {
    return (
      <div className="text-center py-12 bg-background-page rounded-md">
        <p className="text-xl mb-2">All flashcards reviewed!</p>
        <p className="text-gray-400">Great job! Check back later for more reviews.</p>
      </div>
    );
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userAttemptedMove, setUserAttemptedMove] = useState<ShortMove | null>(null);
  const [opponentFirstMove, setOpponentFirstMove] = useState<ShortMove | undefined | null>(null);
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

  // Used to scroll to the bottom of the MovesDisplay
  const [scrollTrigger, setScrollTrigger] = useState(0);


  const opponentMoveTimeoutRef = useRef<number>(0);
  const wrongAnswerBlinkTimeoutRef = useRef<number>(0);
  const undoMoveTimeoutRef = useRef<number>(0);
  const resetBoardTimeoutRef = useRef<number>(0);

  const timeoutRefs = [
    opponentMoveTimeoutRef,
    wrongAnswerBlinkTimeoutRef,
    undoMoveTimeoutRef,
    resetBoardTimeoutRef,
  ]

  const numIncompleteLinesRef = useRef<number | null>(null);
  const totalLinesRef = useRef<number | null>(null);

  const router = useRouter();

  const {
    remainingTime,
    pause: pauseClock,
    unpause: unpauseClock,
    isPaused,
    addTime: addTimeToClock,
    reset: resetClock,
  } = useCountdown(COUNTDOWN_START_TIME);

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

  const fenAnalyzers = useFenAnalyzers();
  const [engineDepth] = useState(18);

  const currentMoveAnalyzer = useCurrentMoveAnalyzer(
    currentMove,
    { depth: 18, numLines: 2 }
  );


  useEngineArrowCreator(
    currentMoveAnalyzer.isOn,
    fenAnalyzers.evaluations,
    currentMoveAnalyzer.latestEvaluations,
    currentMove,
    (newArrows) => setArrows(newArrows),
  );

  const previousMove = usePrevious(currentMove);
  const previousLines = usePrevious(lines);
  const previousMoveGrade = usePrevious(moveGrade);
  const previousMode = usePrevious(currentMode);
  const prevOpponentFirstMove = usePrevious(opponentFirstMove);


  const performWrongAnswerActions = useCallback((options?: {indicateThatTheMoveWasWrong: boolean}) => {
    if (options === undefined || options.indicateThatTheMoveWasWrong) {
      setWrongAnswerCount((blinkCount) => blinkCount + 1);
    } else {
      const didUndo = undoLastMove();
      if (didUndo) unpauseClock();
    }
  }, [undoLastMove, unpauseClock]);


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


  const getReviewQuality = useCallback((): ReviewQuality | null => {
    if (!hasUserCompletedFlashcard) return null;
    if (isReplay) return null;
    if (moveGrade == null) {
      throw new Error('moveGrade was null');
    }

    if (wrongAnswerCount > 0) return ReviewQuality.Again;
    if (numShowMovesGiven > 0) return ReviewQuality.Again;
    if (numHintsGiven > 0) return ReviewQuality.Again;

    if (wrongAnswerCount < 1) {
      if (isMoveJudgementWorseThan(MoveJudgement.Excellent, moveGrade.grade)) {
        return ReviewQuality.Hard;
      }
      if (remainingTime < 1) return ReviewQuality.Hard;
      if (remainingTime < COUNTDOWN_START_TIME * 0.5) return ReviewQuality.Good;
      if (remainingTime >= COUNTDOWN_START_TIME * 0.5) return ReviewQuality.Easy;
    }

    console.warn('Something went wrong');
    console.log('hasUserCompletedFlashcard:', hasUserCompletedFlashcard);
    console.log('isReplay:', isReplay);
    console.log('numShowMovesGiven:', numShowMovesGiven);
    console.log('numHintsGiven:', numHintsGiven);
    console.log('wrongAnswerCount:', wrongAnswerCount);
    console.log('remainingTime:', remainingTime);
    throw new Error('Unexpected scenario in getReviewQuality')
  }, [hasUserCompletedFlashcard, numShowMovesGiven, numHintsGiven, wrongAnswerCount,
      isReplay, remainingTime, moveGrade]);


  const saveFlashcardSolveResult = async (quality: ReviewQuality) => {
    setIsSubmitting(true);
    try {
      const result = await reviewFlashcard(currentFlashcard.id, quality);
      // const result = { success: true }; // Use this line to fake flashcardReview during testing

      if (result.success) {
        await refreshDueCount();
        } else {
          router.refresh();
        }
    } catch (error) {
      console.error('Error saving flashcard solve result:', error);
      alert('An error occurred while submitting review');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleIncorrectUserMove = useCallback(() => {
    performWrongAnswerActions();
  }, [performWrongAnswerActions]);


  const setupOpponentMoveTimeout = useCallback((nextMoves: ShortMove[]) => {
    if (nextMoves.length < 1) throw new Error('nextMoves cannot be empty');
    if (colorToMove(currentMove) === flashcards[flashcardIndex].userColor) {
      throw new Error("Cannot setup opponent move timeout if it is not the opponent's turn");
    }

    const nextMove = getRandom(nextMoves);
    opponentMoveTimeoutRef.current = window.setTimeout(() => {
      playMove(nextMove!);
      unpauseClock();
    }, 800);
  }, [playMove, currentMove, flashcards, flashcardIndex, unpauseClock]);


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

    if (areLinesForcing) {
      setMoveGrade({ san: currentMove.san, grade: MoveJudgement.Best });
    } else {
      const j = getJudgementOfCorrectMove(currentMove);
      setMoveGrade({ san: currentMove.san, grade: j });
    }

    if (shouldUserPlayAnAlternativeMove(relevantLines)) {
      if (remainingTime > 0) addTimeToClock(MOVE_INCREMENT_SECONDS);
      setShowAltMoveModal(true);
      return;
    }

    const nextMoves = getNextMoves(lines, currentMove, {incompleteLinesOnly: true});

    if (nextMoves.length > 0) {
      if (remainingTime > 0) addTimeToClock(MOVE_INCREMENT_SECONDS);
      setupOpponentMoveTimeout(nextMoves);
      return;
    }

    markCurrentLineComplete();
  }, [lines, currentMove, remainingTime, addTimeToClock, setupOpponentMoveTimeout,
      shouldUserPlayAnAlternativeMove, markCurrentLineComplete, areLinesForcing]);


  const gradeMove = useCallback(async (move: Move): Promise<MoveJudgement> => {
    const fc = flashcards[flashcardIndex];
    if (fc == undefined) throw new Error('flashcard was undefined');
    if (fc.bestMoves[0] == undefined) throw new Error('fc.bestLines was empty');
    const pev = await fenAnalyzers.analyze(move.fen, { maxDepth: engineDepth, maxSeconds: 60 });
    return judgePevAgainstBestScore(fc.bestMoves[0].score, pev);
  }, [fenAnalyzers.analyze, flashcards, flashcardIndex, engineDepth]);


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
  }, [currentMove, areLinesForcing, handleIncorrectUserMove, gradeMove,
      handleIncorrectUserMove, markCurrentLineComplete]);


  const handleUserMove = useCallback(() => {
    if (currentMode !== Mode.Practice) return;

    if (currentMove == undefined) throw new Error('currentMove was undefined');
    const move: ShortMove = { from: currentMove.from, to: currentMove.to };
    setUserAttemptedMove(move);
    pauseClock();

    const relevantLines = getRelevantLessonLines(lines, currentMove);

    if (relevantLines.length < 1) {
      handleMoveThatWasNotInFlashcardPgn();
      return;
    }

    handleCorrectUserMove(relevantLines);
  }, [lines, currentMove, handleMoveThatWasNotInFlashcardPgn, handleCorrectUserMove, currentMode, pauseClock]);


  // Set the history so that the MovesDisplay shows the correct history for the flashcard
  // unsolved state. Return the opponentMove so that the opponentMoveTimeout can be setup.
  const setupHistoryForUnsolvedFlashcard = useCallback((flashcard: Flashcard): ShortMove => {
    cmchess.current = new CmChess();
    const parsedPgn = parsePGN(flashcard.pgn);
    if (parsedPgn.length !== 1) throw new Error('parsedPgn length was not 1');
    const parsedMoves = parsedPgn[0].moves.map((m) => m.move);
    const initialMoves = parsedMoves.slice(0, flashcard.positionIdx - 1);
    initialMoves.forEach((move) => {
      const result = cmchess.current.move(move);
      if (result == undefined) throw new Error('bad move');
    })
    const cmHistory = cmchess.current.history();
    setHistory(cmHistory);
    const shortMoves = convertSanLineToShortMoves(parsedMoves);
    return shortMoves[cmHistory.length];
  }, []);


  const setupResetBoardTimeouts = useCallback((delay = 800) => {
    const fc = flashcards[flashcardIndex];
    const opponentMove = setupHistoryForUnsolvedFlashcard(fc);
    const cmhistory = cmchess.current.history();
    const newCurrentMove = cmhistory[cmhistory.length - 1];

    resetBoardTimeoutRef.current = window.setTimeout(() => {
      setCurrentMove(newCurrentMove);
    }, delay);

    opponentMoveTimeoutRef.current = window.setTimeout(() => {
      setOpponentFirstMove(opponentMove);
    }, delay + 200);
  }, [flashcardIndex, flashcards, cmchess.current, setupHistoryForUnsolvedFlashcard]);


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
    setCurrentMode(Mode.Practice);
    setHasUserCompletedFlashcard(false);
    currentMoveAnalyzer.setIsOn(false);
    setMoveGrade(null);
    setWrongAnswerCount(0);
    setIsReplay(true);
    setupResetBoardTimeouts(resetBoardDelay);
    resetClock();
    setNumHintsGiven(0);
    setNumShowMovesGiven(0);
    hasSubmittedRef.current = false;
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
        await refreshDueCount();
      } else {
        console.error('Error deleting flashcard:', result.error);
        setDeleteStatus(DeleteStatus.Failed);
      }
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      setDeleteStatus(DeleteStatus.Failed);
    }
  }, [currentFlashcard, refreshDueCount]);


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
    if (currentMode === Mode.Edit) {
      setCurrentMode(Mode.Practice);
      handleReplayFlashcardBtnClick(250);
    }

    if (currentMode !== Mode.Edit) {
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
      currentMoveAnalyzer.setIsOn(false);
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
  }, [areLinesForcing, currentFlashcard, deleteMoves, promoteToMainLine, promoteMoveVariation]);


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

    if (areLinesForcing) {
      if (numIncompleteLinesRef.current > 0 && haveAnyLinesBeenCompleted) {
        if (remainingTime > 0) addTimeToClock(MOVE_INCREMENT_SECONDS);
        setupResetBoardTimeouts();
      }
    }

    if (numIncompleteLinesRef.current === 0 || (!areLinesForcing && haveAnyLinesBeenCompleted)) {
      pauseClock();
      setHasUserCompletedFlashcard(true);
    }
  }, [lines, areLinesForcing, previousLines, setupResetBoardTimeouts, pauseClock, remainingTime]);


  // When the flashcardIndex changes...
  useEffect(() => {
    setIsReplay(false);
    setWrongAnswerCount(0);
    setHasUserCompletedFlashcard(false);
    setMoveGrade(null);
    setNumHintsGiven(0);
    setNumShowMovesGiven(0);
    numIncompleteLinesRef.current = null;
    totalLinesRef.current = null;
    hasSubmittedRef.current = false;

    const fc = flashcards[flashcardIndex];
    if (fc != undefined) {
      if (fc.bestMoves.length < 2) throw new Error('flashcard has fewer than two elements in bestMoves');
      const judgements = judgeScores(fc.userColor, fc.bestMoves.map(({score}) => score));
      setMoveJudgements(judgements);

      // Use the areLinesForcing value stored in the database
      setAreLinesForcing(fc.areLinesForcing);

      resetClock();

      const opponentMove = setupHistoryForUnsolvedFlashcard(fc);
      const cmHistory = cmchess.current.history();
      setCurrentMove(cmHistory[cmHistory.length - 1]);
      setOpponentFirstMove(opponentMove);

      setLines(makeLineStatsRecord(fc.pgn))
      setBoardFenOverride(undefined);
    } else {
      setMoveJudgements([]);
      setAreLinesForcing(null);
      setOpponentFirstMove(null);
      setLines({});
    }
  }, [flashcardIndex, resetClock, setupHistoryForUnsolvedFlashcard]);


  // Play the opponent move after a slight delay
  useEffect(() => {
    if (opponentFirstMove) {
      if (prevOpponentFirstMove && areMovesEqual(opponentFirstMove, prevOpponentFirstMove)) return;
      opponentMoveTimeoutRef.current = window.setTimeout(() => {
        playMove(opponentFirstMove);
        setOpponentFirstMove(null);
        unpauseClock();
      }, 1000);
    }
  }, [prevOpponentFirstMove, opponentFirstMove, playMove, unpauseClock]);


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
    if (wrongAnswerCount < 1) return;

    wrongAnswerBlinkTimeoutRef.current = window.setTimeout(() => {
      const audio = new Audio('/assets/sound/incorrectWren.mp3');
      audio.play().catch(err => console.error('Error playing sound:', err));
      setWrongAnswerBlinkTrigger((v) => v + 1);
    }, 300);

    undoMoveTimeoutRef.current = window.setTimeout(() => {
      const didUndo = undoLastMove();
      if (didUndo) unpauseClock();
    }, 1300);

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


  // Handle line ending with opponent move
  useEffect(() => {
    if (areCmMovesEqual(currentMove, previousMove)) return;
    if (currentMode !== Mode.Practice) return;
    if (colorToMove(currentMove) !== flashcards[flashcardIndex].userColor) return;

    const nextMoves = getNextMoves(lines, currentMove, {incompleteLinesOnly: true});
    if (nextMoves.length > 0) return;

    markCurrentLineComplete();
  }, [lines, currentMove, flashcards, flashcardIndex, currentMode])


  useEffect(() => {
    if (areLinesForcing) return;
    if (previousMoveGrade == null && moveGrade != null &&
        isMoveJudgementAtLeast(MoveJudgement.Good, moveGrade.grade)) {
      setHasUserCompletedFlashcard(true);
    }
  }, [moveGrade, previousMoveGrade, areLinesForcing])


  // Save flashcard result only once when completed
  const hasSubmittedRef = useRef(false);
  const completionTimeRef = useRef<number>(0);

  useEffect(() => {
    if (hasUserCompletedFlashcard && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      completionTimeRef.current = remainingTime;
      const reviewQuality = getReviewQuality();
      if (reviewQuality != null) {
        saveFlashcardSolveResult(reviewQuality)
      }
    }
  }, [hasUserCompletedFlashcard])


  // Whenever we go into edit mode, turn on the currentMoveAnalyzer
  // When we leave edit mode, turn it off
  useEffect(() => {
    if (previousMode !== currentMode) {
      if (currentMode === Mode.Edit) {
        // currentMoveAnalyzer.setIsOn(true);
      } else {
        currentMoveAnalyzer.setIsOn(false);
      }
    }
  }, [previousMode, currentMode])


  useEffect(() => {
    if (hasUserCompletedFlashcard) setCurrentMode(Mode.Explore);
  }, [hasUserCompletedFlashcard]);


  useEffect(() => {
    if (previousMode !== currentMode && currentMode === Mode.Edit) {
      setScrollTrigger((n) => n + 1);
    }
  }, [currentMode, previousMode])


  // On first load: setup workers and clear evaluations
  useEffect(() => {
    fenAnalyzers.setupWorkers()
      .then(() => fenAnalyzers.newGame())
      .then(() => fenAnalyzers.setEvaluations({}))
      .catch((error) => {
        if (error.message?.includes('terminated during setup')) {
          console.log('Worker setup cancelled due to navigation');
        } else {
          console.error('Error setting up workers:', error);
        }
      });
  }, [])


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
      const maxBoardWidth = Math.min(maxBoardSize, windowSize.width - 625);
      const maxBoardHeight = Math.min(maxBoardSize, windowSize.height - 175);
      boardSize = Math.min(maxBoardWidth, maxBoardHeight);
    }
  }


  const movesDisplay = useMemo(() => (
    <NewMovesDisplay
      history={history}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      useMobileLayout={false}
      showVariations={true}
      contextMenu={makeContextMenu()}
      keyMoves={[history[currentFlashcard.positionIdx - 1]]}
      scrollToBottom={scrollTrigger}
    />
  ), [history, currentMove, currentFlashcard.positionIdx, scrollTrigger]);


  const arrowButtons = useMemo(() => (
    <ArrowButtons
      history={history}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      marginTop={0}
    />
  ), [history, currentMove]);

  const leftColWidth = 275;
  const rightColWidth = 275;
  const columnGapWidth = 8;
  const mainDivWidth = leftColWidth + boardSize + rightColWidth + (columnGapWidth * 2);

  const engineDisplay = useMemo(() => (
    <EngineDisplay
      currentMoveAnalyzer={currentMoveAnalyzer}
      evaluations={fenAnalyzers.evaluations}
      currentMove={currentMove}
      maxLineLengthPx={rightColWidth}
      isSwitchDisabled={currentMode === Mode.Practice}
      switchDisabledTooltip='Complete the flashcard to unlock the engine'
      showMoveJudgements={false}
      colorLineScores={true}
    />
  ), [currentMoveAnalyzer, fenAnalyzers.evaluations, currentMove, rightColWidth, currentMode]);

  return (
    <div className="flex flex-col items-center gap-3" style={{ width: mainDivWidth }}>
      {/* First row  */}
      <div className="flex flex-row w-full max-w-[1400px]">

        {/* Left Column */}
        <div className="flex justify-start" style={{width: rightColWidth + columnGapWidth}}>
          <div className="flex flex-col gap-2" style={{width: rightColWidth, height: boardSize }}>
            {useMemo(() => (
              <div className="flex flex-col gap-4 w-full bg-background-page rounded-md p-2 text-center">
                <h1 className="text-2xl font-bold">Flashcard Review</h1>
                <p>Card {flashcardIndex + 1} of {flashcards.length}</p>
                <div className="flex gap-4 text-sm text-gray-400 justify-center">
                  <div>Total: <span className="font-semibold text-foreground">{stats.total}</span></div>
                  <div>Due: <span className="font-semibold text-foreground">{stats.due}</span></div>
                </div>
              </div>
            ), [flashcardIndex, flashcards.length, stats.total, stats.due])}
            {useMemo(() => (
              <FlashcardDetails flashcard={currentFlashcard} />
            ), [currentFlashcard])}
            {useMemo(() => (
              <FlashcardFeedback
                dueFlashcards={flashcards}
                flashcardIndex={flashcardIndex}
                currentMove={currentMove}
                isFlashcardComplete={hasUserCompletedFlashcard}
                onReplayFlashcardBtnClick={handleReplayFlashcardBtnClick}
                onNextFlashcardBtnClick={handleNextFlashcardBtnClick}
                numWrongAnswers={wrongAnswerCount}
                numHintsGiven={numHintsGiven}
                numShowMovesGiven={numShowMovesGiven}
                isGradingMove={isGradingMove}
                moveGrade={moveGrade}
              />
            ), [flashcards, flashcardIndex, currentMove, hasUserCompletedFlashcard, wrongAnswerCount, numHintsGiven, numShowMovesGiven, isGradingMove, moveGrade])}
          </div>
        </div>

        {/* Chessboard */}
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
          {useMemo(() => {
            let allowInteraction = true;
            if (currentMode === Mode.Practice && !isUsersTurn()) {
              allowInteraction = false;
            }
            return (
              <Chessboard
                currentMove={currentMove}
                boardSize={boardSize}
                orientation={currentFlashcard.userColor}
                allowInteraction={allowInteraction}
                playMove={playMove}
                afterUserMove={handleUserMove}
                animate={true}
                markers={markers}
                fenOverride={boardFenOverride}
                arrows={arrows}
              />
            );
          }, [currentMove, boardSize, currentFlashcard.userColor, currentMode, markers, boardFenOverride, arrows])}
        </div>

        {/* Right column */}
        <div className="flex justify-end" style={{width: rightColWidth + columnGapWidth}}>
          <div className="flex" style={{width: rightColWidth, height: boardSize }}>
            <div className="flex flex-col items-center w-full flex-1 gap-2">
              <div className="flex bg-background-page w-full rounded-md min-h-4">
                {engineDisplay}
              </div>
              <div className="flex flex-col w-full flex-1 min-h-0 overflow-y-scroll no-scrollbar">
                {movesDisplay}
              </div>
              {useMemo(() => {
                if (currentMode !== Mode.Edit) return null;
                return (
                  <>
                    <FlashcardEditButtons
                      onDiscardChangesBtnClick={discardUnsavedChanges}
                      onSaveChangesBtnClick={saveFlashcardPgnChanges}
                      onDeleteFlashcardBtnClick={() => setShowDeleteFlashcardModal(true)}
                      doUnsavedChangesExist={doUnsavedFlashcardChangesExist()}
                      showSaveAndUndoBtns={areLinesForcing === true}
                    />
                  </>
                );
              }, [currentMode, history, areLinesForcing])}
            </div>
          </div>
        </div>
      </div>

      {/* Second Row  */}
      <div className="flex flex-row w-full max-w-[1400px]">


        {/* Left Column */}
        <div className="flex justify-start" style={{width: rightColWidth + columnGapWidth}}>
          <div className="flex" style={{width: rightColWidth }}>
          </div>
        </div>

        {/* Center Column */}
        <div className="relative" style={{ width: boardSize }}>
          <div className="flex justify-center">
            <div className="flex flex-1 justify-between items-center">
              <div className="basis-32">
                {useMemo(() => (
                  <HintButtons
                    currentMove={currentMove}
                    giveHint={giveHint}
                    showMove={showMoves}
                    hintButtonText="Show Hint"
                    showButtonText="Show Move"
                    buttonSize={ButtonSize.Normal}
                  />
                ), [currentMove])}
              </div>
              <div className="ml-auto mr-auto">
                {useMemo(() => (
                  <>
                    {currentMode !== Mode.Edit && (
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
                  </>
                ), [currentMode, hasUserCompletedFlashcard, flashcardIndex, flashcards.length])}
              </div>
              <div className="flex justify-end basis-32">
                <CountdownClock remainingTime={remainingTime} isPaused={isPaused} />
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex justify-center" style={{width: rightColWidth, marginLeft: columnGapWidth}}>
          {arrowButtons}
        </div>
      </div>
    </div>
  );
};

export default FlashcardReview;
