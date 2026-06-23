'use client';

import { useState, useEffect } from 'react';
import { getPaginatedFlashcards, FlashcardFilters } from '../actions';
import type { Flashcard } from '@/db/schema';
import Button, { ButtonSize } from '@/components/button';
import FlashcardPreview from '@/components/flashcardPreview';
import useWindowSize from '@/hooks/useWindowSize';
import Chessboard from '@/components/Chessboard';
import { PieceColor } from '@/types/chess';
import useChessboardEngine from '@/hooks/useChessboardEngine';

const PAGE_SIZE = 50;

export default function BrowseFlashcardsPage() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const windowSize = useWindowSize();
  const isMobile = windowSize.width ? windowSize.width <= 768 : false;

  // UI state
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<PieceColor>(PieceColor.WHITE);

  // Filter state
  const [filters, setFilters] = useState<FlashcardFilters>({
    colors: [],
    minMoveNumber: undefined,
    maxMoveNumber: undefined,
  });

  // Temporary input state (updates while typing, doesn't trigger filter until blur)
  const [tempMinMove, setTempMinMove] = useState<string>('');
  const [tempMaxMove, setTempMaxMove] = useState<string>('');


  const {
    currentMove,
    playMove,
    reset,
  } = useChessboardEngine();

  useEffect(() => {
    console.log('new current move');
    console.log(currentMove);
  }, [currentMove]);

  useEffect(() => {
    const fetchFlashcards = async () => {
      setIsLoading(true);
      const result = await getPaginatedFlashcards(currentPage, PAGE_SIZE, filters);
      setFlashcards(result.flashcards);
      setTotalPages(result.totalPages);
      setTotal(result.total);
      setIsLoading(false);
    };

    fetchFlashcards();
  }, [currentPage, filters]);

  // Sync temp input state with actual filter state
  // Convert ply numbers back to move numbers for display
  useEffect(() => {
    if (filters.minMoveNumber !== undefined) {
      // Convert ply to move: ply (N-1)*2 + 1 -> move N
      const moveNumber = ((filters.minMoveNumber - 1) / 2) + 1;
      setTempMinMove(moveNumber.toString());
    } else {
      setTempMinMove('');
    }

    if (filters.maxMoveNumber !== undefined) {
      // Convert ply to move: ply N*2 -> move N
      const moveNumber = filters.maxMoveNumber / 2;
      setTempMaxMove(moveNumber.toString());
    } else {
      setTempMaxMove('');
    }
  }, [filters.minMoveNumber, filters.maxMoveNumber]);

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

  const handleColorToggle = (color: PieceColor) => {
    setFilters((prev) => {
      const colors = prev.colors || [];
      const isSelected = colors.includes(color);
      const newColors = isSelected
        ? colors.filter((c) => c !== color)
        : [...colors, color];
      return { ...prev, colors: newColors };
    });
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleMinMoveChange = (value: string) => {
    setTempMinMove(value);
  };

  const handleMaxMoveChange = (value: string) => {
    setTempMaxMove(value);
  };

  const handleMinMoveBlur = () => {
    if (tempMinMove === '') {
      if (filters.minMoveNumber !== undefined) {
        setFilters((prev) => ({ ...prev, minMoveNumber: undefined }));
        setCurrentPage(1);
      }
    } else {
      const moveNumber = parseInt(tempMinMove, 10);
      // Convert move number to ply: min move N filters positionIdx > (N-1)*2
      // So we use ply (N-1)*2 + 1 with >= operator to get the same result
      const plyNumber = (moveNumber - 1) * 2 + 1;
      if (plyNumber !== filters.minMoveNumber) {
        setFilters((prev) => ({ ...prev, minMoveNumber: plyNumber }));
        setCurrentPage(1);
      }
    }
  };

  const handleMaxMoveBlur = () => {
    if (tempMaxMove === '') {
      if (filters.maxMoveNumber !== undefined) {
        setFilters((prev) => ({ ...prev, maxMoveNumber: undefined }));
        setCurrentPage(1);
      }
    } else {
      const moveNumber = parseInt(tempMaxMove, 10);
      // Convert move number to ply: max move N includes up to ply N*2
      const plyNumber = moveNumber * 2;
      if (plyNumber !== filters.maxMoveNumber) {
        setFilters((prev) => ({ ...prev, maxMoveNumber: plyNumber }));
        setCurrentPage(1);
      }
    }
  };

  const handleClearFilters = () => {
    setFilters({
      colors: [],
      minMoveNumber: undefined,
      maxMoveNumber: undefined,
    });
    setTempMinMove('');
    setTempMaxMove('');
    setCurrentPage(1);
  };

  const handleFlipBoard = () => {
    setBoardOrientation((prev) =>
      prev === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 mt-4">
        <div className="bg-background-page rounded-md p-8 text-center">
          <p className="text-xl">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  if (total === 0 && !filters.colors?.length && !filters.minMoveNumber && !filters.maxMoveNumber) {
    return (
      <div className="max-w-7xl mx-auto p-4 mt-4">
        <div className="bg-background-page rounded-md p-8 text-center">
          <h1 className="text-3xl font-bold mb-4">Browse Flashcards</h1>
          <p className="text-xl text-gray-300">
            You don't have any flashcards yet
          </p>
        </div>
      </div>
    );
  }

  // Helper to render filter content
  const renderFilterContent = () => (
    <>
      {/* Clear Filters Button */}
      <div className="mb-4">
        <Button
          onClick={handleClearFilters}
          buttonSize={ButtonSize.Small}
          className="w-full"
        >
          Clear Filters
        </Button>
      </div>

      {/* Color Filter */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-2 text-gray-300">Color</h3>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={filters.colors?.includes(PieceColor.WHITE) || false}
              onChange={() => handleColorToggle(PieceColor.WHITE)}
              className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-gray-700 cursor-pointer"
            />
            <span className="ml-2">White</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={filters.colors?.includes(PieceColor.BLACK) || false}
              onChange={() => handleColorToggle(PieceColor.BLACK)}
              className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-gray-700 cursor-pointer"
            />
            <span className="ml-2">Black</span>
          </label>
        </div>
      </div>

      {/* Move Number Range Filter */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-2 text-gray-300">Move Number</h3>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Min</label>
            <input
              type="number"
              min="0"
              placeholder="No min"
              value={tempMinMove}
              onChange={(e) => handleMinMoveChange(e.target.value)}
              onBlur={handleMinMoveBlur}
              className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Max</label>
            <input
              type="number"
              min="0"
              placeholder="No max"
              value={tempMaxMove}
              onChange={(e) => handleMaxMoveChange(e.target.value)}
              onBlur={handleMaxMoveBlur}
              className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Board Position Filter */}
      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2 text-gray-300">Filter by board position</h3>
        <div className="w-full aspect-square mb-2">
          <Chessboard
            currentMove={currentMove}
            boardSize={300}
            orientation={boardOrientation}
            playMove={playMove}
            animate={false}
          />
        </div>
        <div className="flex flex-row gap-3">
          <Button
            onClick={handleFlipBoard}
            buttonSize={ButtonSize.Small}
          >
            Flip Board
          </Button>
          <Button
            onClick={reset}
            buttonSize={ButtonSize.Small}
          >
            Reset
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold p-3 text-center">Browse Flashcards</h1>

      <div className="flex gap-4">
        {/* Filter Sidebar - Desktop Only */}
        {!isMobile && (
          <aside className="w-80 flex-shrink-0">
            <div className="bg-background-page rounded-md p-4 sticky top-4">
              <h2 className="text-xl font-semibold mb-4">Filters</h2>
              {renderFilterContent()}
            </div>
          </aside>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile Filter Button */}
          {isMobile && (
            <div className="mb-4">
              <Button
                onClick={() => setShowMobileFilters(true)}
                buttonSize={ButtonSize.Small}
                className="w-full"
              >
                Show Filters
              </Button>
            </div>
          )}

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
          {total === 0 ? (
            <div className="bg-background-page rounded-md p-8 text-center">
              <p className="text-xl text-gray-300">
                No flashcards match the selected filters
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[calc(100vh-175px)] bg-background [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:invisible">
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
                {flashcards.map((flashcard) => (
                  <FlashcardPreview
                    key={flashcard.id}
                    flashcard={flashcard}
                    useMobileLayout={isMobile}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {isMobile && showMobileFilters && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowMobileFilters(false)}
          ></div>

          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-background-page z-50 overflow-y-auto shadow-xl">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Filters</h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              {renderFilterContent()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
