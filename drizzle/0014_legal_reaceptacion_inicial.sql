-- Versión inicial del sistema (seed, O1): desde ahora exige reaceptación (BE-FR-70 CA1). El seed solo inserta si la fila no existe,
-- así que en las bases ya sembradas esta migración lo aplica. Solo toca filas del sistema (created_by nulo) con la versión provisional.
UPDATE `legal_documents`
SET `requires_reacceptance` = 1
WHERE `version` = '2026-10-11' AND `created_by` IS NULL;
