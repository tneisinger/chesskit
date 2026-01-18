'use client';

import { useState, useEffect } from 'react';
import { ChessWebsite, GameData } from '@/types/chess';
import { fetchGames } from '@/fetch';
import { getUserGames } from '@/app/game-review/actions';
import { saveGames } from '@/app/game-review/actions';
import { saveChessUsername } from '@/app/user/actions';
import Spinner from '@/components/spinner';
import UsernameForm from '@/components/usernameForm';
import usePrevious from '@/hooks/usePrevious';

interface Props {
  chessWebsite: ChessWebsite;
  initialUsername?: string;
}

const AddOnlineGames = ({ chessWebsite, initialUsername }: Props) => {

  const [username, setUsername] = useState<string | undefined>(undefined);

  const [isFetchingGames, setIsFetchingGames] = useState(false);

  const prevIsFetchingGames = usePrevious(isFetchingGames);

  const [fetchedGames, setFetchedGames] = useState<GameData[] | null>(null);

  const [isSavingGames, setIsSavingGames] = useState(false);

  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    savedCount?: number;
    error?: string;
  } | null>(null);

  const [userGames, setUserGames] = useState<GameData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadGames = async () => {
    setIsLoading(true);
    const games = await getUserGames();
    setUserGames(games);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isFetchingGames && isFetchingGames !== prevIsFetchingGames && username) {
      fetchGames(username, chessWebsite, userGames, { maxGames: 30 })
        .then(async (games) => {
          setIsFetchingGames(false);
          setFetchedGames(games);

          // Save games to database
          if (games.length > 0) {
            setIsSavingGames(true);
            const result = await saveGames(games);
            setIsSavingGames(false);
            setSaveResult(result);

            // Save the username to the user's profile
            if (result.success) {
              await saveChessUsername(chessWebsite, username);
            }
          }
        })
        .catch((reason) => {
          setIsFetchingGames(false);
          if (reason instanceof Error && reason.message === 'Failed to fetch') {
            const s1 = `Failed to fetch games from ${chessWebsite}.`
            const s2 = `There may be something wrong with the ${chessWebsite} server.`
            alert(`${s1} ${s2}`);
          } else if (reason instanceof Response && reason.status === 404) {
            alert(`${chessWebsite} account not found. Is ${username} your correct username?`);
          } else {
            alert(`An unknown error occurred: ${reason}`);
            console.error(reason);
          }
        });
    }
  }, [isFetchingGames, prevIsFetchingGames, username, chessWebsite])

  useEffect(() => {
    if (username != undefined) setIsFetchingGames(true);
  }, [username])

  if (username == undefined) {
    return (
      <UsernameForm
        chessWebsite={chessWebsite}
        setUsername={setUsername}
        initialUsername={initialUsername}
      />
    );
  }

  if (isFetchingGames) {
    return (
      <>
        <h2>Fetching games...</h2>
        <Spinner scale={3} />
      </>
    );
  }

  const changeUsernameBtn = (
    <button onClick={() => setUsername(undefined)} >
      Change username
    </button>
  );

  if (fetchedGames && fetchedGames.length > 0) {
    if (isSavingGames) {
      return (
        <div>
          <p>Saving {fetchedGames.length} games to database...</p>
          <Spinner scale={2} />
        </div>
      );
    }

    if (saveResult) {
      if (saveResult.success) {
        const duplicateCount = fetchedGames.length - (saveResult.savedCount || 0);
        return (
          <div>
            <p>
              Successfully saved {saveResult.savedCount} new game{saveResult.savedCount !== 1 ? 's' : ''} from {chessWebsite}
            </p>
            {duplicateCount > 0 && (
              <p style={{ fontSize: '0.875rem', color: '#666' }}>
                ({duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} skipped)
              </p>
            )}
            <button
              onClick={() => {
                setUsername(undefined);
                setFetchedGames(null);
                setSaveResult(null);
              }}
              style={{ marginTop: '1rem' }}
            >
              Import more games
            </button>
          </div>
        );
      } else {
        return (
          <div>
            <p style={{ color: '#dc2626' }}>Error: {saveResult.error}</p>
            <button
              onClick={() => {
                setUsername(undefined);
                setFetchedGames(null);
                setSaveResult(null);
              }}
              style={{ marginTop: '1rem' }}
            >
              Try again
            </button>
          </div>
        );
      }
    }
  }

  return (
    <div>
      <p>{chessWebsite} responded with no games.</p>
      <p>Note: Only standard chess games are supported on this site.</p>
      {changeUsernameBtn}
    </div>
  )
}

export default AddOnlineGames;
