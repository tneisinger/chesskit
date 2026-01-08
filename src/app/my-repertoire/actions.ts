"use server";

import { db } from "@/db";
import { userRepertoire } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import type { Lesson } from "@/types/lesson";
import { PieceColor } from "@/types/chess";
import { auth } from "@/lib/auth";
import { MAX_USER_LESSONS } from "./constants";
import { performLessonLimitChecks } from "@/utils/lesson";

export async function isUserAtLessonLimit(
	userId: number,
): Promise<boolean> {
	try {
		const result = await db
			.select({ count: count() })
			.from(userRepertoire)
			.where(eq(userRepertoire.userId, userId));

		return result[0].count >= MAX_USER_LESSONS;
	} catch (error) {
		console.error("Error checking lesson limit:", error);
		return false;
	}
}

export async function getUserRepertoire(): Promise<Lesson[]> {
	try {
		const session = await auth();

		if (!session?.user) {
			return [];
		}

		const lessons = await db.query.userRepertoire.findMany({
			where: eq(userRepertoire.userId, Number(session.user.id)),
			orderBy: (userRepertoire, { desc }) => [desc(userRepertoire.updatedAt)],
		});

		return lessons.map((lesson) => ({
			id: lesson.id,
			title: lesson.title,
			userColor: lesson.userColor as PieceColor,
			chapters: lesson.chapters,
			displayLine: lesson.displayLine ?? undefined,
		}));
	} catch (error) {
		console.error("Error fetching user lessons:", error);
		return [];
	}
}

export async function getUserLessonById(
	id: number,
): Promise<{ success: boolean; lesson?: Lesson; error?: string }> {
	try {
		const session = await auth();

		if (!session?.user) {
			return { success: false, error: "You must be logged in" };
		}

		const lesson = await db.query.userRepertoire.findFirst({
			where: and(
				eq(userRepertoire.id, id),
				eq(userRepertoire.userId, Number(session.user.id)),
			),
		});

		if (!lesson) {
			return { success: false, error: "Lesson not found" };
		}

		return {
			success: true,
			lesson: {
				id: lesson.id,
				title: lesson.title,
				userColor: lesson.userColor as PieceColor,
				chapters: lesson.chapters,
				displayLine: lesson.displayLine ?? undefined,
			},
		};
	} catch (error) {
		console.error("Error fetching user lesson:", error);
		return { success: false, error: "Failed to fetch lesson" };
	}
}

export async function createUserLesson(
	lesson: Omit<Lesson, "id">,
): Promise<{ success: boolean; id?: number; error?: string }> {
	try {
		const session = await auth();

		if (!session?.user) {
			return { success: false, error: "You must be logged in" };
		}

		const userId = Number(session.user.id);

    const limitCheckResult = performLessonLimitChecks(lesson);
    if (!limitCheckResult.success) {
      return limitCheckResult;
    }

		// Check if user has reached the lesson limit
		const atLimit = await isUserAtLessonLimit(userId);
		if (atLimit) {
			return {
				success: false,
				error: `You have reached the maximum limit of ${MAX_USER_LESSONS} lessons. Please delete a lesson before creating a new one.`,
			};
		}

		const result = await db.insert(userRepertoire).values({
			userId,
			title: lesson.title,
			userColor: lesson.userColor,
			chapters: lesson.chapters,
			displayLine: lesson.displayLine,
		});

		return { success: true, id: Number(result.lastInsertRowid) };
	} catch (error) {
		console.error("Error creating user lesson:", error);
		return { success: false, error: "Failed to create lesson" };
	}
}

export async function updateUserLesson(
	id: number,
	lesson: Omit<Lesson, "id">,
): Promise<{ success: boolean; error?: string }> {
	try {
		const session = await auth();

		if (!session?.user) {
			return { success: false, error: "You must be logged in" };
		}

		// Verify ownership
		const existingLesson = await db.query.userRepertoire.findFirst({
			where: and(
				eq(userRepertoire.id, id),
				eq(userRepertoire.userId, Number(session.user.id)),
			),
		});

		if (!existingLesson) {
			return { success: false, error: "Lesson not found or access denied" };
		}

    const limitCheckResult = performLessonLimitChecks(lesson);
    if (!limitCheckResult.success) {
      return limitCheckResult;
    }

		await db
			.update(userRepertoire)
			.set({
				title: lesson.title,
				userColor: lesson.userColor,
				chapters: lesson.chapters,
				displayLine: lesson.displayLine,
				updatedAt: new Date(),
			})
			.where(eq(userRepertoire.id, id));

		return { success: true };
	} catch (error) {
		console.error("Error updating user lesson:", error);
		return { success: false, error: "Failed to update lesson" };
	}
}

export async function deleteUserLesson(
	id: number,
): Promise<{ success: boolean; error?: string }> {
	try {
		const session = await auth();

		if (!session?.user) {
			return { success: false, error: "You must be logged in" };
		}

		// Verify ownership
		const existingLesson = await db.query.userRepertoire.findFirst({
			where: and(
				eq(userRepertoire.id, id),
				eq(userRepertoire.userId, Number(session.user.id)),
			),
		});

		if (!existingLesson) {
			return { success: false, error: "Lesson not found or access denied" };
		}

		await db.delete(userRepertoire).where(eq(userRepertoire.id, id));

		return { success: true };
	} catch (error) {
		console.error("Error deleting user lesson:", error);
		return { success: false, error: "Failed to delete lesson" };
	}
}
