'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getFlashcardStats } from '@/app/flashcards/actions';
import { checkDailyLimitReached } from '@/app/user/actions';
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
      const [stats, limitStatus] = await Promise.all([
        getFlashcardStats(),
        checkDailyLimitReached(),
      ]);

      let displayCount: number;

      if (limitStatus.success && limitStatus.dailyLimit && limitStatus.dailyLimit > 0) {
        // Calculate effective limit (daily limit + extra review count)
        const effectiveLimit = limitStatus.dailyLimit + (limitStatus.extraReviewCount ?? 0);
        const reviewedToday = limitStatus.reviewedToday ?? 0;

        // With limit: show min(dueCount, max(0, effectiveLimit - reviewedToday))
        const remainingLimit = Math.max(0, effectiveLimit - reviewedToday);
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
        const [stats, limitStatus] = await Promise.all([
          getFlashcardStats(),
          checkDailyLimitReached(),
        ]);

        let displayCount: number;

        if (limitStatus.success && limitStatus.dailyLimit && limitStatus.dailyLimit > 0) {
          // Calculate effective limit (daily limit + extra review count)
          const effectiveLimit = limitStatus.dailyLimit + (limitStatus.extraReviewCount ?? 0);
          const reviewedToday = limitStatus.reviewedToday ?? 0;

          // With limit: show min(dueCount, max(0, effectiveLimit - reviewedToday))
          const remainingLimit = Math.max(0, effectiveLimit - reviewedToday);
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
