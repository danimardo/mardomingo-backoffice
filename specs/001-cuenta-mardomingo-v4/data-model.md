# Modelo de datos — Cuenta Mardomingo v4

**Fase**: 1 de `/speckit-plan` · **Fecha**: 2026-10-10 · **Spec**: [spec.md](./spec.md)

**Fuentes**: `Historias.md` v2.6 (sección 6, BE-FR de 5.1–5.15, secciones 8 y 9, 15.6, 15.14 y 15.27),
`spec.md` (Key Entities, FR y Clarifications), constitución (principios I, IV, VII, VIII, XII y
«Datos y almacenamiento»; v2.1.2), `ARCHITECTURE.md` §3 y ADR 0003/0004, y las decisiones de la
revisión del plan del 2026-10-10 (D-01…D-22, citadas como «D-xx»).

Este documento fija **qué** se guarda, quién es su dueño y qué restricciones protege la base de
datos. No contiene código Drizzle ni SQL completo: los CHECK y los *triggers* se dan en una línea
como referencia. Lo que se ha tenido que suponer está marcado como **[Supuesto]** y se repite en la
sección 8.

---

## 1. Convenciones

### 1.1 Tipos lógicos

| Tipo lógico | Significado | Almacenamiento en SQLite | Reglas |
|---|---|---|---|
| `Id` | Identificador opaco | `TEXT` | Ver 1.3 |
| `Text` | Texto | `TEXT` | Longitudes máximas en Zod, no en la BD |
| `Bool` | Booleano | `INTEGER` 0/1 | `CHECK (col IN (0,1))` |
| `Int` | Entero genérico (contadores, segundos, tokens, KB…) | `INTEGER` | `CHECK (col >= 0)` salvo que se diga otra cosa |
| `EpochMs` | Instante: milisegundos UTC desde la época | `INTEGER` | En la API, ISO 8601 UTC. `Date` solo en la capa de infraestructura (Better Auth, Drizzle) |
| `CivilDate` | Día civil `YYYY-MM-DD` interpretado en Europe/Madrid | `TEXT` | `CHECK (col GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')` |
| `Micro` | Microcréditos (1 crédito = 1.000.000 µc) | `INTEGER` | Entero seguro (`Number.isSafeInteger`) al cruzar fronteras |
| `EurCents` | Céntimos de euro | `INTEGER` | Ídem |
| `MicroUsd` | Micro-USD (1 USD = 1.000.000) | `INTEGER` | Ídem |
| `Ppm` | Decimal escalado ×1.000.000 (márgenes, comisiones, colchón, tipos de cambio, IVA, bonificación) | `INTEGER` | 2,0 → 2.000.000; 5,5 % → 55.000 |
| `Enum(a\|b)` | Valor de una lista cerrada | `TEXT` | `CHECK (col IN ('a','b'))` |
| `Json<Esquema>` | Documento JSON con esquema Zod (sección 3) | `TEXT` | `CHECK (json_valid(col))`; Zod al **escribir** y al **leer** (si está corrupto se rechaza de forma controlada, se registra un evento y no se modifica) |

- **PROHIBIDO `REAL`** en todo el esquema. Los productos intermedios (tarificación, créditos de un
  paquete, tipo de cambio) se calculan con `BigInt` y solo se redondea con `ceil` al pasar a µc.
- **[Supuesto]** La temperatura de una operación (0,7) se guarda como `Int` en milésimas
  (`temperature_milli` = 700) para no introducir `REAL`.
- **[Supuesto]** La duración de audio se guarda en milisegundos (`audio_ms`) para no perder
  precisión en el coste de Voxtral; la API la expone en segundos.

### 1.2 Nomenclatura

- Tablas y columnas en inglés y `snake_case`. Las tablas de Better Auth conservan sus nombres
  (`user`, `session`, `account`, `verification`), con columnas en `snake_case`
  mapeadas desde los campos *camelCase* de Better Auth.
- **[Supuesto]** Sufijos ASCII en lugar de `µ`: `_micro` (µc), `_micro_usd`, `_eur_cents`, `_ppm`,
  `_at` (`EpochMs`), `_ms`. Así, `remaining_µc` de Historias §6 pasa a `remaining_micro`,
  `max_cost_µc` a `max_cost_micro`, `cost_µusd` a `cost_micro_usd`, `bonus_pct` a `bonus_ppm` y
  `vat_rate` a `vat_rate_ppm`. Coincide con los nombres `…Micro` de la API.
- **[Supuesto]** `group` (palabra reservada de SQL) pasa a `group_label` en `app_operations`.
- Los valores de los enumerados se conservan tal como los nombra Historias (p. ej. `libre` /
  `plantilla`) para mantener la trazabilidad.

### 1.3 Identificadores

- Tablas de Better Auth: el `id` lo genera Better Auth (`TEXT`).
- Tablas propias: `Id` de texto aleatorio con prefijo por entidad, generado por el generador de
  ids inyectable de `$lib/server/shared/` (determinista en los tests). La API ya usa `op_…` y
  `ann_…`. **[Supuesto]** Prefijos: `app_`, `aop_`, `tpl_`, `ldoc_`, `tac_`, `fx_`, `bkt_`,
  `hld_`, `mov_`, `inv_`, `pck_`, `pay_`, `op_`, `ann_`, `aud_`.
- Claves naturales cuando existen: `settings.key`, `model_cache.model_id`,
  `welcome_grants.email_normalized_hash`, PK compuestas en `sync_documents`, `release_downloads`…

### 1.4 Borrado lógico, borrado físico y políticas de claves foráneas

- **Borrado lógico** solo en `user.deleted_at` (cuenta borrada y anonimizada, BE-FR-07). La
  configuración no se borra: `apps.status = disabled`, `app_operations.active = 0`,
  `packs.active = 0`, `announcements.active = 0`.
- **Borrado físico**: cuentas sin verificar (BE-FR-68), sesiones caducadas, tokens de
  verificación, contadores, y los datos personales que BE-FR-07 manda eliminar (perfil fiscal,
  documentos sincronizados).
- **Políticas de FK** (`foreign_keys=ON`):
  - Hacia `user`: `CASCADE` en tablas de sesión y de datos que mueren con la cuenta (`session`,
    `account`, `terms_acceptances`, `user_app_activity`); `RESTRICT` en todo lo contable
    (`credit_*`, `payments`, `invoices`, `ai_operations`, `admin_audit`). Consecuencia: la BD
    impide borrar físicamente una cuenta con historia económica; solo se puede anonimizar.
  - `ai_operations.session_id` → `session`: `SET NULL` (las sesiones se purgan).
  - Hacia configuración (`apps`, `app_operations`, `prompt_templates`, `packs`, `fx_rates`,
    `legal_documents`): `RESTRICT`.

### 1.5 Inmutabilidad (Historias 15.27, punto 3)

`credit_movements`, `admin_audit`, `invoices` y `prompt_templates` son de solo inserción: test de
arquitectura (sin `UPDATE`/`DELETE` en el código) **y** *triggers* de SQLite:

`CREATE TRIGGER <t>_no_update BEFORE UPDATE ON <t> BEGIN SELECT RAISE(ABORT, '<t> is append-only'); END;` (y el equivalente `BEFORE DELETE`).

- Drizzle no declara *triggers*: viven en una **migración personalizada** versionada junto a las
  generadas (ver hueco H-29).
- **Sin excepciones (D-18).** Ninguna vía desactiva los *triggers*: las tablas inmutables solo
  guardan el `user_id` opaco, así que el borrado de la cuenta (BE-FR-07) elimina los datos
  personales de la fila de `user` (y del perfil, los datos fiscales y los sincronizados) sin tocar
  esas tablas. Las facturas se conservan íntegras por obligación legal.

### 1.6 Claves foráneas entre funcionalidades

El `schema.ts` de una funcionalidad solo importa el `schema.ts` de otra para `references()`
(principio IV). En las fichas, **«cruza»** indica una FK hacia otra funcionalidad y **«adelante»**
una FK hacia una funcionalidad **posterior** en el orden de `ARCHITECTURE.md` §3 (p. ej. `credits`
→ `user` de `accounts`). Estas importaciones `schema.ts` → `schema.ts` que solo declaran
`references()` quedan **fuera del orden y del cálculo de ciclos** (D-03; constitución v2.1.2, enmienda
v2.1.1, y `ARCHITECTURE.md` §3/§4): son declaraciones de la BD, no llamadas en ejecución, así que las FK
«adelante» están permitidas. Cualquier otra importación sigue las reglas del principio IV. Aun así,
el grafo resultante es acíclico (sección 7).

### 1.7 Leyenda de las fichas

Columnas: **Nulo** = admite `NULL`; **Defecto** = valor por defecto en la BD (— si no tiene).
`now` = el servicio escribe el instante del `Clock` (no hay `DEFAULT CURRENT_TIMESTAMP`, porque el
tiempo se inyecta).

---

## 2. Tablas por funcionalidad dueña

### 2.1 `audit`

#### `admin_audit` — inmutable (BE-FR-55)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `aud_…` |
| `admin_id` | Id | no | — | Administrador que actuó |
| `action` | Text | no | — | Acción con prefijo de funcionalidad (`credits.adjust`, `apps.operation.update`, `accounts.block`…) |
| `entity` | Text | no | — | Tipo de entidad (`user`, `app`, `app_operation`, `setting`, `pack`, `announcement`, `legal_document`, `payment`, `fx_rate`, `app_defaults`…) |
| `entity_id` | Text | sí | — | Id o clave de la entidad (`settings.key` en parámetros) |
| `before` | Json<AuditSnapshot> | sí | — | Valor anterior (nulo al crear) |
| `after` | Json<AuditSnapshot> | sí | — | Valor nuevo (nulo al eliminar o desactivar sin valor) |
| `reason` | Text | sí | — | Motivo; obligatorio en ajustes, bloqueos y reembolsos (lo exige el servicio) |
| `created_at` | EpochMs | no | now | |

- PK `id`. FK `admin_id` → `user.id` (cruza, **adelante** → `accounts`; `RESTRICT`).
- CHECK `before IS NULL OR json_valid(before)`; ídem `after`.
- Índices: (`entity`, `entity_id`, `created_at`) para el enlace desde la confirmación (UX-13);
  (`created_at`) para el listado.
- Inmutable: *triggers* de 1.5.

### 2.2 `notifications`

#### `alerts_state` (BE-FR-56, 80, 82, 15, 87, 46 · FR-099)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `key` | Text | no | — | Clave de la alerta: `openrouter_balance`, `mistral_billing`, `fx_stale`, `ledger_mismatch:<user>`, `model:<model_id>:retired`, `model:<model_id>:price`, `flagged:<user>:<CivilDate>`, `global_brake:<CivilDate>` |
| `active` | Bool | no | 0 | La condición está cruzada (no se reenvía mientras siga activa) |
| `last_sent_at` | EpochMs | sí | — | Último email enviado |
| `updated_at` | EpochMs | no | now | |

- PK `key`. Índice (`updated_at`) para la purga de claves con fecha o usuario (sección 6).

#### `announcements` (BE-FR-85)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `ann_…`, estable (el cliente recuerda los cerrados) |
| `app_id` | Id | sí | — | Nulo = todas las apps |
| `level` | Enum(info\|warning\|critical) | no | — | |
| `message` | Text | no | — | |
| `link` | Text | sí | — | URL opcional |
| `starts_at` | EpochMs | no | — | Inicio de la ventana |
| `ends_at` | EpochMs | sí | — | Fin (nulo = sin fin) |
| `min_version` | Text | sí | — | Semver mínima dirigida (inclusive) |
| `max_version` | Text | sí | — | Semver máxima dirigida (inclusive) |
| `active` | Bool | no | 1 | Interruptor manual |
| `created_at` / `updated_at` | EpochMs | no | now | |

