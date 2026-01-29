'use client';

interface Props {
  remainingTime: number;
  isPaused: boolean;
}

/**
 * Formats seconds into MM:SS format
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Countdown clock component that displays time in MM:SS format
 * Background color changes based on state:
 * - Red when time reaches zero
 * - Gray when paused (and not at zero)
 * - White otherwise
 */
const CountdownClock = ({ remainingTime, isPaused }: Props) => {
  // Determine background color based on state
  let bgColor = 'bg-stone-100'; // Default background

  if (remainingTime === 0) {
    bgColor = 'bg-red-300'; // Red when time is up
  } else if (isPaused) {
    bgColor = 'bg-stone-400'; // Gray when paused
  }

  return (
    <div
      className={`${bgColor} px-2 py-2 rounded-md font-mono text-2xl font-bold text-black transition-colors duration-300`}
    >
      {formatTime(remainingTime)}
    </div>
  );
};

export default CountdownClock;
