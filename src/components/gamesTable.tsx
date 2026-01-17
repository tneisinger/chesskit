import type { GameData } from '@/types/chess';
import GamesTableRow from '@/components/gamesTableRow';

interface Props {
  games: GameData[];
  selectedGameIds: number[];
  changeSelectedGameIds: (newGameIds: number[]) => void;
}

const GamesTable = ({
  games,
  selectedGameIds,
  changeSelectedGameIds,
}: Props) => {
  return (
    <div className="flex flex-col w-full max-w-[95vw] h-full">
      <GamesTableRow
        changeSelectedGameIds={changeSelectedGameIds}
        selectedGameIds={selectedGameIds}
      />
      <div className="min-h-0 flex-1 rounded-b-md overflow-x-hidden overflow-y-scroll">
        {games.map((game, i) =>
          <GamesTableRow
            key={game.gameId}
            game={game}
            isOdd={i % 2 === 0}
            changeSelectedGameIds={changeSelectedGameIds}
            selectedGameIds={selectedGameIds}
          />
        )}
      </div>
    </div>
  );
};

export default GamesTable;
