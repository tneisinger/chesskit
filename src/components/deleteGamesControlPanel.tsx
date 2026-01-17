import React, { useState, useEffect } from 'react';
import DeleteButton from '@/components/deleteButton';
import type { GameData } from '@/types/chess';
import { pluralizeWord } from '@/utils';
import { deleteUserGames } from '@/app/game-review/actions';

interface Props {
  selectedGameIds: number[];
  changeSelectedGameIds: (newGameIds: number[]) => void;
  games: GameData[];
  onGamesDeleted?: () => void;
}

const DeleteGamesControlPanel = ({
  changeSelectedGameIds,
  selectedGameIds,
  games,
  onGamesDeleted,
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
      changeSelectedGameIds(games.map((g) => g.id).filter((id): id is number => id !== undefined));
    }

    if (!isChecked && selectedGameIds.length > 0) {
      changeSelectedGameIds([]);
    }
  }, [isChecked, changeSelectedGameIds, selectedGameIds, games, prevIsChecked])

  useEffect(() => {
    setPrevIsChecked(isChecked);
  }, [isChecked]);

  const deleteSelectedGames = async () => {
    const numGames = selectedGameIds.length;
    const pluralized = pluralizeWord(numGames, 'game', 'games');
    let msg = `Really delete ${numGames} ${pluralized}?`;
    if (confirm(msg) === true) {
      // Delete games from database (selectedGameIds already contains database IDs)
      const result = await deleteUserGames(selectedGameIds);

      if (result.success) {
        changeSelectedGameIds([]);
        setIsChecked(false);
        // Refresh the games list
        if (onGamesDeleted) {
          onGamesDeleted();
        }
      } else {
        alert(`Failed to delete games: ${result.error}`);
      }
    }
  }

  return (
    <div className="flex flex-row items-center">
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
