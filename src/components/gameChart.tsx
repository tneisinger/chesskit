import { GameData, GameEvals } from '@/types/chess';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Move } from 'cm-chess/src/Chess';
import { getPlyFromFen, areFensEqual } from '@/utils/chess';
import { FEN } from 'cm-chessboard/src/Chessboard';
import GameChartToolTip from '@/components/gameChartToolTip';

const CHART_MAX_CP = 1000;

interface ChartDataPointBaseType {
  ply: number;
  move: string;
  color: 'w' | 'b';
  moveNumber: number;
  chartCp: number;
}

interface ChartDataPointWithCP extends ChartDataPointBaseType {
  cp: number;
  mate?: never;
}

interface ChartDataPointWithMate extends ChartDataPointBaseType {
  mate: number;
  cp?: never;
}

// Union type for chart data points
// A data point must have either cp or mate, but not both
type ChartDataPoint = ChartDataPointWithCP | ChartDataPointWithMate;

function makeChartData(history: Move[], gameEvals: GameEvals): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];

  Object.entries(gameEvals).forEach(([fen, e]) => {
    // Skip starting position
    if (fen === FEN.start) return;

    const moveInfo = history.find((m) => areFensEqual(m.fen, fen, { allowEnpassantDif: true }));
    if (!moveInfo) return;

    const move = moveInfo.san;
    const moveNumber = Math.ceil(moveInfo.ply / 2);
    const color = moveInfo.color;


    const ply = getPlyFromFen(fen);
    const partial = { moveNumber, move, color, ply };

    if (e.cp !== undefined) {
      let chartCp = e.cp;
      if (Math.abs(chartCp) > CHART_MAX_CP) {
        chartCp = chartCp > 0 ? CHART_MAX_CP : -CHART_MAX_CP
      }
      result.push({ ...partial, chartCp, cp: e.cp });
    } else if (e.mate !== undefined) {
      // Represent mate as CHART_MAX_CP with sign indicating who is mating
      const sign = e.mate > 0 ? 1 : -1;
      result.push({ ...partial, chartCp: sign * CHART_MAX_CP, mate: e.mate });
    } else {
      // No evaluation available so set cp to 0
      result.push({ ...partial, chartCp: 0, cp: 0 });
    }
  });

  result.sort(({ply: ply1}, {ply: ply2}) => ply1 - ply2);
  return result;
}

export interface Props {
  game: GameData;
  gameEvals: GameEvals;
  currentMove: Move | undefined;
  changeCurrentMove: (newCurrentMove?: Move) => void;
  history: Move[];
  width: number;
}

const GameChart = ({
  game,
  gameEvals,
  currentMove,
  changeCurrentMove,
  history,
  width,
}: Props) => {
  const handleChartClick = (data: any, chartData: ChartDataPoint[], history: Move[]) => {
    if (data.activeIndex === undefined) return;
    console.log('Chart clicked:');
    console.log(chartData[data.activeIndex]);
    changeCurrentMove(history.find((m) => m.ply === chartData[data.activeIndex].ply));
  }

  const chartData = makeChartData(history, gameEvals);
  const max = Math.max(...chartData.map((d) => d.chartCp));
  const min = Math.min(...chartData.map((d) => d.chartCp));
  const offset = max / (max - min);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 5, right: 0, bottom: 5, left: 0 }}
        onClick={(e) => handleChartClick(e, chartData, history)}
      >
        <defs>
          <linearGradient id="colorCp" x1="0" y1="0" x2="0" y2="1">
            <stop offset={offset} stopColor="#eee" stopOpacity={1}/>
            <stop offset={offset} stopColor="#111" stopOpacity={1}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="ply" hide />
        <YAxis domain={[-CHART_MAX_CP, CHART_MAX_CP]} hide />
        <ReferenceLine x={currentMove ? currentMove.ply : 0} stroke="white" />
        <Tooltip content={GameChartToolTip} />
        <Area
          type="monotone"
          dataKey="chartCp"
          stroke="#aaa"
          strokeWidth={1}
          fillOpacity={1}
          fill="url(#colorCp)"
          activeDot={{ r: 3 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default GameChart;
