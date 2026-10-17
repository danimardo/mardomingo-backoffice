CREATE TABLE `billing_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`legal_name` text NOT NULL,
	`tax_id` text NOT NULL,
	`address` text NOT NULL,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`country` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "billing_profiles_kind_enum" CHECK("kind" IN ('individual', 'business')),
	CONSTRAINT "billing_profiles_country_length" CHECK(length("country") = 2)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`kind` text NOT NULL,
	`series` text NOT NULL,
	`number` text NOT NULL,
	`billing_snapshot` text,
	`amount_eur_cents` integer NOT NULL,
	`corrects_invoice_id` text,
	`issue_key` text NOT NULL,
	`provider` text NOT NULL,
	`provider_ref` text,
	`pdf_ref` text,
	`issued_at` integer NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`corrects_invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invoices_kind_enum" CHECK("kind" IN ('simplified', 'full', 'corrective')),
	CONSTRAINT "invoices_corrective_has_target" CHECK(("kind" = 'corrective') = ("corrects_invoice_id" IS NOT NULL)),
	CONSTRAINT "invoices_corrective_negative" CHECK(("kind" = 'corrective') = ("amount_eur_cents" < 0)),
	CONSTRAINT "invoices_full_has_snapshot" CHECK("kind" <> 'full' OR "billing_snapshot" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_series_number_uq` ON `invoices` (`series`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_issue_key_uq` ON `invoices` (`issue_key`);--> statement-breakpoint
CREATE INDEX `invoices_payment_idx` ON `invoices` (`payment_id`);