- PK `id`. FK `app_id` → `apps.id` (cruza, **adelante** → `apps`).
- CHECK `ends_at IS NULL OR ends_at > starts_at`.
- Índice (`active`, `app_id`, `starts_at`) para `/app/status` y el panel (FR-087).

### 2.3 `apps`

#### `apps` (BE-FR-62, 47, 48, 84, 64 CA2)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `app_…` |
| `slug` | Text | no | — | Valor de `X-App-Id` (`secretario`); `CHECK (slug GLOB '[a-z]*' AND slug NOT GLOB '*[^a-z0-9-]*')` |
| `name` | Text | no | — | Nombre visible |
| `description` | Text | no | `''` | Descripción corta (landing) |
| `client_types` | Json<ClientTypes> | no | — | `["desktop"]` |
| `status` | Enum(active\|disabled) | no | `active` | |
| `links` | Json<AppLinks> | no | — | Landing, descarga, notas de versión |
| `min_app_version` | Text | sí | — | Semver |
| `recommended_app_version` | Text | sí | — | Semver |
| `enforce_version` | Bool | no | 0 | |
| `maintenance_active` | Bool | no | 0 | Mantenimiento propio (BE-FR-47) |
| `maintenance_message` | Text | no | `''` | |
| `allowed_origins` | Json<Origins> | no | `[]` | CORS (solo apps web) |
| `post_verify_text` | Text | sí | — | **Nuevo** respecto a §6 (D-14): texto opcional de pasos tras verificar (aclaración 2026-10-10); nulo = texto genérico |
| `settings_overrides` | Json<AppSettingsOverrides> | no | `{}` | Parámetros «por app» de §9 |
| `sync_schema` | Json<SyncSchema> | no | — | Categorías y estrategias (BE-FR-39) |
| `support_email` | Text | sí | — | Nulo = `support_email` global |
| `created_at` / `updated_at` | EpochMs | no | now | |

- PK `id`. UNIQUE `slug`.
- CHECK `enforce_version = 0 OR min_app_version IS NOT NULL`.
- Sin borrado (solo `disabled`).

#### `app_operations` (BE-FR-77, 72, 35, 32, 31)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `aop_…` |
| `app_id` | Id | no | — | |
| `key` | Text | no | — | `fix`, `transcription`… |
| `name` | Text | no | — | Nombre amigable (panel) |
| `kind` | Enum(chat\|transcription\|image) | no | — | |
| `mode` | Enum(libre\|plantilla) | no | `libre` | |
| `model` | Text | sí | — | Modelo principal de OpenRouter (en transcripción, el *backup* va en `transcription_config`) |
| `fallback_models` | Json<FallbackModels> | no | `[]` | Respaldos ordenados |
| `preferred_provider` | Text | sí | — | Proveedor preferido de OpenRouter (`provider.order`) |
| `margin_override_ppm` | Ppm | sí | — | Nulo = `margin_global` |
| `temperature_milli` | Int | no | 700 | 0,7 → 700 |
| `max_output_tokens` | Int | sí | — | Obligatorio en chat |
| `max_cost_micro` | Micro | no | — | Tope duro (`max_cost_credits` × 10⁶) |
| `estimated_max_cost_micro_usd` | MicroUsd | sí | — | Si el modelo no publica precio |
| `timeout_ms` | Int | no | — | Por intento (45.000 / 60.000) |
| `capabilities` | Json<Capabilities> | no | — | |
| `limits` | Json<OperationLimits> | no | `{}` | Sobrescrituras de tamaño por operación |
| `transcription_config` | Json<TranscriptionConfig> | sí | — | Solo `kind = transcription` |
| `group_label` | Text | sí | — | «Corrector», «PRO» (BE-FR-32) |
| `active` | Bool | no | 0 | |
| `created_at` / `updated_at` | EpochMs | no | now | |

- PK `id`. UNIQUE (`app_id`, `key`). FK `app_id` → `apps.id` (misma funcionalidad).
- CHECK `max_cost_micro > 0`; `margin_override_ppm IS NULL OR margin_override_ppm >= 1000000`;
  `temperature_milli BETWEEN 0 AND 2000`; `timeout_ms > 0`;
  `(kind = 'transcription') = (transcription_config IS NOT NULL)`;
  `active = 0 OR kind = 'transcription' OR model IS NOT NULL`;
  `kind <> 'chat' OR max_output_tokens > 0`.
- Las comprobaciones que dependen de `model_cache` (capacidades, precio conocido, BE-FR-72 CA3 y
  BE-FR-77 CA2) son del servicio, no de la BD.
- Índice (`app_id`, `group_label`) para «aplicar a todo el grupo».

#### `prompt_templates` — inmutable por versión (BE-FR-78, 79)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `tpl_…` |
| `operation_id` | Id | no | — | Operación en modo `plantilla` |
| `version` | Int | no | — | 1, 2, 3… |
| `messages` | Json<TemplateMessages> | no | — | |
| `variables` | Json<TemplateVariables> | no | `[]` | |
| `response_format` | Json<ResponseFormat> | sí | — | |
| `tools` | Json<TemplateTools> | sí | — | Herramientas y `tool_choice` |
| `created_by` | Id | no | — | Administrador |
| `created_at` | EpochMs | no | now | |

- PK `id`. UNIQUE (`operation_id`, `version`). FK `operation_id` → `app_operations.id`;
  `created_by` → `user.id` (cruza, **adelante** → `accounts`).
- CHECK `version >= 1`. La versión vigente es la de mayor `version`.
- Inmutable: *triggers* de 1.5.

#### `settings` (BE-FR-61, sección 9)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `key` | Text | no | — | Nombre del parámetro de §9 |
| `value` | Json<SettingValue[key]> | no | — | Esquema por clave (3.1) |
| `updated_at` | EpochMs | no | now | |

- PK `key`. Solo parámetros **globales**; los «por app» se sobrescriben en
  `apps.settings_overrides` y los «por operación» en `app_operations`. El servicio de
  configuración resuelve la herencia global → app → operación.
- Los valores por defecto viven en el módulo de *seed* (no en la BD).

### 2.4 `legal`

#### `legal_documents` (BE-FR-60, 70, 26)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `ldoc_…` |
| `document` | Enum(terms\|privacy\|cookies\|aup\|withdrawal_waiver) | no | — | |
| `version` | Text | no | — | `2026-11-01` (formato libre, ver API) |
| `content` | Text | no | — | **Nuevo** respecto a §6 (D-14): texto versionado del documento en Markdown (la constitución sirve los legales desde la BD) |
| `content_hash` | Text | no | — | SHA-256 de `content` |
| `requires_reacceptance` | Bool | no | 0 | |
| `published_at` | EpochMs | no | — | Vigente = la de mayor `published_at` ≤ ahora |
| `created_by` | Id | sí | — | Administrador que publicó la versión; `NULL` = versión sembrada por el sistema (*seed* de L03, sin administrador todavía; O1) |
| `created_at` | EpochMs | no | now | |

- PK `id`. UNIQUE (`document`, `version`). FK `created_by` → `user.id` (cruza, **adelante**;
  nula solo en las versiones sembradas; toda publicación desde el panel la rellena).
- Índice (`document`, `published_at`).
- **Siembra** (L03): una versión provisional de `terms`, `privacy`, `cookies`, `aup` y también
  `withdrawal_waiver` (texto provisional de la renuncia al desistimiento, BE-FR-26), con
  `created_by` nulo y los textos provisionales que dé el propietario; las versiones definitivas
  se publican desde el panel de administración (L13) con `created_by` relleno.
- **[Supuesto]** Una versión publicada no se edita (el servicio crea otra); no lleva *trigger*
  porque Historias no la declara inmutable.

#### `terms_acceptances` (BE-FR-01 CA2, 69, 70, 26)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `tac_…` |
| `user_id` | Id | no | — | |
| `document` | Enum(terms\|privacy\|cookies\|aup\|withdrawal_waiver\|age_declaration) | no | — | |
| `version` | Text | no | — | Versión aceptada; en `age_declaration`, el `min_age` vigente (`"18"`) |
| `accepted_at` | EpochMs | no | now | |
| `ip` | Text | sí | — | IP de la aceptación (prueba del consentimiento, BE-FR-83) |
| `app_id` | Id | sí | — | Desde qué app se aceptó (nulo = web) |

- PK `id`. FK `user_id` → `user.id` (cruza, **adelante**; `CASCADE` solo para el borrado físico
  de cuentas sin verificar). FK `app_id` → `apps.id` (cruza).
- Sin FK compuesta a `legal_documents` (no existe para `age_declaration`): el servicio comprueba
  que (`document`, `version`) es la vigente (FR-103: versión no vigente → `VALIDATION_ERROR`).
- UNIQUE parcial (`user_id`, `document`, `version`) `WHERE document <> 'withdrawal_waiver'`
  (aceptar dos veces es idempotente; la renuncia al desistimiento se registra en cada compra).
- Índice (`user_id`, `document`, `accepted_at`) para `pendingAcceptances`.

### 2.5 `pricing`

#### `price_references` (BE-FR-73)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `operation_id` | Id | no | — | Operación (la app se obtiene de ella) |
| `typical_micro` | Micro | sí | — | Coste típico efectivo que se publica |
| `source` | Enum(auto\|manual) | sí | — | Origen del valor efectivo |
| `sample_size` | Int | no | 0 | Muestras del último cálculo |
| `manual_typical_micro` | Micro | sí | — | **Nuevo**: valor del administrador, que sobrevive a los recálculos diarios |
| `computed_at` | EpochMs | sí | — | Último cálculo |

- PK `operation_id`. FK → `app_operations.id` (cruza, hacia atrás).
- CHECK `(typical_micro IS NULL) = (source IS NULL)`; importes ≥ 0.
- La mediana la calcula `ai` y llega por parámetro (ARCHITECTURE §3).

#### `fx_rates` (BE-FR-87)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `fx_…` |
| `usd_eur_ppm` | Ppm | no | — | Tipo aplicado USD→EUR (0,92 → 920.000) |
| `source` | Enum(ecb\|manual) | no | — | |
| `ecb_rate_ppm` | Ppm | sí | — | Referencia EUR/USD del BCE (1,0870 → 1.087.000); nulo en `manual` |
| `ecb_date` | CivilDate | sí | — | Fecha de la publicación del BCE |
| `buffer_ppm` | Ppm | sí | — | `fx_buffer_pct` aplicado |
| `effective_from` | EpochMs | no | — | Desde cuándo rige |
| `created_by` | Id | sí | — | Administrador (solo `manual`) |
| `created_at` | EpochMs | no | now | |

- PK `id`. FK `created_by` → `user.id` (cruza, **adelante**).
- CHECK `usd_eur_ppm > 0`; `source = 'manual' OR (ecb_rate_ppm > 0 AND ecb_date IS NOT NULL AND buffer_ppm IS NOT NULL)`; `source = 'ecb' OR created_by IS NOT NULL`.
- Índice (`effective_from`). Vigente = fila con mayor `effective_from` ≤ ahora; el manual está
  activo mientras la última fila sea `manual` (desactivarlo inserta una fila `ecb` con el último
  valor del BCE). Sin filas, se usa `settings.fx_usd_eur` (0,92) (hueco H-25).
