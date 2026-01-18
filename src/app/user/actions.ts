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
