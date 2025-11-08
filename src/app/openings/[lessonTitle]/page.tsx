import React from "react";
import { notFound } from "next/navigation";
import LessonSession from "@/components/lessonSession";
import { getLessonByTitle } from "../actions";

interface PageProps {
	params: Promise<{
		lessonTitle: string;
	}>;
}

export default async function Page({ params }: PageProps) {
	const { lessonTitle } = await params;

	// Decode the URL-encoded title
	const decodedTitle = decodeURIComponent(lessonTitle);

	// Fetch lesson from database
	const lesson = await getLessonByTitle(decodedTitle);

	// If lesson not found, show 404
	if (!lesson) {
		notFound();
	}

	return <LessonSession lesson={lesson} />;
}