- Histórico de solo inserción por diseño (no declarado inmutable en Historias).

### 2.6 `credits`

`credits` es la **única** funcionalidad que escribe en estas tablas (principio IV).

#### `credit_buckets` (BE-FR-12, 13, 14, 16, 25, 27, 28)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `bkt_…` |
| `user_id` | Id | no | — | |
| `kind` | Enum(free\|paid) | no | — | |
| `source` | Enum(welcome\|purchase\|adjustment) | no | — | |
| `initial_micro` | Micro | no | — | Importe del movimiento que la creó |
| `remaining_micro` | Micro | no | — | |
| `expires_at` | EpochMs | sí | — | Solo `free` |
| `payment_id` | Id | sí | — | Solo `purchase` |
| `simulated` | Bool | no | 0 | Compra simulada (BE-FR-25) |
| `expiry_warning_sent_at` | EpochMs | sí | — | **Nuevo**: aviso único de caducidad enviado (BE-FR-16) |
| `created_at` | EpochMs | no | now | |

- PK `id`. FK `user_id` → `user.id` (cruza, **adelante**; `RESTRICT`); `payment_id` →
  `payments.id` (cruza, **adelante** → `payments`).
- CHECK `initial_micro > 0`; `remaining_micro BETWEEN 0 AND initial_micro`;
  `(kind = 'free') = (expires_at IS NOT NULL)`;
  `source <> 'welcome' OR kind = 'free'`;
  `(source = 'purchase') = (payment_id IS NOT NULL)`;
  `source <> 'purchase' OR kind = 'paid'`;
  `simulated = 0 OR source = 'purchase'`.
- UNIQUE parcial (`payment_id`) `WHERE payment_id IS NOT NULL` (acreditación idempotente,
  BE-FR-24 CA1); UNIQUE parcial (`user_id`) `WHERE source = 'welcome'` (bienvenida una vez por
  cuenta, BE-FR-63 CA1).
- Índices: (`user_id`, `kind`, `expires_at`, `created_at`) `WHERE remaining_micro > 0` (orden de
  consumo BE-FR-14 y desglose del panel); (`expires_at`) `WHERE kind = 'free' AND remaining_micro > 0`
  (tarea de caducidad y avisos).

#### `user_balances` (BE-FR-17, 49.7, 11.6)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `user_id` | Id | no | — | |
| `debt_micro` | Micro | no | 0 | Deuda actual (positiva) |
| `has_real_purchase` | Bool | no | 0 | Alguna compra real completada (la fija `credits` cuando `payments` acredita una compra no simulada) |
| `low_balance_threshold_micro` | Micro | sí | — | Nulo = aviso desactivado |
| `low_balance_notified` | Bool | no | 0 | Ya se avisó en el cruce actual |
| `updated_at` | EpochMs | no | now | |

- PK `user_id`. FK → `user.id` (cruza, **adelante**; `RESTRICT`).
- CHECK `debt_micro >= 0`; `low_balance_threshold_micro IS NULL OR low_balance_threshold_micro >= 0`.
- **[Supuesto]** La fila se crea al verificar la cuenta, en la misma transacción que la bolsa de
  bienvenida (o sin bolsa si el hash ya la recibió).
- Saldo materializado = Σ `credit_buckets.remaining_micro` − `debt_micro` (sección 5).

#### `credit_holds` (BE-FR-71)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `hld_…` |
| `user_id` | Id | no | — | |
| `app_id` | Id | no | — | **Nuevo** respecto a §6 (D-14): app que originó la reserva (BE-FR-63 CA2) |
| `operation_id` | Id | no | — | Operación de IA reservada |
| `amount_micro` | Micro | no | — | Coste máximo estimado |
| `created_at` | EpochMs | no | now | |
| `expires_at` | EpochMs | no | — | `created_at + hold_ttl_seconds` |
| `released_at` | EpochMs | sí | — | Nulo = abierta |
| `release_reason` | Enum(consumed\|released\|expired\|interrupted) | sí | — | **Nuevo**: cómo terminó (sección 4.3) |

- PK `id`. UNIQUE `operation_id` (una reserva por operación). FK `user_id` → `user.id`
  (**adelante**); `app_id` → `apps.id` (hacia atrás); `operation_id` → `ai_operations.id` (cruza,
  **adelante** → `ai`).
- CHECK `amount_micro > 0`; `expires_at > created_at`; `(released_at IS NULL) = (release_reason IS NULL)`.
- Índices: (`user_id`) `WHERE released_at IS NULL` (saldo reservado y tope diario);
  (`expires_at`) `WHERE released_at IS NULL` (caducidad y arranque).
- No es un movimiento del ledger: no cambia el saldo, solo el disponible.

#### `credit_movements` — inmutable (BE-FR-15, 17, 18, 27, 28)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `mov_…` |
| `user_id` | Id | no | — | |
| `type` | Enum(welcome\|purchase\|usage\|adjustment\|expiry\|refund\|chargeback\|debt_settlement\|forfeit) | no | — | Lista de BE-FR-15 más `forfeit` (saldo perdido al borrar la cuenta, D-15; sección 5.2) |
| `amount_micro` | Micro (con signo) | no | — | Efecto en el saldo; nunca 0 |
| `bucket_id` | Id | sí | — | Bolsa afectada; **nulo = la línea afecta a la deuda** |
| `operation_id` | Id | sí | — | Operación de IA (`usage`) |
| `app_id` | Id | sí | — | App informativa (`usage`) |
| `payment_id` | Id | sí | — | Compra (`purchase`, `refund`, `chargeback`, y `debt_settlement` originada por compra) |
| `admin_id` | Id | sí | — | **Nuevo**: administrador en `adjustment`, `refund` y su `debt_settlement` |
| `admin_reason` | Text | sí | — | Motivo obligatorio en `adjustment` y `refund` |
| `created_at` | EpochMs | no | now | |

- PK `id`. FK `user_id` → `user.id` (**adelante**, `RESTRICT`); `bucket_id` →
  `credit_buckets.id`; `operation_id` → `ai_operations.id` (**adelante**); `app_id` → `apps.id`;
  `payment_id` → `payments.id` (**adelante**); `admin_id` → `user.id` (**adelante**).
- CHECK `amount_micro <> 0` y, por tipo (una línea cada uno):
  - `type <> 'welcome' OR (amount_micro > 0 AND bucket_id IS NOT NULL)`
  - `type <> 'purchase' OR (amount_micro > 0 AND bucket_id IS NOT NULL AND payment_id IS NOT NULL)`
  - `type <> 'usage' OR (amount_micro < 0 AND operation_id IS NOT NULL)`
  - `type <> 'adjustment' OR (bucket_id IS NOT NULL AND admin_reason IS NOT NULL AND admin_id IS NOT NULL)`
  - `type <> 'expiry' OR (amount_micro < 0 AND bucket_id IS NOT NULL)`
  - `type <> 'refund' OR (amount_micro < 0 AND bucket_id IS NOT NULL AND payment_id IS NOT NULL AND admin_reason IS NOT NULL)`
  - `type <> 'chargeback' OR (amount_micro < 0 AND payment_id IS NOT NULL)`
  - `type <> 'debt_settlement' OR (bucket_id IS NOT NULL AND amount_micro < 0) OR (bucket_id IS NULL AND amount_micro > 0)`
  - `type <> 'forfeit' OR (amount_micro < 0 AND bucket_id IS NOT NULL)`
- Regla del servicio (D-16): un `adjustment` negativo no puede superar el saldo disponible; si lo
  supera, se rechaza con un error de validación y no se escribe nada (el ajuste nunca crea deuda).
- Índices: (`user_id`, `created_at`) (panel, CSV, tope diario, reconstrucción); (`operation_id`);
  (`payment_id`); (`bucket_id`); (`type`, `created_at`) (estadísticas y exportación contable).
- Inmutable: *triggers* de 1.5.

#### `welcome_grants` (BE-FR-11.5, 07 CA3)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `email_normalized_hash` | Text | no | — | HMAC-SHA256 del email normalizado con la clave secreta `EMAIL_HASH_KEY` (D-11; la clave nunca se rota) |
| `granted_at` | EpochMs | no | now | |

- PK `email_normalized_hash`. Sin FK a `user`: sobrevive al borrado de la cuenta. Controla la
  bienvenida una sola vez por forma normalizada (D-11).

### 2.7 `invoicing`

#### `billing_profiles` (BE-FR-74)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `user_id` | Id | no | — | |
| `kind` | Enum(individual\|business) | no | — | |
| `legal_name` | Text | no | — | Nombre o razón social |
| `tax_id` | Text | no | — | NIF/NIE/CIF o NIF-IVA (formato español validado en Zod) |
| `address` | Text | no | — | |
| `postal_code` | Text | no | — | |
| `city` | Text | no | — | |
| `country` | Text | no | — | ISO 3166-1 alfa-2; `CHECK (length(country) = 2)` |
| `created_at` / `updated_at` | EpochMs | no | now | |

- PK `user_id`. FK → `user.id` (cruza, **adelante**; se borra en el borrado de cuenta).
- Perfil opcional: sin fila = sin datos fiscales.

#### `invoices` — inmutable (BE-FR-75, 27, 28)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `inv_…` |
| `payment_id` | Id | no | — | |
| `kind` | Enum(simplified\|full\|corrective) | no | — | |
| `series` | Text | no | — | |
| `number` | Text | no | — | Correlativo por serie (lo asigna el proveedor) |
| `billing_snapshot` | Json<BillingSnapshot> | sí | — | Copia de los datos fiscales al emitir |
| `amount_eur_cents` | EurCents (con signo) | no | — | Total; negativo en `corrective` |
| `corrects_invoice_id` | Id | sí | — | Factura rectificada |
| `issue_key` | Text | no | — | **Nuevo**: clave de idempotencia de la emisión (`payment:<id>:initial`, `refund:<id>`, `chargeback:<id>`) |
| `provider` | Text | no | — | Proveedor de facturación |
| `provider_ref` | Text | sí | — | |
| `pdf_ref` | Text | sí | — | Referencia del PDF descargable |
| `issued_at` | EpochMs | no | — | |

- PK `id`. FK `payment_id` → `payments.id` (cruza, **adelante**); `corrects_invoice_id` →
  `invoices.id`.
- UNIQUE (`series`, `number`); UNIQUE `issue_key` (emisión idempotente, BE-FR-75 CA2).
- CHECK `(kind = 'corrective') = (corrects_invoice_id IS NOT NULL)`;
  `(kind = 'corrective') = (amount_eur_cents < 0)`;
  `kind <> 'full' OR billing_snapshot IS NOT NULL`.
- Índice (`payment_id`).
- Inmutable: *triggers* de 1.5. En la v4 no se crea ninguna fila (proveedor `none`).

### 2.8 `accounts`

