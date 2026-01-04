import type { Lesson, LineStats } from "@/types/lesson";
import { useChapterCompletionRatios } from "@/hooks/useChapterCompletionRatios";

interface Props {
	lesson: Lesson;
	currentChapterIdx: number;
	lines: Record<string, LineStats>[];
	changeChapter: (idx: number) => void;
	heightStyle: string;
  widthStyle: string;
  useMobileLayout: boolean;
}

const LessonChapters = ({
	lesson,
	currentChapterIdx,
	lines,
	changeChapter,
	heightStyle,
  widthStyle,
}: Props) => {
	const chapterCompletionRatios = useChapterCompletionRatios(lesson, lines);

	return (
		<div
			className="flex flex-col"
			style={{ height: heightStyle, width: widthStyle }}
		>
			<div className="flex-1 overflow-y-auto overflow-x-hidden">
				{lesson.chapters.map((chapter, idx) => {
					const isActive = currentChapterIdx === idx;
					const { completedCount, totalCount } =
						chapterCompletionRatios[idx];

					return (
						<div key={idx} className='my-2 max-w-[calc(100vw-30px)]'>
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
