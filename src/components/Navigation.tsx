'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SvgIcon, { Svg } from '@/components/svgIcon';
import useWindowSize from '@/hooks/useWindowSize';

interface NavLink {
	href: string;
	label: string;
}

const navLinks: NavLink[] = [
	{ href: '/', label: 'Home' },
	{ href: '/openings', label: 'Openings' },
];

export default function Navigation() {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const pathname = usePathname();
	const windowSize = useWindowSize();
	const isMobile = windowSize.width ? windowSize.width <= 768 : false;

	const toggleMobileMenu = () => {
		setIsMobileMenuOpen(!isMobileMenuOpen);
	};

	const closeMobileMenu = () => {
		setIsMobileMenuOpen(false);
	};

	const isActiveLink = (href: string) => {
		if (href === '/') {
			return pathname === '/';
		}
		return pathname?.startsWith(href);
	};

	return (
		<>
			{/* Top Navigation Bar */}
			<nav className="bg-background-page border-b border-foreground/10 sticky top-0 z-50">
				<div className={`flex items-center h-10 px-4 ${isMobile ? 'justify-center relative' : ''}`}>
					{/* Mobile Hamburger Button */}
					{isMobile && (
						<button
							onClick={toggleMobileMenu}
							className="absolute left-4 p-2 hover:bg-foreground/10 rounded"
							aria-label="Toggle menu"
						>
							<SvgIcon styles={'invert-75'} svg={Svg.Hamburger} width={20} height={20} />
						</button>
					)}

					{/* Brand/Logo */}
					<Link href="/" className="text-2xl font-bold text-foreground hover:text-foreground/80 no-underline">
						chesskit.io
					</Link>

					{/* Desktop Navigation Links */}
					{!isMobile && (
						<div className="flex items-center gap-1 ml-8">
							{navLinks.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									className={`px-4 rounded transition-colors no-underline ${
										isActiveLink(link.href)
											? 'bg-btn-primary text-foreground font-semibold'
											: 'text-foreground/80 hover:bg-foreground/10 hover:text-foreground'
									}`}
								>
									{link.label}
								</Link>
							))}
						</div>
					)}
				</div>
			</nav>

			{/* Mobile Side Drawer */}
			{isMobile && (
				<>
					{/* Overlay */}
					{isMobileMenuOpen && (
						<div
							className="fixed inset-0 bg-black/50 z-40"
							onClick={closeMobileMenu}
						/>
					)}

					{/* Drawer */}
					<div
						className={`fixed top-0 left-0 h-full w-64 bg-background-page border-r border-foreground/20 z-50 transform transition-transform duration-300 ease-in-out ${
							isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
						}`}
					>
						<div className="flex flex-col h-full">
							{/* Drawer Header */}
							<div className="flex items-center justify-between h-14 px-4 border-b border-foreground/20">
								<span className="text-xl font-bold">Menu</span>
								<button
									onClick={closeMobileMenu}
									className="p-2 hover:bg-foreground/10 rounded"
									aria-label="Close menu"
								>
									<svg
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<line x1="18" y1="6" x2="6" y2="18" />
										<line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</button>
							</div>

							{/* Drawer Links */}
							<div className="flex flex-col p-2">
								{navLinks.map((link) => (
									<Link
										key={link.href}
										href={link.href}
										onClick={closeMobileMenu}
										className={`px-4 py-3 rounded transition-colors no-underline ${
											isActiveLink(link.href)
												? 'bg-btn-primary text-foreground font-semibold'
												: 'text-foreground/80 hover:bg-foreground/10 hover:text-foreground'
										}`}
									>
										{link.label}
									</Link>
								))}
							</div>
						</div>
					</div>
				</>
			)}
		</>
	);
}
