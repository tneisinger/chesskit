import type { Flashcard } from "@/db/schema";

/**
 * Calculate the priority score for a flashcard.
 * Higher scores = higher priority for review.
 *
 * Priority formula:
 * - Overdue factor (weight 2.0): Cards past their review date need attention
 * - Difficulty factor (weight 1.0): Harder cards (lower easiness) need more practice
 * - Learning stage factor (weight 1.5): Cards with fewer repetitions need cementing
 */
export function calculateFlashcardPriority(
  flashcard: Flashcard,
  today: Date
): number {
  // Calculate overdue days (0 if not overdue)
  const nextReviewDate = new Date(flashcard.nextReviewDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysDiff = Math.floor((today.getTime() - nextReviewDate.getTime()) / msPerDay);
  const overdueDays = Math.max(0, daysDiff);

  // Normalize easinessFactor to 0-1 scale (difficulty)
  // easinessFactor ranges from 1300 (hard) to 2500 (easy)
  // Lower easiness = higher difficulty = higher score
  const difficultyScore = (2500 - flashcard.easinessFactor) / 1200;

  // Normalize repetitions to 0-1 scale (learning stage)
  // Cards with fewer repetitions are still being learned
  // Cap at 3 repetitions for scoring purposes
  const learningScore = Math.max(0, 3 - flashcard.repetitions) / 3;

  // Apply weights and calculate final priority
  const priority =
    (overdueDays * 2.0) +
    (difficultyScore * 1.0) +
    (learningScore * 1.5);

  return priority;
}

/**
 * Sort flashcards by priority and optionally limit the count.
 *
 * @param flashcards - Array of flashcards to prioritize
 * @param limit - Optional maximum number of cards to return
 * @returns Sorted and optionally limited array of flashcards
 */
export function prioritizeFlashcards(
  flashcards: Flashcard[],
  limit?: number | null
): Flashcard[] {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of day

  // Calculate priority for each flashcard
  const cardsWithPriority = flashcards.map(card => ({
    card,
    priority: calculateFlashcardPriority(card, today)
  }));

  // Sort by priority (descending), then by nextReviewDate (ascending) for tiebreaker
  cardsWithPriority.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    // Tiebreaker: older review dates first
    return a.card.nextReviewDate.getTime() - b.card.nextReviewDate.getTime();
  });

  // Extract cards and apply limit if specified
  const sortedCards = cardsWithPriority.map(item => item.card);

  if (limit && limit > 0) {
    return sortedCards.slice(0, limit);
  }

  return sortedCards;
}
