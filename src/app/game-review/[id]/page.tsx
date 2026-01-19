import { notFound } from "next/navigation";
import { getUserGameById } from "@/app/game-review/actions";

interface PageProps {
	params: Promise<{
		id: number;
	}>;
}

export default async function Page({ params }: PageProps) {
	const { id } = await params;

	// Fetch lesson from database
	const game = await getUserGameById(id);

	// If lesson not found, show 404
	if (!game) {
		notFound();
	}

	return (
    <div>
      <p>Game Review Page for Game ID: {id}</p>
      <div>{JSON.stringify(game)}</div>
    </div>

  );
}