#### `user` (Better Auth + plugin `admin` + campos propios)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | Generado por Better Auth |
| `name` | Text | no | `''` | Exigido por Better Auth; **[Supuesto]** no se recoge nombre: `''` |
| `email` | Text | no | — | Email de acceso (minúsculas) |
| `email_verified` | Bool | no | 0 | Sin verificar = 0 |
| `image` | Text | sí | — | Better Auth; sin uso en la v4 |
| `role` | Text | no | `'user'` | Lista separada por comas: `user`, `tester`, `admin` (plugin `admin`) |
| `banned` | Bool | no | 0 | Bloqueada |
| `ban_reason` | Text | sí | — | Motivo del bloqueo (admin o contracargo) |
| `ban_expires` | EpochMs | sí | — | Plugin `admin`; siempre nulo en la v4 (bloqueo indefinido) |
| `email_normalized` | Text | sí | — | Forma normalizada (BE-FR-11.5); nulo al borrar |
| `signup_app_id` | Id | sí | — | App de origen (`?app=`, BE-FR-64 CA1) |
| `signup_ip` | Text | sí | — | **Nuevo** (D-14): IP del registro (altas por IP, BE-FR-11.4; prueba, BE-FR-83) |
| `last_activity_at` | EpochMs | sí | — | **Nuevo** (D-14): última actividad (login, API, panel; BE-FR-86) |
| `inactivity_warned_at` | EpochMs | sí | — | **Nuevo**: aviso de borrado por inactividad enviado |
| `deleted_at` | EpochMs | sí | — | Borrada y anonimizada |
| `created_at` / `updated_at` | EpochMs | no | now | Better Auth (`Date` en infraestructura, `timestamp_ms`) |

- PK `id`. UNIQUE `email`. FK `signup_app_id` → `apps.id` (cruza, hacia atrás).
- **Índice no único** (`email_normalized`, D-11): BE-FR-11 CA1 permite varias cuentas con la misma
  forma normalizada (`juan+2@gmail.com` cuando existe `j.uan@gmail.com`). La bienvenida única la
  garantiza `welcome_grants`.
- UNIQUE parcial sobre expresión constante «un solo administrador» (FR-017):
  `CREATE UNIQUE INDEX one_admin ON user((1)) WHERE ',' || role || ',' LIKE '%,admin,%' AND deleted_at IS NULL;`
- CHECK `role <> ''`; `deleted_at IS NULL OR email_normalized IS NULL`.
- Índices: (`signup_ip`, `created_at`) (altas por IP en 24 h); (`email_verified`, `created_at`)
  (purga de no verificadas); (`last_activity_at`) `WHERE deleted_at IS NULL AND email_verified = 1`
  (inactividad); (`signup_app_id`, `created_at`) (embudo y altas por app).
- Estado derivado sin duplicar campos: sin verificar = `email_verified = 0`; bloqueada =
  `banned = 1`; borrada = `deleted_at` no nulo.

#### `session` (Better Auth + campos propios)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | |
| `user_id` | Id | no | — | |
| `token` | Text | no | — | Token opaco (cookie en la web, Bearer en las apps) |
| `expires_at` | EpochMs | no | — | Deslizante: 30 días; se renueva si han pasado > 24 h |
| `ip_address` | Text | sí | — | IP aproximada (panel) |
| `user_agent` | Text | sí | — | |
| `impersonated_by` | Id | sí | — | Plugin `admin`; sin uso en la v4 |
| `app_id` | Id | sí | — | Nulo = web de la cuenta; si no, sesión ligada a esa app (BE-FR-65 CA3) |
| `device_name` | Text | sí | — | `X-Device-Name` |
| `app_version` | Text | sí | — | `X-App-Version` al iniciar sesión |
| `last_used_at` | EpochMs | sí | — | Último uso (panel) |
| `created_at` / `updated_at` | EpochMs | no | now | |

- PK `id`. UNIQUE `token`. FK `user_id` → `user.id` (`CASCADE`); `app_id` → `apps.id` (cruza).
- Índices: (`user_id`); (`expires_at`) (purga).
- **[Supuesto]** `last_used_at` se actualiza como mucho una vez por minuto por sesión para no
  escribir en cada petición.

#### `account` (Better Auth)

Columnas de Better Auth sin añadidos: `id`, `user_id`, `account_id`, `provider_id` (`credential`
en la v4; `google` en la fase 2, BE-FR-09), `password` (hash de Better Auth), `access_token`,
`refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`,
`created_at`, `updated_at` (instantes como `EpochMs`).

- PK `id`. FK `user_id` → `user.id` (`CASCADE`). UNIQUE (`provider_id`, `account_id`). Índice
  (`user_id`).

#### `verification` (Better Auth)

Columnas: `id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at`. Guarda los tokens
de un solo uso (recuperación de contraseña, 1 h, BE-FR-05). La verificación de email (24 h) y la
del cambio de email usan el mecanismo de Better Auth con caducidad configurada a 24 h.

- PK `id`. Índices (`identifier`), (`expires_at`).

#### `auth_rate_limits` (BE-FR-45, D-02)

Contadores propios de `accounts` para los límites de autenticación por IP. Sustituye a la tabla
`rate_limit` de Better Auth, cuyo `rateLimit` no actúa con `auth.api` y está desactivado.

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `scope` | Enum(login\|signup\|resend_verification\|password_reset\|email_change) | no | — | Acción limitada |
| `ip` | Text | no | — | IP del cliente (`getClientAddress()`); dato personal de vida corta |
| `count` | Int | no | 0 | Peticiones en la ventana |
| `window_start` | EpochMs | no | — | Inicio de la ventana |

- PK (`scope`, `ip`). Índice (`window_start`) (purga).
- Los límites salen de `settings`; superarlos → `RATE_LIMITED` (API) o error con tiempo de espera
  (web). Las altas por IP en 24 h (BE-FR-11.4) se cuentan sobre `user.signup_ip`.

#### `login_attempts` (BE-FR-67)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `email_normalized_hash` | Text | no | — | HMAC-SHA256 con `EMAIL_HASH_KEY` (D-11), exista o no la cuenta |
| `failures` | Int | no | 0 | Fallos en la ventana |
| `window_start` | EpochMs | no | — | Inicio de la ventana de 15 min |
| `locked_until` | EpochMs | sí | — | Fin del bloqueo temporal |

- PK `email_normalized_hash`. Índice (`window_start`) (purga).

#### `disposable_domains` (BE-FR-11.2)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `domain` | Text | no | — | Dominio en minúsculas |
| `updated_at` | EpochMs | no | now | Último refresco semanal |

- PK `domain`.

#### `user_app_activity` (D-13; BE-FR-54 embudo, BE-FR-85 CA1, BE-FR-86)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `user_id` | Id | no | — | |
| `app_id` | Id | no | — | |
| `first_login_at` | EpochMs | no | — | Primer login desde la app (embudo) |
| `last_used_at` | EpochMs | no | — | Último uso desde la app (anuncios del panel: apps usadas) |

- PK (`user_id`, `app_id`). FK `user_id` → `user.id` (`CASCADE`); `app_id` → `apps.id` (cruza).
- Índice (`app_id`, `first_login_at`).
- Motivo: las sesiones se borran (revocación inmediata en Better Auth, purga a los 30 días), así
  que ni el «primer login desde la app» del embudo ni las «apps que la cuenta ha usado con sesión
  pasada» del panel se pueden derivar de `session`. La fila se crea en el primer login desde la
  app y `last_used_at` se actualiza con su uso (como mucho una vez por minuto, como la sesión).

### 2.9 `payments`

#### `packs` (BE-FR-23)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `pck_…` |
| `name` | Text | no | — | |
| `price_eur_cents` | EurCents | no | — | IVA incluido |
| `bonus_ppm` | Ppm | no | 0 | +5 % → 50.000 |
| `active` | Bool | no | 1 | |
| `sort_order` | Int | no | 0 | |
| `created_at` / `updated_at` | EpochMs | no | now | |

- PK `id`. CHECK `price_eur_cents > 0`; `bonus_ppm >= 0`. Índice (`active`, `sort_order`).
- Créditos = `price_eur_cents × credits_per_eur_purchase × (10⁶ + bonus_ppm) / 100` µc, calculado
  con `BigInt` en el momento de la compra (5 € → 5.000 créditos; 10 € +5 % → 10.500).

#### `payments` (BE-FR-24, 25, 26, 27, 28)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `pay_…` |
| `user_id` | Id | no | — | |
| `pack_id` | Id | no | — | |
| `attempt_id` | Text (UUID) | no | — | **Nuevo**: identificador de intento de un solo uso (BE-FR-25 CA4) |
| `provider` | Enum(simulated\|stripe) | no | — | |
| `provider_ref` | Text | no | — | Referencia del proveedor (sesión de *checkout*; en `simulated`, generada) |
| `status` | Enum(pending\|completed\|refunded\|partially_refunded\|chargeback) | no | `pending` | |
| `amount_eur_cents` | EurCents | no | — | Total con IVA |
| `base_eur_cents` | EurCents | no | — | Base imponible (D-17) |
| `vat_eur_cents` | EurCents | no | — | Cuota de IVA |
| `vat_rate_ppm` | Ppm | no | — | Tipo de IVA; en la v4, 21 % incluido (210.000) |
| `country` | Text | no | — | ISO 3166-1 alfa-2; en la v4, `ES` |
| `credits_micro` | Micro | no | — | Créditos acreditados (fijados al crear la compra) |
| `wants_full_invoice` | Bool | no | 0 | |
| `simulated` | Bool | no | — | |
| `withdrawal_acceptance_id` | Id | no | — | **Nuevo**: aceptación de la renuncia al desistimiento (BE-FR-26) |
| `refunded_eur_cents` | EurCents | no | 0 | **Nuevo**: importe devuelto acumulado (CSV de ventas) |
| `created_at` | EpochMs | no | now | |
| `completed_at` | EpochMs | sí | — | |
| `updated_at` | EpochMs | no | now | |

- PK `id`. UNIQUE `provider_ref` (webhook idempotente); UNIQUE (`user_id`, `attempt_id`) (doble
  clic, reenvío o «atrás»: la segunda inserción choca y se muestra la compra existente).
- FK `user_id` → `user.id` (cruza, hacia atrás, `RESTRICT`); `pack_id` → `packs.id`;
  `withdrawal_acceptance_id` → `terms_acceptances.id` (cruza, hacia atrás).
- CHECK `amount_eur_cents > 0`; `credits_micro > 0`; `(provider = 'simulated') = (simulated = 1)`;
  `(status = 'pending') = (completed_at IS NULL)`;
  `refunded_eur_cents BETWEEN 0 AND amount_eur_cents`;
  `base_eur_cents + vat_eur_cents = amount_eur_cents`; `length(country) = 2`.
- **IVA (D-17)**: las compras simuladas de la v4 registran IVA español del 21 % incluido y país
  `ES` (base = total / 1,21, redondeo de la cuota en céntimos). El cálculo real llega con Stripe Tax
  en la fase de cobros reales (pendiente con la gestoría).
- Índices: (`user_id`, `created_at`) (panel, exportación RGPD); (`status`, `completed_at`)
  (estadísticas y CSV contable).
- **Intento de compra (decisión):** no hace falta tabla. La página de compra genera un UUID, lo
  envía en un campo oculto y la compra se inserta con él. Un identificador inventado por el
  cliente solo le permitiría crear otra compra suya, lo mismo que recargar la página, así que no
  hace falta firmarlo ni guardarlo antes. Sirve igual para `stripe`: la fila `pending` se crea al
  enviar y el segundo envío devuelve la misma sesión de *checkout*.

### 2.10 `sync`

#### `sync_documents` (BE-FR-39, 40, 41)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `user_id` | Id | no | — | |
| `app_id` | Id | no | — | |
| `revision` | Int | no | 1 | Entero creciente (`If-Match`) |
| `data` | Json<SyncData> | no | — | Validado contra `apps.sync_schema` |
| `created_at` / `updated_at` | EpochMs | no | now | |

