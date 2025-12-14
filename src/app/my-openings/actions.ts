"use server";

import { db } from "@/db";
import { userLessons } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { Lesson } from "@/types/lesson";
import { PieceColor } from "@/types/chess";
import { auth } from "@/lib/auth";

export async function getUserLessons(): Promise<Lesson[]> {
	try {
		const session = await auth();

		if (!session?.user) {
			return [];
		}

		const lessons = await db.query.userLessons.findMany({
			where: eq(userLessons.userId, Number(session.user.id)),
			orderBy: (userLessons, { desc }) => [desc(userLessons.updatedAt)],
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

		const lesson = await db.query.userLessons.findFirst({
			where: and(
				eq(userLessons.id, id),
				eq(userLessons.userId, Number(session.user.id)),
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

		const result = await db.insert(userLessons).values({
			userId: Number(session.user.id),
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
		const existingLesson = await db.query.userLessons.findFirst({
			where: and(
				eq(userLessons.id, id),
				eq(userLessons.userId, Number(session.user.id)),
			),
		});

		if (!existingLesson) {
			return { success: false, error: "Lesson not found or access denied" };
		}

		await db
			.update(userLessons)
			.set({
				title: lesson.title,
				userColor: lesson.userColor,
				chapters: lesson.chapters,
				displayLine: lesson.displayLine,
				updatedAt: new Date(),
			})
			.where(eq(userLessons.id, id));

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
		const existingLesson = await db.query.userLessons.findFirst({
			where: and(
				eq(userLessons.id, id),
				eq(userLessons.userId, Number(session.user.id)),
			),
		});

		if (!existingLesson) {
			return { success: false, error: "Lesson not found or access denied" };
		}

		await db.delete(userLessons).where(eq(userLessons.id, id));

		return { success: true };
	} catch (error) {
		console.error("Error deleting user lesson:", error);
		return { success: false, error: "Failed to delete lesson" };
	}
}
