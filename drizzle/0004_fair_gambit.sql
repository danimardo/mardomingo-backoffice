CREATE TABLE `alerts_state` (
	`key` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`last_sent_at` integer,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT "alerts_state_active_bool" CHECK("active" IN (0, 1)),
	CONSTRAINT "alerts_state_key_not_empty" CHECK(length("key") > 0)
);
--> statement-breakpoint
CREATE INDEX `alerts_state_updated_idx` ON `alerts_state` (`updated_at`);