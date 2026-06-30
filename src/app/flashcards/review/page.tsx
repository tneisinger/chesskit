import { getDueFlashcards, getFlashcardStats, getTotalDueCount } from '../actions';
import { getDailyFlashcardLimit, checkDailyLimitReached } from '@/app/user/actions';
import FlashcardReview from '@/components/flashcardReview';
import FlashcardReviewComplete from '@/components/flashcardReviewComplete';
import Link from "next/link";
import type { Viewport } from 'next';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function FlashcardsPage() {
  const dueFlashcards = await getDueFlashcards();
  const stats = await getFlashcardStats();
  const totalDue = await getTotalDueCount();
  const limitResult = await getDailyFlashcardLimit();
  const limit = limitResult.success ? limitResult.limit : null;
  const dailyLimitStatus = await checkDailyLimitReached();

  if (stats.total === 0) {
    return (
      <div className="text-center py-8 bg-background-page rounded-md mt-4 p-4 max-w-[95vw]">
        <p className="text-xl mb-2 font-bold">You haven't created any flashcards</p>
        <p className="text-gray-300">
          Create flashcards in <Link href='/game-review' className="text-white underline whitespace-nowrap">Game Review</Link>
        </p>
      </div>
    )
  }

  // Check if user has completed their daily limit
  // Show completion screen when limit is reached and no cards are available from getDueFlashcards
  if (
    dailyLimitStatus.success &&
    dailyLimitStatus.limitReached &&
    dailyLimitStatus.dailyLimit != null &&
    dueFlashcards.length === 0 &&
    totalDue > 0
  ) {
    return (
      <FlashcardReviewComplete
        totalDue={totalDue}
        dailyLimit={dailyLimitStatus.dailyLimit}
        reviewedToday={dailyLimitStatus.reviewedToday ?? 0}
      />
    );
  }

  return (
    <div>
      {dueFlashcards.length === 0 ? (
        <div className="text-center py-8 bg-background-page rounded-md mt-4 p-4 max-w-[95vw]">
          <p className="text-xl mb-2 font-bold">No flashcards due for review</p>
          <p className="text-gray-300">
            Come back later or create new flashcards in <Link href='/game-review' className="text-white underline whitespace-nowrap">Game Review</Link>
          </p>
        </div>
      ) : (
        <div>
          <FlashcardReview flashcards={dueFlashcards} stats={stats} />
        </div>
      )}
    </div>
  );
}
