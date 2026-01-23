import { DotItemDotProps } from 'recharts';
import { MoveJudgement } from '@/types/chess';

const GameChartJudgementDots = (props: DotItemDotProps) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null

  const judgementsToShow = [
    MoveJudgement.Blunder,
    MoveJudgement.Mistake,
  ]

  let color: string = '';
  if (payload.judgement === MoveJudgement.Blunder) color = 'red';
  if (payload.judgement === MoveJudgement.Mistake) color = 'orange';
  if (payload.isUserMove && judgementsToShow.includes(payload.judgement)) {
    return (
      <svg x={cx} y={cy} overflow="visible">
        <circle r="3" fill={color} />
      </svg>
    );
  }
};

export default GameChartJudgementDots;
