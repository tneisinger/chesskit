import AddOnlineGames from '@/components/addOnlineGames';
import { ChessWebsite } from '@/types/chess';
import type { NextPage } from 'next';
import Image from 'next/image';

const imgHeight = 82;
const imgWidth = 200;

const Lichess: NextPage = () => {
  return (
    <div className="flex flex-col items-center mt-4">
      <Image
        src={'/lichess.png'}
        alt={'lichess.org'}
        className="rounded-md my-4"
        width={imgWidth}
        height={imgHeight}
      />
      <AddOnlineGames
        chessWebsite={ChessWebsite.Lichess}
      />
    </div>
  );
}

export default Lichess;
