"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { ChessWebsite } from "@/types/chess";

/**
 * Save the chess.com or Lichess username for the current user.
 */
export async function saveChessUsername(
  chessWebsite: ChessWebsite,
  username: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const userId = Number(session.user.id);

    // Update the appropriate username field based on the chess website
    const updateData =
      chessWebsite === ChessWebsite.Chesscom
        ? { chesscomUsername: username }
        : { lichessUsername: username };

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error("Error saving chess username:", error);
    return { success: false, error: "Failed to save username" };
  }
}

/**
 * Get the saved chess.com or Lichess username for the current user.
 */
export async function getChessUsername(
  chessWebsite: ChessWebsite
): Promise<{ success: boolean; username?: string; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const userId = Number(session.user.id);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const username =
      chessWebsite === ChessWebsite.Chesscom
        ? user.chesscomUsername
        : user.lichessUsername;

    return {
      success: true,
      username: username ?? undefined,
    };
  } catch (error) {
    console.error("Error getting chess username:", error);
    return { success: false, error: "Failed to get username" };
  }
}

/**
 * Get the daily flashcard limit for the current user.
 */
export async function getDailyFlashcardLimit(): Promise<{
  success: boolean;
  limit?: number | null;
  error?: string;
}> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const userId = Number(session.user.id);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      limit: user.preferences?.dailyFlashcardLimit ?? null,
    };
  } catch (error) {
    console.error("Error getting daily flashcard limit:", error);
    return { success: false, error: "Failed to get daily limit" };
  }
}

/**
 * Set the daily flashcard limit for the current user.
 * @param limit - Number of cards (must be >= 1) or null for unlimited
 */
export async function setDailyFlashcardLimit(
  limit: number | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    // Validate limit
    if (limit !== null && (limit < 1 || !Number.isInteger(limit))) {
      return {
        success: false,
        error: "Limit must be a positive integer (minimum 1) or null for unlimited"
      };
    }

    const userId = Number(session.user.id);

    // Fetch current preferences
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Update preferences with new limit
    const updatedPreferences = {
      ...user.preferences,
      dailyFlashcardLimit: limit,
    };

    await db
      .update(users)
      .set({ preferences: updatedPreferences })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error("Error setting daily flashcard limit:", error);
    return { success: false, error: "Failed to set daily limit" };
  }
}

/**
 * Get the number of flashcards reviewed today by the current user.
 */
export async function getDailyReviewProgress(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const userId = Number(session.user.id);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const progress = user.preferences?.dailyReviewProgress;

    // If no progress or different day, count is 0
    if (!progress || progress.date !== today) {
      return { success: true, count: 0 };
    }

    return { success: true, count: progress.count };
  } catch (error) {
    console.error("Error getting daily review progress:", error);
    return { success: false, error: "Failed to get daily review progress" };
  }
}

/**
 * Increment the daily review count for the current user.
 * Automatically resets if it's a new day.
 */
export async function incrementDailyReviewCount(): Promise<{
  success: boolean;
  newCount?: number;
  error?: string;
}> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const userId = Number(session.user.id);

    // Fetch current preferences
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const currentProgress = user.preferences?.dailyReviewProgress;

    let newCount: number;

    // If no progress or different day, start fresh at 1
    if (!currentProgress || currentProgress.date !== today) {
      newCount = 1;
    } else {
      // Same day, increment
      newCount = currentProgress.count + 1;
    }

    // Update preferences
    const updatedPreferences = {
      ...user.preferences,
      dailyReviewProgress: {
        date: today,
        count: newCount,
      },
    };

    await db
      .update(users)
      .set({ preferences: updatedPreferences })
      .where(eq(users.id, userId));

    return { success: true, newCount };
  } catch (error) {
    console.error("Error incrementing daily review count:", error);
    return { success: false, error: "Failed to increment daily review count" };
  }
}
