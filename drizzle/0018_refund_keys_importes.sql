-- C-13 (T405): importe y total devuelto tras el reembolso en `refund_keys`, para que el reenvío no tome el importe del
-- cliente. Las claves existentes quedan con ambas columnas nulas (el reenvío no reintenta su rectificativa).
-- Generada con drizzle-kit; corregido a mano el INSERT, que copiaba de la tabla antigua las dos columnas nuevas (no existen).
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_refund_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`status` text NOT NULL,
	`amount_eur_cents` integer,
	`refunded_after_eur_cents` integer,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "refund_keys_status_enum" CHECK("status" IN ('claimed', 'applied')),
	CONSTRAINT "refund_keys_amounts_together" CHECK(("amount_eur_cents" IS NULL) = ("refunded_after_eur_cents" IS NULL)),
	CONSTRAINT "refund_keys_amounts_range" CHECK("amount_eur_cents" >= 0 AND "refunded_after_eur_cents" >= "amount_eur_cents")
);
--> statement-breakpoint
INSERT INTO `__new_refund_keys`("key", "payment_id", "status", "created_at") SELECT "key", "payment_id", "status", "created_at" FROM `refund_keys`;--> statement-breakpoint
DROP TABLE `refund_keys`;--> statement-breakpoint
ALTER TABLE `__new_refund_keys` RENAME TO `refund_keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `refund_keys_payment_idx` ON `refund_keys` (`payment_id`);
