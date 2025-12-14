import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [
		Credentials({
			name: "credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
				rememberMe: { label: "Remember Me", type: "checkbox" },
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					return null;
				}

				const user = await db.query.users.findFirst({
					where: eq(users.email, credentials.email as string),
				});

				if (!user || !user.passwordHash) {
					return null;
				}

				const isValidPassword = await bcrypt.compare(
					credentials.password as string,
					user.passwordHash,
				);

				if (!isValidPassword) {
					return null;
				}

				// Update last login
				await db
					.update(users)
					.set({ lastLogin: new Date() })
					.where(eq(users.id, user.id));

				return {
					id: user.id.toString(),
					email: user.email,
					name: user.username,
					role: user.role,
					username: user.username,
				};
			},
		}),
	],
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days (remember me)
	},
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id as string;
				token.role = user.role as "user" | "admin";
				token.username = user.username as string;
			}
			return token;
		},
		async session({ session, token }) {
			if (token) {
				session.user.id = token.id;
				session.user.role = token.role;
				session.user.username = token.username;
			}
			return session;
		},
	},
	pages: {
		signIn: "/login",
	},
});

// Helper to get session with type safety
export async function getSession() {
	return await auth();
}

// Helper to check if user is admin
export async function isAdmin() {
	const session = await auth();
	return session?.user?.role === "admin";
}
