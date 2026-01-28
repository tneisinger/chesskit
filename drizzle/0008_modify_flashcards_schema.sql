-- Remove question, answer, and notes columns from flashcards table
ALTER TABLE `flashcards` DROP COLUMN `question`;--> statement-breakpoint
ALTER TABLE `flashcards` DROP COLUMN `answer`;--> statement-breakpoint
ALTER TABLE `flashcards` DROP COLUMN `notes`;--> statement-breakpoint
-- Add bestLines column
ALTER TABLE `flashcards` ADD `best_lines` text;
