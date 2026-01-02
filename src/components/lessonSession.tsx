'use client';

import React, {
  useReducer,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { ScrollLock } from '@/components/ScrollLock';
import { Lesson, LineStats, Mode } from '@/types/lesson';
import {
  areCmMovesEqual,
  getLineFromCmMove,
  getLanLineFromCmMove,
  addLineToCmChess,
  Marker,
  getLastMoveOfLine,
  loadPgnIntoCmChess,
} from '@/utils/cmchess';
import { MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers';
import { ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows';
import { PieceColor, ShortMove } from '@/types/chess';
import { Cursor, MoveSound, Arrow } from '@/components/cmChessboard';
import { assertUnreachable, getRandom } from '@/utils';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import {
  areMovesEqual,
  convertSanLineToLanLine,
  convertLanLineToShortMoves,
  lanToShortMove,
  areLinesEqual,
  makePgnFromHistory,
} from '@/utils/chess';
import Chessboard from '@/components/Chessboard'
import BlinkOverlay from '@/components/blinkOverlay';
import EvalerDisplay from '@/components/evalerDisplay';
import MovesDisplay from '@/components/movesDisplay';
import ArrowButtons from '@/components/arrowButtons';
import IconButton from '@/components/iconButton';
import { Svg } from '@/components/svgIcon';
import {
  shouldUseMobileLayout
} from '@/utils/mobileLayout';
import useWindowSize from '@/hooks/useWindowSize';
import { getLinesFromPGN } from '@/utils/pgn';
import usePrevious from '@/hooks/usePrevious';
import LessonSessionInfo from '@/components/lessonSessionInfo';
import useEvaler from '@/hooks/useChessEvaler';
import LessonChapters from '@/components/lessonChapters';
import EditLessonControls from '@/components/editLessonControls';
import NewChapterModal from '@/components/newChapterModal';
import LineCompleteModal from './lineCompleteModal';
import type { Viewport } from 'next'
import { saveOpeningModeToLocalStorage, loadOpeningModeFromLocalStorage } from '@/utils/localStorage';
import { useSearchParams } from 'next/navigation';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// The arrow type that will be used throughout this component unless otherwise specified
const blueArrowType = ARROW_TYPE.info;

enum MobileTab {
  Chapters = 'Chapters',
  Moves = 'Moves',
  Engine = 'Engine',
}

interface State {
  isEvalAllowed: boolean,
  isEvaluatorOn: boolean,
  isLoading: boolean,
  wrongAnswerBlinkCount: number,
  markers: Marker[],
  arrows: Arrow[],
  hasFirstLoadCompleted: boolean,

  allowBoardInteraction: boolean,
  allowBoardAnimation: boolean,
  boardCursor: Cursor | null,
  nextBoardMoveSound: MoveSound | null,
  boardFenOverride: string | null,
  isChessboardMoving: boolean,

  // These state variables are used to trigger the automatic opponent move after
  // puzzlesOrGameId changes if animateOpponentMoveBeforePuzzlePos is true.
  hasChessboardMoved: boolean,
  hasChessboardLoaded: boolean,

  selectedMobileTab: MobileTab,

  recentlyCompletedLine: string | null,
  restartedLine: ShortMove[] | null,
  lines: Record<string, LineStats>[],
  lineProgressIdx: number,

  // The current active mode
  mode: Mode,

  // The mode to return to (either Mode.Practice or Mode.Learn)
  fallbackMode: Mode,

  // The index of the current chapter in lesson.chapters
  currentChapterIdx: number,

  // The index of the chapter from which the current State.lines was derived
  linesChapterIdx: number | undefined,

  showNewChapterModal: boolean,
  showLineCompleteModal: boolean,
}

const initialState: State = {
  isEvalAllowed: false,
  isEvaluatorOn: false,
  isLoading: true,
  wrongAnswerBlinkCount: 0,
  markers: [],
  arrows: [],
  hasFirstLoadCompleted: false,

  allowBoardInteraction: true,
  allowBoardAnimation: true,
  boardCursor: null,
  nextBoardMoveSound: null,
  boardFenOverride: null,
  isChessboardMoving: false,

  // These state variables are used to trigger the automatic opponent move after
  // puzzlesOrGameId changes if animateOpponentMoveBeforePuzzlePos is true.
  hasChessboardMoved: false,
  hasChessboardLoaded: false,

  selectedMobileTab: MobileTab.Moves,

  recentlyCompletedLine: null,
  restartedLine: null,
  lines: [],
  lineProgressIdx: 0,
  mode: Mode.Learn,
  fallbackMode: Mode.Learn,
  currentChapterIdx: 0,
  linesChapterIdx: undefined,
  showNewChapterModal: false,
  showLineCompleteModal: false,
}

interface ClearMoveSound {
  type: 'clearMoveSound',
}

interface SetIsChessboardMoving {
  type: 'setIsChessboardMoving',
  value: boolean,
}

interface RemoveAllMarkersAndArrows {
  type: 'removeAllMarkersAndArrows',
}

interface TriggerWrongAnswerBlink {
  type: 'triggerWrongAnswerBlink',
}

interface DeclareEvaluating {
  type: 'declareEvaluating',
}

interface DeclareEvaluationComplete {
  type: 'declareEvaluationComplete',
}

interface setIsEvaluatorOn {
  type: 'setIsEvaluatorOn',
  value: boolean,
}

interface SetMarkers {
  type: 'setMarkers',
  markers: Marker[],
}

interface ClearMarkersAndSetArrows {
  type: 'clearMarkersAndSetArrows',
  arrows: Arrow[],
}

interface ChangeSelectedMobileTab {
  type: 'changeSelectedMobileTab',
  value: MobileTab,
}

interface SetupNewLesson {
  type: 'setupNewLesson',
  lines: Record<string, LineStats>[],
  nextMode: Mode,
  linesChapterIdx: number,
}

interface SetLineProgressIdx {
  type: 'setLineProgressIdx',
  idx: number,
}

interface SetupNextLine {
  type: 'setupNextLine'
  nextMode: Mode,
}

interface RestartCurrentLine {
  type: 'restartCurrentLine'
  restartedLine: ShortMove[],
  nextMode: Mode,
}

interface DeclareLineComplete {
  type: 'declareLineComplete'
  completedLine: string,
}

interface ChangeMode {
  type: 'changeMode',
  lessonTitle: string,
  mode: Mode,
}

interface ChangeChapterIdx {
  type: 'changeChapterIdx',
  idx: number,
}

interface ShowNewChapterModal {
  type: 'showNewChapterModal',
  show: boolean,
}

interface showLineCompleteModal {
  type: 'showLineCompleteModal',
  show: boolean,
}

type Action =
  | ClearMoveSound
  | SetIsChessboardMoving
  | RemoveAllMarkersAndArrows
  | TriggerWrongAnswerBlink
  | DeclareEvaluating
  | DeclareEvaluationComplete
  | setIsEvaluatorOn
  | SetMarkers
  | ClearMarkersAndSetArrows
  | ChangeSelectedMobileTab
  | SetupNewLesson
  | SetLineProgressIdx
  | SetupNextLine
  | RestartCurrentLine
  | DeclareLineComplete
  | ChangeMode
  | ChangeChapterIdx
  | ShowNewChapterModal
  | showLineCompleteModal

function reducer(s: State, a: Action): State {
  let newState: State;
  switch (a.type) {
    case 'clearMoveSound':
      newState = { ...s, nextBoardMoveSound: null };
      break;
    case 'setIsChessboardMoving':
      newState = { ...s, isChessboardMoving: a.value };
      if (a.value) {
        newState.hasChessboardLoaded = true;
        newState.hasChessboardMoved = true;
        newState.hasFirstLoadCompleted = true;
      }
      break;
    case 'removeAllMarkersAndArrows':
      newState = { ...s, markers: [], arrows: [] };
      break;
    case 'triggerWrongAnswerBlink':
      newState = { ...s, wrongAnswerBlinkCount: s.wrongAnswerBlinkCount + 1 };
      break;
    case 'declareEvaluating':
      newState = { ...s, allowBoardInteraction: false, boardCursor: Cursor.Wait };
      break;
    case 'declareEvaluationComplete':
      newState = { ...s, allowBoardInteraction: true, boardCursor: null };
      break;
    case 'setIsEvaluatorOn':
      newState = { ...s, isEvaluatorOn: a.value };
      break;
    case 'setMarkers':
      newState = { ...s, markers: a.markers };
      break;
    case 'clearMarkersAndSetArrows':
      newState = { ...s, markers: [], arrows: a.arrows };
      break;
    case 'changeSelectedMobileTab':
      let isEvaluatorOn = false;
      if (a.value === MobileTab.Engine && s.mode === Mode.Explore) isEvaluatorOn = true;
      newState = { ...s, selectedMobileTab: a.value, isEvaluatorOn };
      break;
    case 'setupNewLesson':
      newState = setupNewLesson(s, a.lines, a.linesChapterIdx, a.nextMode);
      break;
    case 'setLineProgressIdx':
      newState = { ...s, lineProgressIdx: a.idx };
      break;
    case 'setupNextLine':
      newState = setupNextLine(s, a.nextMode);
      break;
    case 'restartCurrentLine':
      newState = restartCurrentLine(s, a.restartedLine, a.nextMode);
      break;
    case 'declareLineComplete':
      newState = declareLineComplete(s, a.completedLine);
      break;
    case 'changeMode':
      let fallbackMode = s.fallbackMode;
      if (a.mode === Mode.Learn || a.mode === Mode.Practice) {
        saveOpeningModeToLocalStorage(a.lessonTitle, a.mode);
        fallbackMode = a.mode;
      }
      newState = { ...s, mode: a.mode, fallbackMode, arrows: [], markers: [] };
      break;
    case 'changeChapterIdx':
      newState = { ...s, currentChapterIdx: a.idx };
      break;
    case 'showNewChapterModal':
      newState = { ...s, showNewChapterModal: a.show };
      break;
    case 'showLineCompleteModal':
      newState = { ...s, showLineCompleteModal: a.show };
      break;
    default:
      assertUnreachable(a);
  }
  return newState;
}

function setupNewLesson(
  s: State,
  lines: Record<string, LineStats>[],
  linesChapterIdx: number,
  nextMode: Mode,
): State {
  let fallbackMode = s.fallbackMode;
  if (nextMode === Mode.Learn || nextMode === Mode.Practice) {
    fallbackMode = nextMode;
  }
  return {
    ...s,
    lines,
    linesChapterIdx,
    recentlyCompletedLine: null,
    isLoading: false,
    hasChessboardLoaded: false,
    hasChessboardMoved: false,
    hasFirstLoadCompleted: true,
    lineProgressIdx: 0,
    mode: nextMode,
    fallbackMode,
  };
}

function setupNextLine(s: State, nextMode: Mode): State {
  const numLines = Object.keys(s.lines[s.currentChapterIdx]).length;
  const incompleteLines: string[] = [];
  Object.entries(s.lines[s.currentChapterIdx]).forEach(([k, v]) => {
    if (v.isComplete === false) incompleteLines.push(k);
  });
  if (incompleteLines.length < 1 && numLines > 0) throw new Error('No incomplete lines');
  if (numLines < 1) {
    // If there are no lines at all, go to Edit mode
    nextMode = Mode.Edit;
  }
  let fallbackMode = s.fallbackMode;
  if (nextMode === Mode.Learn || nextMode === Mode.Practice) {
    fallbackMode = nextMode;
  }
  return {
    ...s,
    recentlyCompletedLine: null,
    restartedLine: null,
    lineProgressIdx: 0,
    isEvaluatorOn: false,
    mode: nextMode,
    fallbackMode,
  };
}

function restartCurrentLine(s: State, restartedLine: ShortMove[], nextMode: Mode): State {
  const lines = [ ...s.lines ];
  if (s.recentlyCompletedLine) lines[s.currentChapterIdx][s.recentlyCompletedLine].isComplete = false;
  const incompleteLines: string[] = [];
  Object.entries(lines[s.currentChapterIdx]).forEach(([k, v]) => {
    if (!v.isComplete) incompleteLines.push(k);
  });

  // Use the longest restartedLine, either from state or from the action
  if (s.restartedLine && s.restartedLine.length > restartedLine.length) {
    restartedLine = s.restartedLine;
  }

  return {
    ...s,
    lines,
    recentlyCompletedLine: null,
    restartedLine,
    lineProgressIdx: 0,
    isEvaluatorOn: false,
    mode: nextMode,
    fallbackMode: nextMode,
  };
}

function declareLineComplete(s: State, completedLine: string): State {
  const lines = [ ...s.lines ];
  lines[s.currentChapterIdx][completedLine].isComplete = true;
  return {
    ...s,
    lines,
    recentlyCompletedLine: completedLine,
    mode: Mode.Explore,
  };
}

interface Props {
  lesson: Lesson;
  allowEdits?: boolean;
}

const LessonSession = ({
  lesson,
  allowEdits = false,
}: Props) => {

  const {
    cmchess,
    history,
    setHistory,
    currentMove,
    setCurrentMove,
    playMove,
    reset,
    undoLastMove,
    deleteMove,
  } = useChessboardEngine();

  const [s, dispatch] = useReducer(reducer, initialState);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (lesson == undefined) return;
    const chapterIdxParam = searchParams.get('chapterIdx');
    const idx = chapterIdxParam ? parseInt(chapterIdxParam) : 0;
    if (idx >= 0 && idx < lesson.chapters.length) dispatch({ type: 'changeChapterIdx', idx });
  }, [lesson]);


  // Determine the board size
  const windowSize = useWindowSize();
  let boardSize: number;
  const defaultBoardSize = 750;
  if (windowSize.width && windowSize.width < defaultBoardSize) {
    boardSize = windowSize.width;
  } else {
    if (windowSize.width == undefined || windowSize.height == undefined) {
      boardSize = defaultBoardSize;
    } else {
      // These values are based on the current layout and will need to updated if the
      // layout changes.
      const maxBoardWidth = windowSize.width - 625;
      const maxBoardHeight = windowSize.height - 175;
      boardSize = Math.min(maxBoardWidth, maxBoardHeight);
    }
  }

  const {
    setupEvalerForNewGame,
    gameEvals,
    fenBeingEvaluated,
    evalDepth,
    engineName,
    lines: engineLines,
    numLines,
  } = useEvaler(s.isEvaluatorOn, currentMove, { numLines: 2 });

  const resetEvaler = useCallback(() => {
    setupEvalerForNewGame();
  }, []);

  const afterChessboardMoveDo = useRef<((() => void)[])>([]);

  const timeoutRef = useRef<number>(0);

  const previousMove = usePrevious(currentMove);
  const prevLesson = usePrevious(lesson);
  const prevMode = usePrevious(s.mode);
  const prevChapterIdx = usePrevious(s.currentChapterIdx);

  // Saved lines from the last time the user saved the chapter.
  // This is used to detect unsaved changes.
  const [savedLines, setSavedLines] = useState<string[]>([]);

  // Timestamp of when the user entered edit mode
  const [timeEditModeEntered, setTimeEditModeEntered] = useState<number | null>(null);

  // Update savedLines when the lesson or chapter index changes
  useEffect(() => {
    if (lesson && lesson.chapters[s.currentChapterIdx]) {
      setSavedLines(getLinesFromPGN(lesson.chapters[s.currentChapterIdx].pgn));
    }
  }, [lesson, s.currentChapterIdx])

  // Update timeEditModeEntered when mode changes to Edit
  useEffect(() => {
    if (s.mode === Mode.Edit) {
      setTimeEditModeEntered(Date.now());
    } else {
      setTimeEditModeEntered(null);
    }
  }, [s.mode])

  const areAllLinesComplete = useCallback((): boolean => {
    return s.lines.every((chapterLines) => Object.values(chapterLines).every((lineStats) => lineStats.isComplete));
  }, [s.lines]);

  const isNextLineInAnotherChapter = useCallback((): boolean => {
    if (s.lines[s.currentChapterIdx] === undefined) return false;
    if (!Object.values(s.lines[s.currentChapterIdx]).every((stats) => stats.isComplete)) return false;
    if (areAllLinesComplete()) return false;
    getIdxOfNextIncompleteChapter();
    return true;
  }, [s.lines, s.currentChapterIdx]);

  const getIdxOfNextIncompleteChapter = useCallback((): number | null => {
    for (let i = 1; i < lesson.chapters.length; i++) {
      const idx = (s.currentChapterIdx + i) % lesson.chapters.length;
      if (s.lines[idx] === undefined) continue;
      if (!Object.values(s.lines[idx]).every((stats) => stats.isComplete)) {
        return idx;
      }
    }
    return null;
  }, [s.lines, s.currentChapterIdx]);

  // This function is needed because the move history does not update instantly when switching to
  // edit mode. Using this function in 'doUnsavedChangesExist' prevents that function from
  // returning true for a brief moment while the history is being updated.
  const hasBeenInEditModeForMoreThanTwoSeconds = useCallback(() => {
    if (timeEditModeEntered == null) return false;
    const currentTime = Date.now();
    const diff = currentTime - timeEditModeEntered;
    return diff > 1000;
  }, [timeEditModeEntered])

  const doUnsavedChangesExist = useCallback((newPgn?: string) => {
    if (!hasBeenInEditModeForMoreThanTwoSeconds()) return false;
    if (newPgn == undefined) newPgn = makePgnFromHistory(history);
    const newLines = getLinesFromPGN(newPgn);
    if (newLines.length === 0 && savedLines.length === 0) return false;
    return !newLines.every((line) => savedLines.includes(line));
  }, [savedLines, history, timeEditModeEntered, s.currentChapterIdx]);


  const isMoveAllowed = (move: ShortMove): boolean => {
    // CmChess does not allow variations on the first move, so do not allow the move if
    // the user is trying to play a first move that differs from the first move in the
    // history.
    const history = cmchess.current.history();
    if (!currentMove && history.length > 0 && !areMovesEqual(move, history[0])) {
      return false;
    }

    // Otherwise, allow the move
    return true;
  }

  // Get all the relevant lesson lines that start with the line played on the board.
  // Returns completed and uncompleted lines.
  const getRelevantLessonLines = useCallback((
    options?: { incompleteLinesOnly: boolean }
  ): string[] => {
    if (s.lines[s.currentChapterIdx] == undefined) return [];
    if (currentMove == undefined) return Object.keys(s.lines[s.currentChapterIdx]);
    const currentMoveLine = getLanLineFromCmMove(currentMove);
    const relevantLines: string[] = [];
    Object.keys(s.lines[s.currentChapterIdx]).forEach((k) => {
      if (options?.incompleteLinesOnly && s.lines[s.currentChapterIdx][k].isComplete) return;
      const line = k.split(' ');
      let isRelevant = true;
      for (let i = 0; i < currentMoveLine.length; i++) {
        if (currentMoveLine[i] !== line[i]) {
          isRelevant = false;
          break;
        }
      }
      if (isRelevant) relevantLines.push(k);
    });
    return relevantLines;
  }, [currentMove, s.lines, s.currentChapterIdx]);

  const performWrongAnswerActions = useCallback((options?: {indicateThatTheMoveWasWrong: boolean}) => {
    // By default, indicate that the move was wrong.
    if (options === undefined || options.indicateThatTheMoveWasWrong) {
      dispatch({ type: 'triggerWrongAnswerBlink' });
    }

    if (currentMove) undoLastMove();
  }, [currentMove, undoLastMove]);

  const restartCurrentLine = useCallback((nextMode?: Mode) => {
    if (nextMode == undefined) nextMode = s.fallbackMode;
    // Change the mode right away, so that any useEffects will see the new mode.
    if (!allowEdits && nextMode === Mode.Edit) throw new Error('Edits are not allowed');
    dispatch({ type: 'changeMode', lessonTitle: lesson.title, mode: nextMode })

    // To avoid code repitition, define this function here. This function will setup a
    // timeout to run the restart logic after a short wait. This function will either run
    // afterChessBoardMoveDo, or not. See below.
    const setupTimeout = () => {
      timeoutRef.current = window.setTimeout(() => {
        reset();
        const restartedLine = history.slice(0, s.lineProgressIdx);
        dispatch({
          type: 'restartCurrentLine',
          restartedLine,
          nextMode,
        });
        timeoutRef.current = 0;
      }, 300);
    }

    // If the currentMove is undefined, the board will not animate, so don't
    // wait for afterChessboardMoveDo.
    if (currentMove === undefined) {
      setupTimeout();

    // If the currentMove is defined, that means the board is not in the
    // starting position and the board is going to animate to the starting
    // position. We want to run setupTimeout after the chessboard animation.
    } else {
      afterChessboardMoveDo.current.push(() => {
        setupTimeout();
      });
      setCurrentMove(undefined);
    }
  }, [currentMove, reset, history, s.lineProgressIdx, allowEdits, s.fallbackMode]);

  const setupNextLine = useCallback((nextMode?: Mode) => {
    if (nextMode == undefined) nextMode = s.fallbackMode;
    // Change the mode right away, so that any useEffects will see the new mode.
    if (!allowEdits && nextMode === Mode.Edit) throw new Error('Edits are not allowed');
    dispatch({ type: 'changeMode', lessonTitle: lesson.title, mode: nextMode })

    // To avoid code repitition, define this function here. This function will setup a
    // timeout to run the restart logic after a short wait. This function will either run
    // afterChessBoardMoveDo, or not. See below.
    const setupTimeout = () => {
      timeoutRef.current = window.setTimeout(() => {
        reset();
        dispatch({ type: 'setupNextLine', nextMode })
        timeoutRef.current = 0;
      }, 300);
    }

    // If the currentMove is undefined, the board will not animate, so don't
    // wait for afterChessboardMoveDo.
    if (currentMove === undefined) {
      setupTimeout();

    // If the currentMove is defined, that means the board is not in the
    // starting position and the board is going to animate to the starting
    // position. We want to run setupTimeout after the chessboard animation.
    } else {
      afterChessboardMoveDo.current.push(() => {
        setupTimeout();
      });
      setCurrentMove(undefined);
    }
  }, [reset, allowEdits, s.fallbackMode]);

  const openAddNewChapterModal = useCallback(() => {
    dispatch({ type: 'showNewChapterModal', show: true });
  }, [lesson]);

  const changeChapter = useCallback((idx: number) => {
    if (doUnsavedChangesExist()) {
      alert('Please save or discard your changes before changing chapters.');
      return;
    }
    if (s.currentChapterIdx === idx) return;
    dispatch({ type: 'changeChapterIdx', idx });
    if (s.mode === Mode.Edit) return;
    setupNextLine(s.fallbackMode);
  }, [s.currentChapterIdx, s.fallbackMode, s.mode, setupNextLine, doUnsavedChangesExist]);

  const getNextMoves = useCallback((
    options?: { incompleteLinesOnly: boolean }
  ): ShortMove[] => {
    const incompleteLinesOnly = options?.incompleteLinesOnly ?? false;
    let relevantLines = getRelevantLessonLines({ incompleteLinesOnly });
    const nextMoves: ShortMove[] = [];
    relevantLines.forEach((line) => {
      const shortMoves = convertLanLineToShortMoves(line.split(' '));
      const ply = currentMove ? currentMove.ply : 0;
      const nextMove = shortMoves[ply];

      // If there is a nextMove and it is not already in nextMoves, add it
      if (nextMove && !nextMoves.some((m) => areMovesEqual(m, nextMove))) {
        nextMoves.push(nextMove);
      }
    });
    return nextMoves;
  }, [currentMove, getRelevantLessonLines]);

  const isOpponentsTurn = useCallback((): boolean => {
    const ply = currentMove ? currentMove.ply : 0;
    if (ply % 2 === 0) {
      return lesson.userColor === PieceColor.BLACK;
    } else {
      return lesson.userColor === PieceColor.WHITE;
    }
  }, [currentMove, lesson.userColor]);

  const handleEditModeBtnClick = useCallback(() => {
    if (!allowEdits) return;
    if (s.mode === Mode.Edit) return;
    dispatch({ type: 'changeMode', lessonTitle: lesson.title, mode: Mode.Edit })
  }, [s.mode, allowEdits]);

  const deleteCurrentMove = useCallback(() => {
    if (!allowEdits) return;
    if (currentMove == undefined) return;
    deleteMove(currentMove, true);
  }, [currentMove, deleteMove, allowEdits]);

  const handleDiscardChangesBtnClick = useCallback(() => {
    const currentMoveLine = getLanLineFromCmMove(currentMove);
    cmchess.current.loadPgn(lesson.chapters[s.currentChapterIdx].pgn);
    const newHistory = cmchess.current.history();
    const lastCommonMove = getLastMoveOfLine(currentMoveLine, newHistory);
    setHistory(newHistory);
    setCurrentMove(lastCommonMove);
  }, [currentMove, cmchess, lesson.chapters, setCurrentMove, setHistory, s.currentChapterIdx]);

  const putAllLessonLinesInHistory = useCallback(() => {
    const currentMoveLine = getLanLineFromCmMove(currentMove);
    cmchess.current = loadPgnIntoCmChess(lesson.chapters[s.currentChapterIdx].pgn, cmchess.current)
    const newCurrentMove = addLineToCmChess(cmchess.current, currentMoveLine);
    setHistory(cmchess.current.history());
    setCurrentMove(newCurrentMove);
  }, [cmchess, lesson.chapters, setHistory, currentMove, setCurrentMove, s.currentChapterIdx]);

  const giveHint = () => {
    const nextMoves = getNextMoves();
    if (nextMoves.length < 1) return;
    const uniqueFromSquares = new Set(nextMoves.map((m) => m.from));
    const markers: Marker[] = [];
    uniqueFromSquares.forEach((from) => {
      markers.push({ square: from, type: MARKER_TYPE.circle });
    });
    dispatch({ type: 'setMarkers', markers })
  }

  const showMoves = useCallback(() => {
    const nextMoves = getNextMoves();
    if (nextMoves.length < 1) return;
    const arrows = nextMoves.map(
      (m) => ({ type: blueArrowType, from: m.from, to: m.to })
    );
    dispatch({ type: 'clearMarkersAndSetArrows', arrows: arrows });
  }, [getNextMoves]);

  useEffect(() => {
    if (lesson.chapters.length > 1) {
      dispatch({ type: 'changeSelectedMobileTab', value: MobileTab.Chapters })
    }
    return () => window.clearTimeout(timeoutRef.current);
  }, [])

  // This useEffect handles updates after a new lesson, chapter changes, or pgn changes
  useEffect(() => {

    const makeLines = (): Record<string, LineStats>[] => {
      const result: Record<string, LineStats>[] = [];
      lesson.chapters.forEach((chapter) => {
        const chapterLines: Record<string, LineStats> = {};
        const sanLines = getLinesFromPGN(chapter.pgn);
        const lanLines = sanLines.map((l) => convertSanLineToLanLine(l.split(/\s+/)));
        lanLines.forEach((line) => {
          chapterLines[line.join(' ')] = { isComplete: false };
        });
        result.push(chapterLines);
      });
      return result;
    }

    // This function contains everything that this useEffect may do.
    // This function may not run. See below.
    const performUpdate = (options?: { keepLines?: boolean, mode?: Mode }) => {
      // Create the new lines object
      let lines: Record<string, LineStats>[] = [{}];
      if (options && options.keepLines) {
        lines = s.lines;
      } else {
        lines = makeLines();
      }

      // Determine the next mode
      let nextMode = s.fallbackMode;
      if (options && options.mode) nextMode = options.mode;
      if (lines[s.currentChapterIdx] != undefined) {
        if (Object.keys(lines[s.currentChapterIdx]).length < 1) nextMode = Mode.Edit;
      }
      if (s.mode === Mode.Edit) nextMode = Mode.Edit;

      resetEvaler();
      reset();
      dispatch({
        type: 'setupNewLesson',
        lines,
        linesChapterIdx: s.currentChapterIdx,
        nextMode,
      });
    };

    const isDifferentLesson = (): boolean => {
      if (lesson == undefined) return false;
      if (prevLesson == undefined) return true;
      return lesson.title !== prevLesson.title;
    };

    const isDifferentChapter = (): boolean => {
      return s.currentChapterIdx !== s.linesChapterIdx;
    }

    const wasPgnUpdated = (): boolean => {
      if (isDifferentLesson()) return false;
      if (lesson.chapters[s.currentChapterIdx] == undefined) return false;
      return lesson.chapters[s.currentChapterIdx].pgn !== prevLesson!.chapters[s.currentChapterIdx].pgn;
    }

    if (!s.hasFirstLoadCompleted) {
      // On the first load, load the opening mode from local storage
      const mode = loadOpeningModeFromLocalStorage(lesson.title);
      mode ? performUpdate({ mode }) : performUpdate();
      return;
    } else if (isDifferentLesson()) {
      performUpdate();
      return;
    } else if (wasPgnUpdated()) {
      performUpdate();
      return;
    } else if (isDifferentChapter()) {
      // When changing chapters, keep record of which lines from other chapters have been completed.
      performUpdate({ keepLines: true });
      return;
    }
  }, [lesson, prevLesson, resetEvaler, s.mode, s.lines, s.hasFirstLoadCompleted, s.currentChapterIdx, s.linesChapterIdx])

  useEffect(() => {
    // If currentMove hasn't actually changed, do nothing
    if (areCmMovesEqual(currentMove, previousMove)) return;

    // If there are markers or arrows on the board, remove them
    if (s.markers.length > 0 || s.arrows.length > 0) {
      dispatch({ type: 'removeAllMarkersAndArrows' });
    }
  }, [currentMove, previousMove, s.markers.length, s.arrows.length]);

  useEffect(() => {
    // If we're in practice mode and the currentMove hasn't changed, make sure that
    // any arrows and markers have been removed from the board.
    if (s.mode === Mode.Practice && areCmMovesEqual(currentMove, previousMove)) {
      dispatch({ type: 'removeAllMarkersAndArrows' });
    }

    // When in Learn mode and it is the player's turn, show arrows representing the correct move(s).
    if (s.mode === Mode.Learn && !isOpponentsTurn()) {

      // To avoid code repitition, define this function here. This function will setup a
      // timeout to run showMoves after a short wait, which will draw arrows on the board.
      // This function will either be called from afterChessboardMoveDo, or not. See below.
      const setupTimeout = () => {
        timeoutRef.current = window.setTimeout(() => {
          showMoves();
          timeoutRef.current = 0;
        }, 600);
      }

      // If the currentMove hasn't changed, the board will not animate, so don't wait for afterChessboardMoveDo.
      if (areCmMovesEqual(currentMove, previousMove)) { setupTimeout();

      // If the currentMove has changed, we want to wait until after chessboard animation
      } else {
        afterChessboardMoveDo.current.push(() => {
          setupTimeout();
        });
      }
    }
  }, [currentMove, previousMove, s.mode, isOpponentsTurn, showMoves])

  useEffect(() => {
    if (s.mode !== Mode.Learn) return;
    if (isOpponentsTurn()) return;
    if (prevMode === Mode.Learn) return;
    showMoves();
  }, [s.mode]);

  // This useEffect handles automatic opponent moves and wrong move animation
  // in Practice mode and Learn mode.
  useEffect(() => {
    // If we aren't in practice mode or learn mode, do nothing
    if (s.mode !== Mode.Practice && s.mode !== Mode.Learn) return;

    // If currentMove is undefined, do nothing
    if (currentMove == undefined) return;

    // If currentMove hasn't actually changed, do nothing
    if (areCmMovesEqual(currentMove, previousMove)) return;

    // If the user has already completed a line, stop here.
    if (s.recentlyCompletedLine != null) return;

    // If there are no relevant lines, the user has made a mistake.
    // Perform wrong answer actions and do nothing else.
    const relevantLines = getRelevantLessonLines();
    if (relevantLines.length < 1) {
      performWrongAnswerActions();
      return;
    }

    // If there are relevant lines, then a correct move has been played.
    // If a lesson has alternative moves for the user, the user could play a
    // move that is only in lines that have already been completed.
    // In that case, tell the user to play an alternative move instead.
    if (
      isOpponentsTurn() &&
      relevantLines.every((rLine => s.lines[s.currentChapterIdx][rLine].isComplete))
    ) {
      alert("That move is correct but an alternative move exists. Play an alternative move instead.");
      performWrongAnswerActions({ indicateThatTheMoveWasWrong: false });
      return;
    }

    // If currentMove.ply > s.lineProgressIdx, then we need to update the
    // lineProgressIdx and play the next move if the next move is an opponent move.
    if (relevantLines.length > 0 && currentMove.ply > s.lineProgressIdx) {
      dispatch({ type: 'setLineProgressIdx', idx: currentMove.ply });

      // Get a list of the next possible moves.
      // If s.restartedLine is defined, just use the move from the restarted line.
      // Otherwise, get the next moves from the relevant lines.
      let nextMoves: ShortMove[];
      if (s.restartedLine && s.restartedLine[currentMove.ply]) {
        nextMoves = [s.restartedLine[currentMove.ply]];
      } else {
        nextMoves = getNextMoves({ incompleteLinesOnly: true });
      }

      if (isOpponentsTurn() && nextMoves.length > 0 && timeoutRef.current === 0) {
        const nextMove = getRandom(nextMoves);
        timeoutRef.current = window.setTimeout(() => {
          playMove(nextMove!);
          timeoutRef.current = 0;
        }, 600);
      }
    }
  }, [currentMove, getNextMoves, getRelevantLessonLines, isOpponentsTurn,
    performWrongAnswerActions, playMove, previousMove, s.lineProgressIdx,
    s.recentlyCompletedLine, s.restartedLine, s.mode]
  );

  useEffect(() => {
    if (s.recentlyCompletedLine != null) {
      dispatch({ type: 'showLineCompleteModal', show: true });
    }
  }, [s.recentlyCompletedLine])

  useEffect(() => {
    if (s.isChessboardMoving) return;

    if (afterChessboardMoveDo.current.length > 0) {
      afterChessboardMoveDo.current.forEach((f) => {
        f();
      });
      afterChessboardMoveDo.current = [];
    }
  }, [s.isChessboardMoving]);

  // When the lineProgressIdx changes, check if a line has been completed.
  useEffect(() => {
    if (currentMove == undefined) return;
    if (s.recentlyCompletedLine) return;
    if (s.lineProgressIdx === 0) return;
    if (currentMove.ply !== s.lineProgressIdx) return;
    const relevantLines = getRelevantLessonLines({ incompleteLinesOnly: true })

    const currentLine = getLineFromCmMove(currentMove);
    const matchingLine = relevantLines.find((line) => {
      const relevantLine = convertLanLineToShortMoves(line.split(' '));
      return areLinesEqual(relevantLine, currentLine);
    });
    if (matchingLine == undefined) return;
    if (s.lines[s.currentChapterIdx][matchingLine] == undefined) throw new Error('Line not found');
    if (s.lines[s.currentChapterIdx][matchingLine].isComplete) return;
    dispatch({ type: 'declareLineComplete', completedLine: matchingLine })
  }, [s.lineProgressIdx, s.lines, cmchess, currentMove, getRelevantLessonLines,
  s.recentlyCompletedLine, s.currentChapterIdx])

  // When the userColor is BLACK, this useEffect is necessary to perform the first
  // opponent move of each line.
  useEffect(() => {
    if (currentMove) return;
    if (s.lineProgressIdx !== 0) return;
    const nextMoves = getNextMoves({ incompleteLinesOnly: true });
    if (nextMoves.length < 1) return;
    if (isOpponentsTurn() && timeoutRef.current === 0) {
      const nextMove = getRandom(nextMoves);
      timeoutRef.current = window.setTimeout(() => {
        playMove(nextMove!);
        timeoutRef.current = 0;
      }, 600);
    }

    // Cleanup: clear timeout if effect re-runs or component unmounts
    return () => {
      if (timeoutRef.current !== 0) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = 0;
      }
    };
  }, [currentMove, getNextMoves, isOpponentsTurn, playMove, s.lineProgressIdx])

  // If we have a best move from the engine and the engine is on, show the move
  // on the board with an arrow
  useEffect(() => {
    if (s.isEvaluatorOn && currentMove && engineLines[currentMove.fen]) {
      const posLines = engineLines[currentMove.fen];
      const best = posLines.find((l) => l.multipv === 1);
      if (best == undefined || best.lanLine.length < 1) return;
      const engineMove = lanToShortMove(best.lanLine[0]);
      const arrow = {
        type: blueArrowType,
        from: engineMove.from,
        to: engineMove.to
      };
      dispatch({ type: 'clearMarkersAndSetArrows', arrows: [arrow] })
    }
  }, [s.isEvaluatorOn, engineLines, currentMove])

  useEffect(() => {
    if (s.mode === Mode.Edit && prevMode !== Mode.Edit) {
      putAllLessonLinesInHistory();
    }
    if (s.currentChapterIdx !== prevChapterIdx && s.mode === Mode.Edit) {
      putAllLessonLinesInHistory();
    }
  }, [s.mode, prevMode, putAllLessonLinesInHistory, s.currentChapterIdx, prevChapterIdx]);

  const chessboard = (
    <div className="relative">
      <BlinkOverlay blinkCount={s.wrongAnswerBlinkCount} />
      <Chessboard
        boardSize={boardSize}
        currentMove={currentMove}
        fenOverride={s.boardFenOverride ? s.boardFenOverride : undefined}
        isLoading={s.isLoading}
        orientation={lesson.userColor}
        animate={s.allowBoardAnimation}
        playMove={playMove}
        isMoveAllowed={isMoveAllowed}
        allowInteraction={s.allowBoardInteraction}
        cursor={s.boardCursor ? s.boardCursor : undefined}
        markers={s.markers}
        arrows={s.arrows}
        nextMoveSound={s.nextBoardMoveSound ? s.nextBoardMoveSound : undefined}
        onNextMoveSoundUsed={() => dispatch({ type: 'clearMoveSound' })}
        changeIsMoving={(b) => {
          if (b !== s.isChessboardMoving) {
            dispatch({ type: 'setIsChessboardMoving', value: b });
          }
        }}
      />
    </div>
  );

  const chessboardDiv = (
    <div className='relative' style={{ height: boardSize, width: boardSize }}>
      <NewChapterModal
        show={s.showNewChapterModal}
        lesson={lesson}
        onClose={() => dispatch({ type: 'showNewChapterModal', show: false })}
      />
      <LineCompleteModal
        show={s.showLineCompleteModal}
        onClose={() => dispatch({ type: 'showLineCompleteModal', show: false })}
        setupNextLine={setupNextLine}
        restartCurrentLine={restartCurrentLine}
        changeChapter={changeChapter}
        isNextLineInAnotherChapter={isNextLineInAnotherChapter}
        getIdxOfNextIncompleteChapter={getIdxOfNextIncompleteChapter}
        areAllLinesComplete={areAllLinesComplete}
      />
      {chessboard}
    </div>
  );

  let chaptersDivHeight = `${boardSize}px`;
  let chaptersDivWidth = '275px';
  if (shouldUseMobileLayout(windowSize)) {
    chaptersDivHeight = '100%';
    chaptersDivWidth = `${boardSize - 2}px`;
  }

  let lessonChapters: React.ReactNode = <></>;

  let isMoreThanOneChapter = false;
  if (lesson.chapters.length > 1) isMoreThanOneChapter = true;

  if (isMoreThanOneChapter) {
    lessonChapters = (
      <LessonChapters
        lesson={lesson}
        currentChapterIdx={s.linesChapterIdx ?? 0}
        lines={s.lines}
        changeChapter={changeChapter}
        heightStyle={chaptersDivHeight}
        widthStyle={chaptersDivWidth}
        useMobileLayout={shouldUseMobileLayout(windowSize) || false}
      />
    );
  }

  const engineDisplay = (
    <EvalerDisplay
      isEngineOn={s.isEvaluatorOn}
      setIsEngineOn={(b) => dispatch({ type: 'setIsEvaluatorOn', value: b })}
      gameEvals={gameEvals}
      currentMove={currentMove}
      evalerMaxDepth={evalDepth}
      engineName={engineName}
      engineLines={engineLines}
      isEvaluating={fenBeingEvaluated !== null}
      maxLineLength={4}
      numLines={numLines}
      isSwitchDisabled={s.mode === Mode.Learn || s.mode === Mode.Practice}
      switchDisabledMsg={'Complete the line to unlock the engine'}
      showMoveJudgements={false}
    />
  )

  const lessonSessionInfo = (
    <LessonSessionInfo
      lesson={lesson}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      history={history}
      giveHint={giveHint}
      showMove={showMoves}
      isSessionLoading={s.isLoading}
      areAllLinesComplete={areAllLinesComplete}
      isNextLineInAnotherChapter={isNextLineInAnotherChapter}
      getIdxOfNextIncompleteChapter={getIdxOfNextIncompleteChapter}
      isLineComplete={s.recentlyCompletedLine != null}
      lines={s.lines}
      lineProgressIdx={s.lineProgressIdx}
      mode={s.mode}
      fallbackMode={s.fallbackMode}
      setupNextLine={setupNextLine}
      restartCurrentLine={restartCurrentLine}
      changeMode={(mode: Mode) => { 
        if (!allowEdits && mode === Mode.Edit) return;
        dispatch({ type: 'changeMode', lessonTitle: lesson.title, mode })
      }}
      currentChapterIdx={s.currentChapterIdx}
      changeChapter={changeChapter}
    />
  );

  const movesDisplay = (
    <MovesDisplay
      history={history}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      useMobileLayout={shouldUseMobileLayout(windowSize)}
      showVariations={s.mode !== Mode.Practice}
    />
  );

  const arrowButtons = (
    <ArrowButtons
      history={history}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      excludeStartAndEndBtns={shouldUseMobileLayout(windowSize)}
    />
  );

  const containerClasses = ['flex flex-col items-center justify-center w-full h-full'];

  const showDebugButtons = false;

  const debug = () => {
    console.log('debug');
  };

  if (shouldUseMobileLayout(windowSize)) {
    // Account for navigation bar height (40px / 2.5rem / h-10)
    const navBarHeight = 40;
    const divHeight = (windowSize.height || 0) - navBarHeight;

    return (
      <ScrollLock>
        <div
          style={{ height: divHeight }}
          className={containerClasses.join(' ')}
        >
          <div className="p-1">
            <h2 className="text-2xl">{lesson.title}</h2>
            {showDebugButtons && (
              <>
                <button onClick={debug}>debug!</button>
              </>
            )}
          </div>
          {chessboardDiv}
          <div className='p-2 flex flex-row w-screen justify-between'>
            {lessonSessionInfo}
            <div>{arrowButtons}</div>
          </div>
          <div className="flex-1 px-1 w-[calc(100vw-20px)] rounded-md bg-background-page overflow-y-scroll overflow-x-hidden">
            {s.selectedMobileTab === MobileTab.Chapters && lessonChapters}
            {s.selectedMobileTab === MobileTab.Moves && movesDisplay}
            {s.selectedMobileTab === MobileTab.Engine && engineDisplay}
          </div>
          <div className="flex flex-row w-full justify-around items-center bg-[#1b1a18] min-h-[55px]">
            {isMoreThanOneChapter &&
              <IconButton
                icon={Svg.Bookmark}
                onClick={() => dispatch({
                  type: 'changeSelectedMobileTab',
                  value: MobileTab.Chapters,
                })}
                text={'Chapters'}
                isHighlighted={s.selectedMobileTab === MobileTab.Chapters}
              />
            }
            <IconButton
              icon={Svg.SwoopyArrow}
              onClick={() => dispatch({
                type: 'changeSelectedMobileTab',
                value: MobileTab.Moves,
              })}
              text={'Moves'}
              isHighlighted={s.selectedMobileTab === MobileTab.Moves}
            />
            <IconButton
              icon={Svg.Lightbulb}
              onClick={() => dispatch({
                type: 'changeSelectedMobileTab',
                value: MobileTab.Engine,
              })}
              text={'Engine'}
              isHighlighted={s.selectedMobileTab === MobileTab.Engine}
            />
          </div>
        </div>
      </ScrollLock>
    );
  }

  return (
    <ScrollLock>
      <div className={containerClasses.join(' ')}>
        <div style={{ width: `${boardSize + 8 + 275}px` }}> {/* boardSize + right col margin + right col width */}
          <div className="text-center" style={{ width: isMoreThanOneChapter ? '100%' : `${boardSize}px` }}>
          <h2 className="text-[2rem] h-12">{lesson.title}</h2>
          </div>
        </div>
        <div className="flex flex-row">
          {isMoreThanOneChapter && (
            <div
              className="bg-background-page mr-2 rounded-md px-1"
              style={{ height: boardSize }} >
              {lessonChapters}
            </div>
          )}
          <div className="flex flex-col items-center">
            {chessboardDiv}
            <div className="mt-3 w-full">{lessonSessionInfo}</div>
          </div>
          <div className="ml-2 w-[275px]">
            <div
              style={{ height: boardSize }}
              className="flex flex-col flex-1 items-center w-full"
            >
              <div className="bg-background-page w-full p-2 rounded-md">
                {engineDisplay}
              </div>
              <div
                className="my-1 rounded-md p-1 w-full flex-1 min-h-0 overflow-y-scroll no-scrollbar bg-background-page"
              >
                {movesDisplay}
              </div>
              {allowEdits && (
                <div className="rounded-md w-full bg-background-page">
                  <EditLessonControls
                    currentMove={currentMove}
                    lesson={lesson}
                    currentChapterIdx={s.currentChapterIdx}
                    history={history}
                    mode={s.mode}
                    fallbackMode={s.fallbackMode}
                    onEditModeBtnClick={handleEditModeBtnClick}
                    deleteCurrentMove={deleteCurrentMove}
                    onDiscardChangesBtnClick={handleDiscardChangesBtnClick}
                    setupNextLine={setupNextLine}
                    openAddNewChapterModal={openAddNewChapterModal}
                    doUnsavedChangesExist={doUnsavedChangesExist}
                    savedLines={savedLines}
                  />
                </div>
              )}
              {arrowButtons}
            </div>
          </div>
        </div>
        {showDebugButtons && (
          <>
            <button onClick={debug}>debug!</button>
          </>
        )}
      </div>
    </ScrollLock>
  );
};

export default LessonSession;
