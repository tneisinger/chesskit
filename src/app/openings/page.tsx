"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getAllLessons, deleteLesson } from "./actions";
import { getUserRepertoire, createUserLesson } from "@/app/my-repertoire/actions";
import type { Lesson } from "@/types/lesson";
import { PieceColor } from "@/types/chess";
import LessonDisplay from "@/components/lessonDisplay";

type ColorFilter = "all" | PieceColor;

export default function Page() {
	const { data: session } = useSession();
	const isAdmin = session?.user?.role === "admin";
	const [lessons, setLessons] = useState<Lesson[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [deletingLesson, setDeletingLesson] = useState<string | null>(null);
	const [addingToRepertoireLesson, setAddingToRepertoireLesson] = useState<string | null>(null);
	const [colorFilter, setColorFilter] = useState<ColorFilter>("all");

  const handleFilterChange = useCallback((newFilter: ColorFilter) => {
    if (colorFilter === newFilter) return; // No change
    setColorFilter(newFilter);
		window.scrollTo(0, 0);
  }, [colorFilter]);

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

	// Filter lessons based on selected color
	const filteredLessons = lessons.filter((lesson) => {
		if (colorFilter === "all") return true;
		return lesson.userColor === colorFilter;
	});

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

	const handleAddToRepertoireBtnClick = async (lesson: Lesson) => {
		// Check if user is signed in
		if (!session?.user) {
			alert("You must sign in before you can add a lesson to your repertoire.");
			return;
		}

		setAddingToRepertoireLesson(lesson.title);

		try {
			// Check if a lesson with this title already exists in user's repertoire
			const userRepertoire = await getUserRepertoire();
			const existingLesson = userRepertoire.find(
				(userLesson) => userLesson.title === lesson.title
			);

			if (existingLesson) {
				alert(`There is already a lesson in your repertoire with the title "${lesson.title}".`);
				return;
			}

			// Create a copy of the lesson (without the id)
			const lessonCopy: Omit<Lesson, "id"> = {
				title: lesson.title,
				userColor: lesson.userColor,
				chapters: lesson.chapters,
				displayLine: lesson.displayLine,
			};

			const result = await createUserLesson(lessonCopy);

			if (result.success) {
				alert(`"${lesson.title}" has been added to your repertoire!`);
			} else {
				alert(`Failed to add lesson to repertoire: ${result.error}`);
			}
		} catch (error) {
			console.error("Error adding lesson to repertoire:", error);
			alert("An unexpected error occurred while adding the lesson to your repertoire");
		} finally {
			setAddingToRepertoireLesson(null);
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
			<div className="sticky top-10 z-30 pt-4 pb-4 flex flex-col items-center justify-center bg-background mask-b-from-85% mask-b-to-100%">
				<h1 className="text-3xl font-bold">Openings</h1>

				{/* Info banner for regular users */}
				{session && !isAdmin && (
					<div className="mt-4 p-3 bg-color-btn-primary/20 border border-color-btn-primary rounded text-sm max-w-md text-center">
						These are system openings. To create your own openings, visit{" "}
						<Link
							href="/my-repertoire"
							className="text-color-btn-primary hover:text-color-btn-primary-hover font-medium underline"
						>
							My Repertoire
						</Link>
					</div>
				)}

				{/* Filter Controls */}
				<div className="flex items-center gap-3 mt-5 mb-2">
					<span className="text-sm text-foreground/70">Filter by color:</span>
					<div className="flex gap-2">
						<button
							onClick={() => handleFilterChange("all")}
							className={`px-3 py-1.5 rounded transition-colors cursor-pointer text-sm font-medium ${
								colorFilter === "all"
									? "bg-btn-primary text-foreground"
									: "bg-background-page text-foreground/70 hover:bg-foreground/10"
							}`}
						>
							All
						</button>
						<button
							onClick={() => handleFilterChange(PieceColor.WHITE)}
							className={`px-3 py-1.5 rounded transition-colors cursor-pointer text-sm font-medium ${
								colorFilter === PieceColor.WHITE
									? "bg-btn-primary text-foreground"
									: "bg-background-page text-foreground/70 hover:bg-foreground/10"
							}`}
						>
							White
						</button>
						<button
							onClick={() => handleFilterChange(PieceColor.BLACK)}
							className={`px-3 py-1.5 rounded transition-colors cursor-pointer text-sm font-medium ${
								colorFilter === PieceColor.BLACK
									? "bg-btn-primary text-foreground"
									: "bg-background-page text-foreground/70 hover:bg-foreground/10"
							}`}
						>
							Black
						</button>
					</div>
				</div>

				{/* Create button only for admins */}
				{isAdmin && (
					<Link
						href="/openings/create?returnUrl=/openings"
						className="p-3 rounded bg-color-btn-primary hover:bg-color-btn-primary-hover text-white font-bold no-underline"
					>
						Create New Opening
					</Link>
				)}
			</div>
			{lessons.length === 0 ? (
				<p className="text-[#aaa]">
					No lessons found. Create your first lesson to get started!
				</p>
			) : filteredLessons.length === 0 ? (
				<p className="text-[#aaa] text-center">
					No openings found with the selected filter.
				</p>
			) : (
				<ul className="flex flex-wrap justify-center gap-12">
					{filteredLessons.map((lesson) => (
            <LessonDisplay
              lesson={lesson}
              boardSize={325}
              showAddToRepertoireBtn={true}
              handleAddToRepertoireBtnClick={handleAddToRepertoireBtnClick}
              handleDelete={handleDelete}
              isDeletingLesson={deletingLesson === lesson.title}
              isModifiable={isAdmin}
              viewUrl={`/openings/${encodeURIComponent(lesson.title)}`}
              editUrl={`/openings/${encodeURIComponent(lesson.title)}/edit`}
              key={lesson.title}
            />
          ))}
				</ul>
			)}
		</div>
	);
}
