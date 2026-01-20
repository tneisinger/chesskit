import { notFound } from "next/navigation";
import { getUserGameById } from "@/app/game-review/actions";
import GameReview from "@/components/gameReview";

interface PageProps {
	params: Promise<{
		id: number;
	}>;
}

export default async function Page({ params }: PageProps) {
	const { id } = await params;

	// Fetch game from database
	const result = await getUserGameById(id);

	// If game not found, show 404
	if (!result.success || !result.game) {
		notFound();
	}

	return <GameReview game={result.game} />;
}
