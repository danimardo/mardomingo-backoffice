CREATE TABLE `credit_buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`initial_micro` integer NOT NULL,
	`remaining_micro` integer NOT NULL,
	`expires_at` integer,
	`payment_id` text,
	`simulated` integer DEFAULT false NOT NULL,
	`expiry_warning_sent_at` integer,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "credit_buckets_initial_positive" CHECK("initial_micro" > 0),
	CONSTRAINT "credit_buckets_remaining_range" CHECK("remaining_micro" BETWEEN 0 AND "initial_micro"),
	CONSTRAINT "credit_buckets_kind_enum" CHECK("kind" IN ('free', 'paid')),
	CONSTRAINT "credit_buckets_source_enum" CHECK("source" IN ('welcome', 'purchase', 'adjustment')),
	CONSTRAINT "credit_buckets_free_has_expiry" CHECK(("kind" = 'free') = ("expires_at" IS NOT NULL)),
	CONSTRAINT "credit_buckets_welcome_is_free" CHECK("source" <> 'welcome' OR "kind" = 'free'),
	CONSTRAINT "credit_buckets_purchase_has_payment" CHECK(("source" = 'purchase') = ("payment_id" IS NOT NULL)),
	CONSTRAINT "credit_buckets_purchase_is_paid" CHECK("source" <> 'purchase' OR "kind" = 'paid'),
	CONSTRAINT "credit_buckets_simulated_only_purchase" CHECK("simulated" = 0 OR "source" = 'purchase'),
	CONSTRAINT "credit_buckets_simulated_bool" CHECK("simulated" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_buckets_payment_unique` ON `credit_buckets` (`payment_id`) WHERE "payment_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `credit_buckets_welcome_unique` ON `credit_buckets` (`user_id`) WHERE "source" = 'welcome';--> statement-breakpoint
CREATE INDEX `credit_buckets_user_idx` ON `credit_buckets` (`user_id`,`kind`,`expires_at`,`created_at`) WHERE "remaining_micro" > 0;--> statement-breakpoint
CREATE INDEX `credit_buckets_expiry_idx` ON `credit_buckets` (`expires_at`) WHERE "kind" = 'free' AND "remaining_micro" > 0;--> statement-breakpoint
CREATE TABLE `credit_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`app_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`amount_micro` integer NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`expires_at` integer NOT NULL,
	`released_at` integer,
	`release_reason` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`operation_id`) REFERENCES `ai_operations`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "credit_holds_amount_positive" CHECK("amount_micro" > 0),
	CONSTRAINT "credit_holds_expiry_after_creation" CHECK("expires_at" > "created_at"),
	CONSTRAINT "credit_holds_release_pair" CHECK(("released_at" IS NULL) = ("release_reason" IS NULL)),
	CONSTRAINT "credit_holds_release_reason_enum" CHECK("release_reason" IN ('consumed', 'released', 'expired', 'interrupted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_holds_operation_unique` ON `credit_holds` (`operation_id`);--> statement-breakpoint
CREATE INDEX `credit_holds_user_idx` ON `credit_holds` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_holds_open_expiry_idx` ON `credit_holds` (`expires_at`) WHERE "released_at" IS NULL;--> statement-breakpoint
CREATE TABLE `credit_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_micro` integer NOT NULL,
	`bucket_id` text,
	`operation_id` text,
	`app_id` text,
	`payment_id` text,
	`admin_id` text,
	`admin_reason` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bucket_id`) REFERENCES `credit_buckets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operation_id`) REFERENCES `ai_operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`admin_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "credit_movements_amount_non_zero" CHECK("amount_micro" <> 0),
	CONSTRAINT "credit_movements_type_enum" CHECK("type" IN ('welcome', 'purchase', 'usage', 'adjustment', 'expiry', 'refund', 'chargeback', 'debt_settlement', 'forfeit')),
	CONSTRAINT "credit_movements_welcome_sign" CHECK("type" <> 'welcome' OR ("amount_micro" > 0 AND "bucket_id" IS NOT NULL)),
	CONSTRAINT "credit_movements_purchase_sign" CHECK("type" <> 'purchase' OR ("amount_micro" > 0 AND "bucket_id" IS NOT NULL AND "payment_id" IS NOT NULL)),
	CONSTRAINT "credit_movements_usage_sign" CHECK("type" <> 'usage' OR ("amount_micro" < 0 AND "operation_id" IS NOT NULL)),
	CONSTRAINT "credit_movements_adjustment_admin" CHECK("type" <> 'adjustment' OR ("bucket_id" IS NOT NULL AND "admin_reason" IS NOT NULL AND "admin_id" IS NOT NULL)),
	CONSTRAINT "credit_movements_expiry_sign" CHECK("type" <> 'expiry' OR ("amount_micro" < 0 AND "bucket_id" IS NOT NULL)),
	CONSTRAINT "credit_movements_refund_sign" CHECK("type" <> 'refund' OR ("amount_micro" < 0 AND "bucket_id" IS NOT NULL AND "payment_id" IS NOT NULL AND "admin_reason" IS NOT NULL)),
	CONSTRAINT "credit_movements_chargeback_sign" CHECK("type" <> 'chargeback' OR ("amount_micro" < 0 AND "payment_id" IS NOT NULL)),
	CONSTRAINT "credit_movements_settlement_shape" CHECK("type" <> 'debt_settlement' OR ("payment_id" IS NOT NULL OR "admin_id" IS NOT NULL)),
	CONSTRAINT "credit_movements_forfeit_sign" CHECK("type" <> 'forfeit' OR ("amount_micro" < 0 AND "bucket_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `credit_movements_user_idx` ON `credit_movements` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `credit_movements_operation_idx` ON `credit_movements` (`operation_id`);--> statement-breakpoint
CREATE INDEX `credit_movements_payment_idx` ON `credit_movements` (`payment_id`);--> statement-breakpoint
CREATE INDEX `credit_movements_bucket_idx` ON `credit_movements` (`bucket_id`);--> statement-breakpoint
CREATE INDEX `credit_movements_type_idx` ON `credit_movements` (`type`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_balances` (
	`user_id` text PRIMARY KEY NOT NULL,
	`debt_micro` integer DEFAULT 0 NOT NULL,
	`has_real_purchase` integer DEFAULT false NOT NULL,
	`low_balance_threshold_micro` integer,
	`low_balance_notified` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "user_balances_debt_non_negative" CHECK("debt_micro" >= 0),
	CONSTRAINT "user_balances_threshold_non_negative" CHECK("low_balance_threshold_micro" IS NULL OR "low_balance_threshold_micro" >= 0),
	CONSTRAINT "user_balances_real_purchase_bool" CHECK("has_real_purchase" IN (0, 1)),
	CONSTRAINT "user_balances_notified_bool" CHECK("low_balance_notified" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `welcome_grants` (
	`email_normalized_hash` text PRIMARY KEY NOT NULL,
	`granted_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
