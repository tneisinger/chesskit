"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button, { ButtonStyle } from "@/components/button";
import { PieceColor } from "@/types/chess";
import type { Chapter, Lesson } from "@/types/lesson";
import { parsePGN, cleanPGN, makeMovesOnlyPGN } from "@/utils/chess";
import { makePgnParserErrorMsg } from "@/utils/pgn";
import {
  MAX_CHAPTERS,
  MAX_LESSON_TITLE_LENGTH,
  MAX_CHAPTER_TITLE_LENGTH,
} from "@/types/lesson";

interface LessonFormProps {
	initialLesson?: Lesson;
	onSubmit: (lesson: Lesson) => Promise<{ success: boolean; error?: string }>;
	submitButtonText?: string;
	isEdit?: boolean;
}

export default function LessonForm({
	initialLesson,
	onSubmit,
	submitButtonText = "Create Lesson",
}: LessonFormProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [title, setTitle] = useState(initialLesson?.title || "");
	const [userColor, setUserColor] = useState<PieceColor>(
		initialLesson?.userColor || PieceColor.WHITE
	);
	const [chapters, setChapters] = useState<Chapter[]>(
		initialLesson?.chapters || [{ title: "Chapter 1", pgn: "" }]
	);
	const [displayLine, setDisplayLine] = useState<string>(() => {
		// Convert displayLine array to PGN format with move numbers
		if (initialLesson?.displayLine && initialLesson.displayLine.length > 0) {
			const moves = initialLesson.displayLine;
			let pgnString = "";
			for (let i = 0; i < moves.length; i++) {
				if (i % 2 === 0) {
					// White's move - add move number
					pgnString += `${Math.floor(i / 2) + 1}. ${moves[i]} `;
				} else {
					// Black's move
					pgnString += `${moves[i]} `;
				}
			}
			return pgnString.trim();
		}
		return "";
	});
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Track validation errors for each chapter's PGN
	const [chapterPgnErrors, setChapterPgnErrors] = useState<(string | null)[]>(
		new Array(chapters.length).fill(null)
	);

	// Track validation error for displayLine
	const [displayLineError, setDisplayLineError] = useState<string | null>(null);

	/**
	 * Validates PGN string and returns error message if invalid
	 */
	const validatePgn = (pgnString: string): string | null => {
		if (!pgnString.trim()) {
			return null; // Empty PGN is handled by form validation
		}
		try {
			const parsed = parsePGN(pgnString, { allowIncomplete: true });
			if (!parsed || parsed.length === 0) {
				return "Invalid PGN format";
			}
			return null;
		} catch (error: any) {
			return makePgnParserErrorMsg(error);
		}
	};

	const addChapter = () => {
    if (chapters.length >= MAX_CHAPTERS) return;
		setChapters([...chapters, { title: `Chapter ${chapters.length + 1}`, pgn: "" }]);
		setChapterPgnErrors([...chapterPgnErrors, null]);
	};

	const removeChapter = (index: number) => {
		if (chapters.length > 1) {
			setChapters(chapters.filter((_, i) => i !== index));
			setChapterPgnErrors(chapterPgnErrors.filter((_, i) => i !== index));
		}
	};

	const updateChapter = (
		index: number,
		field: keyof Chapter,
		value: string
	) => {
    // Don't allow title to exceed max length
    if (field === "title" && value.length > MAX_CHAPTER_TITLE_LENGTH) {
      return;
    }

		const newChapters = [...chapters];
		newChapters[index] = { ...newChapters[index], [field]: value };
		setChapters(newChapters);

		// Validate PGN when it changes
		if (field === "pgn") {
			const error = validatePgn(value);
			const newErrors = [...chapterPgnErrors];
			newErrors[index] = error;
			setChapterPgnErrors(newErrors);
		}
	};

	/**
	 * Handles lesson title change with validation
	 */
  const handleTitleChange = (value: string) => {
    if (value.length > MAX_LESSON_TITLE_LENGTH) {
      if (value.length < title.length) setTitle(value);
      return;
    } else {
      setTitle(value);
    }
  }

	/**
	 * Handles displayLine input change with validation
	 */
	const handleDisplayLineChange = (value: string) => {
		setDisplayLine(value);

		// Validate as PGN
		const error = validatePgn(value);
		setDisplayLineError(error);
	};

	const validateForm = (): boolean => {
		if (!title.trim()) {
			setError("Lesson title is required");
			return false;
		}

		if (chapters.length === 0) {
			setError("At least one chapter is required");
			return false;
		}

		for (let i = 0; i < chapters.length; i++) {
			if (!chapters[i].title.trim()) {
				setError(`Chapter ${i + 1} title is required`);
				return false;
			}
			// Check for PGN validation errors (only if PGN is not empty)
			if (chapters[i].pgn.trim() && chapterPgnErrors[i]) {
				setError(`Chapter ${i + 1} has invalid PGN: ${chapterPgnErrors[i]}`);
				return false;
			}
		}

		// Check displayLine validation error
		if (displayLineError) {
			setError(`Display line has invalid PGN: ${displayLineError}`);
			return false;
		}

		setError(null);
		return true;
	};

	const handleCancel = () => {
		const returnUrl = searchParams.get('returnUrl');
		if (returnUrl) {
			router.push(returnUrl);
		} else {
			router.push('/');
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		setIsSubmitting(true);
		setError(null);

		try {
			// Parse displayLine from PGN format to array of moves
			let displayLineArray: string[] | undefined = undefined;
			if (displayLine.trim()) {
				try {
					const parsed = parsePGN(displayLine.trim(), { allowIncomplete: true });
					if (parsed && parsed.length > 0 && parsed[0].moves) {
						// Extract just the move notation (e.g., "e4", "Nf3") from parsed PGN
						displayLineArray = parsed[0].moves.map((m) => m.move);
					}
				} catch (error) {
					// If parsing fails, the validation should have caught it
					console.error("Failed to parse displayLine:", error);
				}
			}

      const lessonChapters: Chapter[] = [];
      chapters.forEach((ch) => {
        // If PGN is empty, just use an empty string
        let pgn = "";
        if (ch.pgn.trim()) {
          const cleanedPgn = cleanPGN(ch.pgn);
          if (cleanedPgn == undefined) throw new Error(`Failed to clean PGN ${ch.pgn}`);
          pgn = makeMovesOnlyPGN(cleanedPgn);
        }
        lessonChapters.push({
          title: ch.title.trim(),
          pgn,
        })
      });

			const result = await onSubmit({
				title: title.trim(),
				userColor,
				chapters: lessonChapters,
				displayLine: displayLineArray,
			});

			if (!result.success) {
				setError(result.error || "Failed to save lesson");
			}
		} catch (err) {
			setError("An unexpected error occurred");
			console.error(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-6">
			{/* Lesson Title */}
			<div className="flex flex-col gap-2">
				<label htmlFor="title" className="font-bold">
					Lesson Title
				</label>
				<input
					id="title"
					type="text"
					value={title}
					onChange={(e) => handleTitleChange(e.target.value)}
					className="p-3 rounded bg-background-page text-foreground border border-[#444]"
					placeholder="e.g. Italian Game"
				/>
			</div>

			{/* User Color */}
			<div className="flex flex-col gap-2">
				<label className="font-bold">User Color</label>
				<div className="flex gap-4">
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="userColor"
							value={PieceColor.WHITE}
							checked={userColor === PieceColor.WHITE}
							onChange={(e) => setUserColor(e.target.value as PieceColor)}
							className="cursor-pointer"
						/>
						<span>White</span>
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="userColor"
							value={PieceColor.BLACK}
							checked={userColor === PieceColor.BLACK}
							onChange={(e) => setUserColor(e.target.value as PieceColor)}
							className="cursor-pointer"
						/>
						<span>Black</span>
					</label>
				</div>
			</div>

			{/* Display Line */}
			<div className="flex flex-col gap-2">
				<label htmlFor="displayLine" className="font-bold">
					Display Line (Optional)
				</label>
				<input
					id="displayLine"
					type="text"
					value={displayLine}
					onChange={(e) => handleDisplayLineChange(e.target.value)}
					className={`p-3 rounded bg-background-page text-foreground border ${
						displayLineError ? "border-color-btn-danger" : "border-[#444]"
					}`}
					placeholder="e.g. 1. e4 e5 2. Nf3"
				/>
				{displayLineError && (
					<p className="text-sm text-color-btn-danger">{displayLineError}</p>
				)}
				<p className="text-sm text-[#aaa]">
					Enter moves in PGN format (e.g., "1. e4 e5 2. Nf3"). This line will be used for the preview board on the lessons page.
				</p>
			</div>

			{/* Chapters */}
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<h2 className="font-bold text-xl">Chapters</h2>
				</div>

				{chapters.map((chapter, index) => (
					<div
						key={index}
						className="flex flex-col gap-3 p-4 rounded bg-background-page border border-[#444]"
					>
						<div className="flex items-center justify-between">
							<h3 className="font-bold">Chapter {index + 1}</h3>
							{chapters.length > 1 && (
								<Button
									type="button"
									buttonStyle={ButtonStyle.Danger}
									onClick={() => removeChapter(index)}
								>
									Delete Chapter
								</Button>
							)}
						</div>

						<div className="flex flex-col gap-2">
							<label htmlFor={`chapter-title-${index}`} className="text-sm">
								Chapter Title
							</label>
							<input
								id={`chapter-title-${index}`}
								type="text"
								value={chapter.title}
								onChange={(e) =>
									updateChapter(index, "title", e.target.value)
								}
								className="p-2 rounded bg-background text-foreground border border-[#555]"
								placeholder="e.g. Main Variation"
							/>
						</div>

						<div className="flex flex-col gap-2">
							<label htmlFor={`chapter-pgn-${index}`} className="text-sm">
								PGN Data
							</label>
							<textarea
								id={`chapter-pgn-${index}`}
								value={chapter.pgn}
								onChange={(e) => updateChapter(index, "pgn", e.target.value)}
								className={`p-2 rounded bg-background text-foreground border font-mono text-sm ${
									chapterPgnErrors[index] ? "border-color-btn-danger" : "border-[#555]"
								}`}
								rows={6}
								placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5..."
							/>
							{chapterPgnErrors[index] && (
								<p className="text-sm text-color-btn-danger">{chapterPgnErrors[index]}</p>
							)}
						</div>
					</div>
				))}
			</div>

			{/* Error Message */}
			{error && (
				<div className="p-3 rounded bg-[rgba(173,31,31,0.2)] border border-color-btn-danger text-foreground">
					{error}
				</div>
			)}

			{/* Submit, Cancel, and Add Chapter Buttons */}
      <div className="flex justify-between">
        <div className="flex gap-4">
          <Button
            type="submit"
            buttonStyle={ButtonStyle.Primary}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : submitButtonText}
          </Button>
          <Button
            type="button"
            buttonStyle={ButtonStyle.Secondary}
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={addChapter}
            disabled={chapters.length >= MAX_CHAPTERS}
          >
            Add Chapter
          </Button>
        </div>
			</div>
		</form>
	);
}
