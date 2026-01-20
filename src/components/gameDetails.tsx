import { GameData, PieceColor } from '@/types/chess';
import { makeReadableTimeControl } from '@/utils/chess';
import { makeDateStringYYMMDD } from '@/utils';

interface Props {
  game: GameData;
  orientation: PieceColor;
}

const GameDetails = ({ game, orientation }: Props) => {
  return (
    <div className="w-full bg-background-page text-sm p-2 rounded-md">
      <p>{makeDateStringYYMMDD(new Date(game.startTime))}</p>
      {game.timeControl && (
        <p>Time Control: {makeReadableTimeControl(game.timeControl)}</p>
      )}

      {/* Players Section - Use orientation to order the players to match the board orientation */}
      <section className={`my-2 flex ${orientation === PieceColor.WHITE ? 'flex-col' : 'flex-col-reverse'} my-2`}>
        <p>{game.blackName} - {game.blackElo}</p>
        <p>{game.whiteName} - {game.whiteElo}</p>
      </section>

      {game.website && game.url && (
        <a target="_blank" rel="noopener noreferrer" href={game.url} className="underline">
          View at {game.website}
        </a>
      )}
    </div>
  )
};

export default GameDetails;
