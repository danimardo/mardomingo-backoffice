CREATE TRIGGER `credit_movements_no_update` BEFORE UPDATE ON `credit_movements` BEGIN SELECT RAISE(ABORT, 'credit_movements is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `credit_movements_no_delete` BEFORE DELETE ON `credit_movements` BEGIN SELECT RAISE(ABORT, 'credit_movements is append-only'); END;
