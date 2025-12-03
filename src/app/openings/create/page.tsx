"use client";

import { useRouter } from "next/navigation";
import LessonForm from "@/components/lessonForm";
import { createLesson } from "../actions";
import type { Lesson } from "@/types/lesson";

export default function CreateLessonPage() {
	const router = useRouter();

	const handleSubmit = async (lesson: Lesson) => {
		const result = await createLesson(lesson);
		if (result.success) {
			router.push("/openings");
		}
		return result;
	};

	const handleCancel = () => {
		router.push("/openings");
	};

	return (
		<div className="flex flex-col items-center min-h-screen p-4 sm:p-8">
			<div className="w-full max-w-3xl">
				<h1 className="text-2xl font-bold mb-6">Create New Lesson</h1>
				<LessonForm
					onSubmit={handleSubmit}
					onCancel={handleCancel}
					submitButtonText="Create Lesson"
				/>
			</div>
		</div>
	);
}
