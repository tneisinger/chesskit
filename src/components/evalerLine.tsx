import { makeScoreString, MultiPV } from '@/utils/stockfish';
import { convertLanLineToSanLine } from '@/utils/chess';

interface Props {
  fen: string;
  maxLineLengthPx: number;
  line?: MultiPV;
}

const EvalerLine = ({ fen, maxLineLengthPx, line, }: Props) => {
  if (line == undefined) return <div className="py-[3px] h-[1.6rem]" />;

  const sanLine = convertLanLineToSanLine(line.lanLine, fen);

  const maxMovesLengthPx = maxLineLengthPx - 54; // 54px accounts for score and arrow
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

  return (
    <div className="text-md ml-2">
      <span className="inline-block text-right">{makeScoreString(line.score)}</span>
      <span className="inline-block w-[24px] text-center">{'->'}</span>
      <span className="inline-block text-center">
        {truncatedSanLine}
      </span>
    </div>
  )
}

export default EvalerLine;
