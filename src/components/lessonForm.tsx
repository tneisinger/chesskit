"use client";

import { useState } from "react";
import Button, { ButtonStyle } from "@/components/button";
import { PieceColor } from "@/types/chess";
import type { Chapter, Lesson } from "@/types/lesson";

interface LessonFormProps {
	initialLesson?: Lesson;
	onSubmit: (lesson: Lesson) => Promise<{ success: boolean; error?: string }>;
	onCancel: () => void;
	submitButtonText?: string;
	isEdit?: boolean;
}

export default function LessonForm({
	initialLesson,
	onSubmit,
	onCancel,
	submitButtonText = "Create Lesson",
	isEdit = false,
}: LessonFormProps) {
	const [title, setTitle] = useState(initialLesson?.title || "");
	const [userColor, setUserColor] = useState<PieceColor>(
		initialLesson?.userColor || PieceColor.WHITE
	);
	const [chapters, setChapters] = useState<Chapter[]>(
		initialLesson?.chapters || [{ title: "", pgn: "" }]
	);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const addChapter = () => {
		setChapters([...chapters, { title: "", pgn: "" }]);
	};

	const removeChapter = (index: number) => {
		if (chapters.length > 1) {
			setChapters(chapters.filter((_, i) => i !== index));
		}
	};

	const updateChapter = (
		index: number,
		field: keyof Chapter,
		value: string
	) => {
		const newChapters = [...chapters];
		newChapters[index] = { ...newChapters[index], [field]: value };
		setChapters(newChapters);
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
			if (!chapters[i].pgn.trim()) {
				setError(`Chapter ${i + 1} PGN data is required`);
				return false;
			}
		}

		setError(null);
		return true;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		setIsSubmitting(true);
		setError(null);

		try {
			const result = await onSubmit({
				title: title.trim(),
				userColor,
				chapters: chapters.map((ch) => ({
					title: ch.title.trim(),
					pgn: ch.pgn.trim(),
				})),
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
					onChange={(e) => setTitle(e.target.value)}
					className="p-3 rounded bg-background-page text-foreground border border-[#444]"
					placeholder="e.g. Italian Game"
					disabled={isEdit}
				/>
				{isEdit && (
					<p className="text-sm text-[#aaa]">
						Note: Lesson title cannot be changed when editing
					</p>
				)}
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

			{/* Chapters */}
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<h2 className="font-bold text-xl">Chapters</h2>
					<Button
						type="button"
						buttonStyle={ButtonStyle.Secondary}
						onClick={addChapter}
					>
						Add Chapter
					</Button>
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
									Remove
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
								className="p-2 rounded bg-background text-foreground border border-[#555] font-mono text-sm"
								rows={6}
								placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5..."
							/>
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

			{/* Submit and Cancel Buttons */}
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
					onClick={onCancel}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}
