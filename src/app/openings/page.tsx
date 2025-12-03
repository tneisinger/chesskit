import React from "react";
import Link from "next/link";
import { getAllLessons } from "./actions";

export default async function Page() {
	const lessons = await getAllLessons();

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
			<ul className="flex flex-col gap-2">
				{lessons.map((lesson) => (
					<li key={lesson.title} className="flex items-center justify-between gap-4 p-2 rounded hover:bg-background-page">
						<Link
							href={`/openings/${encodeURIComponent(lesson.title)}`}
							className="text-foreground hover:text-color-btn-primary-hover flex-1"
						>
							{lesson.title}
						</Link>
						<Link
							href={`/openings/${encodeURIComponent(lesson.title)}/edit`}
							className="text-sm text-[#aaa] hover:text-color-btn-primary-hover"
						>
							Edit
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
