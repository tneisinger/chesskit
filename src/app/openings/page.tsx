import React from "react";
import Link from "next/link";
import { getAllLessons } from "./actions";

export default async function Page() {
	const lessons = await getAllLessons();

	return (
		<>
			<h1>Openings</h1>
			<ul>
				{lessons.map((lesson) => (
					<li key={lesson.title}>
						<Link href={`/openings/${encodeURIComponent(lesson.title)}`}>
							{lesson.title}
						</Link>
					</li>
				))}
			</ul>
		</>
	);
}
