import AddOnlineGames from '@/components/addOnlineGames';
import { ChessWebsite } from '@/types/chess';
import type { NextPage } from 'next';
import Image from 'next/image';
import { getChessUsername } from '@/app/user/actions';

export const dynamic = 'force-dynamic';

const imgHeight = 82;
const imgWidth = 200;

const Chesscom: NextPage = async () => {
  const result = await getChessUsername(ChessWebsite.Chesscom);
  const savedUsername = result.success ? result.username : undefined;

  return (
    <div className="flex flex-col items-center mt-4">
      <Image
        src={'/chesscom.png'}
        alt={'chess.com'}
        className="rounded-md my-4"
        width={imgWidth}
        height={imgHeight}
      />
      <AddOnlineGames
        chessWebsite={ChessWebsite.Chesscom}
        initialUsername={savedUsername}
      />
    </div>
  );
}

export default Chesscom;
