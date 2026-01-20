CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`game_id` text NOT NULL,
	`pgn` text NOT NULL,
	`user_color` text NOT NULL,
	`result` text,
	`start_time` integer NOT NULL,
	`url` text,
	`time_control` text,
	`white_name` text,
	`white_elo` integer,
	`black_name` text,
	`black_elo` integer,
	`website` text,
	`engine_analysis` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `games_user_id_game_id_unique` ON `games` (`user_id`, `game_id`);
