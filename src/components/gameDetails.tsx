import { GameData } from '@/types/chess';
import { makeReadableTimeControl } from '@/utils/chess';
import { makeDateStringYYMMDD } from '@/utils';

interface Props {
  game: GameData;
}


const GameDetails = ({ game }: Props) => {
  return (
    <div className="w-full bg-background-page text-sm p-2 rounded-md">
      <p>{makeDateStringYYMMDD(new Date(game.startTime))}</p>
      {game.timeControl && (
        <p>Time Control: {makeReadableTimeControl(game.timeControl)}</p>
      )}
      <p>{game.whiteName} ({game.whiteElo})</p>
      <p>{game.blackName} ({game.blackElo})</p>
    </div>
  )
};

export default GameDetails;
