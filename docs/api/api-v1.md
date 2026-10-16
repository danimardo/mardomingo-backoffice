# Contrato de la API `/api/v1` para las apps

**Funcionalidad**: `001-cuenta-mardomingo-v4` · **Fase**: 1 de `/speckit-plan` · **Fecha**: 2026-10-10

**Fuente normativa**: `Historias.md` v2.6 §7 (7.1 convenciones, 7.2 códigos, 7.3 endpoints, 7.4 desconexión)
y §8 (flujo de cobro), con las aclaraciones del 2026-10-10 de `spec.md` y las decisiones de la revisión del
plan del mismo día (D-01…D-22 de `plan.md`). Este documento **no añade endpoints**:
concreta los de 7.3 con su autenticación, validación, errores, idempotencia y eventos de log.

**Relación con el OpenAPI.** El documento OpenAPI 3.1 publicado en `GET /api/v1/openapi.json` se **genera**
con `zod-openapi` a partir de los esquemas Zod de cada `src/lib/server/features/<f>/contract.ts` y se monta en
`src/lib/server/api/` (constitución, principio VI). Este documento es su **especificación**: antes de
implementar un endpoint se escribe su esquema de petición, respuesta y errores según lo que sigue. Si el
OpenAPI generado y este documento discrepan, es un defecto: se corrige el código o se enmiendan este
documento y `Historias.md` §7. Los tests HTTP (`test:http`) validan todas las respuestas contra el OpenAPI
generado (Historias 15.10, 15.13).

Referencias cruzadas: eventos de log en [log-events.md](./log-events.md); tablas y campos en
[data-model.md](../data-model.md); rutas de la web en [web-routes.md](./web-routes.md).

Marcas usadas: **[7.x]** = literal de `Historias.md`; **[Propuesta]** = decisión de diseño de esta fase que
no fija `Historias.md` y que el plan debe confirmar; **[Hueco]** = ambigüedad o contradicción detectada en
`Historias.md` (resumen en la sección 8).

---

## 1. Convenciones

### 1.1 Base, versionado y formato

| Aspecto             | Regla                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base                | `https://api.mardomingo.com/api/v1` (staging: `https://api-staging.mardomingo.com/api/v1`). **[7.1]**                                                                                                                                                                                                        |
| Separación por host | El host de la API solo responde a `/api/v1/*`; cualquier otra ruta → `404` sin ejecutar nada. Excepción: `/api/v1/health` responde con cualquier `Host` (healthcheck de Coolify). (Constitución, «Rutas y dominios»).                                                                                        |
| Versionado          | Por ruta. Un cambio incompatible (eliminar o renombrar campos, cambiar tipos o semántica, añadir campos obligatorios en la petición) exige `/api/v2` y mantener `/api/v1` durante la transición. Añadir campos opcionales en la respuesta es compatible. (BE-FR-48 CA3, principio VI).                       |
| Cuerpo              | JSON (`Content-Type: application/json`), salvo `POST /ai/transcribe` (`multipart/form-data`). **[4.3]**                                                                                                                                                                                                      |
| CSRF                | No aplica en el host de la API: solo autentica con Bearer y no lee cookies. La comprobación de origen de SvelteKit está desactivada y la propia de `handle` se aplica **solo en el host web** (D-01), así que un `POST /ai/transcribe` en `multipart/form-data` sin `Origin` (apps de escritorio) se acepta. |
| Importes            | Enteros en **microcréditos** con sufijo `Micro` (`chargedMicro`, `availableMicro`…). Nunca decimales. La app los formatea con el redondeo de BE-FR-22. **[7.1]**                                                                                                                                             |
| Fechas              | Instantes en ISO 8601 UTC (`2026-11-05T00:00:00Z`). Fechas de calendario, `YYYY-MM-DD`. (Principio VI, «Datos y almacenamiento»).                                                                                                                                                                            |
| Entradas            | `z.strictObject` en todos los cuerpos: una clave desconocida → `400 VALIDATION_ERROR`. Enteros con `z.int()`. Sin `z.coerce.number()`. (Principio XII).                                                                                                                                                      |
| Caché               | Las respuestas autenticadas llevan `Cache-Control: private, no-store`. **[Propuesta]**                                                                                                                                                                                                                       |
| Privacidad          | Los cuerpos de `/ai/*` y `/sync` **nunca** se registran ni se guardan (BE-FR-38, principio XI). El valor recibido nunca se devuelve en un error (`reportInput` prohibido).                                                                                                                                   |

### 1.2 Cabeceras de petición

