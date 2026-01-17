import type { GameData } from '@/types/chess';
import GamesTableRow from '@/components/gamesTableRow';
import { shouldUseMobileLayout } from '../utils/mobileLayout';
import DeleteGamesControlPanel from '../components/deleteGamesControlPanel';
import useWindowSize from '@/hooks/useWindowSize';

interface Props {
  games: GameData[];
  selectedGameIds: string[];
  changeSelectedGameIds: (newGameIds: string[]) => void;
  includeDeleteControlPanel?: boolean;
  maxHeight?: string;
  maxHeightMobile?: string;
}

const GamesTable = ({
  games,
  selectedGameIds,
  changeSelectedGameIds,
  includeDeleteControlPanel = false,
  maxHeight = '95%',
  maxHeightMobile = '95%',
}: Props) => {
  const windowSize = useWindowSize();

  if (shouldUseMobileLayout(windowSize)) maxHeight = maxHeightMobile;

  return (
    <div className="flex flex-col w-full max-w-[95vw]" style={{ maxHeight }}>
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
      <div className="flex flex-row">
        {includeDeleteControlPanel && (
          <DeleteGamesControlPanel
            games={games}
            selectedGameIds={selectedGameIds}
            changeSelectedGameIds={changeSelectedGameIds}
          />
        )}
      </div>
    </div>
  );
};

export default GamesTable;
