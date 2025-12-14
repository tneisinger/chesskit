import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
import type { Chapter } from "@/types/lesson";

export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	username: text("username").notNull().unique(),
	email: text("email").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	lastLogin: integer("last_login", { mode: "timestamp" }),
	preferences: text("preferences", { mode: "json" }).$type<{
		darkMode?: boolean;
		soundEnabled?: boolean;
		boardTheme?: string;
	}>(),
});

export const lessons = sqliteTable("lessons", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	title: text("title").notNull(),
	userColor: text("user_color", { enum: ["WHITE", "BLACK"] }).notNull(),
	chapters: text("chapters", { mode: "json" })
		.notNull()
		.$type<Chapter[]>(),
	displayLine: text("display_line", { mode: "json" }).$type<string[]>(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// NextAuth adapter tables
export const accounts = sqliteTable("accounts", {
	userId: integer("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	provider: text("provider").notNull(),
	providerAccountId: text("provider_account_id").notNull(),
	refresh_token: text("refresh_token"),
	access_token: text("access_token"),
	expires_at: integer("expires_at"),
	token_type: text("token_type"),
	scope: text("scope"),
	id_token: text("id_token"),
	session_state: text("session_state"),
}, (account) => ({
	compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}));

export const sessions = sqliteTable("sessions", {
	sessionToken: text("session_token").notNull().primaryKey(),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
	identifier: text("identifier").notNull(),
	token: text("token").notNull(),
	expires: integer("expires", { mode: "timestamp" }).notNull(),
}, (vt) => ({
	compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
}));

// User-created lessons table
export const userLessons = sqliteTable("user_lessons", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	userColor: text("user_color", { enum: ["WHITE", "BLACK"] }).notNull(),
	chapters: text("chapters", { mode: "json" })
		.notNull()
		.$type<Chapter[]>(),
	displayLine: text("display_line", { mode: "json" }).$type<string[]>(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;

export type UserLesson = typeof userLessons.$inferSelect;
export type InsertUserLesson = typeof userLessons.$inferInsert;
