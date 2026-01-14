import Link from 'next/link';

export default function GameReviewPage() {
  return (
    <div>
      <h3>Game Review Page</h3>
      <Link href="/game-review/add-games">Add Games</Link>
    </div>
  );
}
