import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
