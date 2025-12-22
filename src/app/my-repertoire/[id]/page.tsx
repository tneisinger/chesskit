import { notFound, redirect } from "next/navigation";
import LessonSession from "@/components/lessonSession";
import { getUserLessonById } from "../actions";
import { auth } from "@/lib/auth";

interface PageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function Page({ params }: PageProps) {
	const session = await auth();

	if (!session?.user) {
		redirect("/login?callbackUrl=/my-repertoire");
	}

	const { id } = await params;
	const lessonId = Number(id);

	if (Number.isNaN(lessonId)) {
		notFound();
	}

	const result = await getUserLessonById(lessonId);

	if (!result.success || !result.lesson) {
		notFound();
	}

	return <LessonSession lesson={result.lesson} allowEdits />;
}
