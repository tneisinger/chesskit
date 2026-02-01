import React from 'react';
import { Move } from 'cm-chess/src/Chess';
import MovePair from './movePair';
import { makeMoveHistoryHtml } from '../utils/movesDisplay';

export interface Props {
  whiteMove?: Move;
  blackMove?: Move;
  currentMove?: Move;
  isLast?: boolean;
  inVariation?: boolean;
  keyMoves?: Move[];
  changeCurrentMove: (newCurrentMove?: Move) => void;
  useMobileLayout?: boolean;
  showVariations: boolean;
  contextMenu?: Record<string, (move: Move) => void>;
}

const hasVariations = (move: Move | undefined): boolean => {
  if (move == undefined) return false;
  return move.variations.length > 0;
}

const MovesGroup = (props: Props) => {
  const { whiteMove, blackMove, currentMove, isLast, inVariation } = props;

  if (whiteMove == undefined && blackMove == undefined) {
    throw new Error('whiteMove and blackMove were both undefined.');
  }

  const makeVariationsHtml = (move: Move) => {
    const variations = move.variations.map((v) => makeVariationHtml(v));

    if (inVariation) return variations;

    const classes = ['bg-gray-500 px-1'];
    if (props.useMobileLayout) classes.push('rounded mr-1 pb-0');

    return (
      <div className={classes.join(' ')}>
        {variations}
      </div>
    );
  }

  const makeVariationHtml = (variation: Move[]) => {
    const classes = ['text-sm py-1 before:content-["("] after:content-[")"] [&_.inVariation]:inline [&_.inVariation]:pr-1'];
    if (inVariation) classes.push('inVariation');
    if (props.useMobileLayout) {
      classes.push('inline-block');
    }

    return (
      <div
        className={classes.join(' ')}
        key={`variation_${variation[0].san}`}
      >
        {makeMoveHistoryHtml({
          moves: variation,
          currentMove,
          changeCurrentMove: props.changeCurrentMove,
          keyMoves: props.keyMoves,
          isVariation: true,
          useMobileLayout: props.useMobileLayout,
          showVariations: props.showVariations,
          contextMenu: props.contextMenu,
        })}
      </div>
    );
  }

  if (!hasVariations(whiteMove) || !props.showVariations) {
    return (
      <React.Fragment>
        <MovePair {...props} contextMenu={props.contextMenu} />
        {blackMove && hasVariations(blackMove) && props.showVariations && (
          makeVariationsHtml(blackMove)
        )}
      </React.Fragment>
    );
  }

  if (whiteMove && hasVariations(whiteMove)) {
    return (
      <React.Fragment>
        <MovePair
          whiteMove={whiteMove}
          currentMove={currentMove}
          isLast={false}
          inVariation={inVariation}
          keyMoves={props.keyMoves}
          changeCurrentMove={props.changeCurrentMove}
          useMobileLayout={props.useMobileLayout}
          contextMenu={props.contextMenu}
        />
        {makeVariationsHtml(whiteMove)}
        {blackMove && (
          <MovePair
            blackMove={blackMove}
            currentMove={currentMove}
            isLast={isLast}
            inVariation={inVariation}
            keyMoves={props.keyMoves}
            changeCurrentMove={props.changeCurrentMove}
            useMobileLayout={props.useMobileLayout}
            contextMenu={props.contextMenu}
          />
        )}
        {blackMove && hasVariations(blackMove) && makeVariationsHtml(blackMove)}
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
    </React.Fragment>
  );
};

export default MovesGroup;
