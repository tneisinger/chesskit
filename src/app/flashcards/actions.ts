"use server";

import { db } from "@/db";
import { flashcards } from "@/db/schema";
import { eq, and, lte, asc } from "drizzle-orm";
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

export interface CreateFlashcardInput {
  gameId?: number;
  pgn: string;
  positionIdx: number;
  userColor: PieceColor;
  bestMoves: ScoredMove[];
  movePlayedInGame: { san: string, lan: string };
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
 */
export async function getDueFlashcards(): Promise<Flashcard[]> {
  try {
    const session = await auth();
    if (!session?.user) return [];

    const userId = Number(session.user.id);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of day

    const dueCards = await db.query.flashcards.findMany({
      where: and(
        eq(flashcards.userId, userId),
        lte(flashcards.nextReviewDate, today)
      ),
      orderBy: [asc(flashcards.nextReviewDate)],
    });

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

    return { success: true };
  } catch (error) {
    console.error("Error reviewing flashcard:", error);
    return { success: false, error: "Failed to update flashcard" };
  }
}

/**
 * Update flashcard content (lines)
 */
export async function updateFlashcard(
  id: number,
  updates: { lines?: {score: Score, lanLine: string}[]; areLinesForcing?: boolean }
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
