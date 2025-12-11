"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllLessons, deleteLesson } from "./actions";
import type { Lesson } from "@/types/lesson";
import LessonDisplay from "@/components/lessonDisplay";
import { getLinesFromPGN } from "@/utils/pgn";

/**
 * Gets the display line for a lesson.
 * If displayLine is set, uses that. Otherwise, gets the first 3 moves from the first chapter.
 */
function getDisplayLine(lesson: Lesson): string[] {
	// Use displayLine if it exists
	if (lesson.displayLine && lesson.displayLine.length > 0) {
		return lesson.displayLine;
	}

	// Fallback to first 3 moves from first chapter
	if (lesson.chapters.length === 0) return [];

	const firstChapter = lesson.chapters[0];
	const lines = getLinesFromPGN(firstChapter.pgn);

	if (lines.length === 0) return [];

	// Get the first line and split it into moves
	const moves = lines[0].split(/\s+/);

	// Return first 3 moves
	return moves.slice(0, 3);
}

export default function Page() {
	const [lessons, setLessons] = useState<Lesson[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [deletingLesson, setDeletingLesson] = useState<string | null>(null);

	useEffect(() => {
		// Scroll to top on page load
		window.scrollTo(0, 0);

		const loadLessons = async () => {
			const fetchedLessons = await getAllLessons();
			setLessons(fetchedLessons);
			setIsLoading(false);
		};

		loadLessons();
	}, []);

	const handleDelete = async (title: string) => {
		// Show confirmation dialog
		const confirmed = window.confirm(
			`Are you sure you want to delete the lesson "${title}"?\n\nThis action cannot be undone.`
		);

		if (!confirmed) {
			return;
		}

		setDeletingLesson(title);

		try {
			const result = await deleteLesson(title);

			if (result.success) {
				// Remove the lesson from the list
				setLessons(lessons.filter((lesson) => lesson.title !== title));
			} else {
				alert(`Failed to delete lesson: ${result.error}`);
			}
		} catch (error) {
			console.error("Error deleting lesson:", error);
			alert("An unexpected error occurred while deleting the lesson");
		} finally {
			setDeletingLesson(null);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-xl">Loading...</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 p-4 pt-0">
			<div className="sticky top-10 z-30 pt-4 pb-3 flex flex-col items-center justify-center bg-background mask-b-from-75% mask-b-to-100%">
				<h1 className="text-3xl font-bold">Openings</h1>
				<Link
					href="/openings/create"
					className="p-3 rounded bg-color-btn-primary hover:bg-color-btn-primary-hover text-white font-bold no-underline"
				>
					Create New Opening
				</Link>
			</div>
			{lessons.length === 0 ? (
				<p className="text-[#aaa]">
					No lessons found. Create your first lesson to get started!
				</p>
			) : (
				<ul className="flex flex-wrap justify-center gap-12">
					{lessons.map((lesson) => (
            <LessonDisplay
              lesson={lesson}
              boardSize={325}
              handleDelete={handleDelete}
              isDeletingLesson={deletingLesson === lesson.title}
              isModifiable={true}
              key={lesson.title}
            />
          ))}
				</ul>
			)}
		</div>
	);
}