- PK (`user_id`, `app_id`). FK `user_id` → `user.id` (cruza, `RESTRICT`: `privacy` los borra
  explícitamente en el borrado de cuenta, que es lógico); `app_id` → `apps.id` (cruza).
- CHECK `revision >= 1`. Escritura condicional `UPDATE … WHERE revision = :ifMatch` (BE-FR-41
  CA1). El tamaño (`max_sync_doc_kb`) lo comprueba el servicio.
- Índice (`app_id`) (anuncios del panel: apps con documento).

#### `app_defaults` (BE-FR-42, 57)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `app_id` | Id | no | — | |
| `data` | Json<SyncData> | no | — | Mismo formato que el documento, validado con el `sync_schema` |
| `updated_at` | EpochMs | no | now | |

- PK `app_id`. FK → `apps.id` (cruza).
- **Siembra** (C3): la hace `sync`, no `apps` (el *seed* de `apps` de L02 no toca esta tabla).
  `src/lib/server/features/sync/seed.ts` (L11), exportado en `sync/index.ts` y ejecutado desde la
  composición en `init`, crea de forma idempotente los predeterminados **vacíos** de `secretario`
  (cada categoría de su `sync_schema` sin elementos); el administrador los edita después (W43).

### 2.11 `protections`

#### `protection_state` (BE-FR-46)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `key` | Text | no | — | `global_brake` |
| `value` | Json<ProtectionValue[key]> | no | — | 3.9 |
| `updated_at` | EpochMs | no | now | |

- PK `key`. Los contadores por minuto y de concurrencia viven en `*.cache.ts` (no en la BD).

### 2.12 `ai`

#### `ai_operations` — sin contenido (BE-FR-38, 21, 37, 44, 79–82)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `id` | Id | no | — | `op_…` (`operationId` de la API) |
| `user_id` | Id | sí | — | Nulo solo tras la anonimización a los 24 meses |
| `app_id` | Id | no | — | |
| `session_id` | Id | sí | — | |
| `app_operation_id` | Id | no | — | Operación del catálogo (Historias: `operation`) |
| `prompt_template_id` | Id | sí | — | Versión de plantilla usada (Historias: `template_version`) |
| `status` | Enum(in_progress\|ok\|provider_error\|cancelled\|undelivered\|interrupted\|rejected) | no | `in_progress` | `in_progress` es **nuevo** respecto a §6 (D-12) |
| `idempotency_key` | Text (UUID) | sí | — | |
| `provider` | Enum(mistral\|openrouter) | sí | — | Proveedor que respondió |
| `model` | Text | sí | — | Modelo que respondió |
| `used_fallback` | Bool | no | 0 | Respaldo o *backup* usado |
| `input_tokens` / `output_tokens` | Int | sí | — | |
| `audio_ms` | Int | sí | — | Duración usada para el coste (proveedor o ffprobe) |
| `cost_micro_usd` | MicroUsd | no | 0 | Coste real total facturado por los proveedores; en `cancelled`, el coste del proveedor si se llega a conocer (pérdida por cancelación, D-05) |
| `cost_estimated` | Bool | no | 0 | BE-FR-20 |
| `fx_rate_id` | Id | sí | — | **Nuevo**: tipo de cambio aplicado al cobro |
| `hold_micro` | Micro | sí | — | Reserva creada |
| `charged_micro` | Micro | no | 0 | Cobrado al usuario |
| `absorbed_micro` | Micro | no | 0 | Coste no cobrado y asumido por el administrador |
| `absorbed_reason` | Enum(undelivered_replay\|debt_cap) | sí | — | **Nuevo**: separa las dos pérdidas de BE-FR-54 |
| `truncated` | Bool | no | 0 | BE-FR-72 CA2 |
| `flagged` | Bool | no | 0 | Moderación del proveedor (BE-FR-82) |
| `duration_ms` | Int | sí | — | |
| `app_version` | Text | sí | — | |
| `error_code` | Text | sí | — | Código de 7.2 |
| `provider_generation_id` | Text | sí | — | Id de generación de OpenRouter |
| `created_at` | EpochMs | no | now | |
| `completed_at` | EpochMs | sí | — | |

- PK `id`. FK `user_id` → `user.id` (cruza, hacia atrás, `RESTRICT`); `session_id` →
  `session.id` (`SET NULL`); `app_id` → `apps.id`; `app_operation_id` → `app_operations.id`;
  `prompt_template_id` → `prompt_templates.id`; `fx_rate_id` → `fx_rates.id` (todas cruzan, hacia
  atrás).
- CHECK `charged_micro >= 0`; `absorbed_micro >= 0`; `hold_micro IS NULL OR hold_micro > 0`;
  `(absorbed_micro = 0) = (absorbed_reason IS NULL)`;
  `status NOT IN ('in_progress','rejected','interrupted','cancelled','provider_error') OR charged_micro = 0`;
  `status <> 'rejected' OR (hold_micro IS NULL AND provider IS NULL)`;
  `(status = 'in_progress') = (completed_at IS NULL)`.
- **Idempotencia:** UNIQUE parcial (`user_id`, `idempotency_key`) `WHERE idempotency_key IS NOT NULL AND status = 'in_progress'`
  (nunca dos ejecuciones en curso con la misma clave; D-12). No es UNIQUE total porque la
  repetición tras `undelivered`, fallo o cancelación crea otra fila con la misma clave.
- **Pérdida por cancelación (D-05)**: una operación `cancelled` nunca se cobra (`charged_micro = 0`),
  pero si el proveedor la factura, su coste (de la respuesta o de la consulta posterior por
  `provider_generation_id`) se guarda en `cost_micro_usd` y las estadísticas lo suman como
  «pérdida por cancelación» (BE-FR-37, BE-FR-54).
- Índices: (`user_id`, `idempotency_key`, `created_at`) `WHERE idempotency_key IS NOT NULL`
  (búsqueda de la última fila en la ventana); (`user_id`, `created_at`) (panel, gráficas, CSV);
  (`app_id`, `created_at`) y (`created_at`) (estadísticas, freno global, precios orientativos);
  (`status`) `WHERE status = 'in_progress'` (arranque); (`user_id`, `created_at`)
  `WHERE flagged = 1` (alerta de moderación y detalle del admin).
- **[Supuesto]** Las peticiones rechazadas antes de resolver una operación válida (operación
  desconocida o inactiva) no generan fila, porque `app_operation_id` es obligatorio; solo se
  registran en el log.

#### `model_cache` (BE-FR-80, 72, 77 CA3)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `model_id` | Text | no | — | Id de OpenRouter |
| `pricing` | Json<ModelPricing> | no | — | Precios convertidos a enteros |
| `modalities` | Json<ModelModalities> | no | — | |
| `supported_parameters` | Json<SupportedParameters> | no | — | |
| `fetched_at` | EpochMs | no | — | |

- PK `model_id`. Un modelo asignado sin fila tras el refresco diario se considera retirado (el
  aviso del panel se deriva; el email usa `alerts_state`).

### 2.13 `privacy`

Sin tablas (ARCHITECTURE §3). Orquesta la exportación (BE-FR-08), el borrado (BE-FR-07), la
inactividad (BE-FR-86) y la retención (BE-FR-83) llamando a las API públicas de las dueñas, que
ejecutan sus funciones de anonimización o borrado.

### 2.14 `stats`

#### `release_downloads` (BE-FR-54)

| Columna | Tipo | Nulo | Defecto | Descripción |
|---|---|---|---|---|
| `app_id` | Id | no | — | |
| `day` | CivilDate | no | — | Día de la lectura |
| `cumulative_downloads` | Int | no | — | **[Supuesto]** Contador acumulado leído de GitHub |
| `downloads` | Int | sí | — | Diferencia con el día anterior (nulo en la primera lectura) |
| `fetched_at` | EpochMs | no | — | |

- PK (`app_id`, `day`). FK `app_id` → `apps.id` (cruza).

---

## 3. Esquemas de las columnas JSON

Notación: `?` opcional; `Micro`, `Ppm`, etc. son enteros seguros no negativos salvo que se diga.
Todos los objetos son estrictos (`z.strictObject`): una clave desconocida se rechaza.

### 3.1 `settings.value` (por clave)

| Clave | Tipo del valor | Defecto (seed) |
|---|---|---|
| `credits_per_eur_purchase`, `credits_per_eur_usage` | Int > 0 (créditos por euro) | 1.000 |
| `fx_usd_eur` | Ppm > 0 (valor inicial hasta la primera consulta) | 920.000 |
| `fx_buffer_pct` | Ppm | 30.000 |
| `fx_stale_alert_days` | Int > 0 | 3 |
| `margin_global` | Ppm ≥ 1.000.000 | 2.000.000 |
| `provider_fee_pct_openrouter` / `provider_fee_pct_mistral` | Ppm | 55.000 / 0 |
| `voxtral_price_per_minute_usd` | MicroUsd | tarifa vigente |
| `welcome_credits` | Micro | 1.000.000.000 |
| `free_credits_expiry_days` / `free_expiry_warning_days` | Int > 0 | 30 / 7 |
| `min_balance_to_operate` | Micro | 5.000.000 |
| `max_debt` | Micro | 200.000.000 |
| `hold_ttl_seconds` | Int > 0 | 600 |
| `chars_per_token_estimate` / `image_input_token_estimate` | Int > 0 | 3 / 1.500 |
| `idempotency_window_minutes` | Int > 0 | 10 |
| `daily_cap_no_purchase` | Micro | 400.000.000 |
| `registrations_per_ip_24h`, `login_max_failures`, `login_lock_minutes` | Int > 0 | 3, 10, 15 |
| `unverified_account_ttl_days`, `min_age`, `inactive_account_years`, `inactive_account_notice_days` | Int > 0 | 7, 18, 3, 30 |
| `ai_requests_per_minute`, `max_concurrent_transcriptions` | Int > 0 | 30, 2 |
| `max_audio_seconds`, `audio_duration_tolerance_seconds`, `max_audio_mb` | Int > 0 | 300, 10, 10 |
| `max_text_chars`, `max_image_mb`, `max_sync_doc_kb` | Int > 0 | 200.000, 10, 1.024 |
| `global_daily_free_cost_brake_eur` | EurCents | 500 |
| `maintenance` | `{ active: Bool, message: Text }` | `{ active: false, message: "" }` |
| `openrouter_balance_alert_usd` | MicroUsd | 10.000.000 |
| `model_price_change_alert_pct` | Ppm | 200.000 |
| `price_reference_window_days`, `price_reference_min_samples` | Int > 0 | 30, 50 |
| `flagged_ops_alert_per_day` | Int > 0 | 3 |
| `support_email` | email | `soporte@mardomingo.com` |

### 3.2 Configuración de `apps`

- `client_types`: array no vacío y sin repetidos de `desktop` | `web` | `mobile`.
- `allowed_origins`: array de orígenes `https://host[:puerto]` sin ruta.
- `links`: `{ landing: { type: "internal" } | { type: "external", url: URL }, download_url?: URL | null, release_notes_url?: URL | null }`.
  El embudo lee GitHub cuando `download_url` apunta a `github.com/<owner>/<repo>/releases`.
- `settings_overrides`: subconjunto opcional de las claves «por app» de §9:
  `{ ai_requests_per_minute?, max_concurrent_transcriptions?, max_audio_seconds?, audio_duration_tolerance_seconds?, max_audio_mb?, max_text_chars?, max_image_mb?, max_sync_doc_kb? }`
  (Int > 0). Refinamiento: `ai_requests_per_minute` y `max_concurrent_transcriptions` ≤ global
  (aclaración 2026-10-10). Mantenimiento, versiones y soporte por app son columnas, no claves.
