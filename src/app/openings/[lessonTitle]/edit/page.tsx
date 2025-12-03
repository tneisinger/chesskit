"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import LessonForm from "@/components/lessonForm";
import { getLessonByTitle, updateLesson } from "../../actions";
import type { Lesson } from "@/types/lesson";

interface PageProps {
	params: Promise<{
		lessonTitle: string;
	}>;
}

export default function EditLessonPage({ params }: PageProps) {
	const router = useRouter();
	const [lesson, setLesson] = useState<Lesson | null>(null);
	const [lessonTitle, setLessonTitle] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const loadLesson = async () => {
			const resolvedParams = await params;
			const decodedTitle = decodeURIComponent(resolvedParams.lessonTitle);
			setLessonTitle(decodedTitle);

			const fetchedLesson = await getLessonByTitle(decodedTitle);
			if (!fetchedLesson) {
				notFound();
			}
			setLesson(fetchedLesson);
			setIsLoading(false);
		};

		loadLesson();
	}, [params]);

	const handleSubmit = async (updatedLesson: Lesson) => {
		const result = await updateLesson(lessonTitle, updatedLesson);
		if (result.success) {
			router.push(`/openings/${encodeURIComponent(lessonTitle)}`);
		}
		return result;
	};

	const handleCancel = () => {
		router.push(`/openings/${encodeURIComponent(lessonTitle)}`);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-xl">Loading...</div>
			</div>
		);
	}

	if (!lesson) {
		return null;
	}

	return (
		<div className="flex flex-col items-center min-h-screen p-4 sm:p-8">
			<div className="w-full max-w-3xl">
				<h1 className="text-2xl font-bold mb-6">Edit Lesson</h1>
				<LessonForm
					initialLesson={lesson}
					onSubmit={handleSubmit}
					onCancel={handleCancel}
					submitButtonText="Save Changes"
					isEdit={true}
				/>
			</div>
		</div>
	);
}
