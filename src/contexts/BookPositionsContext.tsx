'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BookPositions } from '@/types/bookPositions';

interface BookPositionsContextType {
  bookPositions: BookPositions | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const BookPositionsContext = createContext<BookPositionsContextType | undefined>(undefined);

interface BookPositionsProviderProps {
  children: ReactNode;
}

export function BookPositionsProvider({ children }: BookPositionsProviderProps) {
  const [bookPositions, setBookPositions] = useState<BookPositions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  const loadData = async () => {
    // Don't reload if we already have data or are currently loading
    if (bookPositions || isLoading || hasAttemptedLoad) return;

    setHasAttemptedLoad(true);
    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching book positions from /data/bookPositionsMinified.json...');
      const response = await fetch('/data/bookPositionsMinified.json');

      if (!response.ok) {
        throw new Error(`Failed to load book positions: ${response.statusText}`);
      }

      const data = await response.json();
      setBookPositions(data);
      console.log(`Successfully loaded ${Object.keys(data).length} book positions`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error loading book positions';
      setError(errorMessage);
      console.error('Error loading book positions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Force reload data (useful for testing or manual refresh)
  const refetch = () => {
    setHasAttemptedLoad(false);
    setBookPositions(null);
    setError(null);
    loadData();
  };

  const value = {
    bookPositions,
    isLoading,
    error,
    refetch,
    // Internal load function (not exposed in context type)
    load: loadData,
  };

  return (
    <BookPositionsContext.Provider value={value as BookPositionsContextType}>
      {children}
    </BookPositionsContext.Provider>
  );
}

/**
 * Hook to access book positions data.
 *
 * This hook automatically triggers data loading on first use.
 * The data is cached and shared across all components that use this hook.
 *
 * @returns {BookPositionsContextType} Object containing:
 *   - bookPositions: The book positions data (null if not loaded yet)
 *   - isLoading: Whether the data is currently being fetched
 *   - error: Error message if loading failed (null otherwise)
 *   - refetch: Function to force reload the data
 *
 * @throws {Error} If used outside of BookPositionsProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { bookPositions, isLoading, error } = useBookPositions();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!bookPositions) return null;
 *
 *   return <div>Loaded {Object.keys(bookPositions).length} positions</div>;
 * }
 * ```
 */
export function useBookPositions(): BookPositionsContextType {
  const context = useContext(BookPositionsContext);

  if (context === undefined) {
    throw new Error('useBookPositions must be used within a BookPositionsProvider');
  }

  const { load, ...rest } = context as any;

  // Auto-load when hook is first called (lazy loading)
  useEffect(() => {
    load();
  }, [load]);

  return rest;
}
