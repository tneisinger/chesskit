"use server";

import { db } from "@/db";
import { flashcards, users } from "@/db/schema";
import { eq, and, lte, asc, count, desc, sql, or, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { PieceColor, ScoredMove } from "@/types/chess";
import {
  calculateNextReview,
  initializeSM2,
  ReviewQuality,
  efToInt,
  intToEf,
} from "@/utils/supermemo2";
import type { Flashcard } from "@/db/schema";
import type { Score } from "@/utils/stockfish";
import { prioritizeFlashcards } from "@/utils/flashcardPriority";
import { incrementDailyReviewCount } from "@/app/user/actions";

/**
 * Get today's date string in YYYY-MM-DD format using the server's local timezone.
 * This ensures consistency across all daily tracking features.
 */
function getLocalDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface CreateFlashcardInput {
  gameId?: number;
  pgn: string;
  positionIdx: number;
  userColor: PieceColor;
  bestMoves: ScoredMove[];
  movePlayedInGame?: { san: string, lan: string };
  gameUrl?: string;
  areLinesForcing: boolean;
}

/**
 * Create a new flashcard for the current user
 */
export async function createFlashcard(
  input: CreateFlashcardInput
): Promise<{ success: boolean; flashcardId?: number; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const userId = Number(session.user.id);

    // Check if flashcard already exists for this position
    if (input.gameId) {
      const existing = await db.query.flashcards.findFirst({
        where: and(
          eq(flashcards.userId, userId),
          eq(flashcards.gameId, input.gameId),
          eq(flashcards.positionIdx, input.positionIdx)
        ),
      });

      if (existing) {
        return {
          success: false,
          error: "Flashcard already exists for this position",
        };
      }
    }

    // Initialize SM-2 parameters for new flashcard
    const sm2 = initializeSM2();

    const result = await db.insert(flashcards).values({
      userId,
      gameId: input.gameId,
      pgn: input.pgn,
      positionIdx: input.positionIdx,
      userColor: input.userColor,
      bestMoves: input.bestMoves,
      movePlayedInGame: input.movePlayedInGame,
      gameUrl: input.gameUrl,
      areLinesForcing: input.areLinesForcing,
      repetitions: sm2.repetitions,
      easinessFactor: efToInt(sm2.easinessFactor),
      interval: sm2.interval,
      nextReviewDate: sm2.nextReviewDate,
    });

    return { success: true, flashcardId: Number(result.lastInsertRowid) };
  } catch (error) {
    console.error("Error creating flashcard:", error);
    return { success: false, error: "Failed to create flashcard" };
  }
}

/**
 * Get all flashcards due for review (next_review_date <= today)
 * @param options.applyDailyLimit - Whether to apply the user's daily limit (default: true)
 */
export async function getDueFlashcards(
  options?: { applyDailyLimit?: boolean }
): Promise<Flashcard[]> {
  try {
    const session = await auth();
    if (!session?.user) return [];

    const userId = Number(session.user.id);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of day
    const todayStr = getLocalDateString();

    const dueCards = await db.query.flashcards.findMany({
      where: and(
        eq(flashcards.userId, userId),
        lte(flashcards.nextReviewDate, today)
      ),
      orderBy: [asc(flashcards.nextReviewDate)],
    });

    // Apply daily limit if enabled (default: true)
    const applyLimit = options?.applyDailyLimit !== false;

    if (applyLimit) {
      // Fetch user preferences to get daily limit, extra review count, and progress
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      const dailyLimit = user?.preferences?.dailyFlashcardLimit;
      const progress = user?.preferences?.dailyReviewProgress;

      // Calculate how many cards have been reviewed today and extra review count
      // Both reset on new day
      const reviewedToday = progress?.date === todayStr ? progress.count : 0;
      const extraReviewCount = progress?.date === todayStr ? (progress.extraReviewCount ?? 0) : 0;

      // Calculate effective limit (daily limit + extra review count)
      if (dailyLimit && dailyLimit > 0) {
        const effectiveLimit = dailyLimit + extraReviewCount;
        const remainingAllowed = Math.max(0, effectiveLimit - reviewedToday);

        // If the user has reached their limit, return empty array
        if (remainingAllowed === 0) {
          return [];
        }

        // If there are more cards than remaining allowed, prioritize them
        if (dueCards.length > remainingAllowed) {
          return prioritizeFlashcards(dueCards, remainingAllowed);
        }
      }
    }

    return dueCards;
  } catch (error) {
    console.error("Error fetching due flashcards:", error);
    return [];
  }
}

