import React, { useState, useEffect } from 'react';
import DeleteButton from '@/components/deleteButton';
import type { GameData } from '@/types/chess';
import { pluralizeWord } from '@/utils';
import { deleteUserGame } from '@/app/game-review/actions';

interface Props {
  selectedGameIds: string[];
  changeSelectedGameIds: (newGameIds: string[]) => void;
  games: GameData[];
}

const DeleteGamesControlPanel = ({
  changeSelectedGameIds,
  selectedGameIds,
  games,
}: Props) => {
  const [isChecked, setIsChecked] = useState(false);
  const [prevIsChecked, setPrevIsChecked] = useState<boolean | null>(null);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setIsChecked(true);
    else setIsChecked(false);
  }

  useEffect(() => {
    if (isChecked === prevIsChecked) return;

    if (isChecked && selectedGameIds.length !== games.length) {
      changeSelectedGameIds(games.map((g) => g.gameId));
    }

    if (!isChecked && selectedGameIds.length > 0) {
      changeSelectedGameIds([]);
    }
  }, [isChecked, changeSelectedGameIds, selectedGameIds, games, prevIsChecked])

  useEffect(() => {
    setPrevIsChecked(isChecked);
  }, [isChecked]);

  const deleteSelectedGames = () => {
    const numGames = selectedGameIds.length;
    const pluralized = pluralizeWord(numGames, 'game', 'games');
    let msg = `Really delete ${numGames} ${pluralized}?`;
    if (confirm(msg) === true) {
      // use deleteUserGame function here
      console.log('Dropping games:', selectedGameIds);
      changeSelectedGameIds([]);
      setIsChecked(false);
    }
  }

  return (
    <div className="flex flex-row items-center pt-7">
      <input
        className="my-5 w-10"
        type='checkbox'
        checked={isChecked}
        onChange={handleCheckboxChange}
      />
      <DeleteButton
        disabled={selectedGameIds.length < 1}
        onClick={deleteSelectedGames}
      />
    </div>
  )
}

export default DeleteGamesControlPanel;
