ALTER TABLE `example_todos` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `example_todos` ADD `completed_at` integer;