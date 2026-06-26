import { Flashcard } from '@/db/schema';
import Link from "next/link";

interface Props {
  flashcard: Flashcard
}

const FlashcardDetails = ({ flashcard }: Props) => {
  return (
    <div className="flex flex-col bg-background-page rounded-md">
      <h3 className="text-lg text-center font-bold bg-stone-700 p-1 rounded-t-md mb-2">Card Details</h3>
      <div className="flex flex-col items-center gap-2 mb-2 text-sm">
        <p>Created: {flashcard.createdAt.toLocaleDateString()}</p>
        <p>Last Attempt: {flashcard.lastReviewedDate ? flashcard.lastReviewedDate.toLocaleDateString() : 'Never'}</p>
        <p>flashcard id: {flashcard.id}</p>
        <div className="pt-2 px-4 flex flex-row justify-between w-full border-t-1 border-stone-700">
            {flashcard.gameId != null && (
              <Link href={`/game-review/${flashcard.gameId}`} className="text-white underline">Game Review</Link>
            )}
            {flashcard.gameUrl != null && (
              <a target="_blank" rel="noopener noreferrer" href={flashcard.gameUrl} className="underline">
                View on {(new URL(flashcard.gameUrl)).hostname.replace(/^www\./, '')}
              </a>
            )}
          </div>
      </div>
    </div>
  );
}

export default FlashcardDetails;
