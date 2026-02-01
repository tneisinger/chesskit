import React, { useEffect, useRef } from 'react';
import { Move } from 'cm-chess/src/Chess';
import { areMovesEqual } from '../utils/cmchess';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu';

interface Props {
  history: Move[];
  currentMove: Move | undefined;
  changeCurrentMove: (newCurrentMove?: Move) => void;
  keyMoves?: Move[];
  useMobileLayout?: boolean;
  showVariations?: boolean;
  contextMenu?: Record<string, (move: Move) => void>;
}

interface MoveDisplayProps {
  move: Move;
  currentMove: Move | undefined;
  changeCurrentMove: (newCurrentMove?: Move) => void;
  isKeyMove: boolean;
  isInVariation: boolean;
  contextMenu?: Record<string, (move: Move) => void>;
}

const MoveDisplay: React.FC<MoveDisplayProps> = ({
  move,
  currentMove,
  changeCurrentMove,
  isKeyMove,
  isInVariation,
  contextMenu,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isSelected = currentMove && areMovesEqual(move, currentMove);

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  const classes = [];

  if (isSelected) {
    classes.push('bg-[#3692e7]');
  } else {
    classes.push('hover:bg-neutral-600');
  }

  if (isKeyMove) {
    classes.push('border border-red-600');
  }

  let content = (
    <span
      ref={ref}
      className={['py-0.5 px-1 rounded cursor-pointer', ...classes].join(' ')}
      onClick={() => changeCurrentMove(move)}
    >
      {move.san}
    </span>
  );

  if (!isInVariation) {
    content = (
      <span className={['flex-[0_0_41%] py-1 pl-3 cursor-pointer', ...classes].join(' ')}>
        {content}
      </span>
    );
  }

  if (!contextMenu) {
    return content;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {content}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {Object.entries(contextMenu).map(([text, handler]) => (
          <ContextMenuItem key={text} onSelect={() => handler(move)}>
            {text}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
};

const NewMovesDisplay: React.FC<Props> = ({
  history,
  currentMove,
  changeCurrentMove,
  keyMoves = [],
  useMobileLayout = false,
  showVariations = true,
  contextMenu,
}) => {
  const topOfDisplay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentMove === undefined && topOfDisplay.current) {
      topOfDisplay.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMove]);

  const isKeyMove = (move: Move): boolean => {
    return keyMoves.some((km) => areMovesEqual(km, move));
  };

  const renderVariation = (
    variation: Move[],
    depth: number
  ): React.ReactNode => {
    if (variation.length === 0) return null;

    // Create indent spacing using depth
    const indentStyle = depth > 0 ? { paddingLeft: `${depth * 1}rem` } : {};
    const moves: React.ReactNode[] = [];

    let i = 0;
    while (i < variation.length) {
      const move = variation[i];
      const moveNumber = Math.floor(move.ply / 2) + 1;
      const isWhiteMove = move.color === 'w';

      // Wrap move number and move together in an inline-block container
      // This keeps them together when wrapping occurs
      moves.push(
        <span key={move.fen} className="inline-block mr-2 whitespace-nowrap">
          {(isWhiteMove || i === 0) && (
            <span className="text-gray-400 mr-1">
              {moveNumber}.{!isWhiteMove && '..'}
            </span>
          )}
          <MoveDisplay
            move={move}
            currentMove={currentMove}
            changeCurrentMove={changeCurrentMove}
            isKeyMove={isKeyMove(move)}
            isInVariation={true}
            contextMenu={contextMenu}
          />
        </span>
      );

      // Check for variations on this move
      if (showVariations && move.variations.length > 0) {
        const variationElements = move.variations.map((v, idx) => (
          <div key={`${move.fen}-var-${idx}`}>
            {renderVariation(v, depth + 1)}
          </div>
        ));

        // Return what we have so far, then variations, then recurse for rest
        return (
          <>
            <div className="text-sm dark:text-gray-200" style={indentStyle}>
              {moves}
            </div>
            {variationElements}
            {i + 1 < variation.length && renderVariation(variation.slice(i + 1), depth)}
          </>
        );
      }

      i++;
    }

    return (
      <div className="text-sm dark:text-gray-200" style={indentStyle}>
        {moves}
      </div>
    );
  };

  const renderMainLine = (): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < history.length) {
      const whiteMove = history[i];
      const blackMove = history[i + 1];
      const moveNumber = Math.floor(whiteMove.ply / 2) + 1;

      // Check if white move has variations
      if (showVariations && whiteMove.variations.length > 0) {
        // Render the main move pair first
        elements.push(
          <div key={`pair-${whiteMove.fen}`} className="flex">
            <span className="flex-[0_0_18%] text-gray-400  text-center bg-neutral-700 py-1 border-r-1 border-neutral-600">{moveNumber}</span>
              <MoveDisplay
                move={whiteMove}
                currentMove={currentMove}
                changeCurrentMove={changeCurrentMove}
                isKeyMove={isKeyMove(whiteMove)}
                isInVariation={false}
                contextMenu={contextMenu}
              />
            {blackMove && (
                <MoveDisplay
                  move={blackMove}
                  currentMove={currentMove}
                  changeCurrentMove={changeCurrentMove}
                  isKeyMove={isKeyMove(blackMove)}
                  isInVariation={false}
                  contextMenu={contextMenu}
                />
            )}
          </div>
        );

        // Render variations
        whiteMove.variations.forEach((variation, idx) => {
          elements.push(
            <div key={`${whiteMove.fen}-var-${idx}`} className="pl-4 py-1 bg-neutral-700 max-w-full border-y-1 border-neutral-600">
              {renderVariation(variation, 0)}
            </div>
          );
        });

        // Check if black move has variations
        if (blackMove && showVariations && blackMove.variations.length > 0) {
          blackMove.variations.forEach((variation, idx) => {
            elements.push(
              <div key={`${blackMove.fen}-var-${idx}`} className="ml-4 max-w-full">
                {renderVariation(variation, 0)}
              </div>
            );
          });
        }

        i += 2;
        continue;
      }

      // Check if black move has variations
      if (blackMove && showVariations && blackMove.variations.length > 0) {
        // Render the main move pair first
        elements.push(
          <div key={`pair-${whiteMove.fen}`} className="flex">
            <span className="flex-[0_0_18%] text-gray-400  text-center bg-neutral-700 py-1 border-r-1 border-neutral-600">{moveNumber}</span>
              <MoveDisplay
                move={whiteMove}
                currentMove={currentMove}
                changeCurrentMove={changeCurrentMove}
                isKeyMove={isKeyMove(whiteMove)}
                isInVariation={false}
                contextMenu={contextMenu}
              />
              <MoveDisplay
                move={blackMove}
                currentMove={currentMove}
                changeCurrentMove={changeCurrentMove}
                isKeyMove={isKeyMove(blackMove)}
                isInVariation={false}
                contextMenu={contextMenu}
              />
          </div>
        );

        // Render black move variations
        blackMove.variations.forEach((variation, idx) => {
          elements.push(
            <div key={`${blackMove.fen}-var-${idx}`} className="ml-4 max-w-full">
              {renderVariation(variation, 0)}
            </div>
          );
        });

        i += 2;
        continue;
      }

      // No variations, render normally
      elements.push(
        <div key={`pair-${whiteMove.fen}`} className="flex">
          <span className="flex-[0_0_18%] text-gray-400 text-center bg-neutral-700 py-1 border-r-1 border-neutral-600">{moveNumber}</span>
            <MoveDisplay
              move={whiteMove}
              currentMove={currentMove}
              changeCurrentMove={changeCurrentMove}
              isKeyMove={isKeyMove(whiteMove)}
              isInVariation={false}
              contextMenu={contextMenu}
            />
          {blackMove ? (
              <MoveDisplay
                move={blackMove}
                currentMove={currentMove}
                changeCurrentMove={changeCurrentMove}
                isKeyMove={isKeyMove(blackMove)}
                isInVariation={false}
                contextMenu={contextMenu}
              />
          ) : (
            <span className="flex-[0_0_41%] text-gray-400">...</span>
          )}
        </div>
      );

      i += 2;
    }

    return elements;
  };

  const classes = ['bg-background-page rounded-md flex flex-col overflow-y-scroll no-scrollbar w-full flex-1 min-h-0'];
  if (useMobileLayout) classes.push('flex-row flex-wrap content-start');

  return (
    <div className={classes.join(' ')}>
      <div ref={topOfDisplay} />
      {renderMainLine()}
    </div>
  );
};

export default NewMovesDisplay;
