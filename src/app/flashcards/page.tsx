import { getDueFlashcards, getFlashcardStats } from './actions';
import FlashcardReview from '@/components/flashcardReview';
import Link from "next/link";

export default async function FlashcardsPage() {
  const dueFlashcards = await getDueFlashcards();
  const stats = await getFlashcardStats();

  if (stats.total === 0) {
    return (
      <div className="text-center py-8 bg-background-page rounded-md mt-4 p-4">
        <p className="text-xl mb-2 font-bold">You haven't created any flashcards</p>
        <p className="text-gray-300">
          Create flashcards in <Link href='/game-review' className={"text-white underline"}>Game Review</Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      {dueFlashcards.length === 0 ? (
        <div className="text-center py-8 bg-background-page rounded-md mt-4 p-4">
          <p className="text-xl mb-2 font-bold">No flashcards due for review</p>
          <p className="text-gray-300">
            Come back later or create new flashcards in <Link href='/game-review' className={"text-white underline"}>Game Review</Link>
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <FlashcardReview flashcards={dueFlashcards} stats={stats} />
        </div>
      )}
    </div>
  );
}
