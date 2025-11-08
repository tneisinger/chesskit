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
