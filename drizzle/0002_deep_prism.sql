PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_example_todos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_example_todos`("id", "title", "created_at") SELECT "id", "title", "created_at" FROM `example_todos`;--> statement-breakpoint
DROP TABLE `example_todos`;--> statement-breakpoint
ALTER TABLE `__new_example_todos` RENAME TO `example_todos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `example_todos_created_at_idx` ON `example_todos` (`created_at`);