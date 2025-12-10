import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Chapter } from "@/types/lesson";

export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	username: text("username").notNull().unique(),
	email: text("email").unique(),
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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;
