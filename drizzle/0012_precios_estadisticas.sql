CREATE TABLE `price_references` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`typical_micro` integer,
	`source` text,
	`sample_size` integer DEFAULT 0 NOT NULL,
	`manual_typical_micro` integer,
	`computed_at` integer,
	FOREIGN KEY (`operation_id`) REFERENCES `app_operations`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "price_references_source_pair" CHECK(("typical_micro" IS NULL) = ("source" IS NULL)),
	CONSTRAINT "price_references_source_enum" CHECK("source" IN ('auto', 'manual')),
	CONSTRAINT "price_references_typical_non_negative" CHECK("typical_micro" IS NULL OR "typical_micro" >= 0),
	CONSTRAINT "price_references_manual_non_negative" CHECK("manual_typical_micro" IS NULL OR "manual_typical_micro" >= 0),
	CONSTRAINT "price_references_sample_non_negative" CHECK("sample_size" >= 0)
);
--> statement-breakpoint
CREATE TABLE `release_downloads` (
	`app_id` text NOT NULL,
	`day` text NOT NULL,
	`cumulative_downloads` integer NOT NULL,
	`downloads` integer,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`app_id`, `day`),
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "release_downloads_day_format" CHECK("day" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "release_downloads_cumulative_non_negative" CHECK("cumulative_downloads" >= 0),
	CONSTRAINT "release_downloads_downloads_non_negative" CHECK("downloads" IS NULL OR "downloads" >= 0)
);
