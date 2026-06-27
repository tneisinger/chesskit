'use client';

import { useState } from 'react';
import Button, { ButtonStyle } from '@/components/button';
import Link from 'next/link';
import { addExtraReviewCount } from '@/app/user/actions';
import { useRouter } from 'next/navigation';

interface Props {
  totalDue: number;
  dailyLimit: number;
  reviewedToday: number;
}

export default function FlashcardReviewComplete({ totalDue, dailyLimit, reviewedToday }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [extraCount, setExtraCount] = useState<number>(
    Math.min(Math.floor(dailyLimit / 2), totalDue)
  );

  const remainingDue = totalDue;
  const hasMoreCards = remainingDue > 0;

  const handleReviewMore = async () => {
    setIsLoading(true);

    try {
      const result = await addExtraReviewCount(extraCount);

      if (result.success) {
        // Refresh the page to load more flashcards
        router.refresh();
      } else {
        console.error('Error adding extra review count:', result.error);
        alert('Failed to start extra review session');
      }
    } catch (error) {
      console.error('Error adding extra review count:', error);
      alert('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasMoreCards) {
    return (
      <div className="text-center py-8 bg-background-page rounded-md mt-4 p-4 max-w-[95vw]">
        <p className="text-xl mb-4 font-bold">Daily flashcard review complete</p>
        <p className="text-gray-300">
          No flashcards are due for review. Come back tomorrow, or create more flashcards in{' '}
          <Link href='/game-review' className="text-white underline whitespace-nowrap">
            Game Review
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-8 bg-background-page rounded-md mt-4 p-5 max-w-[95vw]">
      <p className="text-2xl mb-4 font-bold">Daily Review Complete!</p>
      <p className="text-gray-300 mb-4">
        {remainingDue} more flashcard{remainingDue !== 1 ? 's are' : ' is'} available for review.
      </p>
      <p className="text-gray-300 mb-6">
        Review{' '}
        <input
          type="number"
          min="1"
          max={remainingDue}
          value={extraCount}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value) && value >= 1 && value <= remainingDue) {
              setExtraCount(value);
            }
          }}
          className="w-16 px-2 py-1 bg-background-tertiary border border-gray-600 rounded text-white text-center mx-1"
        />
        {' '}more flashcard{extraCount !== 1 ? 's' : ''}?
      </p>

      <Button
        onClick={handleReviewMore}
        disabled={isLoading}
        buttonStyle={ButtonStyle.Primary}
      >
        {isLoading ? 'Loading...' : `Review ${extraCount} more flashcard${extraCount !== 1 ? 's' : ''}`}
      </Button>
    </div>
  );
}
