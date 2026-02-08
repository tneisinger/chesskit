import Button from '@/components/button';
import Spinner from '@/components/spinner';
import GameChart, { Props as GameChartProps } from '@/components/gameChart';
import { AnalysisStatus } from '@/hooks/useChessAnalyzer';

interface Props extends GameChartProps {
  analyzePgn: (pgn: string, analyzeVariations?: boolean) => void;
  depth: number;
  changeDepth: (newDepth: number) => void;
  numLines: number;
  changeNumLines: (newNumLines: number) => void;
  pgnAnalysisStatus: AnalysisStatus;
  pgnAnalysisProgress: number;
}

const GameAnalysis = ({
  game,
  analyzePgn,
  depth,
  changeDepth,
  numLines,
  changeNumLines,
  pgnAnalysisStatus,
  pgnAnalysisProgress,
  gameEvaluation,
  currentMove,
  changeCurrentMove,
  history,
  width,
}: Props) => {
  const handleAnalyzeGame = () => {
    analyzePgn(game.pgn, false); // false means do not analyze variations
  }

  return (
    <div className="bg-radial from-stone-600 to-stone-800 rounded-md" style={{ width, height: '100%' }}>
      {Object.keys(gameEvaluation).length < 1 && pgnAnalysisStatus == AnalysisStatus.NotStarted && (
        <div className='flex flex-col h-full justify-center items-center gap-7'>
          <Button onClick={handleAnalyzeGame} disabled={pgnAnalysisStatus !== AnalysisStatus.NotStarted}>
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
                  min={2}
                  max={4}
                  value={numLines}
                  onChange={(e) => changeNumLines(Number(e.target.value))}
                />
                <span>{numLines}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {pgnAnalysisStatus === AnalysisStatus.Analyzing && (
        <div className="relative h-full">
          <div className='absolute z-2 flex flex-col h-full w-full justify-center items-center gap-4'>
            <p className="text-lg font-bold">Analyzing Game</p>
            <Spinner white />
            <div className='flex flex-row gap-8 text-sm'>
              <span className="text-lg">{pgnAnalysisProgress}%</span>
            </div>
          </div>
          <div className="absolute z-1 h-full w-full flex flex-col items-center justify-center">
            <div className="h-full w-full opacity-15 grayscale">
              <GameChart
                game={game}
                gameEvaluation={gameEvaluation}
                currentMove={currentMove}
                changeCurrentMove={changeCurrentMove}
                history={history}
                width={width}
                includeKeyPositionDots={false}
              />
            </div>
          </div>
        </div>
      )}
      {(pgnAnalysisStatus === AnalysisStatus.Complete || game.engineAnalysis != undefined) && (
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
