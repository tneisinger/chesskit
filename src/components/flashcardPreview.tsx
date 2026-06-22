'use client';

import Link from 'next/link';
import PositionPreview from '@/components/PositionPreview';
import type { Flashcard } from '@/db/schema';
import { Chess as ChessJS } from 'chess.js';

interface FlashcardPreviewProps {
  flashcard: Flashcard;
  useMobileLayout?: boolean;
}

/**
 * Get the first N moves from a PGN string
 */
function getFirstNMoves(pgnString: string, n: number): string[] {
  try {
    const chess = new ChessJS();
    chess.loadPgn(pgnString);
    const history = chess.history();
    return history.slice(0, n);
  } catch (error) {
    console.error('Error parsing PGN:', error);
    return [];
  }
}

/**
 * Get difficulty label based on easiness factor
 */
function getDifficulty(easinessFactor: number, repetitions: number): {
  label: string;
  color: string;
} {
  if (repetitions < 2) {
    return { label: 'Unknown', color: 'text-gray-100' };
  }

  if (easinessFactor < 1800) {
    return { label: 'Very Hard', color: 'text-red-500' };
  } else if (easinessFactor < 2100) {
    return { label: 'Hard', color: 'text-orange-500' };
  } else if (easinessFactor < 2400) {
    return { label: 'Medium', color: 'text-yellow-500' };
  } else {
    return { label: 'Easy', color: 'text-green-500' };
  }
}

/**
 * Format date to short format
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * A component that displays a flashcard preview with details and board position
 */
export default function FlashcardPreview({
  flashcard,
  useMobileLayout = false,
}: FlashcardPreviewProps) {
  const moves = getFirstNMoves(flashcard.pgn, flashcard.positionIdx);
  const difficulty = getDifficulty(flashcard.easinessFactor, flashcard.repetitions);
  const previewSize = useMobileLayout ? 150 : 225;

  return (
    <Link
      href={`/flashcards/${flashcard.id}`}
      className="block bg-background-page rounded-lg p-4 hover:bg-foreground/5 transition-colors border border-foreground/10 no-underline"
    >
      <div className="flex items-center gap-4">
        {/* Details Section */}
        <div className={`flex flex-col ${useMobileLayout ? 'gap-1.5' : 'gap-6'} flex-1 min-w-0`}>
          {/* Date Created */}
          <div>
            <div className={`text-foreground/60 ${useMobileLayout ? 'text-sm' : 'text-md'}`}>
              Created on:
            </div>
            <div className={`text-foreground ${useMobileLayout ? 'text-sm' : 'text-base'} font-medium`}>
              {formatDate(flashcard.createdAt)}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <div className={`text-foreground/60 ${useMobileLayout ? 'text-sm' : 'text-md'}`}>
              Difficulty:
            </div>
            <div className={`${useMobileLayout ? 'text-sm' : 'text-base'} font-semibold ${difficulty.color}`}>
              {difficulty.label}
            </div>
          </div>

          {/* Attempts (Repetitions) */}
          {!useMobileLayout && (
            <div className="flex flex-row items-center gap-2">
              <div className="text-foreground/60 mt-0.5">Attempts: </div>
              <div className="text-foreground text-base font-medium">
                {flashcard.repetitions}
              </div>
            </div>
          )}
        </div>

        {/* Preview Section */}
        <div className="flex-shrink-0">
          <PositionPreview
            line={moves}
            orientation={flashcard.userColor}
            size={previewSize}
            cycleLineMoves={false}
          />
        </div>
      </div>
    </Link>
  );
}
