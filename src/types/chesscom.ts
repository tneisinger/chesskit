export interface Accuracies {
  white: number;
  black: number;
}

export interface PlayerDetails {
  '@id': string;
  rating: number;
  result: string;
  username: string;
  uuid: string;
}

export interface ChesscomGame {
  accuracies: Accuracies;
  black: PlayerDetails;
  white: PlayerDetails;
  start_time: number;
  end_time: number;
  fen: string;
  initial_setup: string;
  pgn: string;
  rated: boolean;
  rules: string;
  tcn: string;
  time_class: string;
  time_control: string;
  url: string;
  uuid: string;
}
