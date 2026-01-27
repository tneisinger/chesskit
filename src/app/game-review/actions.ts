"use server";

import { db } from "@/db";
import { games } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { GameData, GameEvaluation } from "@/types/chess";
import { PieceColor, GameResult, ChessWebsite } from "@/types/chess";

/**
 * Save multiple games to the database for the current user.
 * Automatically skips duplicate games (same gameId for same user).
 */
export async function saveGames(
  gamesToSave: GameData[]
): Promise<{ success: boolean; savedCount?: number; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    if (!gamesToSave || gamesToSave.length === 0) {
      return { success: false, error: "No games provided" };
    }

    const userId = Number(session.user.id);

    // Transform GameData to InsertGame format
    const gamesToInsert = gamesToSave.map((game) => ({
      userId,
      gameId: game.gameId,
      pgn: game.pgn,
      userColor: game.userColor,
      result: game.result,
      startTime: game.startTime,
      url: game.url,
      timeControl: game.timeControl,
      whiteName: game.whiteName,
      whiteElo: game.whiteElo,
      blackName: game.blackName,
      blackElo: game.blackElo,
      website: game.website,
      engineAnalysis: game.engineAnalysis,
    }));

    // Batch insert with onConflictDoNothing to skip duplicates
    const result = await db
      .insert(games)
      .values(gamesToInsert)
      .onConflictDoNothing();

    // SQLite returns the number of rows affected
    const savedCount = result.changes;

    return {
      success: true,
      savedCount: savedCount || 0,
    };
  } catch (error) {
    console.error("Error saving games:", error);
    return { success: false, error: "Failed to save games to database" };
  }
}

/**
 * Get all games for the current user, sorted by start time (newest first).
 */
export async function getUserGames(): Promise<GameData[]> {
  try {
    const session = await auth();

    if (!session?.user) {
      return [];
    }

    const userGames = await db.query.games.findMany({
      where: eq(games.userId, Number(session.user.id)),
      orderBy: [desc(games.startTime)],
    });

    return userGames.map((game) => ({
      id: game.id,
      gameId: game.gameId,
      pgn: game.pgn,
      userColor: game.userColor as PieceColor,
      result: game.result ? (game.result as GameResult) : undefined,
      startTime: game.startTime,
      url: game.url ?? undefined,
      createdAt: game.createdAt,
      engineAnalysis: game.engineAnalysis ?? undefined,
      timeControl: game.timeControl ?? undefined,
      whiteName: game.whiteName ?? undefined,
      whiteElo: game.whiteElo ?? undefined,
      blackName: game.blackName ?? undefined,
      blackElo: game.blackElo ?? undefined,
      website: game.website as ChessWebsite | undefined,
    }));
  } catch (error) {
    console.error("Error fetching user games:", error);
    return [];
  }
}

/**
 * Get a single game by ID for the current user.
 */
export async function getUserGameById(
  id: number
): Promise<{ success: boolean; game?: GameData; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    const game = await db.query.games.findFirst({
      where: and(
        eq(games.id, id),
        eq(games.userId, Number(session.user.id))
      ),
    });

    if (!game) {
      return { success: false, error: "Game not found" };
    }

    return {
      success: true,
      game: {
        id: game.id,
        gameId: game.gameId,
        pgn: game.pgn,
        userColor: game.userColor as PieceColor,
        result: game.result ? (game.result as GameResult) : undefined,
        startTime: game.startTime,
        url: game.url ?? undefined,
        createdAt: game.createdAt,
        engineAnalysis: game.engineAnalysis ?? undefined,
        timeControl: game.timeControl ?? undefined,
        whiteName: game.whiteName ?? undefined,
        whiteElo: game.whiteElo ?? undefined,
        blackName: game.blackName ?? undefined,
        blackElo: game.blackElo ?? undefined,
        website: game.website as ChessWebsite | undefined,
      },
    };
  } catch (error) {
    console.error("Error fetching game:", error);
    return { success: false, error: "Failed to fetch game" };
  }
}

/**
 * Delete a game by ID for the current user.
 */
export async function deleteUserGame(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    // Verify ownership
    const existingGame = await db.query.games.findFirst({
      where: and(
        eq(games.id, id),
        eq(games.userId, Number(session.user.id))
      ),
    });

    if (!existingGame) {
      return { success: false, error: "Game not found or access denied" };
    }

    await db.delete(games).where(eq(games.id, id));

    return { success: true };
  } catch (error) {
    console.error("Error deleting game:", error);
    return { success: false, error: "Failed to delete game" };
  }
}

/**
 * Delete multiple games by ID for the current user.
 */
export async function deleteUserGames(
  ids: number[]
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    if (!ids || ids.length === 0) {
      return { success: false, error: "No games provided" };
    }

    const userId = Number(session.user.id);

    // Delete all games matching the IDs for this user
    const { inArray } = await import("drizzle-orm");

    const result = await db
      .delete(games)
      .where(
        and(
          eq(games.userId, userId),
          inArray(games.id, ids)
        )
      );

    return {
      success: true,
      deletedCount: result.changes || 0,
    };
  } catch (error) {
    console.error("Error deleting games:", error);
    return { success: false, error: "Failed to delete games" };
  }
}

/**
 * Update a game's engine analysis in the database.
 */
export async function updateGameAnalysis(
  id: number,
  engineAnalysis: GameEvaluation
): Promise<{ success: boolean; error?: string }> {
  if (Object.keys(engineAnalysis).length === 0) {
    throw new Error('Engine analysis cannot be empty')
  }
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: "You must be logged in" };
    }

    // Verify ownership
    const existingGame = await db.query.games.findFirst({
      where: and(
        eq(games.id, id),
        eq(games.userId, Number(session.user.id))
      ),
    });

    if (!existingGame) {
      return { success: false, error: "Game not found or access denied" };
    }

    await db
      .update(games)
      .set({ engineAnalysis })
      .where(eq(games.id, id));

    return { success: true };
  } catch (error) {
    console.error("Error updating game analysis:", error);
    return { success: false, error: "Failed to update game analysis" };
  }
}
