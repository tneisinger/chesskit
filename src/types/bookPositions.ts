import { PositionEvaluation } from './chess';

export interface BookPosition {
  name: string;
  pev: PositionEvaluation;
}

export type BookPositions = Record<string, BookPosition>;
