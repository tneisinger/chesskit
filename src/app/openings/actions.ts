"use server";

import { db } from "@/db";
import { lessons } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Lesson } from "@/types/lesson";
import { PieceColor } from "@/types/chess";

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
	};
}

export async function getAllLessons() {
	const result = await db.select().from(lessons);

	return result.map((dbLesson) => ({
		title: dbLesson.title,
		userColor: dbLesson.userColor as PieceColor,
		chapters: dbLesson.chapters,
	}));
}

export async function createLesson(lesson: Lesson): Promise<{ success: boolean; error?: string }> {
	try {
		// Check if a lesson with this title already exists
		const existing = await getLessonByTitle(lesson.title);
		if (existing) {
			return { success: false, error: "A lesson with this title already exists" };
		}

		// Insert the new lesson
		await db.insert(lessons).values({
			title: lesson.title,
			userColor: lesson.userColor,
			chapters: lesson.chapters,
		});

		return { success: true };
	} catch (error) {
		console.error("Error creating lesson:", error);
		return { success: false, error: "Failed to create lesson" };
	}
}
