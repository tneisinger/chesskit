import React, { useState, useEffect, useRef } from 'react';
import { PieceColor, GameData, GameResult } from '@/types/chess';
import Link from 'next/link';
import { getOpening } from '@/utils/bookPositions';
import DotsSpinner from '@/components/dotsSpinner';
import { shouldUseMobileLayout } from '@/utils/mobileLayout';
import { makeReadableTimeControl } from '@/utils/chess';
import useWindowSize from '@/hooks/useWindowSize';

interface Column {
  name: string;
  priority: number;
  makeDataDiv: (game: GameData, key: string) => React.ReactNode;
}

interface Props {
  changeSelectedGameIds: (newGameIds: string[]) => void;
  selectedGameIds: string[];
  isOdd?: boolean;
  game?: GameData;
}

const GamesTableRow = ({
  game,
  isOdd,
  changeSelectedGameIds,
  selectedGameIds,
}: Props) => {
  const [opening, setOpening] = useState<null | string>(null);

  const timeout = useRef(0);

  const windowSize = useWindowSize();

  useEffect(() => {
    if (game) {
      const g = game;
      timeout.current = window.setTimeout(() => {
        setOpening(getOpening(g) || '--');
      }, 0);
    }
    return () => window.clearTimeout(timeout.current);
  }, [game]);

  const getOpponent = (game: GameData): string => {
    let opponent = '';
    if (game.userColor === PieceColor.WHITE && game.blackName) {
      opponent = game.blackName;
    }
    if (game.userColor === PieceColor.BLACK && game.whiteName) {
      opponent = game.whiteName;
    }

    return opponent;
  }

  const makeTableDataDiv = (
    data: React.ReactNode,
    key: string,
    linkToGame?: boolean,
    extraClasses?: string[],
  ) => {
    const isMobile = shouldUseMobileLayout(windowSize);

    // Base classes for table cell
    let classes = ['inline-block'];

    // Width based on column type
    if (key === '') {
      // Checkbox column
      classes.push('w-[60px]');
    } else if (key === 'Opening') {
      // Opening column (only on desktop)
      classes.push('w-[220px]');
    } else {
      // Flexible width columns
      if (isMobile) {
        // Mobile: 4 flexible columns (excluding checkbox)
        classes.push('w-[calc((100%-60px)/4)]');
      } else {
        // Desktop: 6 flexible columns (excluding checkbox and opening)
        classes.push('w-[calc((100%-220px-60px)/6)]');
      }
    }

    // Add any extra classes passed in
    if (extraClasses) classes = [...classes, ...extraClasses];

    if (linkToGame && game) {
      data = <Link href={`/game/${game.gameId}`}>{data}</Link>
    }
    return <div key={key} className={classes.join(' ')}>{data}</div>;
  };

  const makeResultStr = (game: GameData): string => {
    if (game.result === GameResult.Draw) return 'Draw';
    if (game.userColor === PieceColor.WHITE) {
      if (game.result === GameResult.WhiteWins) return 'Win';
      if (game.result === GameResult.BlackWins) return 'Loss';
    }
    if (game.userColor === PieceColor.BLACK) {
      if (game.result === GameResult.WhiteWins) return 'Loss';
      if (game.result === GameResult.BlackWins) return 'Win';
    }
    return '?';
  }

  const makeResultDiv = (game: GameData, key: string) => {
    const result = makeResultStr(game);
    const classes = [];
    if (result === 'Win') classes.push('text-[#57a857]'); // moveColorExcellent
    else if (result === 'Loss') classes.push('text-[#ca3431]'); // moveColorBlunder
    else if (result === 'Draw') classes.push('text-[#f0c15c]'); // moveColorInaccurate
    return makeTableDataDiv(result, key, false, classes);
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (game == undefined) return;
    if (e.target.checked) changeSelectedGameIds([...selectedGameIds, game.gameId]);
    else changeSelectedGameIds(selectedGameIds.filter((id) => id !== game.gameId))
  }

  const checkbox = (
    <input
      type='checkbox'
      checked={game && selectedGameIds.includes(game.gameId)}
      onChange={handleCheckboxChange}
      className="w-10"
    />
  );

  let columns: Column[] = [
    {
      name: '',
      priority: 1,
      makeDataDiv: (_game, key) => makeTableDataDiv(checkbox, key, false, [])
    },
    {
      name: 'Date',
      priority: 2,
      makeDataDiv: (game, key) => {
        const date = new Date(game.startTime);
        const formattedDate = date.toLocaleDateString('en-CA');
        // Manually format to YY/MM/DD
        const yymmdd = formattedDate.substring(2).replace(/-/g, '/');
        const dateSpan = <span className="w-[8ch] block text-left">{yymmdd}</span>;
        return makeTableDataDiv(dateSpan, key, true, []);
      }
    },
    {
      name: 'Time',
      priority: 3,
      makeDataDiv: (game, key) => {
        const tc = game.timeControl ? makeReadableTimeControl(game.timeControl) : '--';
        return makeTableDataDiv(tc, key, true)
      },
    },
    {
      name: 'Color',
      priority: 4,
      makeDataDiv: (game, key) => makeTableDataDiv(game.userColor.toLowerCase(), key, true),
    },
    {
      name: 'Opening',
      priority: 8,
      makeDataDiv: (_game, key) => {
        let content: React.ReactNode = (
          <div className="w-[7ch] text-center">
            <DotsSpinner />
          </div>
        );
        if (opening) content = opening;
        return makeTableDataDiv(content, key, true, []);
      }
    },
    {
      name: 'Result',
      priority: 5,
      makeDataDiv: (game, key) => makeResultDiv(game, key),
    },
    {
      name: 'Moves',
      priority: 6,
      makeDataDiv: (game, key) =>
        makeTableDataDiv(Math.round(game.pgn.moves.length / 2), key, true),
    },
    {
      name: 'Opponent',
      priority: 7,
      makeDataDiv: (game, key) => makeTableDataDiv(getOpponent(game), key, true),
    }
  ];

  if (shouldUseMobileLayout(windowSize)) {
    columns = columns.filter((c) => c.priority <= 5);
  }

  // Base row classes
  const classes = ['w-full', 'py-1.5'];

  if (game == undefined) {
    // Header row
    classes.push('font-bold', 'bg-[#292724]', 'rounded-t-md');
    return (
      <div className={classes.join(' ')}>
        {columns.map((c) => makeTableDataDiv(c.name, c.name, false))}
      </div>
    );
  }

  if (game == undefined) throw new Error('game should be defined at this point');

  // Data row styling
  if (isOdd) {
    classes.push('bg-[#37342f] hover:bg-stone-600'); // darkmode-background-secondary
  } else {
    classes.push('bg-[#292724] hover:bg-stone-600'); // darkmode-background-tertiary
  }

  return (
    <div className={classes.join(' ')}>
      {columns.map((c) => c.makeDataDiv(game, c.name))}
    </div>
  );
};

export default GamesTableRow;
