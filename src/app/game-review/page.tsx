'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GamesTable from '@/components/gamesTable';
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
    <div className="mt-2 max-w-[1200px] w-[99vw]">
      <GamesTable
        games={userGames}
        selectedGameIds={selectedGameIds}
        changeSelectedGameIds={setSelectedGameIds}
        maxHeight="92vh"
        includeDeleteControlPanel={true}
      />
      <Link href="/game-review/add-games">Add Games</Link>
    </div>
  );
}
