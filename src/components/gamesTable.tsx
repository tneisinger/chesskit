import { useState } from 'react';
import type { GameData } from '@/types/chess';
import GamesTableRow from '@/components/gamesTableRow';
import styles from './gamesTable.module.css';
import { shouldUseMobileLayout } from '../utils/mobileLayout';
import ReactPaginate, { ReactPaginateProps } from 'react-paginate';
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

const gamesPerPage = 25

const GamesTable = ({
  games,
  selectedGameIds,
  changeSelectedGameIds,
  includeDeleteControlPanel = false,
  maxHeight = '95%',
  maxHeightMobile = '95%',
}: Props) => {
  const windowSize = useWindowSize();

  const [offset, setOffset] = useState(0);

  const endOffset = offset + gamesPerPage;
  const gamesOnCurrentPage = games.slice(offset, endOffset);
  const pageCount = Math.ceil(games.length / gamesPerPage);

  const handlePageClick: ReactPaginateProps['onPageChange'] = (event) => {
    const newOffset = (event.selected * gamesPerPage) % games.length;
    console.log('changing to page', event.selected)
    setOffset(newOffset);
  }

  if (shouldUseMobileLayout(windowSize)) maxHeight = maxHeightMobile;

  return (
    <div className="flex flex-col w-full max-w-[95vw]" style={{ maxHeight }}>
      <GamesTableRow
        changeSelectedGameIds={changeSelectedGameIds}
        selectedGameIds={selectedGameIds}
      />
      <div className="min-h-0 flex-1 rounded-md overflow-x-hidden overflow-y-scroll">
        {gamesOnCurrentPage.map((game, i) =>
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
            games={gamesOnCurrentPage}
            selectedGameIds={selectedGameIds}
            changeSelectedGameIds={changeSelectedGameIds}
          />
        )}
        {games.length > gamesOnCurrentPage.length && (
          <div className={styles.paginator}>
            <ReactPaginate
              breakLabel='...'
              nextLabel='next >'
              onPageChange={handlePageClick}
              pageRangeDisplayed={5}
              pageCount={pageCount}
              previousLabel='< previous'
              renderOnZeroPageCount={null}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GamesTable;
