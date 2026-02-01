import { Move } from 'cm-chess/src/Chess';
import MovesGroup from '@/components/movesGroup';

interface Args {
  moves: Move[];
  currentMove: Move | undefined;
  changeCurrentMove: (newCurrentMove?: Move) => void;
  keyMoves?: Move[];
  isVariation?: boolean;
  useMobileLayout?: boolean;
  showVariations: boolean;
  contextMenu?: Record<string, (move: Move) => void>;
}

export function makeMoveHistoryHtml(args: Args) {
  const result = [];

  /*
  if (args.moves.length < 1) return <React.Fragment></React.Fragment>;

  if (args.gamePuzzles == undefined) args.gamePuzzles = [];

  if (args.gamePuzzles.length > 0) {
    args.keyMoves = args.gamePuzzles.map((gp) => args.moves[gp.puzzle.moveIdx - 1]);
  }

  const firstIncompletePuzzle = getFirstIncompleteGamePuzzle(args.gamePuzzles);

  // If we have a `firstIncompletePuzzle` then we want to truncate `args.moves` so
  // that the user cannot see the moves past the incomplete puzzle.
  if (firstIncompletePuzzle) {

    // If the puzzle is fully incomplete, truncate so that the user cannot see
    // the move that was played in the game.
    if (firstIncompletePuzzle.status === PuzzleStatus.Incomplete) {
      args.moves = args.moves.slice(0, firstIncompletePuzzle.puzzle.moveIdx);

      // if the puzzle is partially complete, that means that the user has completed
      // some but not all of the moves of the puzzle. In that case, we want the user
      // to be able to see the variation they are creating as they solve the puzzle.
      // To do that, we have to show one more move because that one more move is where
      // the variations are stored.
    } else if (firstIncompletePuzzle.status === PuzzleStatus.PartiallyComplete) {
      args.moves = args.moves.slice(0, firstIncompletePuzzle.puzzle.moveIdx + 1);
    }
  }
  */

  const [firstMove, ...rest] = args.moves;
  let restOfMoves = rest;

  if (firstMove && firstMove.color === 'b') {
    result.push(
      <MovesGroup
        blackMove={firstMove}
        currentMove={args.currentMove}
        isLast={args.moves.length === 1}
        inVariation={args.isVariation}
        keyMoves={args.keyMoves}
        changeCurrentMove={args.changeCurrentMove}
        key={`movesGroup_${firstMove.fen}`}
        useMobileLayout={args.useMobileLayout}
        showVariations={args.showVariations}
        contextMenu={args.contextMenu}
      />
    );
  } else {
    restOfMoves = args.moves;
  }

  for (let i = 0; i < restOfMoves.length; i += 2) {
    const whiteMove = restOfMoves[i];
    const blackMove = restOfMoves[i + 1];

    const movesGroupProps = {
      whiteMove,
      blackMove,
      isLast: i + 1 >= restOfMoves.length,
      currentMove: args.currentMove,
      inVariation: args.isVariation,
      changeCurrentMove: args.changeCurrentMove,
    }

    const key = `movesGroup_${whiteMove.fen}`;
    result.push(
      <MovesGroup
        keyMoves={args.keyMoves}
        {...movesGroupProps}
        key={key}
        useMobileLayout={args.useMobileLayout}
        showVariations={args.showVariations}
        contextMenu={args.contextMenu}
      />
    );
  }
  return result;
}
