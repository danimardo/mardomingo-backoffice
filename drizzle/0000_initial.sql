CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`password` text,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_provider_account_unique` ON `account` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`scope` text NOT NULL,
	`ip` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL,
	PRIMARY KEY(`scope`, `ip`),
	CONSTRAINT "auth_rate_limits_scope_enum" CHECK("scope" IN ('login', 'signup', 'resend_verification', 'password_reset', 'email_change')),
	CONSTRAINT "auth_rate_limits_count_non_negative" CHECK("count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `auth_rate_limits_window_idx` ON `auth_rate_limits` (`window_start`);--> statement-breakpoint
CREATE TABLE `disposable_domains` (
	`domain` text PRIMARY KEY NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`email_normalized_hash` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL,
	`locked_until` integer,
	CONSTRAINT "login_attempts_failures_non_negative" CHECK("failures" >= 0)
);
--> statement-breakpoint
CREATE INDEX `login_attempts_window_idx` ON `login_attempts` (`window_start`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`impersonated_by` text,
	`app_id` text,
	`device_name` text,
	`app_version` text,
	`last_used_at` integer,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expires_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'user' NOT NULL,
	`banned` integer DEFAULT false NOT NULL,
	`ban_reason` text,
	`ban_expires` integer,
	`email_normalized` text,
	`signup_app_id` text,
	`signup_ip` text,
	`last_activity_at` integer,
	`inactivity_warned_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`signup_app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "user_role_not_empty" CHECK("role" <> ''),
	CONSTRAINT "user_deleted_has_no_email_normalized" CHECK("deleted_at" IS NULL OR "email_normalized" IS NULL),
	CONSTRAINT "user_email_verified_bool" CHECK("email_verified" IN (0, 1)),
	CONSTRAINT "user_banned_bool" CHECK("banned" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `user_email_normalized_idx` ON `user` (`email_normalized`);--> statement-breakpoint
CREATE INDEX `user_signup_ip_created_idx` ON `user` (`signup_ip`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_unverified_purge_idx` ON `user` (`email_verified`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_signup_app_created_idx` ON `user` (`signup_app_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_inactivity_idx` ON `user` (`last_activity_at`) WHERE "deleted_at" IS NULL AND "email_verified" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `one_admin` ON `user` ((1)) WHERE ',' || "role" || ',' LIKE '%,admin,%' AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE `user_app_activity` (
	`user_id` text NOT NULL,
	`app_id` text NOT NULL,
	`first_login_at` integer NOT NULL,
	`last_used_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `app_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `user_app_activity_app_idx` ON `user_app_activity` (`app_id`,`first_login_at`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `verification_expires_idx` ON `verification` (`expires_at`);--> statement-breakpoint
CREATE TABLE `ai_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`app_id` text NOT NULL,
	`session_id` text,
	`app_operation_id` text NOT NULL,
	`prompt_template_id` text,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`idempotency_key` text,
	`provider` text,
	`model` text,
	`used_fallback` integer DEFAULT false NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`audio_ms` integer,
	`cost_micro_usd` integer DEFAULT 0 NOT NULL,
	`cost_estimated` integer DEFAULT false NOT NULL,
	`fx_rate_id` text,
	`hold_micro` integer,
	`charged_micro` integer DEFAULT 0 NOT NULL,
	`absorbed_micro` integer DEFAULT 0 NOT NULL,
	`absorbed_reason` text,
	`truncated` integer DEFAULT false NOT NULL,
	`flagged` integer DEFAULT false NOT NULL,
	`duration_ms` integer,
	`app_version` text,
	`error_code` text,
	`provider_generation_id` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`app_operation_id`) REFERENCES `app_operations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`prompt_template_id`) REFERENCES `prompt_templates`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`fx_rate_id`) REFERENCES `fx_rates`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ai_operations_status_enum" CHECK("status" IN ('in_progress', 'ok', 'provider_error', 'cancelled', 'undelivered', 'interrupted', 'rejected')),
	CONSTRAINT "ai_operations_provider_enum" CHECK("provider" IN ('mistral', 'openrouter')),
	CONSTRAINT "ai_operations_absorbed_reason_enum" CHECK("absorbed_reason" IN ('undelivered_replay', 'debt_cap')),
	CONSTRAINT "ai_operations_charged_non_negative" CHECK("charged_micro" >= 0),
	CONSTRAINT "ai_operations_absorbed_non_negative" CHECK("absorbed_micro" >= 0),
	CONSTRAINT "ai_operations_hold_positive" CHECK("hold_micro" IS NULL OR "hold_micro" > 0),
	CONSTRAINT "ai_operations_absorbed_reason_matches_amount" CHECK(("absorbed_micro" = 0) = ("absorbed_reason" IS NULL)),
	CONSTRAINT "ai_operations_unbilled_statuses" CHECK("status" NOT IN ('in_progress', 'rejected', 'interrupted', 'cancelled', 'provider_error') OR "charged_micro" = 0),
	CONSTRAINT "ai_operations_rejected_has_no_hold_or_provider" CHECK("status" <> 'rejected' OR ("hold_micro" IS NULL AND "provider" IS NULL)),
	CONSTRAINT "ai_operations_in_progress_has_no_completion" CHECK(("status" = 'in_progress') = ("completed_at" IS NULL)),
	CONSTRAINT "ai_operations_used_fallback_bool" CHECK("used_fallback" IN (0, 1)),
	CONSTRAINT "ai_operations_cost_estimated_bool" CHECK("cost_estimated" IN (0, 1)),
	CONSTRAINT "ai_operations_truncated_bool" CHECK("truncated" IN (0, 1)),
	CONSTRAINT "ai_operations_flagged_bool" CHECK("flagged" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_operations_inflight_idempotency_unique` ON `ai_operations` (`user_id`,`idempotency_key`) WHERE "idempotency_key" IS NOT NULL AND "status" = 'in_progress';--> statement-breakpoint
