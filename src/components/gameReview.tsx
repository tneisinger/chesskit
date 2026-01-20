'use client';

import React, { useState, useEffect, useReducer } from 'react';
import { ScrollLock } from '@/components/ScrollLock';
import { GameData, PieceColor, ShortMove } from '@/types/chess';
import { Cursor, MoveSound, Arrow } from '@/components/cmChessboard';
import { Marker, loadPgnIntoCmChess } from '@/utils/cmchess';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import GameDetails from '@/components/gameDetails';
import Chessboard from '@/components/Chessboard';
import EvalerDisplay from '@/components/evalerDisplay';
import MovesDisplay from '@/components/movesDisplay';
import ArrowButtons from '@/components/arrowButtons';
import { shouldUseMobileLayout } from '@/utils/mobileLayout';
import useWindowSize from '@/hooks/useWindowSize';
import { NAV_BAR_HEIGHT } from '@/lib/constants';
import useEvaler from '@/hooks/useChessEvaler';
import IconButton from '@/components/iconButton';
import { Svg } from '@/components/svgIcon';

enum MobileTab {
  Moves = 'Moves',
  Engine = 'Engine',
}

interface State {
  isEvaluatorOn: boolean;
  allowBoardInteraction: boolean;
  boardCursor: Cursor | null;
  markers: Marker[];
  arrows: Arrow[];
  nextBoardMoveSound: MoveSound | null;
  isChessboardMoving: boolean;
  selectedMobileTab: MobileTab;
}

type Action =
  | { type: 'setIsEvaluatorOn'; value: boolean }
  | { type: 'setMarkers'; markers: Marker[] }
  | { type: 'setArrows'; arrows: Arrow[] }
  | { type: 'clearMoveSound' }
  | { type: 'setMoveSound'; sound: MoveSound }
  | { type: 'setIsChessboardMoving'; value: boolean }
  | { type: 'changeSelectedMobileTab'; value: MobileTab }
  | { type: 'removeAllMarkersAndArrows' };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'setIsEvaluatorOn':
      if (a.value === false) {
        return { ...s, isEvaluatorOn: a.value, markers: [], arrows: [] };
      }
      return { ...s, isEvaluatorOn: a.value };
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

  const initialState: State = {
    isEvaluatorOn: false,
    allowBoardInteraction: true,
    boardCursor: null,
    markers: [],
    arrows: [],
    nextBoardMoveSound: null,
    isChessboardMoving: false,
    selectedMobileTab: MobileTab.Moves,
  };

  const [s, dispatch] = useReducer(reducer, initialState);

  // Set up chessboard engine
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

  // Set up engine evaluator
  const {
    setupEvalerForNewGame,
    gameEvals,
    fenBeingEvaluated,
    evalDepth,
    engineName,
    lines: engineLines,
    numLines,
  } = useEvaler(s.isEvaluatorOn, currentMove, { numLines: 2 });

  useEffect(() => {
    if (game) {
      loadPgnIntoCmChess(game.pgn, cmchess.current);
      setHistory(cmchess.current.history());
    }
  }, [game]);

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
    <EvalerDisplay
      isEngineOn={s.isEvaluatorOn}
      setIsEngineOn={(b) => dispatch({ type: 'setIsEvaluatorOn', value: b })}
      gameEvals={gameEvals}
      currentMove={currentMove}
      evalerMaxDepth={evalDepth}
      engineName={engineName}
      engineLines={engineLines}
      isEvaluating={fenBeingEvaluated !== null}
      maxLineLengthPx={useMobile ? (windowSize.width || 400) - 6 : 275}
      numLines={numLines}
      isSwitchDisabled={false}
      switchDisabledMsg={''}
      showMoveJudgements={true}
    />
  );

  const movesDisplay = (
    <MovesDisplay
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

  const containerClasses = ['flex flex-col items-center justify-center w-full h-full'];

  if (useMobile) {
    const divHeight = (windowSize.height || 0) - NAV_BAR_HEIGHT;

    return (
      <ScrollLock>
        <div
          style={{ height: divHeight }}
          className={containerClasses.join(' ')}
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

  return (
    <ScrollLock>
      <div className={containerClasses.join(' ')}>
        <div className="flex flex-row gap-2">
          <div className="flex flex-col w-54">
            <GameDetails game={game} />
          </div>
          <div className="flex flex-col items-center">
            {chessboardDiv}
          </div>
          <div className="w-[275px]">
            <div
              style={{ height: boardSize }}
              className="flex flex-col flex-1 items-center w-full"
            >
              <div className="flex bg-background-page w-full rounded-md min-h-4">
                {engineDisplay}
              </div>
              <div
                className="my-1 rounded-md p-1 w-full flex-1 min-h-0 overflow-y-scroll no-scrollbar bg-background-page"
              >
                {movesDisplay}
              </div>
              {arrowButtons}
            </div>
          </div>
        </div>
      </div>
    </ScrollLock>
  );
};

export default GameReview;
