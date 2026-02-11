import { getDueFlashcards, getFlashcardStats } from './actions';
import FlashcardReview from '@/components/flashcardReview';

export default async function FlashcardsPage() {
  const dueFlashcards = await getDueFlashcards();
  const stats = await getFlashcardStats();

  return (
    <div>
      {dueFlashcards.length === 0 ? (
        <div className="text-center py-12 bg-background-page rounded-md">
          <p className="text-xl mb-2">No flashcards due for review!</p>
          <p className="text-gray-400">Come back later or create new flashcards from your games.</p>
        </div>
      ) : (
        <div className="mt-4">
          <FlashcardReview flashcards={dueFlashcards} stats={stats} />
        </div>
      )}
    </div>
  );
}
