import { DotItemDotProps } from 'recharts';
import { MoveJudgement } from '@/types/chess';
import { ChessMoveColors } from '@/constants/colors';

const GameChartJudgementDots = (props: DotItemDotProps) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null

  const judgementsToShow = [
    MoveJudgement.Blunder,
    MoveJudgement.Mistake,
    MoveJudgement.Inaccurate,
  ]

  let color: string = '';
  if (payload.keyPosition === MoveJudgement.Blunder) color = ChessMoveColors.Blunder;
  if (payload.keyPosition === MoveJudgement.Mistake) color = ChessMoveColors.Mistake;
  if (payload.keyPosition === MoveJudgement.Inaccurate) color = ChessMoveColors.Inaccurate;
  if (judgementsToShow.includes(payload.keyPosition)) {
    return (
      <svg x={cx} y={cy} overflow="visible">
        <circle r="4" fill={color}/>
      </svg>
    );
  }
};

export default GameChartJudgementDots;
