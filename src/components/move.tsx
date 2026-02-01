import React, { useRef, useEffect } from 'react';
import { Move as MoveType } from 'cm-chess/src/Chess';
import { areMovesEqual } from '../utils/cmchess';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu';

export interface Props {
  move?: MoveType;
  color: 'w' | 'b';
  currentMove?: MoveType;
  isLast?: boolean;
  inVariation?: boolean;
  isKeyMove?: boolean;
  changeCurrentMove: (newCurrentMove?: MoveType) => void;
  contextMenu?: Record<string, (move: MoveType) => void>;
}

const Move = ({
  move,
  color,
  currentMove,
  isLast,
  inVariation,
  isKeyMove,
  changeCurrentMove,
  contextMenu,
}: Props) => {

  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current && move && currentMove && areMovesEqual(move, currentMove)) {
      containerRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentMove, move]);

  let content = '...';
  if (move) {
    content = move.san;
  } else if (isLast && color === 'b') {
    content = '';
  }

  const contentClasses = ['py-0.5 px-1.5 rounded'];

  if (move) {
    contentClasses.push('cursor-pointer');
    if (currentMove && areMovesEqual(move, currentMove)) {
      contentClasses.push('bg-[#3692e7]');
    }
  }

  if (isKeyMove) contentClasses.push('border border-red-600');

  const containerClasses = ['flex-[0_0_38%] dark:text-gray-200'];
  if (inVariation) {
    contentClasses.push('p-0');
    containerClasses.push('inline-block pr-2 last:p-0');
  }

  const moveContent = (
    <span ref={containerRef} className={containerClasses.join(' ')}>
      <span
        className={contentClasses.join(' ')}
        onClick={() => {
          if (move) changeCurrentMove(move);
        }}
      >
        {content}
      </span>
    </span>
  );

  if (!contextMenu || !move) {
    return moveContent;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {moveContent}
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

export default Move;
