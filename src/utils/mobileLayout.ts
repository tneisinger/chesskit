import { Size } from '@/hooks/useWindowSize';
import { layout } from '@/constants/layout';

// Use a windowSize to determine what size (in pixels) the chessboard should be.
// This function assumes that the chessboard will be square.
export function calculateBoardSize(windowSize: Size): number {
  const defaultBoardSize = 750;
  if (windowSize.width) {
    if (windowSize.width < defaultBoardSize) {
      return windowSize.width;
    }
  }
  return defaultBoardSize;
}

export function shouldUseMobileLayout(windowSize: Size): boolean | undefined {
  if (windowSize.width) {
    return windowSize.width < parseInt(layout.mobileLayoutBreakpointWidth) ? true : false;
  }
}

export function calculateMainHeight(windowSize: Size): number | undefined {
  const normal = parseInt(layout.navbarHeight);
  const mobile = parseInt(layout.navbarHeightMobile);
  const navbarHeight = shouldUseMobileLayout(windowSize) ? mobile : normal;
  if (windowSize.height) return windowSize.height - navbarHeight;
}

export function getWindowHeightMinusNavbarHeight(windowSize: Size): number | undefined {
  if (windowSize.height != undefined) {
    const navbarHeight = shouldUseMobileLayout(windowSize)
      ? parseInt(layout.navbarHeightMobile)
      : parseInt(layout.navbarHeight)
    return windowSize.height - navbarHeight;
  }
}