CREATE INDEX `ai_operations_idempotency_window_idx` ON `ai_operations` (`user_id`,`idempotency_key`,`created_at`) WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `ai_operations_user_created_idx` ON `ai_operations` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_operations_app_created_idx` ON `ai_operations` (`app_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_operations_created_idx` ON `ai_operations` (`created_at`);--> statement-breakpoint
CREATE INDEX `ai_operations_in_progress_idx` ON `ai_operations` (`status`) WHERE "status" = 'in_progress';--> statement-breakpoint
CREATE INDEX `ai_operations_flagged_idx` ON `ai_operations` (`user_id`,`created_at`) WHERE "flagged" = 1;--> statement-breakpoint
CREATE TABLE `app_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`mode` text DEFAULT 'libre' NOT NULL,
	`model` text,
	`fallback_models` text DEFAULT '[]' NOT NULL,
	`preferred_provider` text,
	`margin_override_ppm` integer,
	`temperature_milli` integer DEFAULT 700 NOT NULL,
	`max_output_tokens` integer,
	`max_cost_micro` integer NOT NULL,
	`estimated_max_cost_micro_usd` integer,
	`timeout_ms` integer NOT NULL,
	`capabilities` text NOT NULL,
	`limits` text DEFAULT '{}' NOT NULL,
	`transcription_config` text,
	`group_label` text,
	`active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "app_operations_kind_enum" CHECK("kind" IN ('chat', 'transcription', 'image')),
	CONSTRAINT "app_operations_mode_enum" CHECK("mode" IN ('libre', 'plantilla')),
	CONSTRAINT "app_operations_active_bool" CHECK("active" IN (0, 1)),
	CONSTRAINT "app_operations_max_cost_positive" CHECK("max_cost_micro" > 0),
	CONSTRAINT "app_operations_margin_min" CHECK("margin_override_ppm" IS NULL OR "margin_override_ppm" >= 1000000),
	CONSTRAINT "app_operations_temperature_range" CHECK("temperature_milli" BETWEEN 0 AND 2000),
	CONSTRAINT "app_operations_timeout_positive" CHECK("timeout_ms" > 0),
	CONSTRAINT "app_operations_transcription_config_matches_kind" CHECK(("kind" = 'transcription') = ("transcription_config" IS NOT NULL)),
	CONSTRAINT "app_operations_active_needs_model" CHECK("active" = 0 OR "kind" = 'transcription' OR "model" IS NOT NULL),
	CONSTRAINT "app_operations_chat_needs_max_output" CHECK("kind" <> 'chat' OR "max_output_tokens" > 0),
	CONSTRAINT "app_operations_estimated_cost_non_negative" CHECK("estimated_max_cost_micro_usd" IS NULL OR "estimated_max_cost_micro_usd" >= 0),
	CONSTRAINT "app_operations_fallback_models_json" CHECK(json_valid("fallback_models")),
	CONSTRAINT "app_operations_capabilities_json" CHECK(json_valid("capabilities")),
	CONSTRAINT "app_operations_limits_json" CHECK(json_valid("limits"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_operations_app_key_unique` ON `app_operations` (`app_id`,`key`);--> statement-breakpoint
