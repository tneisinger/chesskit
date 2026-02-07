'use client';

import { useState, useEffect, useReducer, useCallback } from 'react';
import { ScrollLock } from '@/components/ScrollLock';
import { GameData, GameEvaluation, MoveJudgement } from '@/types/chess';
import { Cursor, MoveSound, Arrow } from '@/components/cmChessboard';
import { Marker, colorToMove, loadPgnIntoCmChess } from '@/utils/cmchess';
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
import { ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows';
import useGameAnalyzer, { AnalysisStatus } from '@/hooks/useGameAnalyzer';
import IconButton from '@/components/iconButton';
import { Svg } from '@/components/svgIcon';
import usePrevious from '@/hooks/usePrevious';
import { updateGameAnalysis } from '@/app/game-review/actions';
import GameReviewButtons from './gameReviewButtons';
import { getFen, judgeLines, lanToShortMove } from '@/utils/chess';

enum MobileTab {
  Moves = 'Moves',
  Engine = 'Engine',
}

interface State {
  isPositionAnalysisOn: boolean;
  allowBoardInteraction: boolean;
  boardCursor: Cursor | null;
  markers: Marker[];
  arrows: Arrow[];
  nextBoardMoveSound: MoveSound | null;
  isChessboardMoving: boolean;
  selectedMobileTab: MobileTab;
}

type Action =
  | { type: 'setIsPositionAnalysisOn'; value: boolean }
  | { type: 'setMarkers'; markers: Marker[] }
  | { type: 'setArrows'; arrows: Arrow[] }
  | { type: 'clearMoveSound' }
  | { type: 'setMoveSound'; sound: MoveSound }
  | { type: 'setIsChessboardMoving'; value: boolean }
  | { type: 'changeSelectedMobileTab'; value: MobileTab }
  | { type: 'removeAllMarkersAndArrows' };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'setIsPositionAnalysisOn':
      if (a.value === false) {
        return { ...s, isPositionAnalysisOn: a.value, markers: [], arrows: [] };
      }
      return { ...s, isPositionAnalysisOn: a.value };
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
  const [numLines, setNumLines] = useState(2);
  const [hasGameLoaded, setHasGameLoaded] = useState(false);

  const initialState: State = {
    isPositionAnalysisOn: false,
    allowBoardInteraction: true,
    boardCursor: null,
    markers: [],
    arrows: [],
    nextBoardMoveSound: null,
    isChessboardMoving: false,
    selectedMobileTab: MobileTab.Moves,
  };

  const [s, dispatch] = useReducer(reducer, initialState);

  const [gameEvaluation, setGameEvaluation] = useState<GameEvaluation>({});
  const [evaluations, setEvaluations] = useState<GameEvaluation>({});

  // Set up chessboard engine
  const {
    cmchess,
    history,
    setHistory,
    currentMove,
    setCurrentMove,
    playMove,
  } = useChessboardEngine();

  // Set up game analyzer
  const {
    analyzeGame,
    gameAnalysisStatus,
    gameAnalysisProgress,
    engineName,
    fenBeingAnalyzed,
  } = useGameAnalyzer(
    evaluations,
    setEvaluations,
    s.isPositionAnalysisOn,
    currentMove,
    { evalDepth: 20, numLines: 2 }
  );

  const prevGameAnalysisStatus = usePrevious(gameAnalysisStatus);

  const hasGameBeenAnalyzed = useCallback((): boolean => {
    if (gameAnalysisStatus === AnalysisStatus.Complete) return true;
    if (game.engineAnalysis != undefined) return true;
    return false;
  }, [gameAnalysisStatus, game]);

  // When game analysis completes, save the results to the db
  useEffect(() => {
    if (prevGameAnalysisStatus == AnalysisStatus.Analyzing &&
        gameAnalysisStatus == AnalysisStatus.Complete &&
        Object.keys(evaluations).length > 0
    ) {
      // Save a copy of evaluations that only contains evaluations of the game
      setGameEvaluation({...evaluations});

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
  }, [gameAnalysisStatus, prevGameAnalysisStatus, game.id, evaluations])

  // When we get the game...
  useEffect(() => {
    if (game) {
      loadPgnIntoCmChess(game.pgn, cmchess.current);
      setHistory(cmchess.current.history());
      if (game.engineAnalysis) {
        setEvaluations(game.engineAnalysis);
        setGameEvaluation(game.engineAnalysis);
      }
      setHasGameLoaded(true);
    } else {
      setHasGameLoaded(false);
    }
  }, [game]);


  // When the engine is on, draw arrows on the board representing the best moves.
  useEffect(() => {
    // If position analysis is not on, do nothing.
    if (!s.isPositionAnalysisOn) return;

    // If we don't have an evaluation for this position, do nothing.
    const ev = evaluations[getFen(currentMove)];
    if (ev == undefined) return;

    const lineJudgements = judgeLines(colorToMove(currentMove), ev.lines);

    const arrows: Arrow[] = [];

    // Make an arrow for each line
    for (let i = 0; i < ev.lines.length; i++ ) {
      // If the move is not good enough, don't make an arrow for it.
      if (lineJudgements[i] === MoveJudgement.Inaccurate) continue;
      if (lineJudgements[i] === MoveJudgement.Mistake) continue;
      if (lineJudgements[i] === MoveJudgement.Blunder) continue;

      // Get the 'from' and 'to' squares from the first move of this line.
      const { lanLine } = ev.lines[i];
      const firstLanMove = lanLine.trim().split(' ')[0];
      const { from, to } = lanToShortMove(firstLanMove);

      // Determine which ARROW_TYPE to use, which defines the color of the arrow.
      let arrowType;
      switch (lineJudgements[i]) {
        case MoveJudgement.Best:
        case MoveJudgement.Excellent:
          arrowType = ARROW_TYPE.info;
          break;
        case MoveJudgement.Good:
          arrowType = ARROW_TYPE.default;
          break;
        case MoveJudgement.Inaccurate:
          arrowType = ARROW_TYPE.warning;
          break;
        case MoveJudgement.Mistake:
        case MoveJudgement.Blunder:
          arrowType = ARROW_TYPE.danger;
          break;
      }

      // Create an Arrow and add it to our array of arrows.
      arrows.push({ type: arrowType, from, to });
    }

    // Update state, which will draw the arrows on board.
    dispatch({ type: 'setArrows', arrows })
  }, [s.isPositionAnalysisOn, evaluations, currentMove])


  // While analyzing game, update gameEvaluations every time evaluations changes.
  useEffect(() => {
    if (gameAnalysisStatus === AnalysisStatus.Analyzing) {
      setGameEvaluation(evaluations);
    }
  }, [evaluations, gameAnalysisStatus]);


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
      isEngineOn={s.isPositionAnalysisOn}
      setIsEngineOn={(b) => dispatch({ type: 'setIsPositionAnalysisOn', value: b })}
      evaluations={evaluations}
      currentMove={currentMove}
      engineMaxDepth={20}
      engineName={engineName ? engineName : undefined}
      isEvaluating={fenBeingAnalyzed != null}
      maxLineLengthPx={shouldUseMobileLayout(windowSize) ? windowSize.width! - 6 : 275}
      numLines={numLines}
      isSwitchDisabled={!hasGameBeenAnalyzed()}
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
                analyzeGame={analyzeGame}
                depth={depth}
                changeDepth={setDepth}
                numLines={numLines}
                changeNumLines={setNumLines}
                gameAnalysisStatus={gameAnalysisStatus}
                gameAnalysisProgress={gameAnalysisProgress}
                gameEvaluation={gameEvaluation}
                currentMove={currentMove}
                changeCurrentMove={setCurrentMove}
                history={history}
                width={boardSize}
              />
            )}
          </div>
          <div style={{ width: rightColWidth }}>
            <GameReviewButtons
              game={game}
              evaluations={evaluations}
              currentMove={currentMove}
              hasGameBeenAnalyzed={hasGameBeenAnalyzed()}
            />
          </div>
        </div>
      </div>
    </ScrollLock>
  );
};

export default GameReview;