- `sync_schema`: `{ categories: Record<Nombre, Categoría> }` (al menos una), con
  `Categoría = { strategy: "items", key: Text, tombstone_ttl_days: Int } | { strategy: "block" } | { strategy: "keyed", keys?: Text[] }`.
  Perfil `secretario`: `customReplacements` = `items` (clave `from`, 30 días);
  `coreReplacements`, `quickTexts`, `prompts` = `block`; `preferences` = `keyed` con
  `keys: [communicationStyle, messageType, language, targetPersons, processWithLLM, autoCopy, fixAuto, markdownMode, translationTargetLanguage, themePreference]`.

### 3.3 `sync_documents.data` y `app_defaults.data`

Objeto con **solo** las categorías declaradas; la forma depende de la estrategia:

- `items`: `{ items: Array<{ [key]: Text, updatedAt: EpochMs, …campos de la app }>, tombstones: Array<{ [key]: Text, deletedAt: EpochMs }> }`
  (claves únicas dentro de `items`).
- `block`: `{ value: JSON, updatedAt: EpochMs }`.
- `keyed`: `Record<clave, { value: JSON, updatedAt: EpochMs }>`; si el esquema declara `keys`,
  solo esas claves.

El contenido de `value` y de los campos de cada elemento no se valida más allá de ser JSON (la
fusión y la semántica son del cliente). La siembra (BE-FR-40) copia `app_defaults.data` con todos
los `updatedAt`/`deletedAt` a 0. Tamaño serializado ≤ `max_sync_doc_kb` efectivo.

### 3.4 Configuración de `app_operations`

- `fallback_models`: array ordenado de ids de modelo, sin repetidos y sin el `model` principal.
- `capabilities`: `{ image_input: Bool, structured_output: Bool, tools: Bool }`.
- `limits`: `{ max_text_chars?: Int > 0, max_image_mb?: Int > 0 }`.
- `transcription_config`:
  `{ primary: { enabled: Bool, model: Text, timeout_ms: Int, retry_delays_ms: Int[] }, backup: { model: Text, timeout_ms: Int } | null }`
  (por defecto `voxtral-mini-latest`, 45.000 ms, `[2000, 4000, 8000]`; *backup* 60.000 ms).
  Refinamiento: `primary.enabled = false` exige `backup` no nulo (BE-FR-35).

### 3.5 `prompt_templates`

- `messages`: array no vacío de `{ role: "system" | "user" | "assistant", content: Text | Array<{ type: "text", text: Text } | { type: "image_url", variable: Nombre }> }`.
  Los textos pueden contener `{{nombre}}`; toda variable usada debe estar declarada y viceversa.
- `variables`: array de `{ name: /^[a-z][a-z0-9_]*$/, type: "text" | "image", required: Bool, max_chars?: Int, max_mb?: Int }`
  (nombres únicos; `max_chars` solo en `text`, `max_mb` solo en `image`).
- `response_format`: `{ type: "json_schema", json_schema: { name: Text, strict?: Bool, schema: Objeto JSON Schema } }`.
- `tools`: `{ tools: Array<{ type: "function", function: { name: Text, description?: Text, parameters: Objeto JSON Schema } }>, tool_choice?: "auto" | "none" | "required" | { type: "function", function: { name: Text } } }`.

### 3.6 `invoices.billing_snapshot`

`{ kind: "individual" | "business", legal_name, tax_id, address, postal_code, city, country }`
(mismos tipos que `billing_profiles`), copiado en el momento de la emisión. Nulo permitido solo en
facturas simplificadas sin datos fiscales.

### 3.7 `admin_audit.before` / `after`

`Record<campo, JSON>` con **solo** los campos cambiados de la entidad (o el objeto completo al
crear). Reglas: nunca contraseñas, tokens, secretos ni contenido de usuario; los usuarios se
identifican por `id`, no por email (así la auditoría no necesita anonimizarse).

### 3.8 `model_cache`

- `pricing` (**[Supuesto]** conversión a enteros con `ceil`):
  `{ prompt_micro_usd_per_mtok?: Int, completion_micro_usd_per_mtok?: Int, internal_reasoning_micro_usd_per_mtok?: Int, audio_micro_usd_per_mtok?: Int, image_micro_usd?: Int, request_micro_usd?: Int }`
  (µUSD por millón de tokens o por unidad).
- `modalities`: `{ input: Array<"text" | "image" | "audio" | "file">, output: Array<"text" | "image"> }`.
- `supported_parameters`: array de textos (`response_format`, `structured_outputs`, `tools`,
  `tool_choice`, `max_tokens`, `temperature`…).

### 3.9 `protection_state.value`

Clave `global_brake`:
`{ day: CivilDate, active: Bool, activated_at: EpochMs | null, released_at: EpochMs | null, released_by: Id | null }`.
Al cambiar de día (Europe/Madrid) se considera inactivo aunque `active` siga a `true`.

---

## 4. Transiciones de estado

### 4.1 Cuenta

| Desde | Evento | Hacia | Efectos de datos |
|---|---|---|---|
| — | Registro web (BE-FR-01) | **Sin verificar** | `user` (`email_verified = 0`, `email_normalized`, `signup_app_id`, `signup_ip`), `account` (`credential`), `terms_acceptances` (terms, privacy, aup, `age_declaration`) |
| Sin verificar | Enlace en 24 h (BE-FR-02) | **Verificada** | `email_verified = 1`; si el hash no está en `welcome_grants`: fila en `welcome_grants`, bolsa `free` y movimiento `welcome`; fila `user_balances`; si `email = ADMIN_EMAIL` y no hay admin: `role` con `admin` |
| Sin verificar | `unverified_account_ttl_days` (BE-FR-68) | **Eliminada** (borrado físico) | `DELETE user` en cascada; el email queda libre |
| Verificada | Bloqueo del admin o contracargo (BE-FR-50, 28) | **Bloqueada** | `banned = 1`, `ban_reason`; se borran todas sus `session`; auditoría (si es el admin) |
| Bloqueada | Desbloqueo del admin | Verificada | `banned = 0`, `ban_reason = NULL`; auditoría |
| Verificada | Aviso de inactividad (BE-FR-86) | Verificada con aviso | `inactivity_warned_at = now` |
| Verificada con aviso | Cualquier actividad | Verificada | `inactivity_warned_at = NULL`, `last_activity_at = now` |
| Verificada (con aviso vencido) / Verificada (usuario) | Borrado (BE-FR-07, 86) | **Borrada** (terminal) | Bolsas restantes a cero con movimientos `forfeit` (D-15); anonimización (sección 6); `deleted_at = now` |

El cambio de email (BE-FR-66) no cambia el estado: recalcula `email_normalized` y revoca las demás
sesiones. Ver hueco H-32 sobre el borrado de una cuenta bloqueada.

### 4.2 Sesión

| Desde | Evento | Hacia |
|---|---|---|
| — | Login web (cookie) o de app (Bearer, con `app_id`, `device_name`, `app_version`) | **Activa** |
| Activa | Uso con más de 24 h desde la última renovación | Activa (`expires_at = now + 30 d`) |
| Activa | 30 días sin uso | **Caducada** (`expires_at < now`; `UNAUTHENTICATED`) |
| Activa | Logout, cierre desde el panel, cambio de contraseña o email (las demás), bloqueo (todas), borrado de cuenta | **Revocada** (Better Auth borra la fila) |
| Caducada | 30 días tras `expires_at` (BE-FR-04 CA6) | Eliminada |

Una sesión de app usada con otro `X-App-Id` responde `UNAUTHENTICATED` sin cambiar de estado.

### 4.3 Reserva (`credit_holds`)

| Desde | Evento | Hacia (`release_reason`) | Movimiento |
|---|---|---|---|
| — | Paso 6 de la sección 8 (cabe la reserva) | **Abierta** (`released_at` nulo) | Ninguno |
| Abierta | Cobro en la transacción 2 | **Consumida** (`consumed`) | `usage` por el coste real |
| Abierta | Operación sin cobro (error de todos los proveedores, cancelación antes de la respuesta, repetición no cobrada) | **Liberada** (`released`) | Ninguno |
| Abierta | `expires_at` vencido (tarea de limpieza) | **Caducada** (`expired`) | Ninguno; la operación queda `interrupted` |
| Abierta | Arranque del servidor | **Interrumpida** (`interrupted`) | Ninguno; la operación queda `interrupted` |

**Caducidad de reservas** (O3): `credits.expireHolds(tx, now)` (servicio de `credits`, L05, con su
caso en el test TDD del lote) libera en una transacción las reservas abiertas con antigüedad mayor
que `hold_ttl_seconds` (`expires_at ≤ now`, con `expires_at = created_at + hold_ttl_seconds` fijado
al reservar; ver 3.1): `release_reason = 'expired'`, sin movimiento ni cobro, y emite
`credits.hold.expired`. La tarea programada `jobs/holds-cleanup.ts` (L14) solo la invoca
periódicamente (y una vez al arrancar); no contiene la regla.

### 4.4 Operación de IA (`ai_operations`)

| Desde | Evento | Hacia | Cobro |
|---|---|---|---|
| — | Rechazo antes de reservar (validación con operación válida, límites, mantenimiento, coste máximo, saldo, tope diario, freno) | **rejected** (terminal, sin reserva) | 0 |
| — | Reserva creada (misma transacción) | **in_progress** | — |
| in_progress | Respuesta entregada | **ok** | coste real (o 0 + `absorbed_reason = undelivered_replay` si repite una `undelivered`) |
| in_progress | Fallan todos los proveedores o *timeout* total | **provider_error** (`error_code` `PROVIDER_ERROR`, `PROVIDER_TIMEOUT` o `TRANSCRIPTION_FAILED`) | 0 |
| in_progress | Cliente cierra antes de la respuesta del proveedor | **cancelled** | 0 (si el proveedor la factura, su coste conocido va a `cost_micro_usd` como pérdida por cancelación, D-05) |
| in_progress | Cliente cierra después de la respuesta | **undelivered** | coste real |
| in_progress | Reinicio o reserva caducada | **interrupted** | 0 |

Idempotencia (misma `user_id` + `idempotency_key`, última fila dentro de
`idempotency_window_minutes`):

| Última fila | Respuesta | Nueva fila |
|---|---|---|
| `in_progress` | `409 REQUEST_IN_PROGRESS` | No (lo garantiza el UNIQUE parcial, D-12) |
| `ok` | `409 DUPLICATE_REQUEST` (`details.operationId`) | No |
| `undelivered` | Se ejecuta de nuevo | Sí; sin cobro, coste en `absorbed_micro` |
| `provider_error`, `cancelled`, `interrupted`, `rejected` | Se ejecuta con normalidad | Sí |
| Ninguna en la ventana | Petición nueva | Sí |

### 4.5 Pago (`payments`)