| Cabecera                        | Obligatoria en                                          | Validación (frontera, principio XII)                                                                                                              | Efecto                                                                                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-App-Id: <slug>`              | Todas, salvo `/health` y `/openapi.json` (BE-FR-62 CA1) | Texto con el patrón del _param matcher_ de slug de app: `^[a-z0-9][a-z0-9-]{0,62}$` **[Propuesta]**                                               | Ausente, mal formada o desconocida → `400 UNKNOWN_APP`; app `disabled` → `503 APP_DISABLED`. **Identifica, no autentica** (BE-FR-62 CA2).                                                                                                               |
| `X-App-Version: x.y.z`          | Todas las de las apps **[7.1]**                         | `^\d{1,4}\.\d{1,4}\.\d{1,4}$` **[Propuesta]**                                                                                                     | En peticiones **autenticadas** de una app con `enforce_version`, versión < `min_app_version` o ausente → `426 UPGRADE_REQUIRED` (BE-FR-48 CA1). En el login se guarda en la sesión (BE-FR-03 CA3). Filtra los anuncios de `/app/status` (BE-FR-85 CA1). |
| `X-Device-Name: <nombre>`       | Escritorio y móvil **[7.1]**; opcional para apps web    | Texto recortado, 1–100 caracteres, sin caracteres de control **[Propuesta]** ([Hueco] 7.1 no fija longitud)                                       | Se guarda en la sesión al hacer login (`session.device_name`) y se muestra en el panel. No se registra en logs.                                                                                                                                         |
| `Authorization: Bearer <token>` | Endpoints no marcados como públicos                     | Token opaco de Better Auth (plugin `bearer`). Nunca se registra.                                                                                  | Sin token, caducado, revocado o de otra app → `401 UNAUTHENTICATED` (BE-FR-04, BE-FR-65 CA3). La API **no** lee cookies (constitución, «Autenticación y autorización»).                                                                                 |
| `Idempotency-Key: <uuid>`       | Recomendada en `/ai/*` (BE-FR-81)                       | `z.uuid()`. Mal formada → `400 VALIDATION_ERROR` (`details.field = "Idempotency-Key"`). Nunca se registra.                                        | Ver 1.6. Sin cabecera, cada petición es independiente (BE-FR-81 CA2).                                                                                                                                                                                   |
| `If-Match: <revision>`          | `PUT /sync`                                             | Texto de solo dígitos (`^\d+$`), convertido a entero seguro. Ausente o mal formada → `400 VALIDATION_ERROR` (`details.field = "If-Match"`) (D-19) | Revisión distinta de la actual → `412 SYNC_CONFLICT` (BE-FR-41).                                                                                                                                                                                        |
| `Origin`                        | La envían solo los navegadores (apps web)               | —                                                                                                                                                 | Ver 1.5 (CORS por app).                                                                                                                                                                                                                                 |
| `X-Request-Id` (entrante)       | —                                                       | **Se ignora**                                                                                                                                     | El servidor siempre genera el suyo (principio XI).                                                                                                                                                                                                      |

### 1.3 Cabeceras de respuesta

| Cabecera                                                                                                  | Cuándo                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Request-Id: <uuid>`                                                                                    | En **todas** las respuestas. Es el «Código de referencia» para soporte. No se añade al cuerpo de los errores. (Principio XI).                                    |
| `Retry-After: <segundos>`                                                                                 | En `429 RATE_LIMITED` y `429 LOGIN_TEMPORARILY_LOCKED`. **[7.2]**                                                                                                |
| `Access-Control-Allow-Origin`, `Vary: Origin`, `Access-Control-Expose-Headers: X-Request-Id, Retry-After` | Solo si la petición trae `Origin` permitido (1.5).                                                                                                               |
| `Cache-Control: private, no-store`                                                                        | Respuestas autenticadas **[Propuesta]**. `/app/status`, `/health` y `/openapi.json`: `no-store` también, porque reflejan configuración editable sin redesplegar. |
| Cabeceras de seguridad                                                                                    | Las del hook de cabeceras (HSTS, `X-Content-Type-Options: nosniff`, sin CSP de página en JSON).                                                                  |

### 1.4 Formato de error

Todas las respuestas de error, sin excepción, usan este formato y solo los códigos de la tabla 2
(principio VI, FR-062). Nunca `error()` de SvelteKit ni `+error.svelte` en la API.

```json
{
	"error": {
		"code": "INSUFFICIENT_BALANCE",
		"message": "Texto en español apto para mostrar",
		"details": { "requiredMicro": 50000000, "availableMicro": 12000000 }
	}
}
```

- `code`: uno de la tabla 2.
- `message`: texto en español de Paraglide, apto para mostrar al usuario final. **Excepción**: en
  `MAINTENANCE`, `message` es el texto que escribió el administrador (BE-FR-47) **[7.2]**.
- `details`: objeto (puede ser `{}`); solo los campos documentados por código. Nunca contiene la entrada
  recibida, nombres de modelo, proveedores subyacentes ni datos internos (principio II).
- Los errores de validación de Zod se traducen a `VALIDATION_ERROR` con `details.field` = ruta del primer
  error (p. ej. `messages.1.content`, `operation`, `If-Match`) mediante `z.config({ customError })`.
- Lo genera un formateador común en `src/lib/server/api/` a partir de los errores tipados de
  `src/lib/server/shared/`.

### 1.5 CORS por app (BE-FR-65 CA2)

- Las apps de escritorio y móviles no envían `Origin`: no se aplica CORS.
- Petición con `Origin`: se acepta solo si el origen figura en `apps.allowed_origins` de la app de
  `X-App-Id`. Si no figura → la respuesta **no** incluye `Access-Control-Allow-Origin` y el servidor responde
  `403 ORIGIN_NOT_ALLOWED` sin ejecutar la ruta (D-19).
- _Preflight_ (`OPTIONS`): el navegador no envía el **valor** de `X-App-Id` en el _preflight_, así que no se
  puede resolver la app. Se acepta (`204`) si el `Origin` figura en la lista de **alguna** app activa (D-19),
  con `Access-Control-Allow-Headers: Authorization, Content-Type, X-App-Id, X-App-Version, X-Device-Name,
Idempotency-Key, If-Match`, `Access-Control-Allow-Methods: GET, POST, PUT` y `Access-Control-Max-Age: 600`;
  la comprobación estricta (origen ∈ lista de la app de `X-App-Id`) se hace en la petición real.
- Nunca `Access-Control-Allow-Origin: *` ni `Allow-Credentials` (la API no usa cookies).

### 1.6 Idempotencia de `/ai/*` (BE-FR-81)

Para un mismo **usuario** y `Idempotency-Key`, durante `idempotency_window_minutes` (10 por defecto):

| Estado de la operación anterior                           | Respuesta                                          | ¿Llama al proveedor? | ¿Cobra?                                  |
| --------------------------------------------------------- | -------------------------------------------------- | -------------------- | ---------------------------------------- |
| En curso                                                  | `409 REQUEST_IN_PROGRESS`                          | No                   | No                                       |
| Terminada y **entregada**                                 | `409 DUPLICATE_REQUEST`, `details.operationId`     | No                   | No                                       |
| Terminada pero **no entregada** (`undelivered`)           | Se ejecuta de nuevo, `200` con nuevo `operationId` | Sí                   | **No** (coste registrado como absorbido) |
| Fallida o cancelada antes de que respondiera el proveedor | Se ejecuta de nuevo con normalidad                 | Sí                   | Según BE-FR-21                           |
| Sin cabecera o fuera de ventana                           | Petición independiente                             | Sí                   | Sí                                       |

- La clave se compara por usuario (índice único parcial sobre (`user_id`, `idempotency_key`) solo para el
  estado `in_progress` de `ai_operations`, D-12, que permite repetir tras `undelivered` o fallo), no por app
  ni por operación. **[Propuesta]**: reutilizar una clave con otra operación o cuerpo distinto se
  trata igual (la clave identifica la acción del usuario; el contenido no se guarda para compararlo).
- El contenido **no** se guarda para reentregarlo (BE-FR-81 CA1).

### 1.7 Desconexión del cliente (7.4, BE-FR-37)

En `/ai/*`, si el cliente cierra la conexión antes de recibir la respuesta, el servidor aborta la llamada al
proveedor (`AbortSignal`) y detiene los reintentos:

- Antes de que respondiera el proveedor → operación `cancelled`, reserva liberada, **sin cobro al usuario**.
  Sin _streaming_, abortar no evita que el proveedor la facture: cuando se conoce su coste (en la respuesta o
  con la consulta posterior de la generación), se guarda en la operación y cuenta en las estadísticas como
  **pérdida por cancelación** (D-05; BE-FR-37, BE-FR-54). Se registra `ai.cancellation_cost.recorded`.
- Después de que respondiera (coste conocido) → se cobra y la operación queda `undelivered`; el reintento con
  la misma `Idempotency-Key` no se cobra (1.6).
- El temporal de audio se borra en un `finally` también al cancelar (BE-FR-38 CA2).

### 1.8 Orden de comprobaciones (§8 paso 1–6, FR-063)

Se aplican en este orden; el primer fallo determina la respuesta. «—» = no aplica a ese endpoint.

| #   | Comprobación                                         | Código                                          | `/app/status`  | `/auth/login`, `/auth/resend-verification` | `/auth/logout`, `/me`, `/me/accept-terms` | `/ai/*` | `/sync`, `/defaults`                |
| --- | ---------------------------------------------------- | ----------------------------------------------- | -------------- | ------------------------------------------ | ----------------------------------------- | ------- | ----------------------------------- |
| 0   | Host de la API                                       | `404` (sin formato 7.1)                         | Sí             | Sí                                         | Sí                                        | Sí      | Sí                                  |
| 1   | `X-App-Id` presente y conocido                       | `400 UNKNOWN_APP`                               | Sí             | Sí                                         | Sí                                        | Sí      | Sí                                  |
| 2   | App activa                                           | `503 APP_DISABLED`                              | Sí             | Sí                                         | Sí                                        | Sí      | Sí                                  |
| 3   | `Origin` permitido (si viene)                        | `403 ORIGIN_NOT_ALLOWED` (D-19)                 | Sí             | Sí                                         | Sí                                        | Sí      | Sí                                  |
| 4   | Límite por IP de autenticación (BE-FR-45)            | `429 RATE_LIMITED`                              | —              | Sí                                         | —                                         | —       | —                                   |
| 5   | Sesión Bearer válida y ligada a la app               | `401 UNAUTHENTICATED`                           | —              | —                                          | Sí                                        | Sí      | Sí                                  |
| 6   | Versión (`enforce_version`)                          | `426 UPGRADE_REQUIRED`                          | —              | —                                          | Sí (salvo logout, D-19)                   | Sí      | Sí                                  |
| 7   | Mantenimiento global o de la app                     | `503 MAINTENANCE`                               | — (lo informa) | —                                          | —                                         | Sí      | Solo `/sync` (`/defaults` no, D-19) |
| 8   | Freno global (cuentas sin compras reales)            | `503 SERVICE_LIMITED`                           | —              | —                                          | —                                         | Sí      | —                                   |
| 9   | Documentos legales pendientes                        | `403 TERMS_ACCEPTANCE_REQUIRED`                 | —              | —                                          | —                                         | Sí      | Solo `/sync` (`/defaults` no, D-19) |
| 10  | `Idempotency-Key`                                    | `409 REQUEST_IN_PROGRESS` / `DUPLICATE_REQUEST` | —              | —                                          | —                                         | Sí      | —                                   |
| 11  | Validación de forma, operación, tamaños y duración   | `400` / `413`                                   | —              | Sí                                         | Sí                                        | Sí      | Sí                                  |
| 12  | Frecuencia y concurrencia por usuario (cuenta + app) | `429 RATE_LIMITED`                              | —              | —                                          | —                                         | Sí      | —                                   |
| 13  | Coste máximo estimado ≤ tope                         | `413 OPERATION_TOO_EXPENSIVE`                   | —              | —                                          | —                                         | Sí      | —                                   |
| 14  | Saldo, deuda, tope diario y reserva (transacción)    | `402`                                           | —              | —                                          | —                                         | Sí      | —                                   |

Notas:

- `ACCOUNT_BLOCKED` y `EMAIL_NOT_VERIFIED` solo aparecen en el login: un bloqueo revoca todas las sesiones
  (BE-FR-04 CA4), así que una petición posterior con ese token recibe `401 UNAUTHENTICATED`.
- El mantenimiento **no** bloquea login, logout, `/me`, `/app/status`, `/defaults` ni la aceptación de
  términos (BE-FR-47, BE-FR-70 CA1, D-19). `/defaults` tampoco se bloquea por documentos pendientes.
- `/auth/logout` y `/app/status` no exigen versión mínima (D-19).

---

## 2. Códigos de error **[7.2]**

| HTTP | `code`                      | Cuándo se devuelve                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `details`                                                              | Endpoints                                                  |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`          | Cuerpo, query o cabecera con forma inválida o clave desconocida; operación desconocida, inactiva o de otra app (`details.field = "operation"`, BE-FR-31); variables que faltan, sobran o exceden su límite (BE-FR-78 CA1); `messages` en una operación con plantilla (BE-FR-78 CA3) o `response_format`/`tools` en una que no los permite (BE-FR-79); audio que ffprobe no puede leer (BE-FR-44); documento de sincronización con categorías no declaradas o mal formadas (BE-FR-41 CA2); versión legal que no es la vigente (`/me/accept-terms`) | `field`                                                                | Todos los que tienen entrada                               |
| 400  | `UNKNOWN_APP`               | `X-App-Id` ausente, mal formado o desconocido (BE-FR-62 CA1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —                                                                      | Todos salvo `/health`, `/openapi.json`                     |
| 401  | `UNAUTHENTICATED`           | Sin token, token caducado (30 días sin uso) o revocado, token de otra app (BE-FR-65 CA3)                                                                                                                                                                                                                                                                                                                                                                                                                                                          | —                                                                      | Autenticados                                               |
| 401  | `INVALID_CREDENTIALS`       | Email inexistente o contraseña incorrecta, sin distinguirlos (BE-FR-03 CA1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                                                                      | `POST /auth/login`                                         |
| 402  | `INSUFFICIENT_BALANCE`      | Disponible < `min_balance_to_operate`, deuda > 0, o la reserva no cabe en `disponible + (max_debt − deuda)` (BE-FR-17, BE-FR-71)                                                                                                                                                                                                                                                                                                                                                                                                                  | `requiredMicro`, `availableMicro`                                      | `/ai/*`                                                    |
| 402  | `DAILY_FREE_LIMIT_REACHED`  | Cuenta sin compras reales cuyos cobros del día + reservas activas (todas las apps, día de Madrid) alcanzarían `daily_cap_no_purchase` (BE-FR-11.6)                                                                                                                                                                                                                                                                                                                                                                                                | — ([Hueco] sin `details`)                                              | `/ai/*`                                                    |
| 403  | `EMAIL_NOT_VERIFIED`        | Login de una cuenta sin verificar (BE-FR-02 CA2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                      | `POST /auth/login`                                         |
| 403  | `ACCOUNT_BLOCKED`           | Login de una cuenta bloqueada (BE-FR-03 CA2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —                                                                      | `POST /auth/login`                                         |
| 403  | `TERMS_ACCEPTANCE_REQUIRED` | Hay una versión legal que exige aceptación pendiente (BE-FR-70 CA1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `pending`: lista con la forma de `pendingAcceptances` **[Propuesta]**  | `/ai/*`, `/sync` (no `/defaults`, D-19)                    |
| 403  | `ORIGIN_NOT_ALLOWED`        | Petición con `Origin` que no figura en `allowed_origins` de la app de `X-App-Id` (BE-FR-65 CA2, D-19)                                                                                                                                                                                                                                                                                                                                                                                                                                             | —                                                                      | Todos salvo `/health`, `/openapi.json`                     |
| 404  | `NOT_FOUND`                 | Ruta inexistente dentro de `/api/v1` en el host de la API (D-19)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                      | —                                                          |
| 405  | `METHOD_NOT_ALLOWED`        | Método no admitido por una ruta existente de `/api/v1` (D-19)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | —                                                                      | Todos                                                      |
| 409  | `REQUEST_IN_PROGRESS`       | Operación con la misma `Idempotency-Key` aún en curso (BE-FR-81)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                      | `/ai/*`                                                    |
| 409  | `DUPLICATE_REQUEST`         | Operación con esa clave ya completada y entregada (BE-FR-81)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `operationId`                                                          | `/ai/*`                                                    |
| 412  | `SYNC_CONFLICT`             | `If-Match` no coincide con la revisión actual (BE-FR-41)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | —                                                                      | `PUT /sync`                                                |
| 413  | `PAYLOAD_TOO_LARGE`         | Audio > `max_audio_mb`; texto de mensajes o variables > `max_text_chars`; imagen > `max_image_mb`; documento > `max_sync_doc_kb` (BE-FR-44, BE-FR-41)                                                                                                                                                                                                                                                                                                                                                                                             | —                                                                      | `/ai/*`, `PUT /sync`                                       |
| 413  | `AUDIO_TOO_LONG`            | Duración medida con ffprobe > `max_audio_seconds` + `audio_duration_tolerance_seconds` (BE-FR-44)                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `maxSeconds`                                                           | `POST /ai/transcribe`                                      |
| 413  | `OPERATION_TOO_EXPENSIVE`   | Coste máximo estimado > `max_cost_credits` de la operación (BE-FR-72 CA1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `estimatedMicro`, `maxMicro`                                           | `/ai/*`                                                    |
| 426  | `UPGRADE_REQUIRED`          | Petición autenticada de una app con `enforce_version` y `X-App-Version` < mínima o ausente (BE-FR-48 CA1)                                                                                                                                                                                                                                                                                                                                                                                                                                         | — (el cliente consulta `/app/status`)                                  | Autenticados                                               |
| 429  | `RATE_LIMITED`              | Se supera `ai_requests_per_minute` o `max_concurrent_transcriptions` **de la cuenta** (suma de todas las apps) **o**, si la app tiene valor propio, **el de la app** (solo sus peticiones; no mayor que el global); se aplica el primero que se alcance (BE-FR-43, aclaración 2026-10-10). También el límite por IP de autenticación (BE-FR-45). Con `Retry-After`                                                                                                                                                                                | —                                                                      | `/ai/*`, `/auth/login`, `/auth/resend-verification` (D-19) |
| 429  | `LOGIN_TEMPORARILY_LOCKED`  | `login_max_failures` fallos para el mismo email normalizado en 15 min, exista o no la cuenta (BE-FR-67). Con `Retry-After`                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                                      | `POST /auth/login`                                         |
| 502  | `PROVIDER_ERROR`            | El proveedor (y todos los modelos de respaldo) ha fallado, ha devuelto una respuesta inválida o ha rechazado el contenido por moderación (mensaje genérico, BE-FR-82)                                                                                                                                                                                                                                                                                                                                                                             | —                                                                      | `/ai/chat`, `/ai/image`                                    |
| 502  | `TRANSCRIPTION_FAILED`      | Han fallado Voxtral (tras reintentos) y el backup (BE-FR-35)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `primaryError`, `backupError` (saneados: sin modelo ni datos internos) | `/ai/transcribe`                                           |
| 500  | `INTERNAL_ERROR`            | Error interno inesperado; mensaje genérico (el «Código de referencia» va en `X-Request-Id`) (D-19)                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                                      | Todos                                                      |
| 503  | `MAINTENANCE`               | Mantenimiento global o de la app activo (BE-FR-47); `message` = texto del administrador                                                                                                                                                                                                                                                                                                                                                                                                                                                           | —                                                                      | `/ai/*`, `/sync` (no `/defaults`, D-19)                    |
| 503  | `SERVICE_LIMITED`           | Freno global de gasto activo y la cuenta no tiene compras reales (BE-FR-46)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                                                                      | `/ai/*`                                                    |
| 503  | `APP_DISABLED`              | La app de `X-App-Id` está `disabled` (BE-FR-62 CA1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | —                                                                      | Todos salvo `/health`, `/openapi.json`                     |
| 504  | `PROVIDER_TIMEOUT`          | Se agota el tiempo total de la operación sin respuesta válida (BE-FR-34, BE-FR-80)                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                                      | `/ai/chat`, `/ai/image` ([Hueco] transcripción)            |

`ORIGIN_NOT_ALLOWED`, `NOT_FOUND`, `METHOD_NOT_ALLOWED` e `INTERNAL_ERROR` son los códigos nuevos de 7.2 en
`Historias.md` 2.6 (D-19). La combinación cruzada de host (paso 0 de 1.8) sigue respondiendo `404` sin cuerpo
7.1.

---

## 3. Modelos comunes

### 3.1 `Balance` (saldo)

| Campo            | Tipo                                  | Descripción                     |
| ---------------- | ------------------------------------- | ------------------------------- |
| `totalMicro`     | entero (puede ser negativo con deuda) | Σ bolsas − deuda                |
| `reservedMicro`  | entero ≥ 0                            | Σ reservas activas              |
| `availableMicro` | entero                                | `totalMicro − reservedMicro`    |
| `freeMicro`      | entero ≥ 0                            | Σ bolsas `free` vigentes        |
| `paidMicro`      | entero ≥ 0                            | Σ bolsas `paid`                 |
| `debtMicro`      | entero ≥ 0                            | Deuda                           |
| `nextFreeExpiry` | `{ amountMicro, expiresAt }` o `null` | Bolsa gratuita que caduca antes |

`GET /me` devuelve el `Balance` completo. Las respuestas de `/ai/*` devuelven el **saldo resumido**
`{ totalMicro, reservedMicro, availableMicro, debtMicro }`: incluye `reservedMicro` para distinguir total,
reservado y disponible (BE-FR-71 CA2, D-19).

### 3.2 `PendingAcceptance`

`{ "document": "terms" | "privacy" | "cookies" | "aup", "version": "<texto>", "url": "<URL absoluta de la web>" }`.

### 3.3 Mensajes de chat (`messages[]`)

Subconjunto del formato de OpenRouter/OpenAI (BE-FR-34, BE-FR-79):

| Campo          | Validación                                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role`         | `system` \| `user` \| `assistant` \| `tool`                                                                                                                                                           |
| `content`      | Texto, o array de partes `{ type: "text", text }` / `{ type: "image_url", image_url: { url: "data:image/(png\|jpeg\|webp);base64,…" } }` (las imágenes solo si la operación admite entrada de imagen) |
| `tool_calls`   | Solo en `assistant`, si la operación admite herramientas                                                                                                                                              |
| `tool_call_id` | Obligatorio en `tool`                                                                                                                                                                                 |

Límites: texto total ≤ `max_text_chars`; cada imagen (decodificada) ≤ `max_image_mb`; ambos con herencia
global → app → operación. Las URL de imagen solo pueden ser _data URL_ (nunca URL remotas) **[Propuesta]**.

---

## 4. Endpoints

Resumen (14 endpoints, todos de 7.3):

| #   | Método y ruta                    | Autenticación                              | Funcionalidad dueña (`contract.ts`)                       | Idempotencia                        |
| --- | -------------------------------- | ------------------------------------------ | --------------------------------------------------------- | ----------------------------------- |
| E01 | `GET /app/status`                | Pública (requiere `X-App-Id`)              | `apps` (la ruta compone `apps`, `notifications`, `legal`) | Lectura                             |
| E02 | `POST /auth/login`               | Pública                                    | `accounts`                                                | No                                  |
| E03 | `POST /auth/resend-verification` | Pública                                    | `accounts`                                                | Natural (202 siempre)               |
| E04 | `POST /auth/logout`              | Bearer                                     | `accounts`                                                | Natural                             |
| E05 | `GET /me`                        | Bearer                                     | `accounts` (compone `credits`, `legal`)                   | Lectura                             |
| E06 | `POST /me/accept-terms`          | Bearer                                     | `legal`                                                   | Natural                             |
| E07 | `POST /ai/chat`                  | Bearer                                     | `ai`                                                      | `Idempotency-Key`                   |
| E08 | `POST /ai/transcribe`            | Bearer                                     | `ai`                                                      | `Idempotency-Key`                   |
| E09 | `POST /ai/image`                 | Bearer                                     | `ai`                                                      | `Idempotency-Key`                   |
| E10 | `GET /sync`                      | Bearer                                     | `sync`                                                    | Lectura (siembra la primera vez)    |
| E11 | `PUT /sync`                      | Bearer                                     | `sync`                                                    | `If-Match` (concurrencia optimista) |
| E12 | `GET /defaults`                  | Bearer                                     | `sync`                                                    | Lectura                             |
| E13 | `GET /health`                    | Pública (sin `X-App-Id`, cualquier `Host`) | Infraestructura (`$lib/server/api`)                       | Lectura                             |
| E14 | `GET /openapi.json`              | Pública (sin `X-App-Id`)                   | Infraestructura (`$lib/server/api`)                       | Lectura                             |

En todos los endpoints, además de los eventos propios, se emite `http.request.completed` (y
`http.request.failed` ante un error inesperado). Los rechazos de las comprobaciones comunes (1.8) emiten:
`apps.app.rejected` (pasos 1–2), `http.cors.rejected` (3), `accounts.rate_limit.exceeded` (4),
`accounts.session.rejected` (5), `protections.request.rejected` (6–8, 12), `legal.acceptance.required` (9).

### E01 · `GET /app/status` _(pública; requiere `X-App-Id`)_ — BE-FR-48 CA2, BE-FR-77 CA4, BE-FR-84, BE-FR-85

- **Entrada**: cabeceras `X-App-Id` (obligatoria) y `X-App-Version` (opcional; filtra anuncios por rango de
  versiones). Sin cuerpo ni query (query desconocida → `400 VALIDATION_ERROR`).
- **Salida 200**:

| Campo                                                                                                                            | Tipo                                                                                  | Origen                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app.id`, `app.name`                                                                                                             | texto                                                                                 | `apps.slug`, `apps.name`                                                                                                                                                 |
| `minAppVersion`, `recommendedAppVersion`                                                                                         | texto `x.y.z`                                                                         | Registro de la app                                                                                                                                                       |
| `maintenance.active`, `maintenance.message`                                                                                      | booleano, texto                                                                       | Global **o** de la app (activo si cualquiera lo está; mensaje del que esté activo, prioridad al global) **[Propuesta]**                                                  |
| `limits.maxAudioSeconds`                                                                                                         | entero                                                                                | `max_audio_seconds` efectivo de la app **[7.3]**                                                                                                                         |
| `operations.<key>.timeoutMs`                                                                                                     | entero                                                                                | Tiempo máximo **total** calculado de cada operación **activa** (BE-FR-77 CA4)                                                                                            |
| `links.register`                                                                                                                 | URL                                                                                   | `<web>/registro?app=<slug>`                                                                                                                                              |
| `links.forgotPassword`, `links.panel`, `links.buyCredits`, `links.prices`, `links.terms`, `links.privacy`, `links.acceptableUse` | URL                                                                                   | `/recuperar`, `/panel`, `/panel/comprar`, `/precios`, `/terminos`, `/privacidad`, `/uso-aceptable`                                                                       |
| `supportEmail`                                                                                                                   | texto                                                                                 | `support_email` de la app o global (BE-FR-84)                                                                                                                            |
| `announcements[]`                                                                                                                | `{ id, level: "info"\|"warning"\|"critical", message, link: URL\|null, endsAt: ISO }` | Anuncios activos de la app (o de todas) cuyo rango de versiones incluye `X-App-Version` (BE-FR-85 CA1); sin cabecera de versión: los que no tienen rango **[Propuesta]** |

- **Errores**: `UNKNOWN_APP`, `APP_DISABLED`, `VALIDATION_ERROR`. **No** devuelve `MAINTENANCE` ni
  `UPGRADE_REQUIRED` (es la vía para que el cliente los conozca). [Hueco] con la app `disabled` el cliente
  no puede leer `supportEmail` ni anuncios.
- **Idempotencia**: lectura pura.
- **Eventos**: `http.request.completed`; rechazos `apps.app.rejected`.

### E02 · `POST /auth/login` _(pública)_ — BE-FR-03, BE-FR-04, BE-FR-65, BE-FR-67, BE-FR-70 CA1

- **Entrada** (`strictObject`): `email` (`z.email()`, ≤ 254, se normaliza para el contador de fallos),
  `password` (texto 1–128; no se aplica aquí la regla de 8 caracteres para no revelar la política) +
  cabeceras de 1.2 (`X-App-Version` y `X-Device-Name` se guardan en la sesión).
- **Salida 200**: `{ token, expiresAt, user: { email, roles }, pendingAcceptances: PendingAcceptance[] }`.
  `token` es el token opaco de la sesión ligada a la app (`session.app_id`); `expiresAt` = caducidad
  deslizante (30 días). `roles` ⊆ `["user","tester","admin"]`.
- **Errores**: `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_BLOCKED`,
  `RATE_LIMITED` (IP), `LOGIN_TEMPORARILY_LOCKED` (email), `UNKNOWN_APP`, `APP_DISABLED`.
  - Orden **[Propuesta]**: bloqueo temporal del email → credenciales → bloqueada → sin verificar (para no
    revelar el estado de una cuenta sin la contraseña correcta).
  - Un login correcto pone a cero el contador de fallos (BE-FR-67 CA2).
  - Login permitido con mantenimiento y con documentos pendientes (BE-FR-47, BE-FR-70 CA1).
- **Idempotencia**: no; cada login correcto crea una sesión nueva (sin límite de sesiones, BE-FR-04 CA5).
- **Eventos**: `accounts.login.succeeded`, `accounts.login.failed`, `accounts.login.locked`,
  `accounts.rate_limit.exceeded`.

### E03 · `POST /auth/resend-verification` _(pública)_ — BE-FR-02 CA3

- **Entrada**: `{ email }` (`z.email()`).
- **Salida**: siempre `202` sin cuerpo (anti-enumeración): exista o no la cuenta, esté o no verificada, y
  también al superar el límite **por email** (no se envía). Única excepción: el límite **por IP**
  (BE-FR-45) responde `429 RATE_LIMITED` con `Retry-After`, que no revela nada sobre el email (D-19).
- **Errores**: `VALIDATION_ERROR`, `RATE_LIMITED` (IP), `UNKNOWN_APP`, `APP_DISABLED`.
- **Idempotencia**: natural; repetir solo reenvía dentro del límite.
- **Eventos**: `accounts.verification.resend_requested`, `notifications.email.sent` /
  `notifications.email.failed`, `accounts.rate_limit.exceeded`.

### E04 · `POST /auth/logout` _(Bearer)_ — BE-FR-06

- **Entrada**: sin cuerpo (un cuerpo no vacío → `400 VALIDATION_ERROR`).
- **Salida**: `204`. Revoca la sesión del token; tiene efecto inmediato (BE-FR-04 CA2).
- **Errores**: `UNAUTHENTICATED`, `UNKNOWN_APP`, `APP_DISABLED`. No exige versión mínima (D-19): una
  versión antigua siempre puede cerrar sesión.
- **Idempotencia**: natural (un token ya revocado → `401`).
- **Eventos**: `accounts.session.revoked` (`reason = logout`).

### E05 · `GET /me` _(Bearer)_ — BE-FR-49.7, BE-FR-63, BE-FR-70 CA1, BE-FR-71 CA2

- **Entrada**: ninguna.
- **Salida 200**: `{ email, roles, balance: Balance, lowBalanceThresholdMicro: entero | null,
hasRealPurchase: booleano, pendingAcceptances: PendingAcceptance[] }`. `lowBalanceThresholdMicro = null`
  si el usuario desactivó el aviso **[Propuesta]** (7.3 solo muestra un entero).
- **Errores**: `UNAUTHENTICATED`, `UPGRADE_REQUIRED`, `UNKNOWN_APP`, `APP_DISABLED`. Funciona con
  mantenimiento y con documentos pendientes.
- **Idempotencia**: lectura. Cuenta como actividad (BE-FR-86) y renueva la sesión deslizante.
- **Eventos**: `http.request.completed`.

### E06 · `POST /me/accept-terms` _(Bearer)_ — BE-FR-70 CA2

- **Entrada**: `{ documents: [ { document: "terms"|"privacy"|"cookies"|"aup", version: texto 1–32 } ] }`
  (1–4 elementos, sin documentos repetidos).
- **Salida**: `204`. Registra en `terms_acceptances` la versión, la fecha, la IP (de
  `event.getClientAddress()`) y `app_id`.
- **Errores**: `VALIDATION_ERROR` (versión que no es la vigente, documento repetido o desconocido),
  `UNAUTHENTICATED`, `UPGRADE_REQUIRED`, `UNKNOWN_APP`, `APP_DISABLED`. Funciona con mantenimiento.
- **Idempotencia**: aceptar una versión ya aceptada responde `204` sin duplicar **[Propuesta]**.
- **Eventos**: `legal.acceptance.recorded`, `legal.acceptance.rejected`.

### E07 · `POST /ai/chat` _(Bearer)_ — BE-FR-30, 31, 34, 72, 77–82; flujo §8

- **Entrada** (`strictObject`):

| Campo                  | Regla                                                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operation`            | Clave de una operación **activa** de tipo `chat` de la app de `X-App-Id`; si no → `VALIDATION_ERROR` (`field = "operation"`)                                                                                                                    |
| `messages`             | Obligatorio en operaciones `libre`; prohibido en `plantilla` (3.3)                                                                                                                                                                              |
| `variables`            | Obligatorio en `plantilla`; prohibido en `libre`. Objeto `nombre → valor` validado con el esquema dinámico de la plantilla (tipo `text`/`image`, obligatoriedad, longitud o tamaño)                                                             |
| `response_format`      | Opcional; solo si la operación admite salida estructurada y es `libre`. `{ type: "json_schema", json_schema: { name, schema, strict? } }`                                                                                                       |
| `tools`, `tool_choice` | Opcionales; solo si la operación admite herramientas y es `libre`. `tools[]`: `{ type: "function", function: { name, description?, parameters } }`; `tool_choice`: `"auto"`\|`"none"`\|`"required"`\|`{ type: "function", function: { name } }` |

- **Salida 200**: `{ text: texto|null, json: valor|null, structuredValid: booleano|null,
toolCalls: array|null, truncated: booleano, operationId, chargedMicro, balance }` **[7.3]**. Nunca el
  modelo ni el proveedor (BE-FR-80 CA1). `structuredValid = false` se cobra igualmente (BE-FR-79 CA1).
  Ejemplo de 7.3 (BE-FR-22, `fix` de un párrafo, coste 0,0004 USD; D-07): 0,0004 × 1,055 × 0,92 × 2 × 1.000 =
  0,77648 créditos → `"chargedMicro": 776480` (la app lo muestra como «0,8»).
- **Errores**: comunes de 1.8 + `VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`, `OPERATION_TOO_EXPENSIVE`,
  `INSUFFICIENT_BALANCE`, `DAILY_FREE_LIMIT_REACHED`, `REQUEST_IN_PROGRESS`, `DUPLICATE_REQUEST`,
  `RATE_LIMITED`, `PROVIDER_ERROR`, `PROVIDER_TIMEOUT`, `MAINTENANCE`, `SERVICE_LIMITED`,
  `TERMS_ACCEPTANCE_REQUIRED`, `UPGRADE_REQUIRED`, `UNAUTHENTICATED`.
- **Cobro**: reserva del coste máximo (transacción 1) → proveedor fuera de transacción → coste real → cobro
  y liberación (transacción 2). No se cobra lo que falla o se rechaza (BE-FR-21) ni lo cancelado antes de la
  respuesta del proveedor; el coste que este facture por una cancelación es pérdida por cancelación (1.7, D-05).
- **Idempotencia**: `Idempotency-Key` (1.6); desconexión (1.7).
- **Eventos**: `ai.operation.started`, `ai.operation.completed`, `ai.operation.rejected`,
  `ai.operation.failed`, `ai.operation.cancelled`, `ai.cancellation_cost.recorded`, `ai.operation.flagged`,
  `ai.provider.retry`,
  `ai.provider.fallback`, `ai.provider.invalid_response`, `ai.cost.estimated`, `ai.idempotency.replayed`,
  `credits.hold.created`, `credits.hold.rejected`, `credits.hold.released`, `credits.charge.applied`,
  `credits.debt.created`, `credits.debt.absorbed`, `credits.low_balance.crossed`.

### E08 · `POST /ai/transcribe` _(Bearer)_ — BE-FR-35, BE-FR-44, BE-FR-20

- **Entrada** (`multipart/form-data`, esquema estricto de campos):
  - `operation`: clave de una operación activa de tipo `transcription` de la app.
  - `file`: `z.file()` con tamaño ≤ `max_audio_mb` (de la app). El MIME declarado (`audio/webm`) no es prueba:
    la duración y la legibilidad las verifica **ffprobe** sobre el flujo completo. Ilegible →
    `VALIDATION_ERROR` (`field = "file"`); duración > máximo + tolerancia → `AUDIO_TOO_LONG`.
  - Se aplica `max_concurrent_transcriptions` (cuenta y app) además del límite por minuto.
- **Salida 200**: `{ text, providerUsed: "primary"|"backup", audioSeconds: entero, operationId,
chargedMicro, balance }` **[7.3]**. Nunca el nombre del modelo.
- **Errores**: comunes + `VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`, `AUDIO_TOO_LONG`,
  `OPERATION_TOO_EXPENSIVE`, `INSUFFICIENT_BALANCE`, `DAILY_FREE_LIMIT_REACHED`, `REQUEST_IN_PROGRESS`,
  `DUPLICATE_REQUEST`, `RATE_LIMITED`, `TRANSCRIPTION_FAILED` (`details.primaryError`,
  `details.backupError`, saneados). [Hueco] Escenarios «solo Voxtral» y «solo backup»: 7.2 no dice qué
  `details` lleva `TRANSCRIPTION_FAILED` si un proveedor no está configurado (**[Propuesta]**: el campo del
  proveedor no usado es `null`) ni si un _timeout_ total es `PROVIDER_TIMEOUT` o `TRANSCRIPTION_FAILED`
  (**[Propuesta]**: `TRANSCRIPTION_FAILED`).
- **Cobro**: estimación = duración medida × el precio más caro entre Voxtral y el backup; coste real de
  Voxtral = segundos × `voxtral_price_per_minute_usd` / 60; con _fallback_ se cobra solo lo que haya
  facturado cada proveedor (BE-FR-21).
- **Respaldo por OpenRouter** (D-08): como OpenRouter no admite WebM en la entrada de audio, el audio se
  convierte con ffmpeg (incluido en la imagen) a mp3 o wav antes de enviarlo.
- **Privacidad**: el audio se procesa en memoria o en un temporal borrado en `finally` (el original y, si lo
  hay, el convertido), también en error o cancelación (BE-FR-38 CA2).
- **Idempotencia**: `Idempotency-Key`; desconexión (1.7).
- **Eventos**: los de E07 + `ai.transcription.backup_used`, `ai.temp_file.cleanup_failed`,
  `ai.provider.billing_error`.

### E09 · `POST /ai/image` _(Bearer)_ — BE-FR-36

- **Entrada**: `{ operation, prompt }` (operación `libre`; `prompt` texto ≤ `max_text_chars`) o
  `{ operation, variables }` (operación `plantilla`). `operation`: operación activa de tipo `image`.
- **Salida 200**: `{ imageDataUrl: "data:image/png;base64,…", operationId, chargedMicro, balance }`. La
  imagen **no** se almacena.
- **Errores**: como E07 (sin `TRANSCRIPTION_FAILED`).
- **Cobro**: estimación con el precio por imagen del modelo o `estimated_max_cost_usd` (BE-FR-72).
- **Idempotencia** y **eventos**: como E07.

### E10 · `GET /sync` _(Bearer)_ — BE-FR-39, BE-FR-40, BE-FR-41

- **Entrada**: ninguna. El documento es el de la app de `X-App-Id` y el usuario de la sesión (filtro por
  `app_id` y `user_id` en el repositorio, principio VII).
- **Salida 200**: `{ revision: entero ≥ 1, data: { <categoría>: … } }` con la forma de cada estrategia
  (`items` con `items[]` y `tombstones[]`; `block` con `{ value, updatedAt }`; `keyed` con
  `{ <clave>: { value, updatedAt } }`; `updatedAt` en milisegundos epoch). Primera lectura: se siembra con
  los predeterminados vigentes, todos los `updatedAt = 0` (BE-FR-40) y `revision = 1` (D-19).
- **Errores**: comunes de 1.8 (incluidos `MAINTENANCE` y `TERMS_ACCEPTANCE_REQUIRED`).
- **Idempotencia**: lectura; la siembra ocurre una sola vez (clave `(user_id, app_id)`).
- **Eventos**: `sync.document.seeded`, `sync.document.read`, `sync.document.corrupt`.

### E11 · `PUT /sync` _(Bearer)_ — BE-FR-39, BE-FR-41

- **Entrada**: cabecera `If-Match` (obligatoria; si falta → `400 VALIDATION_ERROR` con `field: "If-Match"`,
  D-19) y cuerpo `{ data }` validado con el esquema dinámico
  generado desde `apps.sync_schema` de la app (solo categorías declaradas, forma de su estrategia).
  Tamaño serializado ≤ `max_sync_doc_kb`.
- **Salida 200**: `{ revision: entero }` (revisión anterior + 1). Sustituye el documento completo; la fusión
  la hace el cliente.
- **Errores**: `SYNC_CONFLICT` (412), `PAYLOAD_TOO_LARGE`, `VALIDATION_ERROR` **[7.3]** + comunes de 1.8.
  [Hueco] `PUT` sin `GET` previo (documento aún no sembrado): **[Propuesta]** se siembra primero y se
  compara `If-Match` con la revisión sembrada (`1`).
- **Concurrencia**: dos `PUT` con la misma revisión → uno `200` y otro `412`; nunca se pierde una escritura
  (BE-FR-41 CA1). Comparación y escritura en una transacción `BEGIN IMMEDIATE`.
- **Eventos**: `sync.document.written`, `sync.document.rejected`.

### E12 · `GET /defaults` _(Bearer)_ — BE-FR-42 CA2

- **Entrada**: ninguna.
- **Salida 200**: `{ data }` con la misma forma que `/sync` de la app, sin `revision`.
- **Errores**: `UNAUTHENTICATED`, `UPGRADE_REQUIRED`, `UNKNOWN_APP`, `APP_DISABLED`. **No** se bloquea por
  mantenimiento ni por documentos pendientes (D-19): la app puede ofrecer «Restaurar valores
  predeterminados» en cualquier caso.
- **Eventos**: `http.request.completed`.

### E13 · `GET /health` _(pública)_

- **Entrada**: ninguna; sin `X-App-Id`; responde con cualquier `Host`.
- **Salida**: `200 { "status": "ok" }` si la BD responde; si no, `503 { "status": "unavailable" }` (D-19;
  sin formato 7.1, porque lo consume Coolify).
- **Eventos**: `http.request.completed` en nivel `debug`.

### E14 · `GET /openapi.json` _(pública)_

- **Salida 200**: documento OpenAPI 3.1 generado (servidores `api.` del entorno, esquemas de petición,
  respuesta y error de cada endpoint, cabeceras de 1.2, códigos de la tabla 2 con sus `details`, valores por
  defecto de los límites dinámicos).
- **Eventos**: `http.request.completed`.

---

## 5. Seguridad y privacidad del contrato

- La sesión Bearer está **ligada a la app** del login; otra `X-App-Id` con el mismo token → `401` (BE-FR-65
  CA3). Una cookie de sesión enviada a la API se ignora; un Bearer enviado a la web se rechaza.
- Nunca se devuelven ni registran contraseñas, tokens, `Idempotency-Key`, IP, cuerpos de `/ai/*` o `/sync`,
  nombres de modelo ni costes reales.
- Los errores de proveedores se sanean antes de devolverse (`primaryError`/`backupError`) o registrarse.
- El tamaño máximo del cuerpo (`BODY_SIZE_LIMIT` de adapter-node) es ≥ el mayor `max_audio_mb` de cualquier
  app; se comprueba al arrancar.

## 6. Pruebas que demuestran este contrato

- `tests/http/` (suite `http`, contra el build en `APP_ENV=test`): una tabla de casos parametrizada por
  código de la sección 2 y por endpoint (método, cuerpo válido e inválido, autenticación, formato de error,
  serialización `…Micro` e ISO, `Retry-After`, `X-Request-Id`, 413, 502/504 con el simulador), validando
  cada respuesta contra el OpenAPI generado (Historias 15.10, 15.13).
- Integración (`features/ai/*.int.test.ts`, `credits`, `sync`): concurrencia de reservas, idempotencia,
  conflicto 412, aislamiento entre apps.
- Ver los escenarios de [quickstart.md](../quickstart.md).

## 7. Trazabilidad

| Endpoint | Requisitos (`spec.md`)                               |
| -------- | ---------------------------------------------------- |
| E01      | FR-074, FR-075, FR-076, FR-050 (tiempos)             |
| E02–E04  | FR-008, FR-009, FR-010, FR-012, FR-014, FR-071       |
| E05–E06  | FR-028 (saldo), FR-082, FR-103                       |
| E07–E09  | FR-027–FR-035, FR-049–FR-063, FR-069, FR-070, FR-072 |
| E10–E12  | FR-064–FR-068                                        |
| Comunes  | FR-002, FR-006, FR-062, FR-073, FR-074               |

## 8. Huecos y contradicciones detectados en `Historias.md` §7

La revisión del plan (D-07 y D-19, recogidas en `Historias.md` 2.6) resolvió los códigos para `404`, `405`,
`500` y origen no permitido, el _preflight_ CORS, el límite de `resend-verification`, la versión mínima en el
logout y en `/app/status`, `/defaults` con mantenimiento o documentos pendientes, `reservedMicro` en `/ai/*`,
el ejemplo `chargedMicro: 776480`, la revisión inicial de `/sync`, `If-Match` ausente y `/health` con la BD
caída. Siguen abiertos:

1. `PUT /sync` sin documento sembrado (propuesta de E11).
2. `TRANSCRIPTION_FAILED` en los escenarios con un solo proveedor y frontera con `PROVIDER_TIMEOUT`.
3. `X-Device-Name` y `X-App-Version`: formato y longitud no fijados.
4. `DAILY_FREE_LIMIT_REACHED`, `UPGRADE_REQUIRED` y `TERMS_ACCEPTANCE_REQUIRED` sin forma de `details`
   fijada (salvo el nombre `pending`).
