import { getPracticeSessionFlashcards, getFlashcardStats } from '../actions';
import FlashcardReview from '@/components/flashcardReview';
import Link from "next/link";
import type { Viewport } from 'next';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function PracticePage() {
  const practiceFlashcards = await getPracticeSessionFlashcards();
  const stats = await getFlashcardStats();

  if (practiceFlashcards.length === 0) {
    return (
      <div className="text-center py-8 bg-background-page rounded-md mt-4 p-4 max-w-[95vw]">
        <p className="text-xl mb-2 font-bold">No flashcards in practice session</p>
        <p className="text-gray-300">
          Start a practice session from <Link href='/flashcards/browse' className="text-white underline whitespace-nowrap">Browse Flashcards</Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <FlashcardReview
        flashcards={practiceFlashcards}
        stats={stats}
        isPracticeMode={true}
      />
    </div>
  );
}
