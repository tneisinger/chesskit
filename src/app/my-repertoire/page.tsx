"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getUserRepertoire, deleteUserLesson } from "./actions";
import { MAX_USER_LESSONS } from "./constants";
import type { Lesson } from "@/types/lesson";
import { PieceColor } from "@/types/chess";
import LessonDisplay from "@/components/lessonDisplay";
import { sortLessonsByTitle } from "@/utils/lesson";
import { getAllLessons, createLesson, updateLesson } from "../openings/actions";

type ColorFilter = "all" | PieceColor;

export default function MyRepertoirePage() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const isAdmin = session?.user?.role === "admin";
	const [lessons, setLessons] = useState<Lesson[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [deletingLessonId, setDeletingLessonId] = useState<number | null>(null);
	const [colorFilter, setColorFilter] = useState<ColorFilter>("all");
  const [publishingLessonId, setPublishingLessonId] = useState<number | null>(null);

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
			router.push("/login?callbackUrl=/my-repertoire");
			return;
		}

		if (status === "authenticated") {
			window.scrollTo(0, 0);

			const loadLessons = async () => {
				const fetchedLessons = await getUserRepertoire();
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

  sortLessonsByTitle(filteredLessons);

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

  const handlePublishOpeningBtnClick = async (lesson: Lesson) => {
    // If the user is not an admin, show an alert and return
    if (!isAdmin) {
      alert("You must be signed in as an admin to publish an opening.")
      return;
    }

    setPublishingLessonId(lesson.id!);

    try {
      // Check if a lesson with this title already exists in Openings
      const openings = await getAllLessons()
      const existingOpening = openings.find(o => o.title === lesson.title)

      let confirmed = true;
      if (existingOpening) {
        confirmed = confirm(`An opening with the title "${lesson.title}" already exists in Openings. Do you want to replace it with this one?`)
      }
      if (!confirmed) return;

      // Create a copy of the lesson (without the id)
      const lessonCopy: Lesson = {
        title: lesson.title,
        userColor: lesson.userColor,
        chapters: lesson.chapters,
        displayLine: lesson.displayLine,
      }

      let result;
      if (existingOpening) {
        result = await updateLesson(lesson.title, lessonCopy);
      } else {
        result = await createLesson(lessonCopy);
      }

			if (result.success) {
				alert(`"${lesson.title}" has been added to Openings!`);
			} else {
				alert(`Failed to add lesson to Openings: ${result.error}`);
			}
		} catch (error) {
			console.error("Error adding lesson to Openings:", error);
			alert("An unexpected error occurred while adding the lesson to Openings");
		} finally {
			setPublishingLessonId(null);
		}
  }

	if (status === "loading" || isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-xl">Loading...</div>
			</div>
		);
	}

	const isAtLimit = lessons.length >= MAX_USER_LESSONS;

  // Create New Lesson Link
  const commonClasses = 'px-3 py-2 rounded bg-foreground/15 text-white font-bold';
  const atLimitClasses = 'opacity-50 pointer-events-none';
  const notAtLimitClasses = 'hover:bg-foreground/25 cursor-pointer';
  const classes = isAtLimit ? `${commonClasses} ${atLimitClasses}` : `${commonClasses} ${notAtLimitClasses}`;
  const createNewLessonLink = (
    <Link
      href="/my-repertoire/create?returnUrl=/my-repertoire"
      className={classes}
    >
      Create New Lesson
    </Link>
  );

	return (
		<div className="flex flex-col gap-4 p-4 pt-0">
			<div className="sticky top-10 z-30 py-4 flex flex-col gap-2 items-center justify-center bg-background mask-b-from-92% mask-b-to-100% pb-6">
				<h1 className="text-3xl font-bold">My Repertoire</h1>

				{/* Filter Controls */}
				<div className="flex items-center gap-3 my-1">
					<span className="text-sm text-foreground/70">Filter by color:</span>
					<div className="flex gap-2">
						<button
							onClick={() => handleFilterChange("all")}
							className={`px-3 py-1.5 rounded transition-colors cursor-pointer text-sm font-medium ${
								colorFilter === "all"
									? "bg-btn-normal text-foreground"
									: "bg-background-page text-foreground/70 hover:bg-foreground/20"
							}`}
						>
							All
						</button>
						<button
							onClick={() => handleFilterChange(PieceColor.WHITE)}
							className={`px-3 py-1.5 rounded transition-colors cursor-pointer text-sm font-medium ${
								colorFilter === PieceColor.WHITE
									? "bg-btn-normal text-foreground"
									: "bg-background-page text-foreground/70 hover:bg-foreground/20"
							}`}
						>
							White
						</button>
						<button
							onClick={() => handleFilterChange(PieceColor.BLACK)}
							className={`px-3 py-1.5 rounded transition-colors cursor-pointer text-sm font-medium ${
								colorFilter === PieceColor.BLACK
									? "bg-btn-normal text-foreground"
									: "bg-background-page text-foreground/70 hover:bg-foreground/20"
							}`}
						>
							Black
						</button>
					</div>
				</div>

        <div className="text-center mt-2">
          {createNewLessonLink}
          {isAtLimit && (
            <p className="text-xs text-foreground/50 mt-3 max-w-sm">
              Lesson limit reached. You can't have more than {MAX_USER_LESSONS} lessons.
            </p>
          )}
        </div>
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
              showPublishOpeningBtn={isAdmin}
              handlePublishOpeningBtnClick={(lesson) => handlePublishOpeningBtnClick(lesson)}
							handleDelete={(title) => handleDelete(lesson.id!, title)}
							isDeletingLesson={deletingLessonId === lesson.id}
							isModifiable={true}
							viewUrl={`/my-repertoire/${lesson.id}`}
							editUrl={`/my-repertoire/${lesson.id}/edit`}
							key={lesson.id}
						/>
					))}
				</ul>
			)}
		</div>
	);
}
