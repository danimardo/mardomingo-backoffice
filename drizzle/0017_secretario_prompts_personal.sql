-- D14 (= R14), C-05: `prompts` de Secretario es una categoría personal (BE-FR-42 CA3). El seed solo inserta si la fila no
-- existe, así que en las bases ya sembradas esta migración lo aplica. Solo toca la fila con `prompts` en `block` y sin la
-- clave `personal`: un esquema que el administrador haya cambiado no se pisa. `updated_at` (ms) invalida la caché de `sync`.
-- Se despliega después del PR #47: la imagen anterior rechaza la clave `personal` (C-07, docs/operaciones/migraciones.md).
UPDATE `apps`
SET `sync_schema` = json_set(`sync_schema`, '$.categories.prompts.personal', json('true')),
    `updated_at` = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE `slug` = 'secretario'
  AND json_extract(`sync_schema`, '$.categories.prompts.strategy') = 'block'
  AND json_extract(`sync_schema`, '$.categories.prompts.personal') IS NULL;