CREATE INDEX `app_operations_group_idx` ON `app_operations` (`app_id`,`group_label`);--> statement-breakpoint
CREATE TABLE `apps` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`client_types` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`links` text NOT NULL,
	`min_app_version` text,
	`recommended_app_version` text,
	`enforce_version` integer DEFAULT false NOT NULL,
	`maintenance_active` integer DEFAULT false NOT NULL,
	`maintenance_message` text DEFAULT '' NOT NULL,
	`allowed_origins` text DEFAULT '[]' NOT NULL,
	`post_verify_text` text,
	`settings_overrides` text DEFAULT '{}' NOT NULL,
	`sync_schema` text NOT NULL,
	`support_email` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT "apps_slug_format" CHECK("slug" GLOB '[a-z]*' AND "slug" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "apps_status_enum" CHECK("status" IN ('active', 'disabled')),
	CONSTRAINT "apps_enforce_version_bool" CHECK("enforce_version" IN (0, 1)),
	CONSTRAINT "apps_maintenance_bool" CHECK("maintenance_active" IN (0, 1)),
	CONSTRAINT "apps_enforce_version_needs_min" CHECK("enforce_version" = 0 OR "min_app_version" IS NOT NULL),
	CONSTRAINT "apps_client_types_json" CHECK(json_valid("client_types")),
	CONSTRAINT "apps_links_json" CHECK(json_valid("links")),
	CONSTRAINT "apps_allowed_origins_json" CHECK(json_valid("allowed_origins")),
	CONSTRAINT "apps_settings_overrides_json" CHECK(json_valid("settings_overrides")),
	CONSTRAINT "apps_sync_schema_json" CHECK(json_valid("sync_schema"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_slug_unique` ON `apps` (`slug`);--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`version` integer NOT NULL,
	`messages` text NOT NULL,
	`variables` text DEFAULT '[]' NOT NULL,
	`response_format` text,
	`tools` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`operation_id`) REFERENCES `app_operations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "prompt_templates_version_min" CHECK("version" >= 1),
	CONSTRAINT "prompt_templates_messages_json" CHECK(json_valid("messages")),
	CONSTRAINT "prompt_templates_variables_json" CHECK(json_valid("variables"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_templates_operation_version_unique` ON `prompt_templates` (`operation_id`,`version`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT "settings_value_json" CHECK(json_valid("value"))
);
--> statement-breakpoint
CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`before` text,
	`after` text,
	`reason` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "admin_audit_before_json" CHECK("before" IS NULL OR json_valid("before")),
	CONSTRAINT "admin_audit_after_json" CHECK("after" IS NULL OR json_valid("after"))
);
--> statement-breakpoint
CREATE INDEX `admin_audit_entity_idx` ON `admin_audit` (`entity`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_audit_created_idx` ON `admin_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `legal_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`version` text NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`requires_reacceptance` integer DEFAULT false NOT NULL,
	`published_at` integer NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "legal_documents_document_enum" CHECK("document" IN ('terms', 'privacy', 'cookies', 'aup', 'withdrawal_waiver')),
	CONSTRAINT "legal_documents_reacceptance_bool" CHECK("requires_reacceptance" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_documents_document_version_unique` ON `legal_documents` (`document`,`version`);--> statement-breakpoint
CREATE INDEX `legal_documents_published_idx` ON `legal_documents` (`document`,`published_at`);--> statement-breakpoint
CREATE TABLE `terms_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`document` text NOT NULL,
	`version` text NOT NULL,
	`accepted_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`ip` text,
	`app_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "terms_acceptances_document_enum" CHECK("document" IN ('terms', 'privacy', 'cookies', 'aup', 'withdrawal_waiver', 'age_declaration'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terms_acceptances_user_document_version_unique` ON `terms_acceptances` (`user_id`,`document`,`version`) WHERE "document" <> 'withdrawal_waiver';--> statement-breakpoint
CREATE INDEX `terms_acceptances_pending_idx` ON `terms_acceptances` (`user_id`,`document`,`accepted_at`);--> statement-breakpoint
CREATE TABLE `packs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price_eur_cents` integer NOT NULL,
	`bonus_ppm` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	CONSTRAINT "packs_price_positive" CHECK("price_eur_cents" > 0),
	CONSTRAINT "packs_bonus_non_negative" CHECK("bonus_ppm" >= 0),
	CONSTRAINT "packs_active_bool" CHECK("active" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `packs_active_order_idx` ON `packs` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pack_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_ref` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount_eur_cents` integer NOT NULL,
	`base_eur_cents` integer NOT NULL,
	`vat_eur_cents` integer NOT NULL,
	`vat_rate_ppm` integer NOT NULL,
	`country` text NOT NULL,
	`credits_micro` integer NOT NULL,
	`wants_full_invoice` integer DEFAULT false NOT NULL,
	`simulated` integer NOT NULL,
	`withdrawal_acceptance_id` text NOT NULL,
	`refunded_eur_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`completed_at` integer,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`pack_id`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`withdrawal_acceptance_id`) REFERENCES `terms_acceptances`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payments_provider_enum" CHECK("provider" IN ('simulated', 'stripe')),
	CONSTRAINT "payments_status_enum" CHECK("status" IN ('pending', 'completed', 'refunded', 'partially_refunded', 'chargeback')),
	CONSTRAINT "payments_amount_positive" CHECK("amount_eur_cents" > 0),
	CONSTRAINT "payments_credits_positive" CHECK("credits_micro" > 0),
	CONSTRAINT "payments_simulated_matches_provider" CHECK(("provider" = 'simulated') = ("simulated" = 1)),
	CONSTRAINT "payments_pending_has_no_completion" CHECK(("status" = 'pending') = ("completed_at" IS NULL)),
	CONSTRAINT "payments_refund_range" CHECK("refunded_eur_cents" BETWEEN 0 AND "amount_eur_cents"),
	CONSTRAINT "payments_vat_adds_up" CHECK("base_eur_cents" + "vat_eur_cents" = "amount_eur_cents"),
	CONSTRAINT "payments_country_iso2" CHECK(length("country") = 2),
	CONSTRAINT "payments_wants_invoice_bool" CHECK("wants_full_invoice" IN (0, 1)),
	CONSTRAINT "payments_simulated_bool" CHECK("simulated" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_ref_unique` ON `payments` (`provider_ref`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_user_attempt_unique` ON `payments` (`user_id`,`attempt_id`);--> statement-breakpoint
CREATE INDEX `payments_user_created_idx` ON `payments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `payments_status_completed_idx` ON `payments` (`status`,`completed_at`);--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`usd_eur_ppm` integer NOT NULL,
	`source` text NOT NULL,
	`ecb_rate_ppm` integer,
	`ecb_date` text,
	`buffer_ppm` integer,
	`effective_from` integer NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fx_rates_usd_eur_positive" CHECK("usd_eur_ppm" > 0),
	CONSTRAINT "fx_rates_source_enum" CHECK("source" IN ('ecb', 'manual')),
	CONSTRAINT "fx_rates_ecb_fields" CHECK("source" = 'manual' OR ("ecb_rate_ppm" > 0 AND "ecb_date" IS NOT NULL AND "buffer_ppm" IS NOT NULL)),
	CONSTRAINT "fx_rates_ecb_date_format" CHECK("ecb_date" IS NULL OR "ecb_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "fx_rates_manual_has_author" CHECK("source" = 'ecb' OR "created_by" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `fx_rates_effective_idx` ON `fx_rates` (`effective_from`);