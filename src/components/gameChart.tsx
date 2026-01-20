import { useState } from 'react';
import { GameData } from '@/types/chess';
import Button from '@/components/button';
import Spinner from '@/components/spinner';

interface Props {
  game: GameData;
}

const GameChart = ({ game }: Props) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  const [depth, setDepth] = useState<number>(20);
  const [numLines, setNumLines] = useState<number>(3);

  const handleAnalyzeGame = () => {
    setIsAnalyzing(true);
  }

  return (
    <div className="bg-background-page rounded-md w-full h-full">
      {!isAnalyzing && !isAnalysisComplete && (
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
                  onChange={(e) => setDepth(Number(e.target.value))}
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
                  onChange={(e) => setNumLines(Number(e.target.value))}
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
          </div>
        </div>
      )}
    </div>
  );
}

export default GameChart;
