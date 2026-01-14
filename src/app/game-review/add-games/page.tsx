'use client';

import type { NextPage } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { shouldUseMobileLayout } from '@/utils/mobileLayout';
import useWindowSize from '@/hooks/useWindowSize';

const imgHeight = 82;
const imgWidth = 200;
const mobileImgScalar = 0.8;

const AddGames: NextPage = () => {
  const windowSize = useWindowSize();

  const useMobileLayout = shouldUseMobileLayout(windowSize);

  return (
    <div
      className="mt-2 flex flex-col items-center h-[80vh] justify-center"
    >
      <div className="flex flex-col gap-4 items-center">
        <h3 className="text-3xl">
          Add games from an online account:
        </h3>
        <div className="flex flex-row gap-8">
          <Link href={'/game-review/add-games/chesscom'}>
            <Image
              src={'/chesscom.png'}
              alt={'chess.com'}
              width={useMobileLayout ? imgWidth * mobileImgScalar : imgWidth}
              height={useMobileLayout ? imgHeight * mobileImgScalar : imgHeight}
              className="rounded-md"
            />
          </Link>
          <Link href={'/game-review/add-games/lichess'}>
            <Image
              src={'/lichess.png'}
              alt={'lichess.org'}
              width={useMobileLayout ? imgWidth * mobileImgScalar : imgWidth}
              height={useMobileLayout ? imgHeight * mobileImgScalar : imgHeight}
              className="rounded-md"
            />
          </Link>
        </div>
      </div>
      <div className="flex w-full gap-2 my-10 text-stone-400">
        <div className="flex-1 border-b-1 h-5"></div>
        <span className="text-3xl">or</span>
        <div className="flex-1 border-b-1 h-5"></div>
      </div>
      <div>
        <Link
          href={'/game-review/add-games/pgn'}
          className="font-bold underline text-xl"
        >
            Add Games using PGN Data
        </Link>
      </div>

      <div className="flex w-full gap-2 my-10 text-stone-400">
        <div className="flex-1 border-b-1 h-5"></div>
        <span className="text-3xl">or</span>
        <div className="flex-1 border-b-1 h-5"></div>
      </div>

      <div>
        <Link
          href={'/game-review/add-games/manual-entry'}
          className="font-bold underline text-xl"
        >
            Enter a Game Using a Chess Board
        </Link>
      </div>
    </div>
  );
}

export default AddGames;
