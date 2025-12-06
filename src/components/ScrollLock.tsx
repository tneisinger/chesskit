'use client';

import { useEffect, ReactNode } from 'react';

interface ScrollLockProps {
	children: ReactNode;
}

/**
 * Wrapper component that locks document scrolling by applying a class to the html element.
 * Use this component to wrap page content that should not scroll.
 *
 * Example:
 * ```tsx
 * <ScrollLock>
 *   <YourPageContent />
 * </ScrollLock>
 * ```
 */
export function ScrollLock({ children }: ScrollLockProps) {
	useEffect(() => {
		const htmlElement = document.documentElement;
		htmlElement.classList.add('scroll-lock');

		return () => {
			htmlElement.classList.remove('scroll-lock');
		};
	}, []);

	return <>{children}</>;
}
