import { DotItemDotProps } from 'recharts';
import { MoveJudgement } from '@/types/chess';
import { getJudgementColor } from '@/utils/chess';

const KeyPositionDots = (props: DotItemDotProps) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null

  const judgementsToShow = [
    MoveJudgement.Blunder,
    MoveJudgement.Mistake,
    MoveJudgement.Inaccurate,
  ]

  let color: string = '';
  if (judgementsToShow.includes(payload.keyPosition)) {
    color = getJudgementColor(payload.keyPosition);
    return (
      <svg x={cx} y={cy} overflow="visible">
        <circle r="4" fill={color}/>
      </svg>
    );
  }
};

export default KeyPositionDots;
