'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import SvgIcon, { Svg } from '@/components/svgIcon';
import useWindowSize from '@/hooks/useWindowSize';

interface NavLink {
	href: string;
	label: string;
	requiresAuth?: boolean;
}

const publicNavLinks: NavLink[] = [
	{ href: '/', label: 'Home' },
	{ href: '/openings', label: 'Openings' },
];

const authenticatedNavLinks: NavLink[] = [
	{ href: '/', label: 'Home' },
	{ href: '/openings', label: 'Openings' },
	{ href: '/my-openings', label: 'My Openings', requiresAuth: true },
];

export default function Navigation() {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const pathname = usePathname();
	const windowSize = useWindowSize();
	const isMobile = windowSize.width ? windowSize.width <= 768 : false;
	const { data: session, status } = useSession();

	const isLoading = status === "loading";
	const isLoggedIn = !!session;
	const navLinks = isLoggedIn ? authenticatedNavLinks : publicNavLinks;

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

	const handleSignOut = async () => {
		await signOut({ callbackUrl: '/' });
	};

	return (
		<>
			{/* Top Navigation Bar */}
			<nav className="bg-background-page border-b border-foreground/10 sticky top-0 z-50">
				<div className={`flex items-center h-10 px-4 ${isMobile ? 'justify-center relative' : 'justify-between'}`}>
					{/* Left side - Mobile hamburger + brand */}
					<div className="flex items-center">
						{isMobile && (
							<button
								onClick={toggleMobileMenu}
								className="absolute left-4 p-2 hover:bg-foreground/10 rounded"
								aria-label="Toggle menu"
							>
								<SvgIcon styles={'invert-75'} svg={Svg.Hamburger} width={20} height={20} />
							</button>
						)}

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

					{/* Right side - Auth links (desktop only) */}
					{!isMobile && !isLoading && (
						<div className="flex items-center gap-2">
							{isLoggedIn ? (
								<>
									<span className="text-sm text-foreground/70 mr-2">
										{session.user?.username}
										{session.user?.role === 'admin' && (
											<span className="ml-2 px-2 py-0.5 bg-color-btn-primary rounded text-xs">
												Admin
											</span>
										)}
									</span>
									<button
										onClick={handleSignOut}
										className="px-4 py-1.5 rounded bg-background-page text-foreground/80 hover:bg-foreground/10 hover:text-foreground transition-colors"
									>
										Logout
									</button>
								</>
							) : (
								<>
									<Link
										href="/login"
										className="px-4 py-1.5 rounded bg-background-page text-foreground/80 hover:bg-foreground/10 hover:text-foreground transition-colors no-underline"
									>
										Login
									</Link>
									<Link
										href="/register"
										className="px-4 py-1.5 rounded bg-color-btn-primary text-foreground hover:bg-color-btn-primary-hover transition-colors no-underline"
									>
										Register
									</Link>
								</>
							)}
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

							{/* User info (if logged in) */}
							{isLoggedIn && (
								<div className="px-4 py-3 border-b border-foreground/20">
									<div className="text-sm text-foreground/70">Logged in as</div>
									<div className="font-semibold">
										{session.user?.username}
										{session.user?.role === 'admin' && (
											<span className="ml-2 px-2 py-0.5 bg-color-btn-primary rounded text-xs">
												Admin
											</span>
										)}
									</div>
								</div>
							)}

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

							{/* Auth buttons (mobile) */}
							{!isLoading && (
								<div className="mt-auto p-4 border-t border-foreground/20">
									{isLoggedIn ? (
										<button
											onClick={() => {
												closeMobileMenu();
												handleSignOut();
											}}
											className="w-full px-4 py-2 rounded bg-color-btn-danger text-foreground hover:bg-color-btn-danger-hover transition-colors"
										>
											Logout
										</button>
									) : (
										<div className="flex flex-col gap-2">
											<Link
												href="/login"
												onClick={closeMobileMenu}
												className="w-full px-4 py-2 rounded bg-background text-foreground/80 hover:bg-foreground/10 text-center no-underline"
											>
												Login
											</Link>
											<Link
												href="/register"
												onClick={closeMobileMenu}
												className="w-full px-4 py-2 rounded bg-color-btn-primary text-foreground hover:bg-color-btn-primary-hover text-center no-underline"
											>
												Register
											</Link>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</>
			)}
		</>
	);
}
