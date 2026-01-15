'use client';

import { useState, useEffect } from 'react';
import { ChessWebsite, GameData } from '@/types/chess';
import { fetchGames } from '@/fetch';
import Spinner from '@/components/spinner';
import UsernameForm from '@/components/usernameForm';
import usePrevious from '@/hooks/usePrevious';

const maxNumGamesToAnalyze = 9;

interface Props {
  chessWebsite: ChessWebsite;
}

const AddOnlineGames = ({ chessWebsite }: Props) => {

  const [username, setUsername] = useState<string | undefined>(undefined);

  const [isFetchingGames, setIsFetchingGames] = useState(false);

  const prevIsFetchingGames = usePrevious(isFetchingGames);

  const [fetchedGames, setFetchedGames] = useState<GameData[] | null>(null);

  useEffect(() => {
    const name = '' // getStoredUsername(chessWebsite);
    if (name) setUsername(name);
  }, [chessWebsite])

  useEffect(() => {
    if (isFetchingGames && isFetchingGames !== prevIsFetchingGames && username) {
      fetchGames(username, chessWebsite, [], { maxGames: 30 })
        .then((games) => {
          setIsFetchingGames(false);
          setFetchedGames(games);
          // updateUsername(username, chessWebsite, zState);
        })
        .catch((reason) => {
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
    console.log(fetchedGames);
    return (
      <>
        <h2>
          {username}{"'"}s games from {chessWebsite}
        </h2>
        <h3>
          Select up to {maxNumGamesToAnalyze} games to analyze
        </h3>
        <div>
          {changeUsernameBtn}
        </div>
      </>
    )
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
