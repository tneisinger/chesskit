"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getUserLessons, deleteUserLesson } from "./actions";
import type { Lesson } from "@/types/lesson";
import { PieceColor } from "@/types/chess";
import LessonDisplay from "@/components/lessonDisplay";

type ColorFilter = "all" | PieceColor;

export default function MyOpeningsPage() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [lessons, setLessons] = useState<Lesson[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [deletingLessonId, setDeletingLessonId] = useState<number | null>(null);
	const [colorFilter, setColorFilter] = useState<ColorFilter>("all");

	const handleFilterChange = useCallback(
		(newFilter: ColorFilter) => {
			if (colorFilter === newFilter) return;
			setColorFilter(newFilter);
			window.scrollTo(0, 0);
		},
		[colorFilter],
	);

	useEffect(() => {
		// Redirect to login if not authenticated
		if (status === "unauthenticated") {
			router.push("/login?callbackUrl=/my-openings");
			return;
		}

		if (status === "authenticated") {
			window.scrollTo(0, 0);

			const loadLessons = async () => {
				const fetchedLessons = await getUserLessons();
				setLessons(fetchedLessons);
				setIsLoading(false);
			};

			loadLessons();
		}
	}, [status, router]);

	// Filter lessons based on selected color
	const filteredLessons = lessons.filter((lesson) => {
		if (colorFilter === "all") return true;
		return lesson.userColor === colorFilter;
	});

	const handleDelete = async (lessonId: number, title: string) => {
		const confirmed = window.confirm(
			`Are you sure you want to delete the lesson "${title}"?\n\nThis action cannot be undone.`,
		);

		if (!confirmed) {
			return;
		}

		setDeletingLessonId(lessonId);

		try {
			const result = await deleteUserLesson(lessonId);

			if (result.success) {
				setLessons(lessons.filter((lesson) => lesson.id !== lessonId));
			} else {
				alert(`Failed to delete lesson: ${result.error}`);
			}
		} catch (error) {
			console.error("Error deleting lesson:", error);
			alert("An unexpected error occurred while deleting the lesson");
		} finally {
			setDeletingLessonId(null);
		}
	};

	if (status === "loading" || isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-xl">Loading...</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 p-4 pt-0">
			<div className="sticky top-10 z-30 pt-4 pb-4 flex flex-col items-center justify-center bg-background mask-b-from-85% mask-b-to-100%">
				<h1 className="text-3xl font-bold">My Openings</h1>

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

				<Link
					href="/my-openings/create"
					className="p-3 rounded bg-color-btn-primary hover:bg-color-btn-primary-hover text-white font-bold no-underline"
				>
					Create New Opening
				</Link>
			</div>
			{lessons.length === 0 ? (
				<p className="text-[#aaa] text-center">
					No openings found. Create your first opening to get started!
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
							handleDelete={(title) => handleDelete(lesson.id!, title)}
							isDeletingLesson={deletingLessonId === lesson.id}
							isModifiable={true}
							viewUrl={`/my-openings/${lesson.id}`}
							editUrl={`/my-openings/${lesson.id}/edit`}
							key={lesson.id}
						/>
					))}
				</ul>
			)}
		</div>
	);
}
