'use client';

import { useCountdown } from '@/hooks/useCountdown';
import CountdownClock from '@/components/countdownClock';
import Button from '@/components/button';

/**
 * Example component demonstrating how to use useCountdown hook with CountdownClock
 * This can be deleted once you've integrated the countdown into your app
 */
const CountdownClockExample = () => {
  const { remainingTime, pause, unpause, reset, isPaused } = useCountdown(10); // 10 second countdown

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <h2 className="text-xl font-semibold">Countdown Timer Example</h2>

      <CountdownClock remainingTime={remainingTime} isPaused={isPaused} />

      <div className="flex gap-3">
        {isPaused ? (
          <Button onClick={unpause}>Start</Button>
        ) : (
          <Button onClick={pause}>Pause</Button>
        )}
        <Button onClick={reset}>Reset</Button>
      </div>

      <div className="text-sm text-gray-400">
        Status: {isPaused ? 'Paused' : 'Running'} | Time: {remainingTime}s
      </div>
    </div>
  );
};

export default CountdownClockExample;
