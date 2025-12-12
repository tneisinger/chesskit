import React from 'react'
import { makeScoreString, MultiPV } from '@/utils/stockfish';
import { convertLanLineToSanLine } from '@/utils/chess';

interface Props {
  fen: string;
  line?: MultiPV;
  maxLineLength?: number;
}

const EvalerLine = ({ fen, line, maxLineLength = 5 }: Props) => {
  if (line == undefined) return <div className="py-[3px] h-[1.6rem]" />;

  const sanLine = convertLanLineToSanLine(line.lanLine, fen);

  return (
    <div className="py-[3px] h-[1.6rem] text-sm">
      <span className="inline-block w-10 text-right">{makeScoreString(line.score)}</span>
      <span className="inline-block w-[24px] text-center">{'->'}</span>
      <span className="inline-block text-center">
        {sanLine.slice(0, maxLineLength).map((move, i) =>
          <span key={`${line.multipv} ${i}`} className="inline-block text-center [&+span]:ml-2">
            {move}
          </span>
        )}
      </span>
    </div>
  )
}

export default EvalerLine;
