'use client';

import { useState, useEffect, useMemo } from 'react';
import { getPaginatedFlashcards, FlashcardFilters } from '../actions';
import type { Flashcard } from '@/db/schema';
import Button, { ButtonSize } from '@/components/button';
import FlashcardPreview from '@/components/flashcardPreview';
import useWindowSize from '@/hooks/useWindowSize';
import Chessboard from '@/components/Chessboard';
import { PieceColor } from '@/types/chess';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import { Chess as ChessJS } from 'chess.js';
import { parse } from 'pgn-parser';
import { getFenParts } from '@/utils/chess';
import { Move } from 'cm-chess/src/Chess';
import { makeAltFensWithEnPassantSquares } from '@/utils/bookPositions';

const PAGE_SIZE = 50;
const MAX_PLY_DEPTH_TO_CHECK = 6;

export default function BrowseFlashcardsPage() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [unfilteredFlashcards, setUnfilteredFlashcards] = useState<Flashcard[]>([]);
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

  // Board position filter state
  const [appliedBoardPosition, setAppliedBoardPosition] = useState<Move | undefined>(undefined);

  // Temporary input state (updates while typing, doesn't trigger filter until blur)
  const [tempMinMove, setTempMinMove] = useState<string>('');
  const [tempMaxMove, setTempMaxMove] = useState<string>('');

  const {
    currentMove,
    playMove,
    reset,
  } = useChessboardEngine();

  // Check if board position has changed (to enable/disable Apply button)
  const hasBoardPositionChanged = useMemo(() => {
    // On initial load, current position is starting position but not considered "changed"
    if (!appliedBoardPosition && currentMove?.ply === 0) return false;
    if (!currentMove && !appliedBoardPosition) return false;
    if (!currentMove || !appliedBoardPosition) return true;
    return currentMove.fen !== appliedBoardPosition.fen;
  }, [currentMove, appliedBoardPosition]);

  // Filter flashcards by board position
  const filterFlashcardsByBoardPosition = (flashcardList: Flashcard[], targetFen: string): Flashcard[] => {
    const targetFenParts = getFenParts(targetFen);
    const targetFullMoveNumber = targetFenParts.fullMoveNumber;
    const maxPlyToCheck = (targetFullMoveNumber - 1) * 2 + MAX_PLY_DEPTH_TO_CHECK;

    return flashcardList.filter((flashcard) => {
      try {
        // Parse the PGN
        const parsed = parse(flashcard.pgn);
        if (!parsed || parsed.length === 0 || !parsed[0].moves) {
          return false;
        }

        const moves = parsed[0].moves;
        const chessjs = new ChessJS();

        // Check each move in the flashcard
        for (let i = 0; i < moves.length; i++) {
          const move = moves[i];

          // Play the move
          const result = chessjs.move(move.move);
          if (!result) {
            // Invalid move, skip this flashcard
            return false;
          }

          // Get current ply after the move
          const currentMoveNumber = chessjs.moveNumber();
          const currentPly = chessjs.turn() === 'w'
            ? (currentMoveNumber - 1) * 2 + 1  // Just played black's move
            : (currentMoveNumber - 1) * 2;      // Just played white's move

          // Stop checking if we're too deep
          if (currentPly > maxPlyToCheck) {
            break;
          }

          // Check FEN
          const fen = chessjs.fen();
          if (fen === targetFen) return true;

          // Check altFens with EnPassantSquares
          const altFens = makeAltFensWithEnPassantSquares(fen);
          if (altFens.includes(targetFen)) return true;
        }

        return false;
      } catch (error) {
        console.error('Error filtering flashcard:', error);
        return false;
      }
    });
  };

  useEffect(() => {
    const fetchFlashcards = async () => {
      setIsLoading(true);

      // If board position filter is active, fetch ALL matching flashcards
      // Otherwise, use normal pagination
      if (appliedBoardPosition?.fen) {
        // Fetch all flashcards matching the other filters (no pagination)
        const result = await getPaginatedFlashcards(1, 10000, filters);

        // Store all unfiltered results
        setUnfilteredFlashcards(result.flashcards);

        // Apply board position filter to all results
        const filtered = filterFlashcardsByBoardPosition(result.flashcards, appliedBoardPosition.fen);

        // Handle pagination client-side
        const startIdx = (currentPage - 1) * PAGE_SIZE;
        const endIdx = startIdx + PAGE_SIZE;
        const paginatedFiltered = filtered.slice(startIdx, endIdx);

        setFlashcards(paginatedFiltered);
        setTotal(filtered.length);
        setTotalPages(Math.ceil(filtered.length / PAGE_SIZE));
      } else {
        // Normal server-side pagination
        const result = await getPaginatedFlashcards(currentPage, PAGE_SIZE, filters);
        setUnfilteredFlashcards(result.flashcards);
        setFlashcards(result.flashcards);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      }

      setIsLoading(false);
    };

    fetchFlashcards();
  }, [currentPage, filters, appliedBoardPosition]);

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

  const handleApplyBoardPosition = () => {
    if (currentMove) {
      setAppliedBoardPosition(currentMove);
      setCurrentPage(1);
    }
  };

  const handleResetBoard = () => {
    reset();
    setAppliedBoardPosition(undefined);
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    handleClearFilters();
    handleResetBoard();
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
      <div className="px-4">

        {/* Color Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2 text-gray-300">Color</h3>
          <div className="flex flex-row gap-4">
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
      </div>

      {/* Board Position Filter */}
      <div className="mb-0">
        <h3 className="text-sm font-medium text-center mb-2 text-gray-300">Filter by board position</h3>
        <div className="w-full flex flex-row justify-center mb-2">
          <Chessboard
            currentMove={currentMove}
            boardSize={310}
            orientation={boardOrientation}
            playMove={playMove}
            animate={false}
          />
        </div>
        <div className="flex w-full flex-row justify-between px-2">
          <Button
            onClick={handleFlipBoard}
            buttonSize={ButtonSize.Small}
          >
            Flip Board
          </Button>
          <Button
            onClick={handleResetBoard}
            buttonSize={ButtonSize.Small}
          >
            Reset
          </Button>
          <Button
            onClick={handleApplyBoardPosition}
            buttonSize={ButtonSize.Small}
            disabled={!hasBoardPositionChanged}
          >
            Apply
          </Button>
        </div>

        {/* Clear Filters Button */}
        <div className="mt-3 pt-3 pb-2 w-full flex flex-row justify-center">
          <Button
            onClick={handleClearAllFilters}
            buttonSize={ButtonSize.Small}
            className="w-full"
          >
            Clear All Filters
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
            <div className="bg-background-page rounded-md py-2 sticky top-4">
                <h2 className="text-xl font-semibold text-center mb-2">Filters</h2>
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
