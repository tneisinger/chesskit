import Link from 'next/link';
import { getFlashcardStats } from './actions';

export const dynamic = 'force-dynamic';

export default async function FlashcardsPage() {
  const stats = await getFlashcardStats();

  return (
    <div className="max-w-4xl mx-auto p-4 mt-4">
      <h1 className="text-3xl font-bold text-center mb-8">Flashcards</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Review Card */}
        <Link
          href="/flashcards/review"
          className="bg-background-page rounded-lg p-6 hover:bg-foreground/5 transition-colors border border-foreground/10 no-underline"
        >
          <div className="flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold mb-2 text-foreground">Review</h2>
            <p className="text-foreground/70 mt-3">
              Review due flashcards
            </p>
          </div>
        </Link>

        {/* Browse Card */}
        <Link
          href="/flashcards/browse"
          className="bg-background-page rounded-lg p-6 hover:bg-foreground/5 transition-colors border border-foreground/10 no-underline"
        >
          <div className="flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold mb-2 text-foreground">Browse</h2>
            <p className="text-foreground/70 mt-3">
              {stats.total > 0
                ? `Browse all ${stats.total} ${stats.total === 1 ? 'flashcard' : 'flashcards'}`
                : 'Browse your flashcards'}
            </p>
          </div>
        </Link>

        {/* Stats Card */}
        <Link
          href="/flashcards/stats"
          className="bg-background-page rounded-lg p-6 hover:bg-foreground/5 transition-colors border border-foreground/10 no-underline"
        >
          <div className="flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold mb-2 text-foreground">Stats</h2>
            <p className="text-foreground/70 mt-3">
              View your review statistics and progress
            </p>
          </div>
        </Link>
      </div>

      {stats.total === 0 && (
        <div className="mt-8 bg-background-page rounded-md p-6 text-center border border-foreground/10">
          <p className="text-xl mb-2 font-bold">You haven't created any flashcards</p>
          <p className="text-gray-300">
            Create flashcards in <Link href='/game-review' className="text-white underline whitespace-nowrap">Game Review</Link>
          </p>
        </div>
      )}
    </div>
  );
}
