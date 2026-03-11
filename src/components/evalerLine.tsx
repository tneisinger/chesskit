import { makeScoreString, MultiPV } from '@/utils/stockfish';
import { convertLanLineToSanLine } from '@/utils/chess';

interface Props {
  fen: string;
  maxLineLengthPx: number;
  line?: MultiPV;

  // A tailwindcss text color class ('text-blue-500' for example)
  // If provided, the line score will be the given color.
  scoreColor?: string; 
}

const EvalerLine = ({ fen, maxLineLengthPx, line, scoreColor }: Props) => {
  if (line == undefined || (line.lanLine.length === 1 && line.lanLine[0] === '')) {
    return <div className="py-[3px] h-[1.6rem]" />;
  }

  const sanLine = convertLanLineToSanLine(line.lanLine, fen);

  const maxMovesLengthPx = maxLineLengthPx - 64; // 54px accounts for score and arrow
  const approxCharWidthPx = 10; // approximate width of a character in pixels
  const maxMovesChars = Math.floor(maxMovesLengthPx / approxCharWidthPx);
  let truncatedSanLine = "";
  for (let i = 0, len = sanLine.length; i < len; i++) {
    const move = sanLine[i];
    if ((truncatedSanLine + move).length > maxMovesChars) {
      break;
    }
    truncatedSanLine += move + " ";
  }

  const scoreClasses = ["inline-block w-10 text-right"];
  if (scoreColor) scoreClasses.push(scoreColor);

  return (
    <div className="text-md">
      <span className={scoreClasses.join(' ')}>
        {makeScoreString(line.score)}
      </span>
      <span className="inline-block w-[24px] text-center">{'->'}</span>
      <span className="inline-block text-center">
        {truncatedSanLine}
      </span>
    </div>
  )
}

export default EvalerLine;
