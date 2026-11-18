-- C-56 (T447): retira `settings.fx_usd_eur` (BE-FR-87). El tipo USD→EUR vigente sale de `fx_rates` y, sin filas, de
-- `DEFAULT_FX_USD_EUR_PPM`; desde C-49 (T440) ni `pricing` ni `protections` leen la clave. La imagen nueva ya no la tiene en
-- `SETTING_SCHEMAS` y `readSettings` rechazaría la fila como desconocida, así que se borra aquí. Si una imagen anterior la
-- vuelve a sembrar (vuelta atrás), el _seed_ de la imagen nueva la borra al arrancar (`RETIRED_SETTING_KEYS`, `apps/seed.ts`).
-- Generada con drizzle-kit (`--custom`); el `DELETE` se escribe a mano (no hay cambio de esquema). Idempotente.
DELETE FROM `settings` WHERE `key` = 'fx_usd_eur';
