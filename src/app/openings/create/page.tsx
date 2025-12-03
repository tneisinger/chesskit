"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button, { ButtonStyle } from "@/components/button";
import { createLesson } from "../actions";
import { PieceColor } from "@/types/chess";
import type { Chapter } from "@/types/lesson";

export default function CreateLessonPage() {
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [userColor, setUserColor] = useState<PieceColor>(PieceColor.WHITE);
	const [chapters, setChapters] = useState<Chapter[]>([
		{ title: "", pgn: "" },
	]);
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
			const result = await createLesson({
				title: title.trim(),
				userColor,
				chapters: chapters.map((ch) => ({
					title: ch.title.trim(),
					pgn: ch.pgn.trim(),
				})),
			});

			if (result.success) {
				router.push("/openings");
			} else {
				setError(result.error || "Failed to create lesson");
			}
		} catch (err) {
			setError("An unexpected error occurred");
			console.error(err);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="flex flex-col items-center min-h-screen p-4 sm:p-8">
			<div className="w-full max-w-3xl">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-2xl font-bold">Create New Lesson</h1>
					<Button
						type="button"
						buttonStyle={ButtonStyle.Secondary}
						onClick={() => router.push("/openings")}
					>
						Cancel
					</Button>
				</div>

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
									onChange={(e) =>
										setUserColor(e.target.value as PieceColor)
									}
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
									onChange={(e) =>
										setUserColor(e.target.value as PieceColor)
									}
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
										onChange={(e) =>
											updateChapter(index, "pgn", e.target.value)
										}
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

					{/* Submit Button */}
					<div className="flex gap-4">
						<Button
							type="submit"
							buttonStyle={ButtonStyle.Primary}
							disabled={isSubmitting}
						>
							{isSubmitting ? "Creating..." : "Create Lesson"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
