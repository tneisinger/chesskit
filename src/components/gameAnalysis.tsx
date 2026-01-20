import { GameData, GameEvals } from '@/types/chess';
import Button from '@/components/button';
import Spinner from '@/components/spinner';
import GameChart from '@/components/gameChart'

interface Props {
  game: GameData;
  analyzeGame: () => void;
  depth: number;
  changeDepth: (newDepth: number) => void;
  numLines: number;
  changeNumLines: (newNumLines: number) => void;
  isAnalyzing: boolean;
  progress: number;
  gameEvals: GameEvals
}

const GameAnalysis = ({
  game,
  analyzeGame,
  depth,
  changeDepth,
  numLines,
  changeNumLines,
  isAnalyzing,
  progress,
  gameEvals,
}: Props) => {
  const handleAnalyzeGame = () => {
    analyzeGame();
  }

  return (
    <div className="bg-stone-800 rounded-md w-full h-full">
      {game.engineAnalysis != undefined && (
        <div className='h-full w-full'>
          <GameChart gameEvals={game.engineAnalysis} />
        </div>
      )}
      {!isAnalyzing && progress === 0 && (
        <div className='flex flex-col h-full justify-center items-center gap-7'>
          <Button onClick={handleAnalyzeGame} disabled={isAnalyzing}>
            Analyze Game
          </Button>
          <div className='flex flex-row gap-8'>
            <div className='flex flex-col items-center'>
              <label htmlFor='depthSelect'>
                Depth:
              </label>
              <div className='flex flex-col items-center'>
                <input
                  className='w-28 accent-stone-300'
                  type='range'
                  min={18}
                  max={30}
                  value={depth}
                  onChange={(e) => changeDepth(Number(e.target.value))}
                />
                <span>{depth}</span>
              </div>
            </div>
            <div>
              <label htmlFor='numLinesSelect' className='ml-4 mr-2 self-center'>
                Lines:
              </label>
              <div className='flex flex-col items-center'>
                <input
                  type='range'
                  className='w-20 accent-stone-300'
                  min={1}
                  max={5}
                  value={numLines}
                  onChange={(e) => changeNumLines(Number(e.target.value))}
                />
                <span>{numLines}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {isAnalyzing && (
        <div className='flex flex-col h-full justify-center items-center gap-4'>
          <p>Analyzing game</p>
          <Spinner scale={1} tailwindColor={'bg-white'} />
          <div className='flex flex-row gap-8 text-sm'>
            <span>depth: {depth}</span>
            <span>lines: {numLines}</span>
            <span>progress: {progress}</span>
          </div>
        </div>
      )}
      {!isAnalyzing && progress >= 100 && (
        <div className='h-full w-full'>
          <GameChart gameEvals={gameEvals} />
        </div>
      )}
    </div>
  );
}

export default GameAnalysis;
