"use server";

import { db } from "@/db";
import { lessons } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Lesson } from "@/types/lesson";
import { PieceColor } from "@/types/chess";
import { auth } from "@/lib/auth";
import { MAX_CHAPTERS, MAX_PGN_LENGTH } from "@/types/lesson";

export async function getLessonByTitle(
	title: string,
): Promise<Lesson | null> {
	const result = await db
		.select()
		.from(lessons)
		.where(eq(lessons.title, title))
		.limit(1);

	if (result.length === 0) {
		return null;
	}

	const dbLesson = result[0];

	// Map database lesson to Lesson type
	return {
		title: dbLesson.title,
		userColor: dbLesson.userColor as PieceColor,
		chapters: dbLesson.chapters,
		displayLine: dbLesson.displayLine ?? undefined,
	};
}

export async function getAllLessons() {
	const result = await db.select().from(lessons);

	return result.map((dbLesson) => ({
		title: dbLesson.title,
		userColor: dbLesson.userColor as PieceColor,
		chapters: dbLesson.chapters,
		displayLine: dbLesson.displayLine ?? undefined,
	}));
}

export async function createLesson(
  lesson: Lesson
): Promise<{ success: boolean; error?: string }> {
	try {
		// Check authentication and authorization
		const session = await auth();

		if (!session?.user) {
			return { success: false, error: "You must be logged in" };
		}

		if (session.user.role !== "admin") {
			return {
				success: false,
				error: "Only administrators can create system lessons",
			};
		}

		// Check if a lesson with this title already exists
		const existing = await getLessonByTitle(lesson.title);
		if (existing) {
			return { success: false, error: "A lesson with this title already exists" };
		}

    // Check if lesson has too many chapters
		if (lesson.chapters.length > MAX_CHAPTERS) {
			return {
				success: false,
				error: `Lesson cannot have more than ${MAX_CHAPTERS} chapters.`,
			};
		}

		// Check if any chapter PGN is too long
    for (const [i, c] of lesson.chapters.entries()) {
      if (c.pgn.length > MAX_PGN_LENGTH) {
        return {
          success: false,
          error: `The PGN of chapter ${i + 1} is too long. Reduce the moves section by ${c.pgn.length - MAX_PGN_LENGTH} characters.`
        };
      }
    };

		// Insert the new lesson
		await db.insert(lessons).values({
			title: lesson.title,
			userColor: lesson.userColor,
			chapters: lesson.chapters,
			displayLine: lesson.displayLine ?? null,
		});

		return { success: true };
	} catch (error) {
		console.error("Error creating lesson:", error);
		return { success: false, error: "Failed to create lesson" };
	}
}

export async function updateLesson(
	originalTitle: string,
	lesson: Lesson
): Promise<{ success: boolean; error?: string }> {
	try {
		// Check authentication and authorization
		const session = await auth();

		if (!session?.user) {
			return { success: false, error: "You must be logged in" };
		}

		if (session.user.role !== "admin") {
			return {
				success: false,
				error: "Only administrators can edit system lessons",
			};
		}

		// Check if the lesson exists
		const existing = await getLessonByTitle(originalTitle);
		if (!existing) {
			return { success: false, error: "Lesson not found" };
		}

		// Check if lesson has too many chapters
		if (lesson.chapters.length > MAX_CHAPTERS) {
			return {
				success: false,
				error: `Lesson cannot have more than ${MAX_CHAPTERS} chapters.`,
			};
		}

		// Check if any chapter PGN is too long
    for (const [i, c] of lesson.chapters.entries()) {
      if (c.pgn.length > MAX_PGN_LENGTH) {
        return {
          success: false,
          error: `The PGN of chapter ${i + 1} is too long. Reduce the moves section by ${c.pgn.length - MAX_PGN_LENGTH} characters.`
        };
      }
    };

		// Check if the title has changed
		const titleChanged = originalTitle !== lesson.title;

		if (titleChanged) {
			// If title changed, check if new title already exists
			const newTitleExists = await getLessonByTitle(lesson.title);
			if (newTitleExists) {
				return { success: false, error: "A lesson with this title already exists" };
			}

			// Create new lesson with new title
			await db.insert(lessons).values({
				title: lesson.title,
				userColor: lesson.userColor,
				chapters: lesson.chapters,
				displayLine: lesson.displayLine ?? null,
			});

			// Delete old lesson
			await db.delete(lessons).where(eq(lessons.title, originalTitle));

			return { success: true };
		} else {
			// Title hasn't changed, just update the lesson
			await db
				.update(lessons)
				.set({
					userColor: lesson.userColor,
					chapters: lesson.chapters,
					displayLine: lesson.displayLine ?? null,
					updatedAt: new Date(),
				})
				.where(eq(lessons.title, originalTitle));

			return { success: true };
		}
	} catch (error) {
		console.error("Error updating lesson:", error);
		return { success: false, error: "Failed to update lesson" };
	}
}

export async function deleteLesson(title: string): Promise<{ success: boolean; error?: string }> {
	try {
		// Check authentication and authorization
		const session = await auth();

		if (!session?.user) {
			return { success: false, error: "You must be logged in" };
		}

		if (session.user.role !== "admin") {
			return {
				success: false,
				error: "Only administrators can delete system lessons",
			};
		}

		// Check if the lesson exists
		const existing = await getLessonByTitle(title);
		if (!existing) {
			return { success: false, error: "Lesson not found" };
		}

		// Delete the lesson
		await db.delete(lessons).where(eq(lessons.title, title));

		return { success: true };
	} catch (error) {
		console.error("Error deleting lesson:", error);
		return { success: false, error: "Failed to delete lesson" };
	}
}