/**
 * Get all flashcards for the current user (for browsing/management)
 */
export async function getAllFlashcards(): Promise<Flashcard[]> {
  try {
    const session = await auth();
    if (!session?.user) return [];

    const userId = Number(session.user.id);

    const allCards = await db.query.flashcards.findMany({
      where: eq(flashcards.userId, userId),
      orderBy: [asc(flashcards.createdAt)],
    });

    return allCards;
  } catch (error) {
    console.error("Error fetching all flashcards:", error);
    return [];
  }
}

/**
 * Get a single flashcard by ID
 */
export async function getFlashcardById(
  id: number
): Promise<{ success: boolean; flashcard?: Flashcard; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const flashcard = await db.query.flashcards.findFirst({
      where: and(
        eq(flashcards.id, id),
        eq(flashcards.userId, Number(session.user.id))
      ),
    });

    if (!flashcard) {
      return { success: false, error: "Flashcard not found" };
    }

    return { success: true, flashcard };
  } catch (error) {
    console.error("Error fetching flashcard:", error);
    return { success: false, error: "Failed to fetch flashcard" };
  }
}

/**
 * Update flashcard after review
 */
export async function reviewFlashcard(
  id: number,
  quality: ReviewQuality
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const userId = Number(session.user.id);

    // Get current flashcard
    const flashcard = await db.query.flashcards.findFirst({
      where: and(eq(flashcards.id, id), eq(flashcards.userId, userId)),
    });

    if (!flashcard) {
      return { success: false, error: "Flashcard not found" };
    }

    // Calculate next review using SuperMemo-2
    const sm2Result = calculateNextReview(
      quality,
      flashcard.repetitions,
      intToEf(flashcard.easinessFactor),
      flashcard.interval
    );

    // Update flashcard
    await db
      .update(flashcards)
      .set({
        repetitions: sm2Result.repetitions,
        easinessFactor: efToInt(sm2Result.easinessFactor),
        interval: sm2Result.interval,
        nextReviewDate: sm2Result.nextReviewDate,
        lastReviewedDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(flashcards.id, id));

    // Increment daily review count for badge tracking
    await incrementDailyReviewCount();

    return { success: true };
  } catch (error) {
    console.error("Error reviewing flashcard:", error);
    return { success: false, error: "Failed to update flashcard" };
  }
}

/**
 * Update flashcard content (pgn, lines, areLinesForcing)
 */
export async function updateFlashcard(
  id: number,
  updates: { pgn?: string; lines?: {score: Score, lanLine: string}[]; areLinesForcing?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    // Verify ownership
    const flashcard = await db.query.flashcards.findFirst({
      where: and(
        eq(flashcards.id, id),
        eq(flashcards.userId, Number(session.user.id))
      ),
    });

    if (!flashcard) {
      return {
        success: false,
        error: "Flashcard not found or access denied",
      };
    }

    await db
      .update(flashcards)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(flashcards.id, id));

    return { success: true };
  } catch (error) {
    console.error("Error updating flashcard:", error);
    return { success: false, error: "Failed to update flashcard" };
  }
}

/**
 * Update flashcard PGN
 */
export async function updateFlashcardPgn(
  id: number,
  pgn: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    // Verify ownership
    const flashcard = await db.query.flashcards.findFirst({
      where: and(
        eq(flashcards.id, id),
        eq(flashcards.userId, Number(session.user.id))
      ),
    });

    if (!flashcard) {
      return {
        success: false,
        error: "Flashcard not found or access denied",
      };
    }

    await db
      .update(flashcards)
      .set({
        pgn,
        updatedAt: new Date(),
      })
      .where(eq(flashcards.id, id));

    return { success: true };
  } catch (error) {
    console.error("Error updating flashcard PGN:", error);
    return { success: false, error: "Failed to update flashcard PGN" };
  }
}

/**
 * Delete a flashcard
 */
export async function deleteFlashcard(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    // Verify ownership
    const flashcard = await db.query.flashcards.findFirst({
      where: and(
        eq(flashcards.id, id),
        eq(flashcards.userId, Number(session.user.id))
      ),
    });

    if (!flashcard) {
      return {
        success: false,
        error: "Flashcard not found or access denied",
      };
    }

    await db.delete(flashcards).where(eq(flashcards.id, id));
    return { success: true };
  } catch (error) {
    console.error("Error deleting flashcard:", error);
    return { success: false, error: "Failed to delete flashcard" };
  }
}

