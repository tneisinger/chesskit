import { GameData, PieceColor } from '@/types/chess';
import { makeReadableTimeControl } from '@/utils/chess';
import { makeDateStringYYMMDD } from '@/utils';
import { getOpening } from '@/utils/bookPositions';

const MAX_OPPONENT_NAME_LENGTH = 15;


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

  let whiteName;
  if (game.whiteName != undefined) {
    whiteName = game.whiteName.length > MAX_OPPONENT_NAME_LENGTH ?
      game.whiteName.slice(0, MAX_OPPONENT_NAME_LENGTH) + '...' :
      game.whiteName;
  }

  let blackName;
  if (game.blackName != undefined) {
    blackName = game.blackName.length > MAX_OPPONENT_NAME_LENGTH ?
      game.blackName.slice(0, MAX_OPPONENT_NAME_LENGTH) + '...' :
      game.blackName;
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
        <p>{blackName == undefined ? "(Name Unknown)" : blackName} - {game.blackElo == undefined ? "???" : game.blackElo}</p>
        <p>{whiteName == undefined ? "(Name Unknown)" : whiteName} - {game.whiteElo == undefined ? "???" : game.whiteElo}</p>
      </section>

      <section className="flex flex-row w-full ml-6">
        <p>{getOpening(game)}</p>
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
