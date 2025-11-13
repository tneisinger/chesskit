'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import ChessJS from '../chessjs';
import { Square } from 'chess.js';
import { ShortMove, PieceColor } from '../types/chess';
import PromoteModal from '@/components/promoteModal';
import Spinner from './spinner';
import {
  Arrows,
  ArrowTypeConfig,
} from 'cm-chessboard/src/extensions/arrows/Arrows';
import { MarkerTypeConfig, Markers } from 'cm-chessboard/src/extensions/markers/Markers';
import { FEN, Move } from 'cm-chess/src/Chess';
import {
  Chessboard,
  Props as BoardProps,
  INPUT_EVENT_TYPE,
  COLOR,
  MoveInputEvent,
  BORDER_TYPE,
} from 'cm-chessboard/src/Chessboard';
import 'cm-chessboard/assets/chessboard.css';
import 'cm-chessboard/assets/extensions/arrows/arrows.css';
import 'cm-chessboard/assets/extensions/markers/markers.css';
import { toColor } from '../utils/cmchess';
import { getFen, getPlyFromFen } from '../utils/chess';

const showDevButtons = false;

export interface Arrow {
  from: string;
  to: string;
  type: ArrowTypeConfig;
}

export interface Marker {
  type: MarkerTypeConfig;
  square: string;
}

export enum Cursor {
  Arrow,
  Hand,
  Wait,
}

export enum MoveSound {
  Silence,
  Move,
  Capture,
}

export interface Props {
  currentMove: Move | undefined;
  boardSize: number;
  orientation?: PieceColor;
  playMove?: (_move: ShortMove) => void;
  animate?: boolean;
  markers?: Marker[];
  setMarkers?: (_markers: Marker[]) => void;
  arrows?: Arrow[];
  setArrows?: (_arrows: Arrow[]) => void;
  isLoading?: boolean;
  isMoveAllowed?: (_move: ShortMove) => boolean;
  allowInteraction?: boolean;
  cursor?: Cursor;
  elemId?: string;

  // Use this function to tell the parent component when the board is animating.
  // In the parent, create a useState boolean, and pass the setter as this function.
  changeIsMoving?: (_isMoving: boolean) => void;

  nextMoveSound?: MoveSound
  onNextMoveSoundUsed?: () => void;

  // If this is undefined, the board position will be determined by the value of currentMove.
  // If fenOverride is defined, fenOverride sets the board position.
  fenOverride?: string;

  // style properties for cm-chessboard
  showCoordinates?: boolean;
  borderType?: BORDER_TYPE;
  cssClass?: string;
  setPiecesAfterOrientation?: boolean;

  // If you want to limit user input to only one piece color, set this value to
  // the color that you want the user to be able to control.
  limitMoveInputToColor?: PieceColor;

  // A callback function that will run after the user has completed a move on the board.
  afterUserMove?: (shortMove: ShortMove) => void;

  // The sound that will play when a non-capture move is played.
  moveSound?: HTMLAudioElement;

  // The sound that will play when a capture move is played.
  takeSound?: HTMLAudioElement;
}

