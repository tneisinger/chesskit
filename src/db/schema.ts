import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, primaryKey, unique, index } from "drizzle-orm/sqlite-core";
import type { Chapter } from "@/types/lesson";
import type { GameEvaluation, PieceColor } from "@/types/chess";
import type { Score } from "@/utils/stockfish";

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
	chesscomUsername: text("chesscom_username"),
	lichessUsername: text("lichess_username"),
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

// User repertoire table (user-created lessons)
export const userRepertoire = sqliteTable("user_repertoire", {
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

// Games table (user's chess games)
export const games = sqliteTable("games", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	gameId: text("game_id").notNull(),
	pgn: text("pgn").notNull(),
	userColor: text("user_color", { enum: ["WHITE", "BLACK"] }).notNull(),
	result: text("result", { enum: ["1-0", "0-1", "1/2-1/2"] }),
	startTime: integer("start_time").notNull(),
	url: text("url"),
	timeControl: text("time_control"),
	whiteName: text("white_name"),
	whiteElo: integer("white_elo"),
	blackName: text("black_name"),
	blackElo: integer("black_elo"),
	website: text("website", { enum: ["chess.com", "lichess.org"] }),
	engineAnalysis: text("engine_analysis", { mode: "json" }).$type<GameEvaluation>(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
}, (table) => ({
	uniqueUserGame: unique().on(table.userId, table.gameId),
}));

// Flashcards table (spaced repetition learning)
export const flashcards = sqliteTable("flashcards", {
	id: integer("id").primaryKey({ autoIncrement: true }),

	// Relationships
	userId: integer("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	gameId: integer("game_id")
		.references(() => games.id, { onDelete: "cascade" }),

	// Chess data
	pgn: text("pgn").notNull(),
	positionIdx: integer("position_idx").notNull(),
	userColor: text("user_color", { enum: ["WHITE", "BLACK"] })
    .notNull()
    .$type<PieceColor>(),

	// Flashcard content
	bestLines: text("best_lines", { mode: "json" }).$type<{score: Score, lanLine: string}[]>(),

	// SuperMemo-2 algorithm fields
	repetitions: integer("repetitions").notNull().default(0),
	easinessFactor: integer("easiness_factor").notNull().default(2500), // 2.5 * 1000
	interval: integer("interval").notNull().default(0), // Days
	nextReviewDate: integer("next_review_date", { mode: "timestamp" }).notNull(),
	lastReviewedDate: integer("last_reviewed_date", { mode: "timestamp" }),

	// Timestamps
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
}, (table) => ({
	userReviewDateIdx: index("flashcards_user_review_date_idx")
		.on(table.userId, table.nextReviewDate),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;

export type UserRepertoire = typeof userRepertoire.$inferSelect;
export type InsertUserRepertoire = typeof userRepertoire.$inferInsert;

export type Game = typeof games.$inferSelect;
export type InsertGame = typeof games.$inferInsert;

export type Flashcard = typeof flashcards.$inferSelect;
export type InsertFlashcard = typeof flashcards.$inferInsert;
