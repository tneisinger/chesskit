'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getFlashcardStats } from '@/app/flashcards/actions';
import { getDailyFlashcardLimit, getDailyReviewProgress } from '@/app/user/actions';
import { useSession } from 'next-auth/react';

interface FlashcardContextType {
  dueCount: number;
  refreshDueCount: () => Promise<void>;
}

const FlashcardContext = createContext<FlashcardContextType | undefined>(undefined);

export function FlashcardProvider({ children }: { children: ReactNode }) {
  const [dueCount, setDueCount] = useState<number>(0);
  const { data: session, status } = useSession();
  const isLoggedIn = !!session;

  const refreshDueCount = async () => {
    if (isLoggedIn) {
      const [stats, limitResult, progressResult] = await Promise.all([
        getFlashcardStats(),
        getDailyFlashcardLimit(),
        getDailyReviewProgress(),
      ]);

      // Calculate badge count with daily limit and progress
      const limit = limitResult.success ? limitResult.limit : null;
      const reviewedToday = progressResult.success ? progressResult.count || 0 : 0;

      let displayCount: number;

      if (limit && limit > 0) {
        // With limit: show min(dueCount, max(0, limit - reviewedToday))
        const remainingLimit = Math.max(0, limit - reviewedToday);
        displayCount = Math.min(stats.due, remainingLimit);
      } else {
        // No limit: show actual due count
        displayCount = stats.due;
      }

      setDueCount(displayCount);
    } else {
      setDueCount(0);
    }
  };

  // Initial fetch when login state changes
  useEffect(() => {
    const fetchCount = async () => {
      if (isLoggedIn) {
        const [stats, limitResult, progressResult] = await Promise.all([
          getFlashcardStats(),
          getDailyFlashcardLimit(),
          getDailyReviewProgress(),
        ]);

        // Calculate badge count with daily limit and progress
        const limit = limitResult.success ? limitResult.limit : null;
        const reviewedToday = progressResult.success ? progressResult.count || 0 : 0;

        let displayCount: number;

        if (limit && limit > 0) {
          // With limit: show min(dueCount, max(0, limit - reviewedToday))
          const remainingLimit = Math.max(0, limit - reviewedToday);
          displayCount = Math.min(stats.due, remainingLimit);
        } else {
          // No limit: show actual due count
          displayCount = stats.due;
        }

        setDueCount(displayCount);
      } else {
        setDueCount(0);
      }
    };
    fetchCount();
  }, [isLoggedIn]);

  return (
    <FlashcardContext.Provider value={{ dueCount, refreshDueCount }}>
      {children}
    </FlashcardContext.Provider>
  );
}

export function useFlashcardContext() {
  const context = useContext(FlashcardContext);
  if (context === undefined) {
    throw new Error('useFlashcardContext must be used within a FlashcardProvider');
  }
  return context;
}
