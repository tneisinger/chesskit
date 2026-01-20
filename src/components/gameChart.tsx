import { useState } from 'react';
import { GameData, GameEvals } from '@/types/chess';
import Button from '@/components/button';
import Spinner from '@/components/spinner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getPlyFromFen } from '@/utils/chess';

function makeChartData(gameEvals: GameEvals): {ply: number, cp: number}[] {
  const result: {ply: number, cp: number}[] = [];

  Object.entries(gameEvals).forEach(([fen, e]) => {
    const ply = getPlyFromFen(fen);
    if (e.cp !== undefined) {
      let cp = e.cp;
      if (cp > 1000) cp = 1000;
      result.push({ ply, cp });
    } else if (e.mate !== undefined) {
      // Represent mate as a large centipawn value
      const sign = e.mate > 0 ? 1 : -1;
      result.push({ ply, cp: sign * 1000 });
    } else {
      // No evaluation available so set cp to 0
      result.push({ ply, cp: 0 });
    }
  });

  result.sort(({ply: ply1}, {ply: ply2}) => ply1 - ply2);
  return result;
}

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

const GameChart = ({
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

  const chartData = makeChartData(gameEvals);
  const max = Math.max(...chartData.map((d) => d.cp));
  const min = Math.min(...chartData.map((d) => d.cp));
  const offset = max / (max - min);

  return (
    <div className="bg-stone-800 rounded-md w-full h-full">
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
          </div>
        </div>
      )}
      {!isAnalyzing && progress >= 100 && (
        <ResponsiveContainer>
          <AreaChart
            width={400}
            height={200}
            data={chartData}
          >      {/* Define a gradient for the fill */}
            <defs>
              <linearGradient id="colorCp" x1="0" y1="0" x2="0" y2="1">
                <stop offset={offset} stopColor="#eee" stopOpacity={1}/>
                <stop offset={offset} stopColor="#111" stopOpacity={1}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="ply" hide /> 
            <YAxis domain={[-1000, 1000]} hide /> 
            <Tooltip /> 
            <Area
              type="monotone"
              dataKey="cp"
              stroke="#4c946a"
              strokeWidth={1}
              fillOpacity={1}
              fill="url(#colorCp)"
              activeDot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
</div>
  );
}

export default GameChart;
