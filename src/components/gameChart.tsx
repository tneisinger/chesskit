import { GameEvals } from '@/types/chess';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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
  gameEvals: GameEvals
}

const GameChart = ({ gameEvals }: Props) => {

  const chartData = makeChartData(gameEvals);
  const max = Math.max(...chartData.map((d) => d.cp));
  const min = Math.min(...chartData.map((d) => d.cp));
  const offset = max / (max - min);

  return (
    <ResponsiveContainer>
      <AreaChart data={chartData} >
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
  );
};

export default GameChart;
