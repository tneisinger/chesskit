"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getAllLessons, deleteLesson } from "./actions";
import type { Lesson } from "@/types/lesson";
import Button, { ButtonStyle, ButtonSize } from "@/components/button";

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
				<ul className="flex flex-col gap-2">
					{lessons.map((lesson) => (
						<li
							key={lesson.title}
							className="flex items-center justify-between gap-4 p-2 rounded hover:bg-background-page"
						>
							<Link
								href={`/openings/${encodeURIComponent(lesson.title)}`}
								className="text-foreground hover:text-color-btn-primary-hover flex-1"
							>
								{lesson.title}
							</Link>
							<div className="flex items-center gap-2">
								<Link
									href={`/openings/${encodeURIComponent(lesson.title)}/edit`}
									className="text-sm text-[#aaa] hover:text-color-btn-primary-hover px-2"
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
					))}
				</ul>
			)}
		</div>
	);
}
