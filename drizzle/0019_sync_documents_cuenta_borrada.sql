-- C-43 (T435): `sync_documents` no admite filas de una cuenta borrada (BE-FR-07 CA1; RGPD, art. 17). Una petición de `/sync`
-- que pasó la sesión antes de que se confirmara el borrado ya no puede sembrar ni sobrescribir el documento. Cuenta borrada:
-- la fila de `user` con `deleted_at` no nulo (la anonimiza `accounts.anonymizeUser` en la transacción de
-- `privacy.deleteAccount`, a petición o por inactividad; la fila no se borra nunca, la FK es `RESTRICT`). Una cuenta que no
-- existe ya la rechaza la FK, y un bloqueo (`banned`) no es un borrado. El `DELETE` sigue permitido: lo hace el propio borrado.
-- Generada con drizzle-kit (`--custom`); los dos triggers se escriben a mano, porque Drizzle no los declara (data-model 1.5).
CREATE TRIGGER `sync_documents_deleted_user_no_insert` BEFORE INSERT ON `sync_documents`
WHEN (SELECT `deleted_at` FROM `user` WHERE `id` = NEW.`user_id`) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'sync_documents_user_deleted'); END;--> statement-breakpoint
CREATE TRIGGER `sync_documents_deleted_user_no_update` BEFORE UPDATE ON `sync_documents`
WHEN (SELECT `deleted_at` FROM `user` WHERE `id` = NEW.`user_id`) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'sync_documents_user_deleted'); END;
