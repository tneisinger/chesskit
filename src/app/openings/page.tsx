"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getAllLessons, deleteLesson } from "./actions";
import type { Lesson } from "@/types/lesson";
import Button, { ButtonStyle, ButtonSize } from "@/components/button";
import PositionPreview from "@/components/PositionPreview";
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
		<div className="flex flex-col gap-4 p-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Openings</h1>
				<Link
					href="/openings/create"
					className="p-3 rounded bg-color-btn-primary hover:bg-color-btn-primary-hover text-white font-bold no-underline"
				>
					Create New Lesson
				</Link>
			</div>
			{lessons.length === 0 ? (
				<p className="text-[#aaa]">
					No lessons found. Create your first lesson to get started!
				</p>
			) : (
				<ul className="flex flex-col gap-4">
					{lessons.map((lesson) => {
						const displayLine = getDisplayLine(lesson);
						return (
							<li
								key={lesson.title}
								className="flex items-center gap-4 p-4 rounded hover:bg-background-page border border-foreground/10"
							>
								{/* Board Preview */}
								<Link
									href={`/openings/${encodeURIComponent(lesson.title)}`}
									className="flex-shrink-0"
								>
									<PositionPreview line={displayLine} orientation={lesson.userColor} size={240} />
								</Link>

								{/* Lesson Info */}
								<div className="flex flex-col flex-1 gap-2">
									<Link
										href={`/openings/${encodeURIComponent(lesson.title)}`}
										className="text-xl font-semibold text-foreground hover:text-color-btn-primary-hover no-underline"
									>
										{lesson.title}
									</Link>
									<div className="text-sm text-foreground/60">
										{lesson.chapters.length} {lesson.chapters.length === 1 ? 'chapter' : 'chapters'}
									</div>
								</div>

								{/* Action Buttons */}
								<div className="flex items-center gap-2 flex-shrink-0">
									<Link
										href={`/openings/${encodeURIComponent(lesson.title)}/edit`}
										className="text-sm text-[#aaa] hover:text-color-btn-primary-hover px-3 py-2 rounded hover:bg-foreground/10 no-underline"
									>
										Edit
									</Link>
									<Button
										buttonStyle={ButtonStyle.Danger}
										buttonSize={ButtonSize.Small}
										onClick={() => handleDelete(lesson.title)}
										disabled={deletingLesson === lesson.title}
									>
										{deletingLesson === lesson.title ? "Deleting..." : "Delete"}
									</Button>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
