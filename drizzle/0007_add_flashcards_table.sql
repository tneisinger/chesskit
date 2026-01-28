CREATE TABLE `flashcards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`game_id` integer,
	`fen` text NOT NULL,
	`previous_fen` text,
	`move_to_play` text,
	`side_to_move` text NOT NULL,
	`opponent_move` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`notes` text,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`easiness_factor` integer DEFAULT 2500 NOT NULL,
	`interval` integer DEFAULT 0 NOT NULL,
	`next_review_date` integer NOT NULL,
	`last_reviewed_date` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `flashcards_user_review_date_idx` ON `flashcards` (`user_id`,`next_review_date`);--> statement-breakpoint
CREATE INDEX `flashcards_user_fen_idx` ON `flashcards` (`user_id`,`fen`);
