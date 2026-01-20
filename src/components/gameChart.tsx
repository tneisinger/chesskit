import { GameData } from '@/types/chess';

interface Props {
  game: GameData;
}

const GameChart = ({ game }: Props) => {
  return (
    <div className="bg-background-page rounded-md w-full h-full">
      {/* Placeholder for game chart visualization */}
      <p>Game Chart for Game {game.id}</p>
    </div>
  );
}

export default GameChart;
