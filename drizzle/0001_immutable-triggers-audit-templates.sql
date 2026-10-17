CREATE TRIGGER `admin_audit_no_update` BEFORE UPDATE ON `admin_audit` BEGIN SELECT RAISE(ABORT, 'admin_audit is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `admin_audit_no_delete` BEFORE DELETE ON `admin_audit` BEGIN SELECT RAISE(ABORT, 'admin_audit is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `prompt_templates_no_update` BEFORE UPDATE ON `prompt_templates` BEGIN SELECT RAISE(ABORT, 'prompt_templates is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `prompt_templates_no_delete` BEFORE DELETE ON `prompt_templates` BEGIN SELECT RAISE(ABORT, 'prompt_templates is append-only'); END;
