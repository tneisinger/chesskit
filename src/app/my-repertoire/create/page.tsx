"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, Suspense } from "react";
import LessonForm from "@/components/lessonForm";
import { createUserLesson } from "../actions";
import type { Lesson } from "@/types/lesson";

export default function CreateUserLessonPage() {
	const router = useRouter();
	const { status } = useSession();

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/login?callbackUrl=/my-repertoire/create");
		}
	}, [status, router]);

	const handleSubmit = async (lesson: Lesson) => {
		const result = await createUserLesson(lesson);
		if (result.success) {
			router.push("/my-repertoire");
		}
		return result;
	};

	if (status === "loading") {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-xl">Loading...</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center min-h-screen p-4 sm:p-8">
			<div className="w-full max-w-3xl">
				<h1 className="text-2xl font-bold mb-6">Create New Opening</h1>
				<Suspense fallback={<div>Loading...</div>}>
					<LessonForm
						onSubmit={handleSubmit}
						submitButtonText="Create Opening"
					/>
				</Suspense>
			</div>
		</div>
	);
}
