'use client';

import { useState, useEffect, useReducer, useCallback } from 'react';
import { ScrollLock } from '@/components/ScrollLock';
import { GameData, Evaluations } from '@/types/chess';
import { Cursor, MoveSound, Arrow } from '@/components/cmChessboard';
import { Marker, loadPgnIntoCmChess } from '@/utils/cmchess';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import GameDetails from '@/components/gameDetails';
import Chessboard from '@/components/Chessboard';
import NewMovesDisplay from './newMovesDisplay';
import ArrowButtons from '@/components/arrowButtons';
import GameAnalysis from '@/components/gameAnalysis';
import EngineDisplay from '@/components/engineDisplay';
import { shouldUseMobileLayout } from '@/utils/mobileLayout';
import useWindowSize from '@/hooks/useWindowSize';
import { NAV_BAR_HEIGHT } from '@/lib/constants';
import useCurrentMoveAnalyzer from '@/hooks/useCurrentMoveAnalyzer';
import usePgnAnalyzerParallel, { AnalyzerStatus } from '@/hooks/usePgnAnalyzerParallel';
import useForcingLineFinderParallel from '@/hooks/useForcingLineFinderParallel';
import useEngineArrowCreator from '@/hooks/useEngineArrowCreator';
import IconButton from '@/components/iconButton';
import { Svg } from '@/components/svgIcon';
import usePrevious from '@/hooks/usePrevious';
import { updateGameAnalysis } from '@/app/game-review/actions';
import FlashcardCreator from './flashcardCreator';
import { useBookPositions } from '@/contexts/BookPositionsContext';
import { StockfishSettings } from '@/hooks/useFenAnalyzer';

enum MobileTab {
  Moves = 'Moves',
  Engine = 'Engine',
}

interface State {
  allowBoardInteraction: boolean;
  boardCursor: Cursor | null;
  markers: Marker[];
  arrows: Arrow[];
  nextBoardMoveSound: MoveSound | null;
  isChessboardMoving: boolean;
  selectedMobileTab: MobileTab;
}

type Action =
  | { type: 'setMarkers'; markers: Marker[] }
  | { type: 'setArrows'; arrows: Arrow[] }
  | { type: 'clearMoveSound' }
  | { type: 'setMoveSound'; sound: MoveSound }
  | { type: 'setIsChessboardMoving'; value: boolean }
  | { type: 'changeSelectedMobileTab'; value: MobileTab }
  | { type: 'removeAllMarkersAndArrows' };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'setMarkers':
      return { ...s, markers: a.markers };
    case 'setArrows':
      return { ...s, arrows: a.arrows };
    case 'clearMoveSound':
      return { ...s, nextBoardMoveSound: null };
    case 'setMoveSound':
      return { ...s, nextBoardMoveSound: a.sound };
    case 'setIsChessboardMoving':
      return { ...s, isChessboardMoving: a.value };
    case 'changeSelectedMobileTab':
      return { ...s, selectedMobileTab: a.value };
    case 'removeAllMarkersAndArrows':
      return { ...s, markers: [], arrows: [] };
    default:
      return s;
  }
}

interface Props {
  game: GameData;
}