/**
 * Get statistics about user's flashcards
 */
export async function getFlashcardStats(): Promise<{
  total: number;
  due: number;
  learning: number; // repetitions < 2
  mature: number; // repetitions >= 2
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { total: 0, due: 0, learning: 0, mature: 0 };
    }

    const userId = Number(session.user.id);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const allCards = await db.query.flashcards.findMany({
      where: eq(flashcards.userId, userId),
    });

    const stats = {
      total: allCards.length,
      due: allCards.filter((card) => card.nextReviewDate <= today).length,
      learning: allCards.filter((card) => card.repetitions < 2).length,
      mature: allCards.filter((card) => card.repetitions >= 2).length,
    };

    return stats;
  } catch (error) {
    console.error("Error fetching flashcard stats:", error);
    return { total: 0, due: 0, learning: 0, mature: 0 };
  }
}

/**
 * Get the total count of due flashcards without applying the daily limit
 */
export async function getTotalDueCount(): Promise<number> {
  try {
    const session = await auth();
    if (!session?.user) return 0;

    const userId = Number(session.user.id);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const dueCards = await db.query.flashcards.findMany({
      where: and(
        eq(flashcards.userId, userId),
        lte(flashcards.nextReviewDate, today)
      ),
    });

    return dueCards.length;
  } catch (error) {
    console.error("Error fetching total due count:", error);
    return 0;
  }
}

export interface DailyReviewData {
  date: string;
  count: number;
}

export interface ReviewStatsData {
  dailyReviews: DailyReviewData[];
  totalReviews: number;
  averagePerDay: number;
  daysInPeriod: number;
}

/**
 * Get review statistics for a given time period
 */
export async function getReviewStats(days?: number): Promise<ReviewStatsData> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { dailyReviews: [], totalReviews: 0, averagePerDay: 0, daysInPeriod: 0 };
    }

    const userId = Number(session.user.id);

    // Get all flashcards for the user
    const allCards = await db.query.flashcards.findMany({
      where: eq(flashcards.userId, userId),
    });

    // Filter cards that have been reviewed
    const reviewedCards = allCards.filter((card) => card.lastReviewedDate !== null);

    // Calculate the start date based on days parameter
    const now = new Date();
    let startDate: Date;
    if (days) {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // If no days specified, get all time (use earliest review date)
      if (reviewedCards.length === 0) {
        return { dailyReviews: [], totalReviews: 0, averagePerDay: 0, daysInPeriod: 0 };
      }
      const earliestReview = reviewedCards.reduce((earliest, card) => {
        const reviewDate = card.lastReviewedDate!;
        return reviewDate < earliest ? reviewDate : earliest;
      }, reviewedCards[0].lastReviewedDate!);
      startDate = new Date(earliestReview);
      startDate.setHours(0, 0, 0, 0);
    }

    // Filter reviews within the time period
    const filteredReviews = reviewedCards.filter((card) => {
      const reviewDate = card.lastReviewedDate!;
      return reviewDate >= startDate;
    });

    // Group reviews by date
    const reviewsByDate = new Map<string, number>();
    filteredReviews.forEach((card) => {
      const reviewDate = new Date(card.lastReviewedDate!);
      const dateKey = reviewDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      reviewsByDate.set(dateKey, (reviewsByDate.get(dateKey) || 0) + 1);
    });

    // Create array of all dates in range with counts
    const dailyReviews: DailyReviewData[] = [];
    const currentDate = new Date(startDate);
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyReviews.push({
        date: dateKey,
        count: reviewsByDate.get(dateKey) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate statistics
    const totalReviews = filteredReviews.length;
    const daysInPeriod = dailyReviews.length;
    const averagePerDay = daysInPeriod > 0 ? totalReviews / daysInPeriod : 0;

    return {
      dailyReviews,
      totalReviews,
      averagePerDay,
      daysInPeriod,
    };
  } catch (error) {
    console.error("Error fetching review stats:", error);
    return { dailyReviews: [], totalReviews: 0, averagePerDay: 0, daysInPeriod: 0 };
  }
}

export type GamePhase = 'Opening' | 'MiddleGame' | 'EndGame';

export interface FlashcardFilters {
  colors?: PieceColor[];
  minMoveNumber?: number;
  maxMoveNumber?: number;
  gamePhases?: GamePhase[];
}

