declare module 'cm-chessboard/src/Chessboard' {
  import { MarkerTypeConfig } from 'cm-chessboard/src/extensions/markers/Markers';
  import { ArrowTypeConfig } from 'cm-chessboard/src/extensions/arrows/Arrows';

  // Enums and Constants
  export const COLOR: {
    white: 'w';
    black: 'b';
  };

  export type COLOR = typeof COLOR[keyof typeof COLOR];

  export const INPUT_EVENT_TYPE: {
    moveInputStarted: 'moveInputStarted';
    movingOverSquare: 'movingOverSquare';
    validateMoveInput: 'validateMoveInput';
    moveInputCanceled: 'moveInputCanceled';
    moveInputFinished: 'moveInputFinished';
  };

  export type INPUT_EVENT_TYPE = typeof INPUT_EVENT_TYPE[keyof typeof INPUT_EVENT_TYPE];

  export const POINTER_EVENTS: {
    pointercancel: 'pointercancel';
    pointerdown: 'pointerdown';
    pointerenter: 'pointerenter';
    pointerleave: 'pointerleave';
    pointermove: 'pointermove';
    pointerout: 'pointerout';
    pointerover: 'pointerover';
    pointerup: 'pointerup';
  };

  export type POINTER_EVENTS = typeof POINTER_EVENTS[keyof typeof POINTER_EVENTS];

  export const BORDER_TYPE: {
    none: 'none';
    thin: 'thin';
    frame: 'frame';
  };

  export type BORDER_TYPE = typeof BORDER_TYPE[keyof typeof BORDER_TYPE];

  export const PIECE: {
    wp: 'wp';
    wb: 'wb';
    wn: 'wn';
    wr: 'wr';
    wq: 'wq';
    wk: 'wk';
    bp: 'bp';
    bb: 'bb';
    bn: 'bn';
    br: 'br';
    bq: 'bq';
    bk: 'bk';
  };

  export type PIECE = typeof PIECE[keyof typeof PIECE];

  export const PIECE_TYPE: {
    pawn: 'p';
    knight: 'n';
    bishop: 'b';
    rook: 'r';
    queen: 'q';
    king: 'k';
  };

  export type PIECE_TYPE = typeof PIECE_TYPE[keyof typeof PIECE_TYPE];

  export const PIECES_FILE_TYPE: {
    svgSprite: 'svgSprite';
  };

  export type PIECES_FILE_TYPE = typeof PIECES_FILE_TYPE[keyof typeof PIECES_FILE_TYPE];

  export const FEN: {
    start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    empty: '8/8/8/8/8/8/8/8';
  };

  // Type aliases
  export type Square = string;

  // Interfaces
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
        type?: PIECES_FILE_TYPE;
        file?: string;
        tileSize?: number;
      };
      animationDuration?: number;
    };
    extensions?: Array<{
      class: any;
      props?: Record<string, unknown>;
    }>;
  }

  export interface MoveInputEvent {
    chessboard: Chessboard;
    type: INPUT_EVENT_TYPE;
    square?: string;
    squareFrom?: string;
    squareTo?: string;
    piece?: PIECE | null;
    moveInputCallbackResult?: boolean;
    reason?: string;
    legalMove?: boolean;
  }

  export interface SquareSelectEvent {
    eventType: string;
    event: Event;
    chessboard: Chessboard;
    square: string | null;
  }

  export type MoveInputHandler = (event: MoveInputEvent) => boolean | void;
  export type SquareSelectHandler = (event: SquareSelectEvent) => void;

  // Main Chessboard class
  export class Chessboard {
    constructor(context: HTMLElement, props?: Props);

    // Position management
    setPiece(square: Square, piece: PIECE | null, animated?: boolean): Promise<void>;
    movePiece(squareFrom: Square, squareTo: Square, animated?: boolean): Promise<void>;
    setPosition(fen: string, animated?: boolean): Promise<void>;
    getPosition(): string;
    getPiece(square: Square): PIECE | null;

    // Board orientation
    setOrientation(color: COLOR, animated?: boolean): Promise<void>;
    getOrientation(): COLOR;

    // Move input
    enableMoveInput(eventHandler: MoveInputHandler, color?: COLOR): void;
    disableMoveInput(): void;
    isMoveInputEnabled(): boolean;

    // Square selection
    enableSquareSelect(eventType: POINTER_EVENTS, eventHandler: SquareSelectHandler): void;
    disableSquareSelect(eventType: POINTER_EVENTS): void;
    isSquareSelectEnabled(): boolean;

    // Extensions
    addExtension(extensionClass: any, props?: Record<string, unknown>): void;
    getExtension(extensionClass: any): any;

    // Markers (added by Markers extension)
    addMarker?(type: MarkerTypeConfig, square: Square): void;
    getMarkers?(type?: MarkerTypeConfig, square?: string): any[];
    removeMarkers?(type?: MarkerTypeConfig, square?: string): void;
    addLegalMovesMarkers?(moves: Array<{ from: string; to: string; promotion?: string }>): void;
    removeLegalMovesMarkers?(): void;

    // Arrows (added by Arrows extension)
    addArrow?(type: ArrowTypeConfig, from: string, to: string): void;
    getArrows?(type?: ArrowTypeConfig, from?: string, to?: string): any[];
    removeArrows?(type?: ArrowTypeConfig, from?: string, to?: string): void;

    // Lifecycle
    destroy(): void;

    // Properties (exposed for extensions)
    id: string;
    context: HTMLElement;
    props: Required<Props>;
    state: any;
    view: any;
    extensions: any[];
  }
}
