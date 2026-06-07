import type { GameData } from '@/types/chess';
import GamesTableRow from '@/components/gamesTableRow';
import { shouldUseMobileLayout } from '@/utils/mobileLayout';
import useWindowSize from '@/hooks/useWindowSize';
import Spinner from '@/components/spinner';

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

  const windowSize = useWindowSize();
  const isMobile = shouldUseMobileLayout(windowSize);

  if (isMobile == undefined) return (
    <div className="flex flex-col h-full items-center justify-center gap-4">
      <Spinner scale={2} white />
    </div>
  );

  return (
    <div className="flex flex-col w-full max-w-[95vw] h-full">
      <GamesTableRow
        changeSelectedGameIds={changeSelectedGameIds}
        selectedGameIds={selectedGameIds}
        isMobile={isMobile}
      />
      <div className="min-h-0 flex-1 rounded-b-md overflow-x-hidden overflow-y-scroll">
        {games.map((game, i) =>
          <GamesTableRow
            key={game.gameId}
            game={game}
            isMobile={isMobile}
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
