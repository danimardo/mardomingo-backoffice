CREATE TABLE `adjustment_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