| Desde | Evento | Hacia | Efectos |
|---|---|---|---|
| — | Envío del formulario con `attempt_id` nuevo | **pending** | Aceptación `withdrawal_waiver`; en `simulated`, en la misma transacción pasa a `completed` |
| pending | `payment_completed` | **completed** | Bolsa `paid` (`simulated` según el pago), movimiento `purchase` y, si hay deuda, `debt_settlement`; si no es simulada, `has_real_purchase = 1` y factura (con proveedor real) |
| completed | Reembolso parcial del admin (BE-FR-27) | **partially_refunded** | `refund` sobre la bolsa; `refunded_eur_cents`; rectificativa |
| completed / partially_refunded | Reembolso total | **refunded** | Ídem |
| completed / partially_refunded | `chargeback_opened` (BE-FR-28) | **chargeback** | `chargeback` sobre la bolsa y sobre la deuda (sin tope); cuenta bloqueada; rectificativa |

No hay estado de fallo o abandono (hueco H-14).

### 4.6 Factura (`invoices`)

No tiene transiciones: cada emisión es una fila inmutable. Tipos: **simplified** (sin factura
completa pedida), **full** (pedida y con datos fiscales), **corrective** (reembolso o contracargo;
`corrects_invoice_id` obligatorio, importe negativo). La completa posterior de una simplificada es
otra fila `full` del mismo pago (hueco H-16).

### 4.7 Bolsa (`credit_buckets`)

| Desde | Evento | Hacia |
|---|---|---|
| — | Bienvenida, compra o ajuste positivo | **Activa** (`remaining_micro > 0`) |
| Activa | Consumo, liquidación de deuda, reembolso o contracargo hasta 0 | **Agotada** (`remaining_micro = 0`; terminal: `remaining` nunca crece) |
| Activa (`free`) | `expires_at ≤ now` (tarea diaria) | **Caducada** (movimiento `expiry` por el resto; `remaining = 0`) |
| Activa (`free`) | `free_expiry_warning_days` antes, con saldo | Activa con aviso (`expiry_warning_sent_at`) |
| Activa | Borrado de la cuenta (BE-FR-07, 86) | **Agotada** (movimiento `forfeit` por el resto; D-15) |

### 4.8 Documento legal y aceptación

- Documento: **publicado** (`published_at` futuro = programado) → **vigente** (el de mayor
  `published_at` ≤ ahora) → **sustituido** (hay otro más reciente). Nunca se edita.
- Aceptación pendiente para (usuario, documento): existe una versión vigente con
  `requires_reacceptance = 1` y el usuario no tiene aceptación de esa versión (ni de una
  posterior). Al aceptar (`POST /me/accept-terms` o panel) se inserta `terms_acceptances` y deja
  de estar pendiente. Las versiones informativas solo generan email y aviso.

### 4.9 Intento de compra (BE-FR-25 CA4)

**Generado** (UUID en el formulario, sin persistir) → **usado** (existe `payments` con
(`user_id`, `attempt_id`)). Un segundo envío con el mismo identificador no crea nada y muestra la
compra existente («Esta compra ya se completó»). Sin caducidad: un identificador antiguo se puede
usar una sola vez (hueco H-24).

---

## 5. Invariantes de dinero

### 5.1 Invariantes comprobables (test de propiedades, L05, y tarea diaria BE-FR-15 CA1)

| # | Invariante |
|---|---|
| D1 | Para cada bolsa `b`: `b.remaining_micro = Σ m.amount_micro` de los movimientos con `m.bucket_id = b.id` |
| D2 | Para cada cuenta `u`: `user_balances.debt_micro = − Σ m.amount_micro` de sus movimientos con `bucket_id IS NULL` |
| D3 | Consecuencia: saldo materializado = `Σ remaining_micro − debt_micro = Σ m.amount_micro` de todos sus movimientos (reconstrucción desde el ledger) |
| D4 | `0 ≤ remaining_micro ≤ initial_micro`; `initial_micro` = importe del movimiento que creó la bolsa; `debt_micro ≥ 0` |
| D5 | Reservado = Σ `amount_micro` de las reservas abiertas; disponible = saldo − reservado |
| D6 | Al crear una reserva: `amount ≤ disponible + (max_debt − debt)` y `disponible ≥ min_balance_to_operate`; con `debt > 0` no se crea ninguna |
| D7 | `debt_micro ≤ max_debt` salvo tras un contracargo (o si el admin baja `max_debt`) |
| D8 | Para cada operación: `charged_micro = − Σ amount_micro` de sus movimientos `usage`; `charged_micro + absorbed_micro` (`debt_cap`) = cobro calculado (BE-FR-19); una operación terminal no tiene reserva abierta |
| D9 | Cada pago `completed` (o posterior) tiene exactamente una bolsa con `initial_micro = credits_micro`, `simulated` igual y un movimiento `purchase` |
| D10 | Como mucho una bolsa `welcome` por cuenta; si existe, el hash de su email normalizado está en `welcome_grants` |
| D11 | `has_real_purchase = 1` ⇔ existe un pago no simulado que llegó a `completed` (hueco H-13) |
| D12 | Un `refund` nunca supera el `remaining_micro` de la bolsa de esa compra en ese momento |
| D13 | Cada liquidación de deuda es un par en la misma transacción: línea en la bolsa entrante `−s` y línea de deuda `+s`, con `s = min(entrada, deuda)`; el par suma 0 |
| D14 | Pérdida por deuda liquidada con un ajuste gratuito = Σ `s` de los pares cuya bolsa es `free` (aclaración 2026-10-10) |

### 5.2 Tipos de movimiento (BE-FR-15 más `forfeit`, D-15)

| Tipo | Signo | `bucket_id` | Referencias | Origen |
|---|---|---|---|---|
| `welcome` | + | bolsa `free` nueva | — | Verificación (BE-FR-12) |
| `purchase` | + | bolsa `paid` nueva | `payment_id` | Compra real o simulada (BE-FR-25) |
| `usage` | − | cada bolsa consumida (orden BE-FR-14) y una línea **nula** por la parte que pasa a deuda | `operation_id`, `app_id` | Cobro de una operación (sección 8, paso 9) |
| `adjustment` | + o − | + crea bolsa (`free` con caducidad o `paid`); − reduce bolsas del tipo indicado, nunca más que el saldo disponible (D-16: si no, error de validación; no crea deuda) | `admin_id`, `admin_reason` | Ajuste manual (BE-FR-18) |
| `expiry` | − | bolsa `free` caducada | — | Tarea diaria (BE-FR-16) |
| `refund` | − | bolsa de la compra | `payment_id`, `admin_id`, `admin_reason` | Reembolso manual (BE-FR-27) |
| `chargeback` | − | bolsa de la compra (su resto) y una línea **nula** por lo que falte (deuda sin tope) | `payment_id` | Contracargo (BE-FR-28) |
| `debt_settlement` | par −/+ | − en la bolsa entrante; + en la línea **nula** (reduce la deuda) | `payment_id` o `admin_id` | Entrada `paid` o **cualquier ajuste positivo del administrador**, gratuito o comprado (BE-FR-17, aclaración 2026-10-10) |
| `forfeit` | − | cada bolsa con saldo (por su resto) | — | Borrado de la cuenta por el usuario o por inactividad (BE-FR-07, 86 CA3; D-15). Cuenta en estadísticas como saldo perdido |

No hay movimientos `hold` ni `release`: las reservas no son movimientos (BE-FR-15).

Ejemplo (BE-FR-22, fila 4; D-07): saldo 55 en una bolsa; cobro 58,236 (58.236.000 µc) →
`usage −55` (bolsa) y `usage −3,236` (línea nula); `debt_micro = 3.236.000`; saldo −3,236 (se
muestra «−3,2»). Compra posterior de 5.000 → `purchase +5.000` (bolsa nueva),
`debt_settlement −3,236` (bolsa nueva) y `debt_settlement +3,236` (línea nula); deuda 0; saldo
4.996,764.

### 5.3 Transacciones

Toda escritura que toque saldo, bolsas, deuda, reservas o ledger es **una** transacción
`BEGIN IMMEDIATE` sin `await`, abierta por el servicio que orquesta: reserva (transacción 1 con la
fila `in_progress` de `ai_operations`), cobro (transacción 2 con la actualización de
`ai_operations`), compra, ajuste, caducidad, reembolso, contracargo y pérdida por borrado
(`forfeit`).

---

## 6. Retención y anonimización

Plazos por defecto de BE-FR-83 (a confirmar, decisión 15; el plazo de prescripción está pendiente
del abogado). «Borrado» = BE-FR-07 (usuario o
inactividad, BE-FR-86); «Purga» = BE-FR-68 (sin verificar, borrado físico total).

| Tabla | En el borrado de cuenta | Plazo automático (tarea diaria) |
|---|---|---|
| `user` | Anonimizada: `email = deleted+<id>@invalid` (libera el email y respeta `NOT NULL UNIQUE`), `name = ''`, `image`, `email_normalized`, `last_activity_at`, `inactivity_warned_at`, `ban_reason` a nulo, `role = 'user'`, `deleted_at = now`. Se conservan `id`, `created_at`, `signup_app_id` y `signup_ip` (prueba, hueco H-17) | Purga: borrado físico a los `unverified_account_ttl_days`. `signup_ip` a nulo al vencer el plazo de prescripción (sin parámetro, H-17) |
| `session` | Borradas todas | Borradas 30 días tras `expires_at` |
| `account` | Borradas (hash de contraseña) | — |
| `verification` | Borradas las del usuario | Borradas al caducar |
| `auth_rate_limits` | — (no ligadas a la cuenta) | **[Supuesto]** Borradas las filas con `window_start` de más de 24 h |
| `login_attempts` | — (no ligadas a la cuenta) | **[Supuesto]** Borradas con `window_start` de más de 24 h y sin bloqueo vigente |
| `disposable_domains` | — | Refresco semanal |
| `user_app_activity` | Borradas | — |
| `welcome_grants` | **Se conserva** (BE-FR-07 CA3) | Sin plazo (hueco H-17) |
| `terms_acceptances` | Se conservan (prueba del consentimiento, ligadas al id anonimizado) | `ip` a nulo al vencer la prescripción (H-17); purga en cascada |
| `user_balances` | Se conserva; `low_balance_threshold_micro = NULL` | Plazo legal (ledger) |
| `credit_buckets` | Se conservan, puestas a cero con movimientos `forfeit` (D-15) | Plazo legal (ledger) |
| `credit_holds` | Se liberan las abiertas (`released`) | **[Supuesto]** Borradas las liberadas de más de 24 meses (no son contables) |
| `credit_movements` | Se conservan (solo el `user_id` opaco de una cuenta anonimizada; `admin_reason` no debe contener datos personales; D-18) | Plazo legal ~6 años; no se modifican ni se borran: ninguna vía desactiva los *triggers* (D-18) |
| `ai_operations` | Se conservan; `session_id` queda nulo al borrarse las sesiones | A los 24 meses: `user_id`, `session_id`, `idempotency_key` y `provider_generation_id` a nulo (hueco H-18) |
| `payments` | Se conservan anonimizados (ligados al id anonimizado) | Plazo legal ~6 años |
| `billing_profiles` | Borrada | Mientras exista la cuenta |
| `invoices` | Se conservan **íntegras** (incluido `billing_snapshot`) por obligación legal (D-18) | Plazo legal ~6 años; en la v4 no se emiten facturas (H-17) |
| `sync_documents` | Borrados (todas las apps) | Mientras exista la cuenta; las marcas de borrado de más de 30 días se limpian a diario (H-27) |
| `admin_audit` | Se conserva (sin emails por la regla de 3.7) | Sin plazo (H-17) |
| `alerts_state` | — | **[Supuesto]** Borradas las claves con usuario o fecha de más de 30 días |
| `announcements`, `apps`, `app_operations`, `prompt_templates`, `settings`, `legal_documents`, `packs`, `app_defaults`, `price_references`, `fx_rates`, `model_cache`, `protection_state`, `release_downloads` | Sin datos personales | Sin plazo |

