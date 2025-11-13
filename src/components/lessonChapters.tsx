import React, { useMemo } from "react";
import type { Lesson, LineStats } from "@/types/lesson";
import { getLinesFromPGN } from "@/utils/pgn";
import { convertSanLineToLanLine } from "@/utils/chess";

interface Props {
	lesson: Lesson;
	currentChapterIdx: number;
	lines: Record<string, LineStats>;
	changeChapter: (idx: number) => void;
	height: number;
  width: number;
}

const LessonChapters = ({
	lesson,
	currentChapterIdx,
	lines,
	changeChapter,
	height,
  width,
}: Props) => {
	// Calculate completion ratio for each chapter
	const chapterCompletionRatios = useMemo(() => {
		return lesson.chapters.map((chapter) => {
			const sanLines = getLinesFromPGN(chapter.pgn);
			const lanLines = sanLines.map((l) =>
				convertSanLineToLanLine(l.split(/\s+/)),
			);

			let completedCount = 0;
			let totalCount = 0;

			lanLines.forEach((line) => {
				const lineKey = line.join(" ");
				totalCount++;
				if (lines[lineKey]?.isComplete) {
					completedCount++;
				}
			});

			return { completedCount, totalCount };
		});
	}, [lesson.chapters, lines]);

	return (
		<div
			className="mr-2 w-[275px] flex flex-col bg-background-page"
			style={{ height, width }}
		>
			<div className="flex-1 overflow-y-auto">
				{lesson.chapters.map((chapter, idx) => {
					const isActive = currentChapterIdx === idx;
					const { completedCount, totalCount } =
						chapterCompletionRatios[idx];

					return (
						<div key={idx} className="m-2">
							<button
								className={`
                  w-full text-left p-2 rounded transition-colors
                  ${
										isActive
											? "bg-btn-primary text-foreground font-bold"
											: "hover:bg-foreground/10"
									}
                `}
								onClick={() => changeChapter(idx)}
							>
								<div className="flex justify-between items-center">
									<span>
										{idx + 1}. {chapter.title}
									</span>
									<span
										className={`text-sm ${isActive ? "font-normal" : "text-foreground/60"}`}
									>
										{completedCount}/{totalCount}
									</span>
								</div>
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default LessonChapters;
