CREATE TABLE `app_defaults` (
	`app_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "app_defaults_data_json" CHECK(json_valid("data"))
);
--> statement-breakpoint
CREATE TABLE `sync_documents` (
	`user_id` text NOT NULL,
	`app_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	PRIMARY KEY(`user_id`, `app_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sync_documents_revision_min" CHECK("revision" >= 1),
	CONSTRAINT "sync_documents_data_json" CHECK(json_valid("data"))
);
--> statement-breakpoint
CREATE INDEX `sync_documents_app_idx` ON `sync_documents` (`app_id`);