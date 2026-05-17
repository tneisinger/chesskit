import { getFlashcardById, getFlashcardStats } from '../actions';
import FlashcardReview from '@/components/flashcardReview';
import Link from "next/link";
import { notFound } from 'next/navigation';

interface Props {
  params: {
    id: string;
  };
}

export default async function FlashcardByIdPage({ params }: Props) {
  const { id } = await params;
  const flashcardId = parseInt(id);

  if (isNaN(flashcardId)) {
    notFound();
  }

  const result = await getFlashcardById(flashcardId);
  const stats = await getFlashcardStats();

  if (!result.success || !result.flashcard) {
    return (
      <div className="text-center py-8 bg-background-page rounded-md mt-4 p-4">
        <p className="text-xl mb-2 font-bold">Flashcard not found</p>
        <p className="text-gray-300 mb-4">
          {result.error || "The flashcard you're looking for doesn't exist or you don't have access to it."}
        </p>
        <Link href="/flashcards" className="text-white underline">
          Back to Flashcards
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <FlashcardReview flashcards={[result.flashcard]} stats={stats} />
    </div>
  );
}
