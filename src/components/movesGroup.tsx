import React from 'react';
import { Move } from 'cm-chess/src/Chess';
import MovePair from '@/components/movePair';
import { makeMoveHistoryHtml } from '@/utils/movesDisplay';

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

    // const classes = [styles.variations];
    // if (props.useMobileLayout) classes.push(styles.mobileLayout);

    return (
      <div>
        {variations}
      </div>
    );
    // return (
    //   <div className={classes.join(' ')}>
    //     {variations}
    //   </div>
    // );
  }

  const makeVariationHtml = (variation: Move[]) => {
    // const classes = [styles.variation];
    // if (inVariation) classes.push(styles.inVariation);
    // if (props.useMobileLayout) {
    //   classes.push(styles.mobileLayout);
    // }

    return (
      <div key={`variation_${variation[0].san}`}>
        {makeMoveHistoryHtml({
          moves: variation,
          currentMove,
          changeCurrentMove: props.changeCurrentMove,
          keyMoves: props.keyMoves,
          isVariation: true,
          useMobileLayout: props.useMobileLayout,
          showVariations: props.showVariations,
        })}
      </div>
    );
    // return (
    //   <div
    //     className={classes.join(' ')}
    //     key={`variation_${variation[0].san}`}
    //   >
    //     {makeMoveHistoryHtml({
    //       moves: variation,
    //       currentMove,
    //       changeCurrentMove: props.changeCurrentMove,
    //       keyMoves: props.keyMoves,
    //       isVariation: true,
    //       useMobileLayout: props.useMobileLayout,
    //       showVariations: props.showVariations,
    //     })}
    //   </div>
    // );
  }

  if (!hasVariations(whiteMove) || !props.showVariations) {
    return (
      <React.Fragment>
        <MovePair {...props} />
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
