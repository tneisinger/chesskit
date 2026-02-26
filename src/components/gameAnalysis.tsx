import Button from '@/components/button';
import Spinner from '@/components/spinner';
import GameChart, { Props as GameChartProps } from '@/components/gameChart';
import { AnalyzerStatus, Output as PgnAnalyzer } from '@/hooks/usePgnAnalyzerParallel';

interface Props extends GameChartProps {
  analyzePgn: PgnAnalyzer['analyzePgn'];
  depth: number;
  changeDepth: (newDepth: number) => void;
  numLines: number;
  changeNumLines: (newNumLines: number) => void;
  pgnAnalyzerStatus: AnalyzerStatus;
  pgnAnalysisProgress: number;
  isGameEvaluationComplete: boolean;
}

const GameAnalysis = ({
  game,
  analyzePgn,
  depth,
  changeDepth,
  numLines,
  changeNumLines,
  pgnAnalyzerStatus,
  pgnAnalysisProgress,
  isGameEvaluationComplete,
  gameEvaluation,
  currentMove,
  changeCurrentMove,
  history,
  width,
}: Props) => {
  const handleAnalyzeGame = () => {
    analyzePgn(game.pgn, { analyzeVariations: false, maxSecondsPerPosition: 60 * 4 });
  }

  return (
    <div className="bg-radial from-stone-600 to-stone-800 rounded-md" style={{ width, height: '100%' }}>
      {Object.keys(gameEvaluation).length < 1 && pgnAnalyzerStatus == AnalyzerStatus.Idle && (
        <div className='flex flex-col h-full justify-center items-center gap-7'>
          <Button onClick={handleAnalyzeGame} disabled={pgnAnalyzerStatus !== AnalyzerStatus.Idle}>
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
                  min={16}
                  max={25}
                  value={depth}
                  onChange={(e) => changeDepth(Number(e.target.value))}
                />
                <span>{depth}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {pgnAnalyzerStatus === AnalyzerStatus.Analyzing && (
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
      {isGameEvaluationComplete && (
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
