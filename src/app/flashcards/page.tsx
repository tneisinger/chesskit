import { getDueFlashcards, getFlashcardStats } from './actions';
import FlashcardReview from '@/components/flashcardReview';

export default async function FlashcardsPage() {
  const dueFlashcards = await getDueFlashcards();
  const stats = await getFlashcardStats();

  return (
    <div>
      <div className="my-3">
        <h1 className="text-2xl font-bold mb-2 text-center">Flashcard Review</h1>
        <div className="flex gap-4 text-sm text-gray-400 justify-center">
          <div>Total: <span className="font-semibold text-foreground">{stats.total}</span></div>
          <div>Due: <span className="font-semibold text-foreground">{stats.due}</span></div>
          <div>Learning: <span className="font-semibold text-foreground">{stats.learning}</span></div>
          <div>Mature: <span className="font-semibold text-foreground">{stats.mature}</span></div>
        </div>
      </div>

      {dueFlashcards.length === 0 ? (
        <div className="text-center py-12 bg-background-page rounded-md">
          <p className="text-xl mb-2">No flashcards due for review!</p>
          <p className="text-gray-400">Come back later or create new flashcards from your games.</p>
        </div>
      ) : (
        <FlashcardReview flashcards={dueFlashcards} stats={stats} />
      )}
    </div>
  );
}
