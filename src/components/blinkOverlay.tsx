import React, { useState, useEffect } from 'react';

interface Props {
  blinkCount: number
}

const BlinkOverlay = ({ blinkCount }: Props) => {

  const [shouldBlink, setShouldBlink] = useState<boolean>(false);

  // Whenever the blink count changes, trigger a blink
  useEffect(() => {
    let timeout = 0;
    if (blinkCount > 0) {
      setShouldBlink(true);
      timeout = window.setTimeout(() => setShouldBlink(false), 600);
    }
    return () => window.clearTimeout(timeout);
  }, [blinkCount]);

  const classes = [
    'w-full',
    'h-full',
    'absolute',
    'top-0',
    'left-0',
    'z-10',
    'bg-red-600',
    'opacity-0',
    'pointer-events-none',
  ];

  if (shouldBlink) {
    classes.push('animate-blink');
  }

  return (
    <>
      <div className={classes.join(' ')}></div>
      <style jsx>{`
        @keyframes blink {
          0% {
            opacity: 0;
          }
          25% {
            opacity: 0.35;
          }
          50% {
            opacity: 0;
          }
          75% {
            opacity: 0.35;
          }
          100% {
            opacity: 0;
          }
        }

        :global(.animate-blink) {
          animation: blink 600ms;
        }
      `}</style>
    </>
  );
};

export default BlinkOverlay;
