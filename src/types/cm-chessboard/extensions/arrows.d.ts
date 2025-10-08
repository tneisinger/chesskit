declare module 'cm-chessboard/src/extensions/arrows/Arrows' {
  export interface ArrowTypeConfig {
    class: string;
  }

  export const ARROW_TYPE: {
    default: ArrowTypeConfig;
    success: ArrowTypeConfig;
    warning: ArrowTypeConfig;
    info: ArrowTypeConfig;
    danger: ArrowTypeConfig;
  };

  export interface ArrowsProps {
    sprite?: string;
    slice?: string;
    headSize?: number;
    offsetFrom?: number;
    offsetTo?: number;
  }

  export class Arrows {
    constructor(chessboard: any, props?: ArrowsProps);

    addArrow(type: ArrowTypeConfig, from: string, to: string): void;

    getArrows(type?: ArrowTypeConfig, from?: string, to?: string): Arrow[];

    removeArrows(type?: ArrowTypeConfig, from?: string, to?: string): void;
  }

  class Arrow {
    from: string;
    to: string;
    type: ArrowTypeConfig;

    constructor(from: string, to: string, type: ArrowTypeConfig);

    matches(from?: string, to?: string, type?: ArrowTypeConfig): boolean;
  }
}
