import { Flashcard } from '@/db/schema';
import Link from "next/link";

interface Props {
  flashcard: Flashcard
}

const FlashcardDetails = ({ flashcard }: Props) => {
  return (
    <div className="flex flex-col bg-background-page rounded-md">
      <h3 className="text-lg text-center font-bold bg-stone-700 p-1 rounded-t-md mb-1">Card Details</h3>
      <div className="flex flex-col items-center gap-1 mb-2 text-md">
        <p>Flashcard: #{flashcard.id}</p>
        <p>Created: {flashcard.createdAt.toLocaleDateString()}</p>
        <p>Last Attempted: {flashcard.lastReviewedDate ? flashcard.lastReviewedDate.toLocaleDateString() : 'Never'}</p>
        {flashcard.gameId !== null && (
          <Link href={`/game-review/${flashcard.gameId}`} className="text-white underline">Game Review</Link>
        )}
      </div>
    </div>
  );
}

export default FlashcardDetails;