const CmChessboard = ({
  currentMove,
  boardSize,
  orientation,
  animate,
  playMove,
  markers,
  setMarkers = () => { return },
  arrows,
  isLoading,
  isMoveAllowed,
  cursor,
  allowInteraction = true,
  elemId = 'board',

  setArrows = () => { return },
  // Set a do-nothing function as the default value
  changeIsMoving = () => { return },

  nextMoveSound,
  onNextMoveSoundUsed = () => { return },
  fenOverride,
  showCoordinates,
  borderType,
  cssClass,
  // Set this to true if you expect to get a defined orientation value and
  // you don't want to display the pieces until after you know the orientation.
  // This makes the orientation flip less jarring.
  setPiecesAfterOrientation = false,

  limitMoveInputToColor,
  afterUserMove = () => { return },
  moveSound,
  takeSound,
}: Props) => {
  const [prevOrientation, setPrevOrientation] = useState<PieceColor | undefined>(
    undefined
  );

  const [showPromoteModal, setShowPromoteModal] = useState(false);

  const [promoteColor, setPromoteColor] = useState<'w' | 'b'>('w');

  const [promoteEvent, setPromoteEvent] = useState<MoveInputEvent | null>(null);

  // This value will get incremented after every time that `board.current.setPosition`
  // completes its promise. The `setPosition` function returns a promise which resolves
  // when the board animation completes. This state value is necessary because in some
  // cases, (for instance if nothing has to move on the board) the `setPosition`
  // animation will complete too quickly for a `isMoving` state change to be
  // detected by the parent component. To avoid that problem, we run `changeIsMoving(true)` 
  // before running `board.current.setPosition`. Then, after the promise resolves, we
  // increment this value. Finally, in a useEffect that is listening to changes to this
  // value, `changeIsMoving(false)` will be run.
  const [boardPosChangeNum, setBoardPosChangeNum] = useState(0);

  if (animate == undefined) animate = true;

  const board = useRef<Chessboard | undefined>(undefined);

  const chessjs = useRef(new ChessJS());

  const boardFen = useRef<string | undefined>(undefined);

  const allowSound = useRef(false);
  const allowNextSound = useRef(false);

  const validateMoveInputEvent = useRef<MoveInputEvent | null>(null);

  const playMoveSound = useCallback((san?: string, plyChange?: number) => {
    if (!allowSound.current) return;

    if (!allowNextSound.current) {
      allowNextSound.current = true;
      return;
    }

    // If the parent component has defined the nextMoveSound, play that sound
    if (nextMoveSound != undefined) {
      if (nextMoveSound === MoveSound.Move && moveSound) soundPlay(moveSound);
      if (nextMoveSound === MoveSound.Capture && takeSound) soundPlay(takeSound);
      onNextMoveSoundUsed();
      return;
    }

    // If we know that the new move was a capture and that the ply change was 1
    // forward, play the capture sound
    if (san && san.includes('x') && plyChange && plyChange === 1) {
      if (!takeSound) return;
      soundPlay(takeSound);
      return;
    }

    // Otherwise, try to play the moveSound
    if (!moveSound) return;
    soundPlay(moveSound);
  }, [moveSound, nextMoveSound, onNextMoveSoundUsed, takeSound]);

  const getOrientation = useCallback((): COLOR => {
    return orientation === PieceColor.BLACK ? COLOR.black : COLOR.white;
  }, [orientation]);

  // Whenever `boardPosChangeNum` changes, inform the parent component that the
  // board is no longer in the middle of an animation.
  useEffect(() => {
    changeIsMoving(false);
  }, [boardPosChangeNum, changeIsMoving]);

  const changeBoardPosition = useCallback((fen: string, san?: string, animate = true): Promise<void> => {
    if (board.current) {
      // Get the number of ply difference between the current boardFen and the new fen.
      let plyChange = undefined;
      if (boardFen.current) {
        plyChange = getPlyFromFen(fen) - getPlyFromFen(boardFen.current);
      }

      boardFen.current = fen;
      if (board.current.removeArrows) board.current.removeArrows();
      setArrows([]);

      if (board.current.removeMarkers) board.current.removeMarkers();
      setMarkers([]);

      // If the new position is an empty chessboard, do not play a move sound
      if (fen !== FEN.empty) playMoveSound(san, plyChange);

      // If the new position is an empty chessboard, do not play the next move sound.
      if (fen === FEN.empty) allowNextSound.current = false;

      // Tell the parent component that the board is animating
      changeIsMoving(true);

      board.current.setPosition(fen, animate).then(() =>
        // Increment `setBoardPosChangeNum` so that we can run `changeIsMoving(false)`
        // after the parent component has had a change to detect a change to `isMoving`
        setBoardPosChangeNum((n) => n + 1)
      );
    }
    return Promise.resolve();
  }, [setArrows, changeIsMoving, playMoveSound]);

  const performMove = useCallback((shortMove: ShortMove) => {
    const chessjsMove = chessjs.current.move(shortMove);
    if (!chessjsMove) throw new Error(`Unable to play move ${shortMove}`);
    changeBoardPosition(chessjs.current.fen(), chessjsMove.san, false)
      .then(() => afterUserMove(shortMove));

    if (playMove != undefined) playMove(shortMove);
  }, [afterUserMove, playMove, changeBoardPosition]);

  const enableMoveInput = useCallback(() => {
    const handleMoveFinished = (event: MoveInputEvent) => {
      const ev = validateMoveInputEvent.current;
      if (event.type !== INPUT_EVENT_TYPE.moveInputFinished) {
        throw new Error('Expected moveInputFinished event');
      }

      if (ev === null) {
        console.log('ev was null');
        console.log(event);
        return;
      }

      const shortMove: ShortMove = {
        from: ev.squareFrom as Square,
        to: ev.squareTo as Square
      }

      // If the isMoveAllowed predicate is defined and that predicate determines that
      // the move is not allowed, then don't play the move.
      if (isMoveAllowed != undefined && !isMoveAllowed(shortMove)) {
        validateMoveInputEvent.current = null;
        return;
      }

      // Get the relevant legal moves
      const moves = chessjs.current.moves({ square: ev.squareFrom as Square, verbose: true })
        // @ts-ignore: This expression is not callable
        .filter((m: any) => m.to === ev.squareTo);

      // If there is more than one legal move, that means that a promotion is required
      if (moves.length > 1) {
        setPromoteColor(chessjs.current.turn());
        setPromoteEvent(ev);
        setShowPromoteModal(true);
        if (ev.squareFrom && ev.squareTo) {
          board.current?.movePiece(ev.squareFrom, ev.squareTo);
        }
        validateMoveInputEvent.current = null;
        return;
      }
      if (moves.length === 1) performMove(shortMove);
      validateMoveInputEvent.current = null;
    }

    const inputHandler = (event: MoveInputEvent) => {
      console.log(event);
      if (!allowInteraction) return;

      // If the `limitMoveInputToColor` prop is defined, then do nothing if it is not
      // currently that color to move.
      if (limitMoveInputToColor) {
        const inputColor = toColor(limitMoveInputToColor);
        if (chessjs.current.turn() !== inputColor) return;
      }

      if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
        const moves = chessjs.current.moves({
          square: event.square as Square | undefined,
          verbose: true
        });
        return moves.length > 0;
      } else if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
        validateMoveInputEvent.current = event;
      } else if (event.type === INPUT_EVENT_TYPE.moveInputCanceled) {
        validateMoveInputEvent.current = null;
      } else if (event.type === INPUT_EVENT_TYPE.moveInputFinished) {
        handleMoveFinished(event);
      }
    };

    if (board.current == undefined) return;
    board.current.disableMoveInput();
    board.current.enableMoveInput(inputHandler);
  }, [allowInteraction, limitMoveInputToColor, isMoveAllowed, performMove]);

  const soundPlay = (sound: HTMLAudioElement): void => {
    sound.play().catch((error) => {
      if (error.name && error.name === 'NotAllowedError') {
        console.warn(error.message);
      } else {
        setTimeout(() => { throw error });
      }
    })
  }

  const handlePromoteClick = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (promoteEvent == null) throw new Error('promoteEvent was null');
    const shortMove: ShortMove = {
      from: promoteEvent.squareFrom as Square,
      to: promoteEvent.squareTo as Square,
      promotion: piece,
    }
    performMove(shortMove);
    setPromoteEvent(null);
    setShowPromoteModal(false);
  }

  useEffect(() => {
    const elem = document.getElementById(elemId);

    if (!elem) throw new Error(`No element with id ${elemId} was found`);
    if (elem.childNodes.length > 0) {
      while (elem.firstChild) elem.removeChild(elem.firstChild);
    }

    const emptyFen = FEN.empty;

    const boardProps: BoardProps = {
      position: emptyFen,
      orientation: orientation === PieceColor.BLACK ? COLOR.black : COLOR.white,
      responsive: true,
      style: {
        borderType,
        cssClass,
        showCoordinates,
        pieces: {
          file: '/assets/pieces/staunty.svg'
        },
      },
      extensions: [
        { class: Arrows, props: {sprite: '/assets/extensions/arrows/arrows.svg'}},
        {
          class: Markers,
          props: {
            sprite: '/assets/extensions/markers/markers.svg',
            autoMarkers: null,
          }
        },
      ]
    }

    board.current = new Chessboard(elem, boardProps);
    boardFen.current = emptyFen;
    return () => { if (board.current && board.current.removeArrows) board.current.removeArrows() }
  }, [borderType, cssClass, showCoordinates, elemId, orientation ]);

  useEffect(() => {
    // Only run setOrientation if the new orientation is different from prevOrientation.
    // We do this because setOrientation causes the pieces to blink, so we only want to
    // run setOrientation when absolutely necessary.
    if (board.current && orientation !== prevOrientation) {
      board.current.setOrientation(getOrientation());
      setPrevOrientation(orientation);
    }
  }, [orientation, getOrientation, setPrevOrientation, prevOrientation]);

  useEffect(() => {
    if (!board.current) return;
    enableMoveInput();
    if (isLoading) board.current.disableMoveInput();

    // If fenOverride is defined, use that. Otherwise, get the fen from the currentMove
    const fen = fenOverride ? fenOverride : getFen(currentMove);
    chessjs.current.load(fen);

    if (!isLoading && prevOrientation != undefined && boardFen.current !== fen) {
      if (!allowSound.current) allowSound.current = true;
      const san = currentMove ? currentMove.san : undefined;
      if (setPiecesAfterOrientation && orientation == undefined) return;
      changeBoardPosition(fen, san, animate);
    } else if (fenOverride && isLoading && fenOverride !== boardFen.current) {
      changeBoardPosition(fenOverride);
    }
  },
    [currentMove, isLoading, prevOrientation, fenOverride, animate,
      orientation, setPiecesAfterOrientation, enableMoveInput, changeBoardPosition,
    ]);

  useEffect(() => {
    enableMoveInput();
  },
    [nextMoveSound, limitMoveInputToColor, afterUserMove, allowInteraction,
      enableMoveInput
    ]);

  useEffect(() => {
    if (board.current && board.current.removeMarkers) {
      board.current.removeMarkers(undefined, undefined);
      if (markers && board.current.addMarker) {
        const addMarker = board.current.addMarker;
        markers.forEach(({ square, type }) => addMarker(type, square));
      }
    }
  }, [markers]);

  useEffect(() => {
    if (board.current && board.current.removeArrows) {
      board.current.removeArrows();
      if (arrows && board.current.addArrow) {
        const addArrow = board.current.addArrow;
        arrows.forEach(({from, to, type}) => addArrow(type, from, to));
      }
    }
  }, [arrows]);

  const containerStyles = ['relative'];

  if (cursor === Cursor.Wait) {
    containerStyles.push('[&_*]:!cursor-wait');
  } else if (cursor === Cursor.Arrow) {
    containerStyles.push('[&_*]:!cursor-default');
  } else if (cursor === Cursor.Hand) {
    containerStyles.push('[&_*]:!cursor-pointer');
  }

  const debug = () => {
    console.log('debug');
  }

  return (
    <div className={containerStyles.join(' ')} style={{ width: boardSize, height: boardSize }}>
      <div style={{ width: boardSize, height: boardSize }} id={elemId}></div>
      <PromoteModal
        show={showPromoteModal}
        color={promoteColor}
        handleClick={handlePromoteClick}
        pieceSize={boardSize * 0.10}
      />
      {isLoading && board.current && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[15]">
          <Spinner scale={2} alwaysDark={true} centerOrigin/>
        </div>
      )}
      {showDevButtons && (
        <button onClick={debug}>debug</button>
      )}
    </div>
  );
};

export default CmChessboard;
