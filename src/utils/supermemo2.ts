/**
 * SuperMemo-2 Spaced Repetition Algorithm Implementation
 *
 * This implements the SM-2 algorithm for optimal flashcard scheduling.
 * The algorithm adjusts review intervals based on user performance.
 */

/**
 * Configuration for new card scheduling behavior
 *
 * Adjust these values to experiment with how frequently new cards appear for review.
 * Default values preserve the standard SM-2 algorithm behavior.
 */
export const NEW_CARD_CONFIG = {
  /**
   * Number of successful repetitions before a card is considered "mature"
   * Cards with repetitions <= this threshold are affected by newCardIntervalMultiplier
   *
   * Default: 2 (affects cards on their 1st and 2nd successful review)
   */
  newCardThreshold: 3,

  /**
   * Multiplier applied to intervals for new cards
   * - Values < 1.0: Cards appear MORE frequently (e.g., 0.5 = twice as often)
   * - Values > 1.0: Cards appear LESS frequently (e.g., 2.0 = half as often)
   * - Value = 1.0: No change to standard SM-2 behavior
   *
   * Default: 1.0 (standard behavior)
   */
  newCardIntervalMultiplier: 0.5,

  /**
   * Base interval for first successful review (in days)
   *
   * Default: 1 (standard SM-2)
   */
  firstRepetitionInterval: 1,

  /**
   * Base interval for second successful review (in days)
   *
   * Default: 6 (standard SM-2)
   */
  secondRepetitionInterval: 6,
};

export interface SM2Result {
  repetitions: number;
  easinessFactor: number; // Float value (e.g., 2.5)
  interval: number; // Days until next review
  nextReviewDate: Date;
}

/**
 * Review quality ratings for the 4-level system
 * Maps to SuperMemo-2 quality values (0-5 scale)
 */
export enum ReviewQuality {
  Again = 0,  // Complete failure - forgot completely
  Hard = 2,   // Difficult recall - remembered with significant difficulty
  Good = 4,   // Correct response - remembered with some effort
  Easy = 5,   // Perfect recall - remembered instantly
}

/**
 * Calculate next review schedule using SuperMemo-2 algorithm
 *
 * Formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 *
 * Where:
 * - EF is the easiness factor (minimum 1.3)
 * - q is the quality of response (0-5)
 *
 * Interval progression:
 * - First repetition: 1 day
 * - Second repetition: 6 days
 * - Subsequent: previous interval * EF
 * - Quality < 3: Reset to beginning
 *
 * @param quality - User's performance rating (0, 2, 4, or 5)
 * @param repetitions - Number of consecutive successful reviews
 * @param easinessFactor - Current easiness factor (1.3 - 2.5+)
 * @param interval - Current interval in days
 * @returns Updated SM-2 parameters and next review date
 */
export function calculateNextReview(
  quality: ReviewQuality,
  repetitions: number,
  easinessFactor: number,
  interval: number
): SM2Result {
  // Calculate new easiness factor using SM-2 formula
  let newEF = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Ensure EF stays within bounds (minimum 1.3, no maximum)
  if (newEF < 1.3) {
    newEF = 1.3;
  }

  let newRepetitions: number;
  let newInterval: number;

  // If quality < 3, reset repetitions and start over
  if (quality < 3) {
    newRepetitions = 0;
    newInterval = 1; // Review again tomorrow
  } else {
    // Successful recall - increment repetitions
    newRepetitions = repetitions + 1;

    // Calculate interval based on repetition number
    if (newRepetitions === 1) {
      newInterval = NEW_CARD_CONFIG.firstRepetitionInterval;
    } else if (newRepetitions === 2) {
      newInterval = NEW_CARD_CONFIG.secondRepetitionInterval;
    } else {
      // Third+ repetitions: I(n) = I(n-1) * EF
      newInterval = Math.round(interval * newEF);
    }

    // Apply new card multiplier if still in learning phase
    if (newRepetitions <= NEW_CARD_CONFIG.newCardThreshold) {
      newInterval = Math.round(newInterval * NEW_CARD_CONFIG.newCardIntervalMultiplier);
      // Ensure minimum interval of 1 day
      if (newInterval < 1) {
        newInterval = 1;
      }
    }
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
  nextReviewDate.setHours(0, 0, 0, 0); // Set to midnight for consistency

  return {
    repetitions: newRepetitions,
    easinessFactor: newEF,
    interval: newInterval,
    nextReviewDate,
  };
}

/**
 * Initialize SuperMemo-2 parameters for a new flashcard
 *
 * @returns Initial SM-2 parameters with default values
 */
export function initializeSM2(): SM2Result {
  const nextReviewDate = new Date();
  nextReviewDate.setHours(0, 0, 0, 0); // Set to midnight today

  return {
    repetitions: 0,
    easinessFactor: 2.5, // Default EF as per SM-2 algorithm
    interval: 0,
    nextReviewDate,
  };
}

/**
 * Convert easiness factor to integer for database storage
 * Stored as value * 1000 to avoid floating point precision issues
 * Example: 2.5 → 2500
 *
 * @param ef - Easiness factor as float
 * @returns Integer representation for database
 */
export function efToInt(ef: number): number {
  return Math.round(ef * 1000);
}

/**
 * Convert integer easiness factor from database to float
 * Example: 2500 → 2.5
 *
 * @param efInt - Integer easiness factor from database
 * @returns Easiness factor as float
 */
export function intToEf(efInt: number): number {
  return efInt / 1000;
}
