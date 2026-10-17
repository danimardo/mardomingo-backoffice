-- Inmutabilidad de las facturas (BE-FR-75, data-model 4.6; T224). Una factura emitida no se modifica ni se borra: una
-- corrección es una factura rectificativa nueva (kind = 'corrective'). Mismo patrón que admin_audit y credit_movements.
CREATE TRIGGER `invoices_no_update` BEFORE UPDATE ON `invoices` BEGIN SELECT RAISE(ABORT, 'invoices is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `invoices_no_delete` BEFORE DELETE ON `invoices` BEGIN SELECT RAISE(ABORT, 'invoices is append-only'); END;
