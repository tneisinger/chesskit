'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/button';
import GamesTable from '@/components/gamesTable';
import DeleteGamesControlPanel from '@/components/deleteGamesControlPanel';
import type { GameData } from "@/types/chess";
import { getUserGames } from './actions';
import { NAV_BAR_HEIGHT } from '@/lib/constants';
import useWindowSize from '@/hooks/useWindowSize';

export default function GameReviewPage() {
  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [userGames, setUserGames] = useState<GameData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { height } = useWindowSize();
  const mainDivHeight = height ? height - NAV_BAR_HEIGHT : undefined;

  const loadGames = async () => {
    setIsLoading(true);
    const games = await getUserGames();
    setUserGames(games);
    setIsLoading(false);
  };

  useEffect(() => {
    loadGames();
  }, []);

  if (isLoading) {
    return (
      <div>
        <p>Loading...</p>
      </div>
    );
  }

  if (userGames.length === 0) {
    return (
      <div
        className="flex flex-col h-full items-center justify-center gap-4"
        style={{ height: mainDivHeight }}
      >

        <p className="text-xl">No games exist</p>
        <Button href="/game-review/add-games">Add Games</Button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col max-w-[1200px] w-[99vw]"
      style={{ height: mainDivHeight }}
    >
      <div className="py-4">
        <h3 className="text-center text-2xl">Imported Games</h3>
      </div>
      <div className="flex-1 min-h-0">
        <GamesTable
          games={userGames}
          selectedGameIds={selectedGameIds}
          changeSelectedGameIds={setSelectedGameIds}
        />
      </div>
      <div className="py-2 flex flex-row gap-4 items-center justify-between">
        <DeleteGamesControlPanel
          selectedGameIds={selectedGameIds}
          changeSelectedGameIds={setSelectedGameIds}
          games={userGames}
          onGamesDeleted={loadGames}
        />
        <Button href="/game-review/add-games">Add Games</Button>
      </div>
    </div>
  );
}
