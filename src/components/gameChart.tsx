import { GameEvals } from '@/types/chess';
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
import { getPlyFromFen } from '@/utils/chess';

const CHART_MAX_CP = 1000;

interface ChartDataPointBaseType {
  ply: number;
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

function makeChartData(gameEvals: GameEvals): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];

  Object.entries(gameEvals).forEach(([fen, e]) => {
    const ply = getPlyFromFen(fen);
    if (e.cp !== undefined) {
      let chartCp = e.cp;
      if (Math.abs(chartCp) > CHART_MAX_CP) {
        chartCp = chartCp > 0 ? CHART_MAX_CP : -CHART_MAX_CP
      }
      result.push({ ply, chartCp, cp: e.cp });
    } else if (e.mate !== undefined) {
      // Represent mate as CHART_MAX_CP with sign indicating who is mating
      const sign = e.mate > 0 ? 1 : -1;
      result.push({ ply, chartCp: sign * CHART_MAX_CP, mate: e.mate });
    } else {
      // No evaluation available so set cp to 0
      result.push({ ply, chartCp: 0, cp: 0 });
    }
  });

  result.sort(({ply: ply1}, {ply: ply2}) => ply1 - ply2);
  return result;
}

interface Props {
  gameEvals: GameEvals;
  currentMove: Move | undefined;
}

const GameChart = ({ gameEvals, currentMove }: Props) => {

  const chartData = makeChartData(gameEvals);
  const max = Math.max(...chartData.map((d) => d.chartCp));
  const min = Math.min(...chartData.map((d) => d.chartCp));
  const offset = max / (max - min);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="colorCp" x1="0" y1="0" x2="0" y2="1">
            <stop offset={offset} stopColor="#eee" stopOpacity={1}/>
            <stop offset={offset} stopColor="#111" stopOpacity={1}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="ply" hide />
        <YAxis domain={[-CHART_MAX_CP, CHART_MAX_CP]} hide />
        <ReferenceLine x={currentMove ? currentMove.ply : 0} stroke="white" />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="chartCp"
          stroke="#aaa"
          strokeWidth={1}
          fillOpacity={1}
          fill="url(#colorCp)"
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default GameChart;
