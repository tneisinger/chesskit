import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCountdownReturn {
  remainingTime: number;
  pause: () => void;
  unpause: () => void;
  reset: () => void;
  isPaused: boolean;
  addTime: (seconds: number) => void;
}

/**
 * Custom hook for countdown timer functionality
 *
 * @param seconds - Initial countdown time in seconds
 * @returns Object with remainingTime, pause, unpause, reset, and isPaused
 */
export function useCountdown(seconds: number): UseCountdownReturn {
  const [remainingTime, setRemainingTime] = useState(seconds);
  const [isPaused, setIsPaused] = useState(true); // Initially paused
  const initialSeconds = useRef(seconds);
  const intervalRef = useRef<number | null>(null);

  // Update initial seconds if the prop changes
  useEffect(() => {
    initialSeconds.current = seconds;
  }, [seconds]);

  // Countdown logic
  useEffect(() => {
    if (isPaused || remainingTime <= 0) {
      // Clear interval if paused or time reached zero
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start countdown interval
    intervalRef.current = window.setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          // Stop at 0
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPaused, remainingTime]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const unpause = useCallback(() => {
    if (remainingTime > 0) {
      setIsPaused(false);
    }
  }, [remainingTime]);

  const reset = useCallback(() => {
    setRemainingTime(initialSeconds.current);
    setIsPaused(true);
  }, []);

  const addTime = useCallback((seconds: number) => {
    setRemainingTime((t) => t + seconds);
  }, []);

  return {
    remainingTime,
    pause,
    unpause,
    reset,
    isPaused,
    addTime,
  };
}
