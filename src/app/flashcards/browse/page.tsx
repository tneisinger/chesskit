'use client';

import { useState, useEffect } from 'react';
import { getPaginatedFlashcards } from '../actions';
import type { Flashcard } from '@/db/schema';
import Button, { ButtonSize } from '@/components/button';
import FlashcardPreview from '@/components/flashcardPreview';
import useWindowSize from '@/hooks/useWindowSize';

const PAGE_SIZE = 100;

export default function BrowseFlashcardsPage() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const windowSize = useWindowSize();
  const isMobile = windowSize.width ? windowSize.width <= 768 : false;

  useEffect(() => {
    const fetchFlashcards = async () => {
      setIsLoading(true);
      const result = await getPaginatedFlashcards(currentPage, PAGE_SIZE);
      setFlashcards(result.flashcards);
      setTotalPages(result.totalPages);
      setTotal(result.total);
      setIsLoading(false);
    };

    fetchFlashcards();
  }, [currentPage]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4 mt-4">
        <div className="bg-background-page rounded-md p-8 text-center">
          <p className="text-xl">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="max-w-6xl mx-auto p-4 mt-4">
        <div className="bg-background-page rounded-md p-8 text-center">
          <h1 className="text-3xl font-bold mb-4">Browse Flashcards</h1>
          <p className="text-xl text-gray-300">
            You don't have any flashcards yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold p-3 text-center">Browse Flashcards</h1>

      {/* Pagination Controls - Top */}
      <div className="flex justify-between items-center mb-4 bg-background-page p-2 rounded">
        <Button
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
          buttonSize={ButtonSize.Small}
        >
          Previous
        </Button>
        <div className="flex flex-col text-sm items-center">
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <span>
            {total} flashcard{total !== 1 ? 's' : ''}
          </span>
        </div>
        <Button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          buttonSize={ButtonSize.Small}
        >
          Next
        </Button>
      </div>

      {/* Flashcards Grid - Scrollable */}
      <div className="overflow-y-auto max-h-[calc(100vh-175px)] bg-background [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:invisible">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flashcards.map((flashcard) => (
            <FlashcardPreview
              key={flashcard.id}
              flashcard={flashcard}
              useMobileLayout={isMobile}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
