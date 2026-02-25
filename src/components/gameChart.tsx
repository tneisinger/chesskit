import { useState, useEffect } from 'react';
import { GameData, Evaluations, MoveJudgement, PieceColor } from '@/types/chess';
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
import { getPlyFromFen, makeMoveJudgements, getFenParts } from '@/utils/chess';
import { FEN } from 'cm-chessboard/src/Chessboard';
import GameChartToolTip from '@/components/gameChartToolTip';
import KeyPositionDots from '@/components/keyPositionDots';
import { isInVariation } from '@/utils/cmchess';

const CHART_MAX_CP = 1000;

interface ChartDataPointBaseType {
  ply: number;
  move: string;
  color: 'w' | 'b';
  moveNumber: number;
  chartCp: number;
  judgement: MoveJudgement | undefined;
  isUserMove: boolean;

  // A key position is a position in a chess game where an inaccuracy,
  // a mistake, or a blunder was played by the user on the next move.
  // For positions where that is not the case, keyPosition will be null.
  keyPosition: MoveJudgement | null;
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
  gameEvaluation: Evaluations,
  userColor: PieceColor
): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];

  const moveJudgements = makeMoveJudgements(gameEvaluation);

  Object.entries(gameEvaluation).forEach(([fen, posEvaluation]) => {
    // Skip starting position
    if (fen === FEN.start) return;

    const judgement = moveJudgements[fen];
    const moveInfo = history.find((m) => m.fen === fen);
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

      // Set all keyPositions to null for now. We will update this in another loop below.
      keyPosition: null,
    };

    if (posEvaluation.score.key === 'cp') {
      let chartCp = posEvaluation.score.value;
      if (Math.abs(chartCp) > CHART_MAX_CP) {
        chartCp = chartCp > 0 ? CHART_MAX_CP : -CHART_MAX_CP
      }
      result.push({ ...partial, chartCp, cp: posEvaluation.score.value });
    } else if (posEvaluation.score.key === 'mate') {

      // Represent mate as CHART_MAX_CP with sign indicating who is mating
      let sign = 1;
      if (posEvaluation.score.value < 0) sign = -1;
      if (posEvaluation.score.value === 0 && activeColor === PieceColor.WHITE) sign = -1;

      result.push({ ...partial, chartCp: sign * CHART_MAX_CP, mate: posEvaluation.score.value });
    } else {
      // No evaluation available so set cp to 0
      result.push({ ...partial, chartCp: 0, cp: 0 });
    }
  });

  result.sort(({ply: ply1}, {ply: ply2}) => ply1 - ply2);

  // Now loop over the result and set the keyPosition values.
  // Look ahead at the next data point to determine how to set keyPosition for
  // the current data point.
  for (let i = 0; i < result.length - 1; i++) {
    // If no judgement on the next data point, continue
    const judgement = result[i + 1].judgement;
    if (judgement == null) continue;

    // If the judgement is not for the user, continue.
    if (!result[i + 1].isUserMove) continue;

    // If the judgement is one of the keyPositionJudgements, set the keyPosition value
    // for this data point.
    const keyPositionJudgements = [
      MoveJudgement.Blunder,
      MoveJudgement.Mistake,
      MoveJudgement.Inaccurate,
    ];
    if (keyPositionJudgements.includes(judgement)) result[i].keyPosition = judgement;
  }

  return fillChartDataWithEmptyPoints(history, userColor, result);
}


// If chartData does not have a ChartDataPoint for every move in history, return a new array
// where there is a ChartDataPoint for every move in history, using empty values.
function fillChartDataWithEmptyPoints(
  history: Move[],
  userColor: PieceColor,
  chartData: ChartDataPoint[]
): ChartDataPoint[] {
  // If chartData is as long as history, just return chartData.
  if (chartData.length >= history.length) return chartData;

  const result: ChartDataPoint[] = [];

  for (let i = 0; i < history.length; i++) {
    // If we have a datapoint at this index, push it into the result and continue.
    if (chartData[i] != undefined) {
      result.push(chartData[i]);
      continue;
    }
    // Otherwise, we need to make a filler data point.

    // Get the move from history
    const move = history[i];
    if (move == undefined) throw new Error('move was undefined');

    // Indicate if this move was played by the user
    // Use not equal because activeColor is the color to move
    const { activeColor } = getFenParts(move.fen);
    const isUserMove = activeColor !== userColor;

    // Create a partial data point to avoid code repetition.
    const partial = {
      ply: move.ply,
      move: move.san,
      color: move.color,
      moveNumber: Math.ceil(move.ply / 2),
      judgement: undefined,
      isUserMove,
      keyPosition: null,
    }

    let emptyPoint: ChartDataPoint;

    // If move.san endsWith '#' that means that this is a checkmate.
    if (move.san.endsWith('#')) {
      // The loser of the game will be the active color.
      // Set the sign to negative if activeColor is white.
      let sign = 1;
      if (activeColor === PieceColor.WHITE) sign = -1;

      // Create the emptyPoint
      emptyPoint = {
        ...partial,
        mate: 0,
        chartCp: CHART_MAX_CP * sign,
      }

    // If not checkmate, just make a normal emptyPoint
    } else {
      // Make a normal filler data point
      emptyPoint = {
        ...partial,
        cp: 0,
        chartCp: 0,
      }
    }

    result.push(emptyPoint);
  }

  return result;
}

export interface Props {
  game: GameData;
  gameEvaluation: Evaluations;
  currentMove: Move | undefined;
  changeCurrentMove: (newCurrentMove?: Move) => void;
  history: Move[];
  width: number;
  includeKeyPositionDots?: boolean;
}

const GameChart = ({
  game,
  gameEvaluation,
  currentMove,
  changeCurrentMove,
  history,
  width,
  includeKeyPositionDots = true,
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
          dot={includeKeyPositionDots ? KeyPositionDots : undefined}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default GameChart;
