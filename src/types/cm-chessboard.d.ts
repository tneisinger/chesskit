declare module 'cm-chessboard/src/Chessboard' {
  import { ArrowTypeConfig } from 'cm-chessboard/src/cm-chessboard/extensions/arrows/Arrows.js';

  export interface Props {
    position?: string;
    orientation?: COLOR;
    responsive?: boolean;
    assetsUrl?: string;
    assetsCache?: boolean;
    style?: {
      cssClass?: string;
      showCoordinates?: boolean;
      borderType?: BORDER_TYPE;
      aspectRatio?: number;
      pieces?: {
        file: string,
      }
    };
    animationDuration?: number;
    extensions?: {
      class: unknown,
      props?: Record<string, unknown>
    }[]
  }

  export enum COLOR {
    white = 'w',
    black = 'b',
  }

  export enum INPUT_EVENT_TYPE {
    moveInputStarted = 'moveInputStarted',
    movingOverSquare = "movingOverSquare",
    validateMoveInput = 'validateMoveInput',
    moveInputCanceled = 'moveInputCanceled',
    moveInputFinished = 'moveInputFinished',
  }

export enum POINTER_EVENTS {
    pointercancel = "pointercancel",
    pointerdown = "pointerdown",
    pointerenter = "pointerenter",
    pointerleave = "pointerleave",
    pointermove = "pointermove",
    pointerout = "pointerout",
    pointerover = "pointerover",
    pointerup = "pointerup"
}

  export enum MARKER_TYPE {
      frame = {class: "marker-frame", slice: "markerFrame"},
      square = {class: "marker-square", slice: "markerSquare"},
      dot = {class: "marker-dot", slice: "markerDot"},
      circle = {class: "marker-circle", slice: "markerCircle"}
  }

  export interface Marker {
    square: string;
    type: MARKER_TYPE;
  }

  export enum SQUARE_SELECT_TYPE {
    primary = 'primary',
    secondary = 'secondary',
  }

  export enum BORDER_TYPE {
      none = "none", // no border
      thin = "thin", // thin border
      frame = "frame" // wide border with coordinates in it
  }

  export enum PIECE {
      wp = "wp",
      wb = "wb",
      wn = "wn",
      wr = "wr",
      wq = "wq",
      wk = "wk",
      bp = "bp",
      bb = "bb",
      bn = "bn",
      br = "br",
      bq = "bq",
      bk = "bk",
  }

  export enum PIECE_TYPE {
      pawn = "p",
      knight = "n",
      bishop = "b",
      rook = "r",
      queen = "q",
      king = "k",
  }

  export interface MoveInputEvent {
    chessboard: Chessboard;
    type: INPUT_EVENT_TYPE;
    square?: string;
    squareFrom?: string;
    squareTo?: string;
  }

  export interface SquareSelectEvent {
    type: SQUARE_SELECT_TYPE;
  }

  type MoveInputHandler = (event: MoveInputEvent, color?: COLOR) => void;

  type SquareSelectHandler = (event: SquareSelectEvent) => void;

  declare class Chessboard {
    constructor(element: HTMLElement | null, props?: Props);

    movePiece(
      squareFrom: Square,
      squareTo: Square,
      animated?: boolean
    ): Promise<undefined>;

    setPosition(fen: string, animated?: boolean): Promise<undefined>;

    getPosition(): string;

    enableMoveInput(handler: MoveInputHandler, color?: COLOR);

    disableMoveInput(): void;

    enableSquareSelect(handler: SquareSelectHandler);

    disableSquareSelect(): void;

    addMarker(type: MARKER_TYPE, square: Square);

    getMarkers(type?: MARKER_TYPE, square?: string);

    removeMarkers(type?: MARKER_TYPE, square?: string);

    setOrientation(color: COLOR);

    addArrow(type: ArrowTypeConfig, from: string, to: string);

    removeArrows(type?: ArrowTypeConfig, from?: string, to?: string);

    destroy(): void;
  }
}