/**
 * Get paginated flashcards for the current user with optional filters
 */
export async function getPaginatedFlashcards(
  page: number = 1,
  pageSize: number = 100,
  filters?: FlashcardFilters
): Promise<{
  flashcards: Flashcard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { flashcards: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const userId = Number(session.user.id);
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const whereConditions = [eq(flashcards.userId, userId)];

    // Apply filters
    if (filters?.colors && filters.colors.length > 0) {
      const colorConditions = filters.colors.map((color) =>
        eq(flashcards.userColor, color)
      );
      if (colorConditions.length === 1) {
        whereConditions.push(colorConditions[0]);
      } else {
        // OR condition for multiple colors
        whereConditions.push(or(...colorConditions)!);
      }
    }

    if (filters?.minMoveNumber !== undefined) {
      whereConditions.push(gte(flashcards.positionIdx, filters.minMoveNumber));
    }

    if (filters?.maxMoveNumber !== undefined) {
      whereConditions.push(lte(flashcards.positionIdx, filters.maxMoveNumber));
    }

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(flashcards)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    // Get paginated flashcards, ordered by most recently created first
    const userFlashcards = await db
      .select()
      .from(flashcards)
      .where(and(...whereConditions))
      .orderBy(desc(flashcards.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalPages = Math.ceil(total / pageSize);

    return {
      flashcards: userFlashcards,
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error("Error fetching paginated flashcards:", error);
    return { flashcards: [], total: 0, page, pageSize, totalPages: 0 };
  }
}

/**
 * Start a new practice session with the given flashcard IDs
 */
export async function startPracticeSession(
  flashcardIds: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const userId = Number(session.user.id);

    // Get current user preferences
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Update preferences with practice session flashcard IDs
    await db
      .update(users)
      .set({
        preferences: {
          ...user.preferences,
          practiceSessionFlashcardIds: flashcardIds,
        },
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error("Error starting practice session:", error);
    return { success: false, error: "Failed to start practice session" };
  }
}

/**
 * Get flashcards for the current practice session
 */
export async function getPracticeSessionFlashcards(): Promise<Flashcard[]> {
  try {
    const session = await auth();
    if (!session?.user) return [];

    const userId = Number(session.user.id);

    // Get user's practice session flashcard IDs
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user || !user.preferences?.practiceSessionFlashcardIds) {
      return [];
    }

    const flashcardIds = user.preferences.practiceSessionFlashcardIds;

    if (flashcardIds.length === 0) {
      return [];
    }

    // Fetch flashcards by IDs
    const practiceFlashcards = await db.query.flashcards.findMany({
      where: and(
        eq(flashcards.userId, userId),
        or(...flashcardIds.map((id) => eq(flashcards.id, id)))
      ),
      orderBy: [asc(flashcards.createdAt)],
    });

    return practiceFlashcards;
  } catch (error) {
    console.error("Error fetching practice session flashcards:", error);
    return [];
  }
}

/**
 * Remove a flashcard from the current practice session
 */
export async function removePracticeFlashcard(
  flashcardId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const userId = Number(session.user.id);

    // Get current user preferences
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const currentIds = user.preferences?.practiceSessionFlashcardIds || [];
    const updatedIds = currentIds.filter((id) => id !== flashcardId);

    // Update preferences
    await db
      .update(users)
      .set({
        preferences: {
          ...user.preferences,
          practiceSessionFlashcardIds: updatedIds,
        },
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error("Error removing practice flashcard:", error);
    return { success: false, error: "Failed to remove flashcard from practice session" };
  }
}

/**
 * Clear the current practice session
 */
export async function clearPracticeSession(): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const userId = Number(session.user.id);

    // Get current user preferences
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Clear practice session
    await db
      .update(users)
      .set({
        preferences: {
          ...user.preferences,
          practiceSessionFlashcardIds: [],
        },
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error("Error clearing practice session:", error);
    return { success: false, error: "Failed to clear practice session" };
  }
}

/**
 * Get the count of flashcards in the current practice session
 */
export async function getPracticeSessionCount(): Promise<number> {
  try {
    const session = await auth();
    if (!session?.user) return 0;

    const userId = Number(session.user.id);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    return user?.preferences?.practiceSessionFlashcardIds?.length || 0;
  } catch (error) {
    console.error("Error getting practice session count:", error);
    return 0;
  }
}
