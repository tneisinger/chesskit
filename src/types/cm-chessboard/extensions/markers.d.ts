declare module 'cm-chessboard/src/extensions/markers/Markers' {
  export interface MarkerTypeConfig {
    class: string;
    slice: string;
    position?: string;
  }

  export const MARKER_TYPE: {
    frame: MarkerTypeConfig;
    framePrimary: MarkerTypeConfig;
    frameDanger: MarkerTypeConfig;
    circle: MarkerTypeConfig;
    circlePrimary: MarkerTypeConfig;
    circleDanger: MarkerTypeConfig;
    circleDangerFilled: MarkerTypeConfig;
    square: MarkerTypeConfig;
    dot: MarkerTypeConfig;
    bevel: MarkerTypeConfig;
  };

  export interface MarkersProps {
    autoMarkers?: MarkerTypeConfig | null;
    sprite?: string;
  }

  export interface Move {
    from: string;
    to: string;
    promotion?: string;
  }

  export class Markers {
    constructor(chessboard: any, props?: MarkersProps);

    addMarker(type: MarkerTypeConfig, square: string): void;

    getMarkers(type?: MarkerTypeConfig, square?: string): Marker[];

    removeMarkers(type?: MarkerTypeConfig, square?: string): void;

    addLegalMovesMarkers(moves: Move[]): void;

    removeLegalMovesMarkers(): void;
  }

  class Marker {
    square: string;
    type: MarkerTypeConfig;

    constructor(square: string, type: MarkerTypeConfig);

    matches(square?: string, type?: MarkerTypeConfig): boolean;
  }
}
