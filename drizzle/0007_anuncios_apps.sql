CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`min_version` text,
	`max_version` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "announcements_level_enum" CHECK("level" IN ('info', 'warning', 'critical')),
	CONSTRAINT "announcements_active_bool" CHECK("active" IN (0, 1)),
	CONSTRAINT "announcements_window" CHECK("ends_at" IS NULL OR "ends_at" > "starts_at"),
	CONSTRAINT "announcements_message_not_empty" CHECK(length("message") > 0)
);
--> statement-breakpoint
CREATE INDEX `announcements_lookup_idx` ON `announcements` (`active`,`app_id`,`starts_at`);