Fuera de la BD: logs de OpenObserve 30 días; backups de Litestream 30 días (los datos borrados
desaparecen de los backups a los 30 días).

---

## 7. Tabla resumen

| Tabla | Funcionalidad dueña | Requisitos | Creación (`schema.ts` + migración) | Primer uso | FK «adelante» |
|---|---|---|---|---|---|
| `admin_audit` | audit | BE-FR-55, 61 CA3 | L02 | L02 | `user` |
| `alerts_state` | notifications | BE-FR-15, 46, 56, 80, 82, 87 | L06 | L06 (`fx_stale`), L14 (resto de claves) | — |
| `announcements` | notifications | BE-FR-85 | L04 | L04 | `apps` |
| `apps` | apps | BE-FR-62, 47, 48, 64, 84 | L02 | L02 | — |
| `app_operations` | apps | BE-FR-31, 32, 35, 72, 77 | L02 | L02 (seed), L07 | — |
| `prompt_templates` | apps | BE-FR-78, 79 | L02 | L07 | `user` |
| `settings` | apps | BE-FR-61, sección 9 | L02 | L02 | — |
| `legal_documents` | legal | BE-FR-60, 70, 26 | L02 | L03 (seed), L12, L13 (publicación) | `user` |
| `terms_acceptances` | legal | BE-FR-01, 26, 69, 70 | L02 | L03 | `user` |
| `price_references` | pricing | BE-FR-73 | L13 | L13 (valor manual), L14 (tarea) | — |
| `fx_rates` | pricing | BE-FR-87, 19 | L02 | L06 | `user` |
| `credit_buckets` | credits | BE-FR-12–14, 16, 25, 27, 28 | L05 | L05 | `user`, `payments` |
| `user_balances` | credits | BE-FR-17, 11.6, 49.7 | L05 | L05 | `user` |
| `credit_holds` | credits | BE-FR-71 | L05 | L05 | `user`, `ai_operations` |
| `credit_movements` | credits | BE-FR-15, 17, 18, 27, 28 | L05 | L05 | `user`, `payments`, `ai_operations` |
| `welcome_grants` | credits | BE-FR-11.5, 07 CA3 | L05 | L05 (D-20) | — |
| `billing_profiles` | invoicing | BE-FR-74 | L10 | L10 | `user` |
| `invoices` | invoicing | BE-FR-75, 27, 28 | L10 | L10 | `payments` |
| `user` | accounts | BE-FR-01–04, 07, 10, 11, 64, 66, 68, 83, 86 | L02 | L03 | — |
| `session` | accounts | BE-FR-03–06, 65 | L02 | L03, L04 (campos de app) | — |
| `account` | accounts | BE-FR-05, 09 | L02 | L03 | — |
| `verification` | accounts | BE-FR-02, 05, 66 | L02 | L03 | — |
| `auth_rate_limits` | accounts | BE-FR-45 (D-02) | L03 | L03 | — |
| `login_attempts` | accounts | BE-FR-67 | L03 | L03 | — |
| `disposable_domains` | accounts | BE-FR-11.2 | L03 | L03 (lista), L14 (refresco) | — |
| `user_app_activity` | accounts | BE-FR-54, 85 CA1 (D-13) | L03 | L03 (tabla), L04 (uso) | — |
| `packs` | payments | BE-FR-23 | L02 | L02 (seed), L10 | — |
| `payments` | payments | BE-FR-24–28 | L02 | L10 | — |
| `sync_documents` | sync | BE-FR-39–41 | L11 | L11 | — |
| `app_defaults` | sync | BE-FR-40, 42, 57 | L11 | L11 (seed de `sync` y edición) | — |
| `protection_state` | protections | BE-FR-46, 53 | L09 | L09 | — |
| `ai_operations` | ai | BE-FR-38, 21, 37, 79–82 | L02 | L07 | — |
| `model_cache` | ai | BE-FR-72, 77 CA3, 80 | L07 | L07, L14 (vigilancia) | — |
| `release_downloads` | stats | BE-FR-54 | L13 | L13 (embudo), L14 (tarea) | — |

La columna «Creación» es el lote real en el que se declara la tabla y se genera su migración (I7):
L02 crea, además de las tablas del *seed*, los destinos de las FK «adelante» que necesitan L03 y L05
(`user`, `session`, `account`, `verification`, `legal_documents`, `terms_acceptances`, `packs`,
`payments`, `fx_rates`, `ai_operations` y `prompt_templates`); el resto se crea en el primer lote que
lo necesita (`alerts_state` en L06 con la alerta del tipo de cambio; `price_references` en L13 con el
valor manual de W38). Ningún lote posterior vuelve a crear una tabla ya creada: solo la amplía con una
migración incremental si hace falta.

**Total: 34 tablas** (33 de Historias §6, con `auth_rate_limits` en lugar de `rate_limit` de
Better Auth, D-02, + `user_app_activity`, D-13). El intento de compra es
una columna (`payments.attempt_id`), no una tabla.

Grafo de importaciones entre `schema.ts` (solo `references()`): `apps` ← `accounts` ← {`audit`,
`legal`, `credits`, `invoicing`, `payments`, `ai`, `sync`}; `payments` ← {`credits`,
`invoicing`}; `ai` ← `credits`; `legal` ← `payments`; `pricing` ← `ai`; `apps` ← todas las que
llevan `app_id`. Sin ciclos: ni `apps` ni `accounts` ni `payments` ni `ai` importan el esquema de
`audit`, `notifications`, `credits` o `invoicing`. Estas importaciones no cuentan para el orden ni
para los ciclos del principio IV (D-03).

---

## 8. Huecos, contradicciones y decisiones supuestas

### 8.1 Huecos cerrados por la revisión del plan (2026-10-10)

H-01 (D-03), H-02 y H-19 (D-11), H-03 y H-04 (D-12), H-05, H-06, H-07 y H-09 (D-14), H-08 (D-13),
H-10 (D-15), H-11 (D-16), H-15 (D-17) y la parte de «vía legal» de H-29 (D-18). Lo decidido ya está
en las fichas de la sección 2 y en las secciones 4–6.

Cerrados por las correcciones tras `/speckit-analyze` (2026-10-10):

- **H-28 Alcance de L02**: L02 crea las tablas del *seed* y los destinos de las FK «adelante» que
  necesitan L03 y L05; la tabla resumen (sección 7) separa el lote de creación del de primer uso
  (I7).
- **Autor de las versiones legales sembradas** (O1): `legal_documents.created_by` admite `NULL`,
  que significa «versión sembrada por el sistema» (no hay administrador cuando se siembra en L03);
  las publicaciones desde el panel lo rellenan siempre. El *seed* incluye `withdrawal_waiver` (O2).
- **Siembra de `app_defaults`** (C3): la hace `sync` (`sync/seed.ts`, L11), no el *seed* de `apps`.
- **Caducidad de reservas** (O3): regla y servicio en `credits` (`expireHolds`, L05); la tarea de
  L14 solo la programa (sección 4.3).

### 8.2 Huecos abiertos

- **H-12 Contracargo de una compra que liquidó deuda**: ¿«el resto» es `credits_micro − remaining`
  o solo lo consumido después?
- **H-13 `has_real_purchase` tras reembolso total o contracargo**: ¿vuelve a 0? Se supone que no.
- **H-14 Estado de pago fallido o abandonado** (relevante con Stripe): no existe; un `pending` se
  quedaría así.
- **H-16 Factura completa a partir de una simplificada**: sin columna de enlace (pendiente de la
  gestoría, decisión 2).
- **H-17 Plazos sin parámetro** (pendientes del abogado): «plazo de prescripción» de las IP
  (registro y aceptaciones), retención de `welcome_grants` (indefinida) y de `admin_audit`,
  retención del ledger de cuentas **activas** con más de 6 años (la reconstrucción del saldo exige
  conservarlo) y destino de las facturas al vencer el plazo legal (fase de cobros reales).
- **H-18 Anonimización de `ai_operations` a los 24 meses**: `credit_movements` (`usage`) sigue
  ligando `operation_id` con `user_id`, así que la operación se puede volver a identificar; además
  el embudo acumulado pierde la «primera operación de IA» por usuario.
- **H-20 Better Auth exige `user.name`**: no se recoge; se supone `''`.
- **H-21 Sesiones revocadas**: Better Auth borra la fila al revocar, así que «30 días tras caducar
  o revocar» (BE-FR-83) solo aplica a las caducadas.
- **H-22 Precio por minuto de Voxtral**: global en §9, pero BE-FR-52 lo pone en la configuración
  de la operación de transcripción. Se mantiene global.
- **H-23 Duplicidades de configuración**: `support_email` y mantenimiento por app son columnas
  (§6) y no claves de `settings_overrides`; el global vive en `settings`.
- **H-24 Caducidad del identificador de intento de compra**: no está definida; sin caducidad, un
  formulario antiguo se puede enviar una vez.
- **H-25 Valor inicial del tipo de cambio** (0,92): `fx_rates.source` solo admite `ecb`/`manual`;
  se usa `settings.fx_usd_eur` mientras no haya filas.
- **H-26 Pérdidas absorbidas**: §6 tiene un solo `absorbed_µc`, pero BE-FR-54 separa deuda
  absorbida y repeticiones no cobradas. Se añade `absorbed_reason` (la pérdida por cancelación se
  deriva de `cost_micro_usd` de las `cancelled`, D-05).
- **H-27 Limpieza diaria de marcas de borrado** en `sync_documents`: ¿incrementa `revision`? Se
  supone que sí, para que ningún cliente sobrescriba sin releer.
- **H-29 *Triggers* en Drizzle**: Drizzle no los declara (migración personalizada, a reconciliar
  con «`schema.ts` solo Drizzle» y con `drizzle-kit check`).
- **H-30 Renuncia al desistimiento**: se acepta en cada compra, así que su UNIQUE debe excluirla
  (se usa UNIQUE parcial).
- **H-31 `cookies` en el registro**: el registro acepta términos, privacidad y uso aceptable; si
  una versión de cookies exige nueva aceptación, todos los usuarios la tendrían pendiente sin
  haberla aceptado nunca.
- **H-32 Borrado de una cuenta bloqueada**: no puede entrar al panel para borrarla y el
  administrador no tiene esa acción.
- **H-33 Precios de OpenRouter** (decimales en texto): la conversión a enteros (µUSD por millón de
  tokens con `ceil`) es un supuesto.

### 8.3 Decisiones supuestas (resumen)

ASCII en los nombres (`_micro`, `_micro_usd`, `_ppm`, `group_label`); temperatura en milésimas;
audio en milisegundos; ids con prefijo; booleanos 0/1 con CHECK; JSON con `json_valid` y Zod;
`user_balances` creada al verificar; liquidación de deuda como par de líneas que suma 0; línea con
`bucket_id` nulo = deuda; FK `RESTRICT` desde lo contable hacia `user` (solo anonimización); intento
de compra como columna UNIQUE sin tabla; `last_used_at` de la sesión como mucho una vez por
minuto; purgas de `auth_rate_limits`, `login_attempts`, `credit_holds` y `alerts_state` con plazos
propuestos; operaciones con operación desconocida sin fila en `ai_operations`;
`legal_documents.created_by` nulo = versión sembrada por el sistema (O1).