const GameReview = ({ game }: Props) => {
  const windowSize = useWindowSize();

  const [depth, setDepth] = useState(18);
  const [numLines, setNumLines] = useState(2);
  const [hasGameLoaded, setHasGameLoaded] = useState(false);
  const [isCreatingFlashcard, setIsCreatingFlashcard] = useState(false);

  const initialState: State = {
    allowBoardInteraction: true,
    boardCursor: null,
    markers: [],
    arrows: [],
    nextBoardMoveSound: null,
    isChessboardMoving: false,
    selectedMobileTab: MobileTab.Moves,
  };

  const [s, dispatch] = useReducer(reducer, initialState);

  const [gameEvaluation, setGameEvaluation] = useState<Evaluations>({});
  const [evaluations, setEvaluations] = useState<Evaluations>({});
  const [isGameEvaluationComplete, setIsGameEvaluationComplete] = useState(false);


  const { bookPositions, isLoading, error } = useBookPositions();


  // Set up chessboard engine
  const {
    cmchess,
    history,
    setHistory,
    currentMove,
    setCurrentMove,
    playMove,
  } = useChessboardEngine();


  const fenAnalyzerSettings: StockfishSettings = {
    numThreads: 1,
    hashSize: 128,
    initializeImmediately: false,
    evaluations,
    setEvaluations,
  }


  const currentMoveAnalyzer = useCurrentMoveAnalyzer(
    8, // Number of useFenAnalyzer instances to use
    currentMove,
    fenAnalyzerSettings, // settings for each instance
    { depth: 18, numLines: 2 }
  );


  // Set up PGN analyzer
  const pgnAnalyzer = usePgnAnalyzerParallel(
    8, // Number of useFenAnalyzer instances to use
    fenAnalyzerSettings, // settings for each instance
    depth,
    numLines
  );

  // Set up forcing line finder
  const forcingLineFinder = useForcingLineFinderParallel(
    8,
    fenAnalyzerSettings, // settings for each instance
  );


  useEngineArrowCreator(
    currentMoveAnalyzer.isOn,
    evaluations,
    currentMoveAnalyzer.latestEvaluations,
    currentMove,
    (newArrows) => dispatch({ type: 'setArrows', arrows: newArrows })
  );

  const prevAnalyzerStatus = usePrevious(pgnAnalyzer.status);
  const prevIsCurrentMoveAnalyzerOn = usePrevious(currentMoveAnalyzer.isOn);


  const setupForcingLineFinder = useCallback(async (): Promise<void> => {
    currentMoveAnalyzer.terminateWorkers();
    pgnAnalyzer.terminateWorkers();
    await forcingLineFinder.setupWorkers();
  }, [currentMoveAnalyzer.terminateWorkers, pgnAnalyzer.terminateWorkers, forcingLineFinder.setupWorkers]);


  const setupCurrentMoveAnalyzer = useCallback(async (): Promise<void> => {
    forcingLineFinder.terminateWorkers();
    pgnAnalyzer.terminateWorkers();
    await currentMoveAnalyzer.setupWorkers();
  }, [forcingLineFinder.terminateWorkers, pgnAnalyzer.terminateWorkers, currentMoveAnalyzer.setupWorkers]);


  const setupPgnAnalyzer = useCallback((): void => {
    currentMoveAnalyzer.terminateWorkers();
    forcingLineFinder.terminateWorkers();
    pgnAnalyzer.setupWorkers();
  }, [currentMoveAnalyzer.terminateWorkers, forcingLineFinder.terminateWorkers, pgnAnalyzer.setupWorkers]);


  // Clear markers and arrows when turning off current move analysis
  useEffect(() => {
    if (prevIsCurrentMoveAnalyzerOn && !currentMoveAnalyzer.isOn) {
      dispatch({ type: 'setMarkers', markers: [] });
      dispatch({ type: 'setArrows', arrows: [] });
    }
  }, [currentMoveAnalyzer.isOn, prevIsCurrentMoveAnalyzerOn]);


  // When pgn analysis completes, save the results to the db
  useEffect(() => {
    if (prevAnalyzerStatus == AnalyzerStatus.Analyzing &&
        pgnAnalyzer.status == AnalyzerStatus.Idle &&
        Object.keys(evaluations).length > 0
    ) {
      // Save a copy of evaluations that only contains evaluations of the game
      setGameEvaluation({...evaluations});
      setIsGameEvaluationComplete(true);

      setupCurrentMoveAnalyzer();

      // Save analysis results to db
      if (game.id) {
        updateGameAnalysis(game.id, evaluations)
          .then((result:any) => {
            if (result.success) {
              console.log('Game analysis saved successfully');
            } else {
              console.error('Failed to save game analysis:', result.error);
            }
          })
          .catch((error: any) => {
            console.error('Error saving game analysis:', error);
          });
      }
    }
  }, [pgnAnalyzer.status, prevAnalyzerStatus, game.id, evaluations, setupCurrentMoveAnalyzer])

  // When we get the game...
  useEffect(() => {
    if (game) {
      loadPgnIntoCmChess(game.pgn, cmchess.current);
      setHistory(cmchess.current.history());
      if (game.engineAnalysis) {
        setEvaluations(game.engineAnalysis);
        setGameEvaluation(game.engineAnalysis);
        setIsGameEvaluationComplete(true);
      }

      setHasGameLoaded(true);
    } else {
      setHasGameLoaded(false);
    }
  }, [game]);


  // If we have engineAnalysis for the game, setup the currentMoveAnalyer.
  // Otherwise, setup the pgnAnalyzer so the game can be analyzed.
  useEffect(() => {
    if (game.engineAnalysis) {
      setupCurrentMoveAnalyzer();
    } else {
      setupPgnAnalyzer();
    }
  }, []);


  // Terminate all workers when component unmounts to prevent memory leaks and unnecessary computations
  useEffect(() => {
    return () => {
      currentMoveAnalyzer.terminateWorkers();
      pgnAnalyzer.terminateWorkers();
      forcingLineFinder.terminateWorkers();
    }
  }, []);


  // While analyzing game, update gameEvaluations every time evaluations changes.
  useEffect(() => {
    if (pgnAnalyzer.status === AnalyzerStatus.Analyzing) {
      setGameEvaluation(evaluations);
    }
  }, [evaluations, pgnAnalyzer.status]);


  // Calculate board size
  const useMobile = shouldUseMobileLayout(windowSize);
  const boardSize = useMobile
    ? Math.min(windowSize.width || 400, windowSize.height || 400) - 10
    : 600;

  const chessboard = (
    <div className="relative">
      <Chessboard
        boardSize={boardSize}
        currentMove={currentMove}
        orientation={game.userColor}
        animate={true}
        playMove={playMove}
        isMoveAllowed={() => true}
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
    <div className="relative" style={{ height: boardSize, width: boardSize }}>
      {chessboard}
    </div>
  );

  const engineDisplay = (
    <EngineDisplay
      currentMoveAnalyzer={currentMoveAnalyzer}
      evaluations={evaluations}
      currentMove={currentMove}
      maxLineLengthPx={shouldUseMobileLayout(windowSize) ? windowSize.width! - 6 : 275}
      isSwitchDisabled={!isGameEvaluationComplete}
      switchDisabledTooltip='Analyze the game to unlock the engine'
      showMoveJudgements={false}
      colorLineScores={true}
    />
  );

  const movesDisplay = (
    <NewMovesDisplay
      history={history}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      useMobileLayout={useMobile}
      showVariations={true}
    />
  );

  const arrowButtons = (
    <ArrowButtons
      history={history}
      currentMove={currentMove}
      changeCurrentMove={setCurrentMove}
      excludeStartAndEndBtns={useMobile}
    />
  );

  if (useMobile) {
    const divHeight = (windowSize.height || 0) - NAV_BAR_HEIGHT;

    return (
      <ScrollLock>
        <div
          style={{ height: divHeight }}
          className='flex flex-col items-center justify-center w-full h-full'
        >
          {chessboardDiv}
          <div className="p-2 flex flex-row w-screen justify-center">
            <div>{arrowButtons}</div>
          </div>
          <div className="flex flex-1 w-[calc(100vw-20px)] rounded-md bg-background-page overflow-y-scroll overflow-x-hidden">
            {s.selectedMobileTab === MobileTab.Moves && movesDisplay}
            {s.selectedMobileTab === MobileTab.Engine && engineDisplay}
          </div>
          <div className="flex flex-row w-full justify-around items-center bg-[#1b1a18] min-h-[55px]">
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

  const leftColWidth = "w-56";
  const rightColWidth = 275;

  return (
    <ScrollLock>
      <div className='flex flex-col items-center justify-center w-full h-full gap-2 mt-2'>
        <div className="flex flex-row gap-2">
          <div className={`flex flex-col ${leftColWidth} gap-2`}>
            <GameDetails game={game} orientation={game.userColor} />
          </div>
          <div className="flex flex-col items-center gap-2">
            {chessboardDiv}
          </div>
          <div style={{ width: rightColWidth }}>
            <div
              style={{ height: boardSize }}
              className="flex flex-col flex-1 items-center w-full"
            >
              <div className="flex bg-background-page w-full rounded-md min-h-4">
                {engineDisplay}
              </div>
              <div
                className="my-1 rounded-md w-full flex-1 min-h-0 overflow-y-scroll no-scrollbar bg-background-page"
              >
                {movesDisplay}
              </div>
              {arrowButtons}
            </div>
          </div>
        </div>
        <div className="flex-1 w-full flex flex-row gap-2 mb-4">
          <div className={`${leftColWidth}`} />
          <div style={{ width: boardSize }}>
            {hasGameLoaded && (
              <GameAnalysis
                game={game}
                analyzePgn={pgnAnalyzer.analyzePgn}
                depth={depth}
                changeDepth={setDepth}
                numLines={numLines}
                changeNumLines={setNumLines}
                pgnAnalyzerStatus={pgnAnalyzer.status}
                pgnAnalysisProgress={pgnAnalyzer.progress}
                isGameEvaluationComplete={isGameEvaluationComplete}
                gameEvaluation={gameEvaluation}
                currentMove={currentMove}
                changeCurrentMove={setCurrentMove}
                history={history}
                width={boardSize}
              />
            )}
          </div>
          <div style={{ width: rightColWidth }}>
            <FlashcardCreator
              game={game}
              evaluations={evaluations}
              currentMove={currentMove}
              hasGameBeenAnalyzed={isGameEvaluationComplete}
              setupForcingLineFinder={setupForcingLineFinder}
              setupCurrentMoveAnalyzer={setupCurrentMoveAnalyzer}
              forcingLineFinder={forcingLineFinder}
              isCreatingFlashcard={isCreatingFlashcard}
              changeIsCreatingFlashcard={setIsCreatingFlashcard}
            />
          </div>
        </div>
      </div>
    </ScrollLock>
  );
};

export default GameReview;
