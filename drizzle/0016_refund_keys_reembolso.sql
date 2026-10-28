CREATE TABLE `refund_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "refund_keys_status_enum" CHECK("status" IN ('claimed', 'applied'))
);
--> statement-breakpoint
CREATE INDEX `refund_keys_payment_idx` ON `refund_keys` (`payment_id`);