"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { notFound } from "next/navigation";
import LessonForm from "@/components/lessonForm";
import { getUserLessonById, updateUserLesson } from "../../actions";
import type { Lesson } from "@/types/lesson";

interface PageProps {
	params: Promise<{
		id: string;
	}>;
}

export default function EditUserLessonPage({ params }: PageProps) {
	const router = useRouter();
	const { status } = useSession();
	const [lesson, setLesson] = useState<Lesson | null>(null);
	const [lessonId, setLessonId] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/login?callbackUrl=/my-repertoire");
			return;
		}

		if (status === "authenticated") {
			const loadLesson = async () => {
				const resolvedParams = await params;
				const id = Number(resolvedParams.id);

				if (Number.isNaN(id)) {
					notFound();
				}

				setLessonId(id);

				const result = await getUserLessonById(id);
				if (!result.success || !result.lesson) {
					notFound();
				}

				setLesson(result.lesson);
				setIsLoading(false);
			};

			loadLesson();
		}
	}, [params, status, router]);

	const handleSubmit = async (updatedLesson: Lesson) => {
		if (lessonId === null) return { success: false, error: "Invalid lesson ID" };

		const result = await updateUserLesson(lessonId, updatedLesson);
		if (result.success) {
			router.push(`/my-repertoire/${lessonId}`);
		}
		return result;
	};

	const handleCancel = () => {
		if (lessonId !== null) {
			router.push(`/my-repertoire/${lessonId}`);
		} else {
			router.push("/my-repertoire");
		}
	};

	if (status === "loading" || isLoading) {
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
				<h1 className="text-2xl font-bold mb-6">Edit Opening</h1>
				<Suspense fallback={<div>Loading...</div>}>
					<LessonForm
						initialLesson={lesson}
						onSubmit={handleSubmit}
						submitButtonText="Save Changes"
					/>
				</Suspense>
			</div>
		</div>
	);
}
