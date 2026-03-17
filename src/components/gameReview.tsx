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
import usePgnAnalyzerParallel from '@/hooks/usePgnAnalyzerParallel';
import useForcingLineFinderParallel from '@/hooks/useForcingLineFinderParallel';
import { AnalyzerStatus } from '@/types/analyzer';
import useEngineArrowCreator from '@/hooks/useEngineArrowCreator';
import IconButton from '@/components/iconButton';
import { Svg } from '@/components/svgIcon';
import usePrevious from '@/hooks/usePrevious';
import { updateGameAnalysis } from '@/app/game-review/actions';
import FlashcardCreator from './flashcardCreator';
import { useFenAnalyzers } from '@/contexts/FenAnalyzersContext';
import { makeEvaluationsArray } from '@/utils/chess';

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

  const [depth, setDepth] = useState(20);
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
  const [isGameEvaluationComplete, setIsGameEvaluationComplete] = useState(false);

  const fenAnalyzers = useFenAnalyzers();

  // Set up chessboard engine
  const {
    cmchess,
    history,
    setHistory,
    currentMove,
    setCurrentMove,
    playMove,
  } = useChessboardEngine();

  const currentMoveAnalyzer = useCurrentMoveAnalyzer(
    currentMove,
    { depth: 18, numLines: 2 }
  );

  // Set up PGN analyzer
  const pgnAnalyzer = usePgnAnalyzerParallel(depth, 2);

  // Set up forcing line finder
  const forcingLineFinder = useForcingLineFinderParallel();

  useEngineArrowCreator(
    currentMoveAnalyzer.isOn,
    fenAnalyzers.evaluations,
    currentMoveAnalyzer.latestEvaluations,
    currentMove,
    (newArrows) => dispatch({ type: 'setArrows', arrows: newArrows })
  );

  const prevAnalyzerStatus = usePrevious(pgnAnalyzer.status);
  const prevIsCurrentMoveAnalyzerOn = usePrevious(currentMoveAnalyzer.isOn);


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
        Object.keys(fenAnalyzers.evaluations).length > 0
    ) {
      // Save a copy of evaluations that only contains evaluations of the game
      setGameEvaluation({...fenAnalyzers.evaluations});
      setIsGameEvaluationComplete(true);

      // Save analysis results to db
      if (game.id) {
        updateGameAnalysis(game.id, fenAnalyzers.evaluations)
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
  }, [pgnAnalyzer.status, prevAnalyzerStatus, game.id, fenAnalyzers.evaluations])

  // When we get the game...
  useEffect(() => {
    if (game) {
      loadPgnIntoCmChess(game.pgn, cmchess.current);
      setHistory(cmchess.current.history());
      if (game.engineAnalysis) {
        fenAnalyzers.setEvaluations(game.engineAnalysis);
        setGameEvaluation(game.engineAnalysis);
        setIsGameEvaluationComplete(true);
      }

      setHasGameLoaded(true);
    } else {
      setHasGameLoaded(false);
    }
  }, [game]);


  // On first load: setup workers and start analysis
  useEffect(() => {
    fenAnalyzers.setupWorkers()
      .then(() => fenAnalyzers.setEvaluations({}))
      .then(() => fenAnalyzers.newGame())
      .then(() => {
        if (game.engineAnalysis) {
          // Game already analyzed, enable current move analyzer
          currentMoveAnalyzer.setIsOn(true);
        }
      })
      .catch((error) => {
        if (error.message?.includes('terminated during setup')) {
          console.log('Worker setup cancelled due to navigation');
        } else {
          console.error('Error setting up workers:', error);
        }
      });
  }, []);


  // While analyzing game, update gameEvaluations every time evaluations changes.
  useEffect(() => {
    if (pgnAnalyzer.status === AnalyzerStatus.Analyzing) {
      setGameEvaluation(fenAnalyzers.evaluations);
    }
  }, [fenAnalyzers.evaluations, pgnAnalyzer.status]);


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
      evaluations={fenAnalyzers.evaluations}
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
              currentMove={currentMove}
              hasGameBeenAnalyzed={isGameEvaluationComplete}
              forcingLineFinder={forcingLineFinder}
              isCreatingFlashcard={isCreatingFlashcard}
              changeIsCreatingFlashcard={setIsCreatingFlashcard}
            />
            <button onClick={() => {
              console.log('debug');
              console.log(makeEvaluationsArray(fenAnalyzers.evaluations));
              console.log(fenAnalyzers.status);
            }}>
              debug
            </button>
          </div>
        </div>
      </div>
    </ScrollLock>
  );
};

export default GameReview;
