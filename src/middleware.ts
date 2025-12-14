import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
	const { pathname } = req.nextUrl;
	const isLoggedIn = !!req.auth;

	// Public routes that don't require authentication
	const publicRoutes = [
		"/",
		"/login",
		"/register",
		"/openings",
		"/stockfish",
		"/stockfish-test",
		"/new",
	];

	// Check if current path is a public route or starts with a public route
	const isPublicRoute =
		publicRoutes.includes(pathname) ||
		publicRoutes.some(
			(route) =>
				route !== "/" && pathname.startsWith(route) && !pathname.includes("/edit"),
		);

	// Allow public routes
	if (isPublicRoute && !pathname.includes("/create") && !pathname.includes("/edit")) {
		return NextResponse.next();
	}

	// Protected routes - require authentication
	if (!isLoggedIn) {
		const loginUrl = new URL("/login", req.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
});

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
