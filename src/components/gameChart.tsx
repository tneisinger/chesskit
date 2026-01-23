import { useState, useEffect } from 'react';
import { GameData, GameEvaluation, MoveJudgement, PieceColor } from '@/types/chess';
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
import { getPlyFromFen, areFensEqual, makeMoveJudgements, getFenParts } from '@/utils/chess';
import { FEN } from 'cm-chessboard/src/Chessboard';
import GameChartToolTip from '@/components/gameChartToolTip';
import GameChartJudgementDots from '@/components/gameChartJudgementDots';
import { isInVariation } from '@/utils/cmchess';

const CHART_MAX_CP = 1000;

interface ChartDataPointBaseType {
  ply: number;
  move: string;
  color: 'w' | 'b';
  moveNumber: number;
  chartCp: number;
  judgement: MoveJudgement | null;
  isUserMove: boolean;
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

function makeChartData(
  history: Move[],
  gameEvaluation: GameEvaluation,
  userColor: PieceColor
): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];

  const moveJudgements = makeMoveJudgements(gameEvaluation);

  Object.entries(gameEvaluation).forEach(([fen, e]) => {
    // Skip starting position
    if (fen === FEN.start) return;

    const judgement = moveJudgements[fen];
    const moveInfo = history.find((m) => areFensEqual(m.fen, fen, { allowEnpassantDif: true }));
    if (!moveInfo) return;

    const move = moveInfo.san;
    const moveNumber = Math.ceil(moveInfo.ply / 2);
    const color = moveInfo.color;


    const ply = getPlyFromFen(fen);
    const { activeColor } = getFenParts(fen);
    const partial = {
      moveNumber,
      move,
      color,
      ply,
      judgement,

      // Indicate if this move was played by the user
      // Use not equal because activeColor is the color to move
      isUserMove: activeColor !== userColor,
    };

    if (e.score.key === 'cp') {
      let chartCp = e.score.value;
      if (Math.abs(chartCp) > CHART_MAX_CP) {
        chartCp = chartCp > 0 ? CHART_MAX_CP : -CHART_MAX_CP
      }
      result.push({ ...partial, chartCp, cp: e.score.value });
    } else if (e.score.key === 'mate') {
      // Represent mate as CHART_MAX_CP with sign indicating who is mating
      const sign = e.score.value > 0 ? 1 : -1;
      result.push({ ...partial, chartCp: sign * CHART_MAX_CP, mate: e.score.value });
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
  gameEvaluation: GameEvaluation;
  currentMove: Move | undefined;
  changeCurrentMove: (newCurrentMove?: Move) => void;
  history: Move[];
  width: number;
}

const GameChart = ({
  game,
  gameEvaluation,
  currentMove,
  changeCurrentMove,
  history,
  width,
}: Props) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [inVariation, setInVariation] = useState<boolean>(false);

  useEffect(() => {
    if (currentMove && isInVariation(currentMove)) {
      setInVariation(true);
    } else {
      setInVariation(false);
    }
  }, [currentMove]);

  // Recompute chart data when history or gameEvaluation changes
  useEffect(() => {
    const data = makeChartData(history, gameEvaluation, game.userColor);
    setChartData(data);

    const max = Math.max(...data.map((d) => d.chartCp));
    const min = Math.min(...data.map((d) => d.chartCp));
    const offsetOrNan = max / (max - min);
    if (!isNaN(offsetOrNan)) setOffset(offsetOrNan);
  }, [history, gameEvaluation]);

  const handleChartClick = (data: any, chartData: ChartDataPoint[], history: Move[]) => {
    if (data.activeIndex === undefined) return;
    changeCurrentMove(history.find((m) => m.ply === chartData[data.activeIndex].ply));
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={chartData}
        margin={{ top: 3, right: 4, bottom: 3, left: 4 }}
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
        <ReferenceLine
          x={currentMove ? currentMove.ply : 0}
          stroke="white"
          strokeDasharray={inVariation ? '3 5' : '0'}
        />
        <Tooltip cursor={false} content={GameChartToolTip} />
        <Area
          type="monotone"
          dataKey="chartCp"
          stroke="#aaa"
          strokeWidth={1}
          fillOpacity={1}
          fill="url(#colorCp)"
          activeDot={{ r: 3 }}
          dot={GameChartJudgementDots}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default GameChart;
