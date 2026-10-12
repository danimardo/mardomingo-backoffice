-- Tope de la operación de imagen: de 80 a 200 créditos (decisión del propietario, L08). Solo cambia la fila sembrada con el
-- valor anterior; una operación que el administrador haya retocado no se toca.
UPDATE app_operations
SET max_cost_micro = 200000000, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE key = 'image-generation' AND max_cost_micro = 80000000;
