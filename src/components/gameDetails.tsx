import { GameData, PieceColor } from '@/types/chess';
import { makeReadableTimeControl } from '@/utils/chess';
import { makeDateStringYYMMDD } from '@/utils';

interface Props {
  game: GameData;
  orientation: PieceColor;
}

const GameDetails = ({ game, orientation }: Props) => {
  let resultText = 'Result: unknown';
  if (game.result) {
    if (game.result === '1-0') resultText = 'Result: White Wins';
    if (game.result === '0-1') resultText = 'Result: Black Wins';
    if (game.result === '1/2-1/2') resultText = 'Result: Draw';
  }

  return (
    <div className="flex flex-col w-full bg-background-page text-sm rounded-md gap-3">
      <section className="flex flex-row w-full justify-between bg-stone-700 p-2">
        <p>{makeDateStringYYMMDD(new Date(game.startTime))}</p>
        {game.timeControl && (
          <p>{makeReadableTimeControl(game.timeControl)}</p>
        )}
      </section>

      {/* Players Section - Use orientation to order the players to match the board orientation */}
      <section className={`flex ${orientation === PieceColor.WHITE ? 'flex-col' : 'flex-col-reverse'} ml-6`}>
        <p>{game.blackName} - {game.blackElo}</p>
        <p>{game.whiteName} - {game.whiteElo}</p>
      </section>

      <section className="text-center border-t border-stone-600 p-2">
        <p>{resultText}</p>
        {game.website && game.url && (
          <a target="_blank" rel="noopener noreferrer" href={game.url} className="underline">
            View on {game.website}
          </a>
        )}
      </section>
    </div>
  )
};

export default GameDetails;
