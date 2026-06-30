'use client';

import { useState, useEffect, useMemo } from 'react';
import { getPaginatedFlashcards, FlashcardFilters, startPracticeSession, getPracticeSessionCount } from '../actions';
import type { Flashcard } from '@/db/schema';
import Button, { ButtonSize } from '@/components/button';
import { useRouter } from 'next/navigation';
import FlashcardPreview from '@/components/flashcardPreview';
import useWindowSize from '@/hooks/useWindowSize';
import Chessboard from '@/components/Chessboard';
import { PieceColor } from '@/types/chess';
import useChessboardEngine from '@/hooks/useChessboardEngine';
import { Chess as ChessJS } from 'chess.js';
import { parse } from 'pgn-parser';
import { getFenParts, isEndgame } from '@/utils/chess';
import { Move } from 'cm-chess/src/Chess';
import { makeAltFensWithEnPassantSquares } from '@/utils/bookPositions';
import type { GamePhase } from '../actions';
import * as Tooltip from '@radix-ui/react-tooltip';

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
    gamePhases: [],
  });

  // Board position filter state
  const [appliedBoardPosition, setAppliedBoardPosition] = useState<Move | undefined>(undefined);

  // Temporary input state (updates while typing, doesn't trigger filter until blur)
  const [tempMinMove, setTempMinMove] = useState<string>('');
  const [tempMaxMove, setTempMaxMove] = useState<string>('');

  // Practice session state
  const [showPracticeWarningModal, setShowPracticeWarningModal] = useState(false);
  const [existingPracticeCount, setExistingPracticeCount] = useState(0);
  const [isStartingPractice, setIsStartingPractice] = useState(false);

  const router = useRouter();

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

  // Determine the game phase of a flashcard
  const determineGamePhase = (flashcard: Flashcard): GamePhase | null => {
    try {
      // Opening phase: positionIdx < 25
      if (flashcard.positionIdx < 25) {
        return 'Opening';
      }

      // For End Game and Middle Game, we need to get the FEN at positionIdx
      const parsed = parse(flashcard.pgn);
      if (!parsed || parsed.length === 0 || !parsed[0].moves) {
        return null;
      }

      const moves = parsed[0].moves;
      const chessjs = new ChessJS();

      // Play moves up to positionIdx
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const result = chessjs.move(move.move);
        if (!result) {
          return null;
        }

        // Calculate current ply after the move
        const currentMoveNumber = chessjs.moveNumber();
        const currentPly = chessjs.turn() === 'w'
          ? (currentMoveNumber - 1) * 2 + 1
          : (currentMoveNumber - 1) * 2;

        // If we've reached the positionIdx, check if it's endgame
        if (currentPly === flashcard.positionIdx) {
          const fen = chessjs.fen();
          return isEndgame(fen) ? 'EndGame' : 'MiddleGame';
        }

        // If we've passed it, something is wrong
        if (currentPly > flashcard.positionIdx) {
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error('Error determining game phase:', error);
      return null;
    }
  };

  // Filter flashcards by game phase
  const filterFlashcardsByGamePhase = (flashcardList: Flashcard[], selectedPhases: GamePhase[]): Flashcard[] => {
    if (selectedPhases.length === 0) return flashcardList;

    return flashcardList.filter((flashcard) => {
      const phase = determineGamePhase(flashcard);
      return phase !== null && selectedPhases.includes(phase);
    });
  };

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

      // Check if client-side filtering is needed
      const needsClientSideFiltering =
        appliedBoardPosition?.fen ||
        (filters.gamePhases && filters.gamePhases.length > 0);

      if (needsClientSideFiltering) {
        // Fetch all flashcards matching the server-side filters (no pagination)
        // Don't include gamePhases in server filters since we handle it client-side
        const serverFilters = {
          colors: filters.colors,
          minMoveNumber: filters.minMoveNumber,
          maxMoveNumber: filters.maxMoveNumber,
        };
        const result = await getPaginatedFlashcards(1, 10000, serverFilters);

        // Store all unfiltered results
        setUnfilteredFlashcards(result.flashcards);

        let filtered = result.flashcards;

        // Apply board position filter if active
        if (appliedBoardPosition?.fen) {
          filtered = filterFlashcardsByBoardPosition(filtered, appliedBoardPosition.fen);
        }

        // Apply game phase filter if active
        if (filters.gamePhases && filters.gamePhases.length > 0) {
          filtered = filterFlashcardsByGamePhase(filtered, filters.gamePhases);
        }

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

  const handleGamePhaseToggle = (phase: GamePhase) => {
    setFilters((prev) => {
      const phases = prev.gamePhases || [];
      const isSelected = phases.includes(phase);
      const newPhases = isSelected
        ? phases.filter((p) => p !== phase)
        : [...phases, phase];
      return { ...prev, gamePhases: newPhases };
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
      gamePhases: [],
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

  const handleStartPracticeClick = async () => {
    // Check if there's an existing practice session
    const count = await getPracticeSessionCount();
    setExistingPracticeCount(count);

    if (count > 0) {
      // Show warning modal
      setShowPracticeWarningModal(true);
    } else {
      // Start practice session directly
      await startPracticeSessionWithCurrentFilters();
    }
  };

  const startPracticeSessionWithCurrentFilters = async () => {
    setIsStartingPractice(true);

    try {
      // Need to fetch all flashcard IDs that match the current filters
      // Determine if we need client-side filtering
      const needsClientSideFiltering =
        appliedBoardPosition?.fen ||
        (filters.gamePhases && filters.gamePhases.length > 0);

      let allFlashcardIds: number[] = [];

      if (needsClientSideFiltering) {
        // Fetch all flashcards and apply client-side filters
        const serverFilters = {
          colors: filters.colors,
          minMoveNumber: filters.minMoveNumber,
          maxMoveNumber: filters.maxMoveNumber,
        };
        const result = await getPaginatedFlashcards(1, 10000, serverFilters);

        let filtered = result.flashcards;

        // Apply board position filter if active
        if (appliedBoardPosition?.fen) {
          filtered = filterFlashcardsByBoardPosition(filtered, appliedBoardPosition.fen);
        }

        // Apply game phase filter if active
        if (filters.gamePhases && filters.gamePhases.length > 0) {
          filtered = filterFlashcardsByGamePhase(filtered, filters.gamePhases);
        }

        allFlashcardIds = filtered.map((fc) => fc.id);
      } else {
        // Use server-side filtering
        const result = await getPaginatedFlashcards(1, 10000, filters);
        allFlashcardIds = result.flashcards.map((fc) => fc.id);
      }

      // Start the practice session
      const startResult = await startPracticeSession(allFlashcardIds);

      if (startResult.success) {
        // Navigate to practice page
        router.push('/flashcards/practice');
      } else {
        alert(`Error: ${startResult.error}`);
      }
    } catch (error) {
      console.error('Error starting practice session:', error);
      alert('An error occurred while starting the practice session');
    } finally {
      setIsStartingPractice(false);
      setShowPracticeWarningModal(false);
    }
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

  if (total === 0 && !filters.colors?.length && !filters.minMoveNumber && !filters.maxMoveNumber && !filters.gamePhases?.length && !appliedBoardPosition) {
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

        {/* Game Phase Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2 text-gray-300">Game Phase</h3>
          <Tooltip.Provider delayDuration={300}>
            <div className="flex flex-row gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.gamePhases?.includes('Opening') || false}
                  onChange={() => handleGamePhaseToggle('Opening')}
                  className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-gray-700 cursor-pointer"
                />
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="ml-2 underline decoration-dotted decoration-gray-500 underline-offset-2">Opening</span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg border border-gray-700 max-w-xs z-50"
                      sideOffset={5}
                    >
                      Positions before move 13.
                      <Tooltip.Arrow className="fill-gray-800" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.gamePhases?.includes('MiddleGame') || false}
                  onChange={() => handleGamePhaseToggle('MiddleGame')}
                  className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-gray-700 cursor-pointer"
                />
                <span className="ml-2">Middle</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.gamePhases?.includes('EndGame') || false}
                  onChange={() => handleGamePhaseToggle('EndGame')}
                  className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-gray-700 cursor-pointer"
                />
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="ml-2 underline decoration-dotted decoration-gray-500 underline-offset-2">End</span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg border border-gray-700 max-w-xs z-50"
                      sideOffset={5}
                    >
                      Both sides have 14 points of material or less.
                      <Tooltip.Arrow className="fill-gray-800" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </label>
            </div>
          </Tooltip.Provider>
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
              {total <= 200 ? (
                <Button
                  onClick={handleStartPracticeClick}
                  buttonSize={ButtonSize.Small}
                  disabled={isStartingPractice || total === 0}
                >
                  {isStartingPractice ? 'Starting...' : `Review ${total} Flashcard${total !== 1 ? 's' : ''}`}
                </Button>
              ) : (
                <span>
                  {total} flashcard{total !== 1 ? 's' : ''}
                </span>
              )}
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

      {/* Practice Session Warning Modal */}
      {showPracticeWarningModal && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50"></div>

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-background-page rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">Replace Practice Session?</h2>
              <p className="text-gray-300 mb-6">
                You have an existing practice session with {existingPracticeCount} flashcard{existingPracticeCount !== 1 ? 's' : ''}.
                Starting a new practice session will replace the old one.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={() => setShowPracticeWarningModal(false)}
                  buttonSize={ButtonSize.Small}
                  disabled={isStartingPractice}
                >
                  Cancel
                </Button>
                <Button
                  onClick={startPracticeSessionWithCurrentFilters}
                  buttonSize={ButtonSize.Small}
                  disabled={isStartingPractice}
                >
                  {isStartingPractice ? 'Starting...' : 'Replace & Start'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

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
