"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

interface RegisterData {
	username: string;
	email: string;
	password: string;
}

export async function registerUser(
	data: RegisterData,
): Promise<{ success: boolean; error?: string }> {
	try {
		// Check if username or email already exists
		const existingUser = await db.query.users.findFirst({
			where: or(eq(users.username, data.username), eq(users.email, data.email)),
		});

		if (existingUser) {
			if (existingUser.username === data.username) {
				return { success: false, error: "Username already taken" };
			}
			if (existingUser.email === data.email) {
				return { success: false, error: "Email already registered" };
			}
		}

		// Hash password
		const passwordHash = await bcrypt.hash(data.password, 10);

		// Create user
		await db.insert(users).values({
			username: data.username,
			email: data.email,
			passwordHash,
			role: "user", // Default role
		});

		return { success: true };
	} catch (error) {
		console.error("Error registering user:", error);
		return { success: false, error: "Failed to create account" };
	}
}
