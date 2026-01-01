import { useState, useEffect } from "react";

export interface Size {
  width: number | undefined;
  height: number | undefined;
}

// Usage
// function App() {
//   const size: Size = useWindowSize();
//   return (
//     <div>
//       {size.width}px / {size.height}px
//     </div>
//   );
// }

export default function useWindowSize(): Size {
  // Initialize state with undefined width/height so server and client renders match
  // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
  const [windowSize, setWindowSize] = useState<Size>({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    // Check if window is defined (client-side only)
    if (typeof window === 'undefined') return;

    // Handler to call on window resize
    function handleResize() {
      // Set window width/height to state
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Use requestAnimationFrame to ensure we get dimensions after layout
    const timeoutId = window.setTimeout(() => {
      handleResize();
    }, 0);

    // Also set immediately in case the timeout doesn't fire fast enough
    handleResize();

    // Add event listener for future resizes
    window.addEventListener("resize", handleResize);

    // Also listen for orientation changes on mobile
    window.addEventListener("orientationchange", handleResize);

    // Remove event listeners and timeout on cleanup
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []); // Empty array ensures that effect is only run on mount

  return windowSize;
}
