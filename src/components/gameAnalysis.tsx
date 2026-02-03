import Button from '@/components/button';
import Spinner from '@/components/spinner';
import GameChart, { Props as GameChartProps } from '@/components/gameChart';
import { GameData } from '@/types/chess';
import { AnalysisStatus } from '@/hooks/useGameAnalyzer';

interface Props extends GameChartProps {
  analyzeGame: (game: GameData) => void;
  depth: number;
  changeDepth: (newDepth: number) => void;
  numLines: number;
  changeNumLines: (newNumLines: number) => void;
  gameAnalysisStatus: AnalysisStatus;
  gameAnalysisProgress: number;
}

const GameAnalysis = ({
  game,
  analyzeGame,
  depth,
  changeDepth,
  numLines,
  changeNumLines,
  gameAnalysisStatus,
  gameAnalysisProgress,
  gameEvaluation,
  currentMove,
  changeCurrentMove,
  history,
  width,
}: Props) => {
  const handleAnalyzeGame = () => {
    analyzeGame(game);
  }

  return (
    <div className="bg-radial from-stone-600 to-stone-800 rounded-md" style={{ width, height: '100%' }}>
      {game.engineAnalysis != undefined && (
        <GameChart
          game={game}
          gameEvaluation={game.engineAnalysis}
          currentMove={currentMove}
          changeCurrentMove={changeCurrentMove}
          history={history}
          width={width}
        />
      )}
      {gameAnalysisStatus == AnalysisStatus.NotStarted && (
        <div className='flex flex-col h-full justify-center items-center gap-7'>
          <Button onClick={handleAnalyzeGame} disabled={gameAnalysisStatus !== AnalysisStatus.NotStarted}>
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
      {gameAnalysisStatus === AnalysisStatus.Analyzing && (
        <div className='flex flex-col h-full justify-center items-center gap-4'>
          <p>Analyzing game</p>
          <Spinner white />
          <div className='flex flex-row gap-8 text-sm'>
            <span>depth: {depth}</span>
            <span>lines: {numLines}</span>
            <span>progress: {gameAnalysisProgress}%</span>
          </div>
        </div>
      )}
      {gameAnalysisStatus === AnalysisStatus.Complete && (
        <GameChart
          game={game}
          gameEvaluation={gameEvaluation}
          currentMove={currentMove}
          changeCurrentMove={changeCurrentMove}
          history={history}
          width={width}
        />
      )}
    </div>
  );
}

export default GameAnalysis;
