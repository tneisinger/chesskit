'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/button';
import { ScrollLock } from '@/components/ScrollLock';
import GamesTable from '@/components/gamesTable';
import DeleteGamesControlPanel from '@/components/deleteGamesControlPanel';
import type { GameData } from "@/types/chess";
import { getUserGames } from './actions';

export default function GameReviewPage() {
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [userGames, setUserGames] = useState<GameData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadGames = async () => {
      const games = await getUserGames();
      setUserGames(games);
      setIsLoading(false);
    };
    loadGames();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <ScrollLock>
      <div className="flex flex-col max-w-[1200px] w-[99vw] h-[calc(100vh-40px)]">
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
          />
          <Button href="/game-review/add-games">Add Games</Button>
        </div>
      </div>
    </ScrollLock>
  );
}
