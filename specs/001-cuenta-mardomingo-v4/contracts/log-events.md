# Catálogo inicial de eventos de log

**Funcionalidad**: `001-cuenta-mardomingo-v4` · **Fase**: 1 de `/speckit-plan` · **Fecha**: 2026-10-10

**Fuentes**: constitución v2.1.2, principio XI («Registro y diagnóstico sin contenido») y principio XII;
decisiones de la revisión del plan del 2026-10-10 (D-01…D-22 de `plan.md`);
`Historias.md` 5.13 (alertas), 10.5, 11 (tareas programadas), 15.19 (logging en los tests);
`ARCHITECTURE.md` §3 (funcionalidades). Endpoints y rutas que los emiten: [api-v1.md](./api-v1.md) y
[web-routes.md](./web-routes.md).

Este catálogo es el punto de partida que exige el principio XI para cada plan. Cada funcionalidad lo
implementa en `src/lib/server/features/<f>/events.ts`; los eventos de infraestructura (`app.*`, `http.*`,
`log.*`) en `src/lib/server/logging/events.ts`, que reúne todos los catálogos (una línea por
funcionalidad); los del navegador (`client.*`) en `src/lib/logging/`. Un test de arquitectura comprueba que
los códigos son únicos y llevan el prefijo de su funcionalidad. Los lotes pueden añadir eventos siguiendo
estas reglas; no pueden añadir campos fuera de la lista permitida sin enmendar la constitución.

---

## 1. Reglas

### 1.1 Forma de cada línea

- **Código** `funcionalidad.objeto.resultado` (minúsculas, `snake_case` dentro de cada segmento). El prefijo
  es el nombre exacto de la funcionalidad dueña (`ARCHITECTURE.md` §3) o `app`, `http`, `log`, `client`.
- **`msg`** fijo, tomado del catálogo. PROHIBIDO construirlo con datos.
- **Firma tipada por evento**: cada código solo admite los campos de su fila (comprobado en compilación).
- **Nivel**: `fatal`, `error`, `warn`, `info` o `debug` según el principio XI. Un rechazo de negocio
  esperado es siempre `info` y lleva `reason`; nunca `error`.
- **Un error, un registro**: solo la frontera (hook `handleError` o envoltorio de la tarea) registra los
  errores inesperados; las capas lanzan errores tipados. Los reintentos van en `debug` y el resultado final
  se registra una vez.

### 1.2 Campos

| Grupo                   | Campos                                                                                                                                                                              | Quién los pone                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Base (todas las líneas) | `time` (ISO UTC con ms), `level`, `event`, `msg`, `schema` (versión del esquema de log, `1`), `service` (`mardomingo_backoffice`), `env` (`APP_ENV`), `version` (versión de la app) | Logger raíz                                                    |
| Contexto de petición    | `requestId`, `appId`, `userId`, `sessionId`, `route` (id de ruta de SvelteKit, nunca la URL), `method`                                                                              | Logger enriquecido en `handle` (`event.locals`) cuando existen |
| Contexto de tarea       | `task`                                                                                                                                                                              | Envoltorio de la tarea programada                              |
| Propios del evento      | `operationId`, `operation`, `httpStatus`, `status`, `errorCode`, `reason`, `durationMs`, `attempt`, `count`, `provider`, `model`, `err`                                             | Cada evento, según su fila                                     |

- **Permitidos** (lista cerrada del principio XI): `time`, `level`, `event`, `msg`, `schema`, `service`,
  `env`, `version`, `requestId`, `appId`, `userId`, `sessionId`, `operationId`, `operation`, `route`,
  `method`, `httpStatus`, `status`, `errorCode`, `reason`, `durationMs`, `attempt`, `count`, `provider`,
  `model`, `task`, `err`.
- **Prohibidos**: contenido del usuario (cuerpos de `/ai/*` y `/sync`, textos, prompts, variables, audios,
  imágenes, resultados), emails, nombres, **IP**, datos fiscales, **importes**, fechas de negocio, valores
  de formulario, textos libres (incluido el motivo del administrador), contraseñas, tokens, cookies,
  cabeceras `Authorization`/`Cookie`, claves, `Idempotency-Key` y el `message` de errores de bibliotecas o
  proveedores. `pino.redact` actúa como segunda barrera.
- `userId` y `sessionId` son ids de fila (`sessionId` nunca es el token). `appId` es el id interno de la
  app. `model` solo aparece en logs internos, nunca en respuestas al cliente.
- `err` se serializa con el serializador propio: `{ type, code, stack? }` (`stack` solo si el error es
  interno). Nunca `message`.
- `reason`, `status` y `operation` solo toman valores **enumerados** en este catálogo (códigos, no texto
  libre). En `audit.entry.recorded`, `operation` es el código de acción de auditoría (p. ej.
  `credits.adjust`).
- `count` es un recuento (filas, intentos, días, sesiones), nunca un importe.

### 1.3 Columna «Alerta»

- **A** — el evento corresponde a una **alerta por email al administrador** de `Historias.md` 5.13: la
  funcionalidad dueña llama a `notifications`, que envía el email una sola vez por cruce de umbral
  (`alerts_state`) y emite `notifications.alert.triggered`.
- **V** — evento de **vigilancia** en OpenObserve (nivel `error`/`fatal` o señal de abuso). No genera email
  propio; el propietario lo consulta a través del Gateway.
- «—» — sin alerta.

---

## 2. Infraestructura

### 2.1 `app.*` — ciclo de vida, configuración y tareas (`$lib/server/logging/events.ts`)

| Código                             | Nivel | `msg`                                                  | Campos propios                                                                                                                           | Cuándo                                                                                                                              | Alerta |
| ---------------------------------- | ----- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `app.started`                      | info  | `Aplicación iniciada`                                  | `count` (reservas liberadas al arrancar); identifica la versión y el entorno con los campos base `version`, `env` y `service` (ver nota) | Tras validar el entorno, abrir la BD, migrar y liberar reservas                                                                     | —      |
| `app.stopping`                     | info  | `Aplicación deteniéndose`                              | `reason` (`sigterm`)                                                                                                                     | Al recibir SIGTERM; se vacía el búfer en ≤ 5 s                                                                                      | —      |
| `app.config.invalid`               | fatal | `Configuración de entorno inválida`                    | `count` (variables ausentes o inválidas)                                                                                                 | En `init`; el proceso sale con código ≠ 0. Los **nombres** de las variables van al mensaje de salida del proceso, nunca sus valores | V      |
| `app.config.body_limit_incoherent` | fatal | `BODY_SIZE_LIMIT menor que el mayor audio configurado` | `reason` (`body_limit_below_max_audio`)                                                                                                  | Al arrancar, tras abrir la BD                                                                                                       | V      |
| `app.db.migrated`                  | info  | `Migraciones aplicadas`                                | `count`, `durationMs`                                                                                                                    | Al arrancar, tras el backup previo                                                                                                  | —      |
| `app.db.migration_failed`          | fatal | `Migración fallida`                                    | `err`                                                                                                                                    | Al arrancar                                                                                                                         | V      |
| `app.task.started`                 | debug | `Tarea iniciada`                                       | `task`                                                                                                                                   | Inicio de cada tarea programada                                                                                                     | —      |
| `app.task.completed`               | info  | `Tarea completada`                                     | `task`, `durationMs`, `count`                                                                                                            | Fin correcto                                                                                                                        | —      |
| `app.task.failed`                  | error | `Tarea fallida`                                        | `task`, `durationMs`, `err`                                                                                                              | Excepción no controlada en una tarea (registrada por el envoltorio)                                                                 | V      |

**Nota (D-22).** `app.started` solo usa campos permitidos por el principio XI: los de base (`version`, `env`,
`service`…) y `count`. No se amplía la lista de campos permitidos.

**Tareas** (valores de `task`, Historias 11): `openrouter-balance` (cada hora), `free-credits-expiry`,
`ledger-check`, `models-refresh`, `price-references`, `sync-tombstones-cleanup`,
`unverified-accounts-cleanup`, `retention`, `holds-cleanup`, `fx-ecb`, `inactive-accounts`,
`release-downloads` (diarias) y `disposable-domains` (semanal).

### 2.2 `http.*` — peticiones (`$lib/server/logging/events.ts`)

| Código                   | Nivel                              | `msg`                                | Campos propios                                                                                                      | Cuándo                                                                                                                                                                | Alerta |
| ------------------------ | ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `http.request.completed` | info (`debug` en `/api/v1/health`) | `Petición completada`                | `route`, `method`, `httpStatus`, `durationMs`, `errorCode` (si la respuesta es un error 7.2 o un `fail` con código) | Una línea por petición terminada, web y API                                                                                                                           | —      |
| `http.request.failed`    | error                              | `Error inesperado en la petición`    | `route`, `method`, `httpStatus` (500), `err`                                                                        | `handleError` ante una excepción no controlada (una sola vez)                                                                                                         | V      |
| `http.host.rejected`     | debug                              | `Host no corresponde a la ruta`      | `reason` (`host_mismatch`)                                                                                          | Separación por host: combinación cruzada → 404                                                                                                                        | —      |
| `http.cors.rejected`     | info                               | `Origen no permitido para la app`    | `reason` (`origin_not_allowed`), `errorCode` (`ORIGIN_NOT_ALLOWED`)                                                 | Host de la API: petición con `Origin` fuera de la lista de la app de `X-App-Id` (`403`), o _preflight_ con un origen que no figura en ninguna app activa (D-19)       | —      |
| `http.origin.rejected`   | info                               | `Formulario rechazado por su origen` | `reason` {`origin_missing`, `origin_mismatch`}, `httpStatus` (403)                                                  | Host web: POST/PUT/PATCH/DELETE con tipo de contenido de formulario sin `Origin` o con un origen distinto de `PUBLIC_WEB_URL` (comprobación propia de `handle`, D-01) | —      |

### 2.3 `log.*` — transporte de logs (`$lib/server/logging/events.ts`)

El envío al Log Gateway es un adaptador con interfaz (D-06). Hasta que el propietario entregue el contrato de
ingesta (entrada de L01), solo se escribe en stdout y estos eventos no se emiten.

| Código                  | Nivel | `msg`                                          | Campos propios                      | Cuándo                                                                      | Alerta |
| ----------------------- | ----- | ---------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- | ------ |
| `log.gateway.dropped`   | warn  | `Eventos descartados por el búfer del Gateway` | `count`                             | El Gateway falla y el búfer acotado descarta los más antiguos (solo stdout) | V      |
| `log.gateway.failed`    | warn  | `Fallo al enviar un lote al Gateway`           | `attempt`, `httpStatus`, `err`      | Un envío de lote falla (stdout)                                             | —      |
| `log.gateway.recovered` | info  | `Envío al Gateway restablecido`                | `count` (lotes pendientes enviados) | Tras un periodo de fallos                                                   | —      |

### 2.4 `client.*` — navegador (`src/lib/logging/`) y su recepción

| Código                             | Dónde                                    | Nivel | `msg`                                   | Campos                                                                                                                 | Cuándo                                                                         | Alerta |
| ---------------------------------- | ---------------------------------------- | ----- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| `client.error.uncaught`            | Navegador (`loglevel`)                   | error | `Error no capturado en el navegador`    | `route` (routeId), `version`, `err` (`type` = nombre, `code` = _fingerprint_, `stack` = líneas del _bundle_ sin query) | `window.onerror` / `handleError` del cliente; se envía a `POST /client-errors` | —      |
| `client.error.unhandled_rejection` | Navegador                                | error | `Promesa rechazada sin capturar`        | Como el anterior                                                                                                       | `unhandledrejection`; se envía a `/client-errors`                              | —      |
| `client.report.failed`             | Navegador (solo consola, nunca se envía) | debug | `No se pudo enviar el informe de error` | `reason` (`network`\|`rejected`)                                                                                       | Fallo del envío a `/client-errors`                                             | —      |
| `client.error.reported`            | Servidor (`/client-errors`)              | warn  | `Error del navegador recibido`          | `route` (routeId), `version`, `count`, `err` (`type` = `name`, `code` = `fingerprint`, `stack` = `frames`)             | Informe aceptado. Superado el límite: `204` **sin** registrar                  | V      |

El **mensaje** del error nunca sale del navegador. `fingerprint` y las líneas de la pila se transportan en
`err.code` y `err.stack` para no ampliar la lista de campos permitidos.

---

## 3. Eventos por funcionalidad

En las tablas, «Campos propios» excluye los de base y contexto (1.2). Las listas entre llaves son los
valores permitidos de `reason`, `status` u `operation`.

### 3.1 `audit`

| Código                 | Nivel | `msg`                               | Campos propios                                                                                                            | Cuándo                                                                                                                         | Alerta |
| ---------------------- | ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `audit.entry.recorded` | info  | `Acción de administración auditada` | `operation` (código de acción de `admin_audit.action`, p. ej. `credits.adjust`, `accounts.block`, `apps.settings.update`) | Tras insertar una entrada en `admin_audit` (en la misma transacción del cambio). Nunca el motivo ni los valores anterior/nuevo | —      |

### 3.2 `notifications`

| Código                           | Nivel | `msg`                               | Campos propios                                                                                                                                                                                                                                                     | Cuándo                                                             | Alerta |
| -------------------------------- | ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------ |
| `notifications.email.sent`       | info  | `Email enviado`                     | `reason` {`verification`, `password_reset`, `password_changed`, `email_change_verify`, `email_changed_notice`, `low_balance`, `free_expiry_warning`, `legal_update`, `invoice_available`, `inactivity_notice`, `admin_alert`}, `provider` (`resend`), `durationMs` | Envío aceptado por el proveedor (o escrito en el _outbox_ en test) | —      |
| `notifications.email.failed`     | warn  | `Email no enviado`                  | `reason` (plantilla, como arriba), `provider`, `errorCode`, `err`                                                                                                                                                                                                  | El proveedor rechaza o no responde; sin reintento infinito         | V      |
| `notifications.alert.triggered`  | warn  | `Alerta enviada al administrador`   | `reason` {`global_brake`, `openrouter_balance_low`, `mistral_billing_error`, `model_retired`, `model_price_changed`, `flagged_ops`, `ledger_mismatch`, `fx_stale`}                                                                                                 | Primer cruce de un umbral (`alerts_state.active` pasa a `true`)    | A      |
| `notifications.alert.suppressed` | debug | `Alerta ya enviada para este cruce` | `reason` (como arriba)                                                                                                                                                                                                                                             | Se repite la condición sin haberse normalizado                     | —      |
| `notifications.alert.rearmed`    | info  | `Alerta rearmada`                   | `reason` (como arriba)                                                                                                                                                                                                                                             | La condición se normaliza y el umbral vuelve a poder dispararse    | —      |

### 3.3 `apps`

| Código                               | Nivel | `msg`                                    | Campos propios                                                                         | Cuándo                                                                                                                                                                                                                       | Alerta |
| ------------------------------------ | ----- | ---------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `apps.app.rejected`                  | info  | `Petición rechazada por la app`          | `reason` {`unknown_app`, `app_disabled`}, `errorCode`                                  | `X-App-Id` ausente o desconocido, o app `disabled`                                                                                                                                                                           | —      |
| `apps.settings.updated`              | info  | `Configuración actualizada`              | `count` (claves cambiadas), `operation` (si es de operación)                           | El administrador guarda parámetros globales, de app u operación                                                                                                                                                              | —      |
| `apps.settings.rejected`             | info  | `Configuración rechazada`                | `reason` {`validation`, `incoherent`, `above_global_limit`}, `count`                   | Validación de tipos, rangos o coherencia fallida                                                                                                                                                                             | —      |
| `apps.config.corrupt`                | error | `Columna JSON de configuración corrupta` | `reason` {`settings`, `app_links`, `app_overrides`, `sync_schema`, `operation_config`} | Al leer una columna JSON que no supera su esquema; no se modifica el dato                                                                                                                                                    | V      |
| `apps.operation.activation_rejected` | info  | `Activación de operación rechazada`      | `operation`, `reason` {`no_model`, `model_incapable`, `no_price`}                      | BE-FR-77 CA2, BE-FR-72 CA3. Lo emite **`apps`** (servicio de activación en `apps/service.ts`), que recibe por parámetro el resultado de compatibilidad calculado por `ai` (modelo capaz y con precio); `ai` no lo emite (I4) | —      |
| `apps.template.versioned`            | info  | `Nueva versión de plantilla`             | `operation`                                                                            | Se guarda una plantilla (versión nueva inmutable)                                                                                                                                                                            | —      |

### 3.4 `legal`

| Código                      | Nivel | `msg`                                           | Campos propios                                                                                                      | Cuándo                                         | Alerta |
| --------------------------- | ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------ |
| `legal.document.published`  | info  | `Versión de documento legal publicada`          | `reason` {`terms`, `privacy`, `cookies`, `aup`}, `status` {`requires_acceptance`, `informative`}                    | El administrador publica una versión           | —      |
| `legal.acceptance.recorded` | info  | `Aceptación legal registrada`                   | `count` (documentos aceptados)                                                                                      | Registro, `/me/accept-terms` o aviso del panel | —      |
| `legal.acceptance.rejected` | info  | `Aceptación legal rechazada`                    | `reason` {`version_not_current`, `duplicate_document`}, `errorCode`                                                 | Versión que no es la vigente                   | —      |
| `legal.acceptance.required` | info  | `Operación bloqueada por documentos pendientes` | `reason` (`terms_pending`), `errorCode` (`TERMS_ACCEPTANCE_REQUIRED`), `count` (pendientes), `operation` (si es IA) | IA o sincronización con versiones pendientes   | —      |

### 3.5 `pricing`

| Código                         | Nivel | `msg`                                | Campos propios                                                          | Cuándo                                                                                 | Alerta |
| ------------------------------ | ----- | ------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| `pricing.fx.updated`           | info  | `Tipo de cambio actualizado`         | `provider` (`ecb`), `status` (`ecb`)                                    | Tarea `fx-ecb` correcta (el valor no se registra: es un dato de negocio en `fx_rates`) | —      |
| `pricing.fx.fetch_failed`      | warn  | `No se pudo obtener el tipo del BCE` | `provider`, `count` (días seguidos sin actualizar), `httpStatus`, `err` | Fallo de la consulta; se mantiene el último valor                                      | —      |
| `pricing.fx.stale`             | warn  | `Tipo de cambio sin actualizar`      | `count` (días)                                                          | Se alcanzan `fx_stale_alert_days` días seguidos                                        | A      |
| `pricing.fx.manual_set`        | info  | `Tipo de cambio manual cambiado`     | `status` {`manual_on`, `manual_off`}                                    | El administrador fija o quita el valor manual                                          | —      |
| `pricing.reference.recomputed` | info  | `Precios orientativos recalculados`  | `count` (operaciones), `status` {`auto`, `manual`}                      | Tarea `price-references`                                                               | —      |

### 3.6 `credits`

| Código                             | Nivel | `msg`                                     | Campos propios                                                                                                     | Cuándo                                                                                                                                                                                                      | Alerta |
| ---------------------------------- | ----- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `credits.hold.created`             | debug | `Reserva creada`                          | `operationId`                                                                                                      | Transacción 1 del flujo de cobro                                                                                                                                                                            | —      |
| `credits.hold.rejected`            | info  | `Reserva rechazada`                       | `operationId`, `reason` {`insufficient_balance`, `below_minimum`, `debt_pending`, `daily_free_limit`}, `errorCode` | Saldo, deuda o tope diario no permiten reservar                                                                                                                                                             | —      |
| `credits.hold.released`            | debug | `Reserva liberada`                        | `operationId`, `reason` {`charged`, `not_charged`}                                                                 | Transacción 2 o fallo antes de cobrar                                                                                                                                                                       | —      |
| `credits.hold.expired`             | info  | `Reservas caducadas liberadas`            | `count`                                                                                                            | Lo emite **`credits`** en `expireHolds(tx, now)` (L05) al liberar sin cobro las reservas abiertas con antigüedad mayor que `hold_ttl_seconds`; la tarea `jobs/holds-cleanup.ts` (L14) solo la programa (O3) | —      |
| `credits.hold.released_on_startup` | warn  | `Reservas abiertas liberadas al arrancar` | `count`                                                                                                            | Arranque con reservas abiertas (si `count > 0`)                                                                                                                                                             | V      |
| `credits.charge.applied`           | info  | `Cobro aplicado`                          | `operationId`, `status` {`charged`, `absorbed`}                                                                    | Cobro del coste real (o repetición no cobrada)                                                                                                                                                              | —      |
| `credits.debt.created`             | info  | `Deuda generada`                          | `operationId`, `reason` (`cost_above_estimate`)                                                                    | El coste real supera el saldo                                                                                                                                                                               | —      |
| `credits.debt.absorbed`            | warn  | `Exceso sobre la deuda máxima absorbido`  | `operationId`                                                                                                      | La deuda superaría `max_debt`                                                                                                                                                                               | V      |
| `credits.debt.settled`             | info  | `Deuda liquidada`                         | `reason` {`purchase`, `adjustment_paid`, `adjustment_free`}                                                        | Entrada de créditos con deuda pendiente (aclaración 2026-10-10)                                                                                                                                             | —      |
| `credits.bucket.granted`           | info  | `Bolsa de créditos creada`                | `reason` {`welcome`, `purchase`, `adjustment`}, `status` {`free`, `paid`}                                          | Bienvenida, compra o ajuste                                                                                                                                                                                 | —      |
| `credits.welcome.denied`           | info  | `Bienvenida no concedida`                 | `reason` (`email_already_granted`)                                                                                 | Verificación de un email normalizado que ya recibió la bienvenida                                                                                                                                           | —      |
| `credits.adjustment.applied`       | info  | `Ajuste manual aplicado`                  | `status` {`add`, `subtract`}                                                                                       | Ajuste del administrador (el motivo va a `admin_audit`, nunca al log)                                                                                                                                       | —      |
| `credits.adjustment.rejected`      | info  | `Ajuste manual rechazado`                 | `reason` {`validation`, `exceeds_available`}                                                                       | Validación, o resta mayor que el saldo disponible (D-16: el ajuste nunca crea deuda)                                                                                                                        | —      |
| `credits.balance.forfeited`        | info  | `Saldo perdido por borrado de la cuenta`  | `reason` {`user`, `inactivity`}, `count` (bolsas puestas a cero)                                                   | Movimientos `forfeit` en el borrado de la cuenta (D-15); el importe no se registra                                                                                                                          | —      |
| `credits.expiry.applied`           | info  | `Bolsas gratuitas caducadas`              | `count`                                                                                                            | Tarea `free-credits-expiry`                                                                                                                                                                                 | —      |
| `credits.expiry.warned`            | info  | `Avisos de caducidad enviados`            | `count`                                                                                                            | Tarea `free-credits-expiry` (`free_expiry_warning_days`)                                                                                                                                                    | —      |
| `credits.ledger.verified`          | info  | `Ledger comprobado`                       | `count` (cuentas comprobadas)                                                                                      | Tarea `ledger-check` sin discrepancias                                                                                                                                                                      | —      |
| `credits.ledger.mismatch`          | error | `Discrepancia entre saldo y ledger`       | `count` (cuentas con discrepancia)                                                                                 | Tarea `ledger-check`; un evento por ejecución (los `userId` afectados se consultan en la BD)                                                                                                                | A      |
| `credits.low_balance.crossed`      | info  | `Saldo bajo el umbral`                    | `status` {`notified`, `rearmed`}                                                                                   | Cruce del umbral hacia abajo (email) o rearme al superarlo                                                                                                                                                  | —      |

### 3.7 `invoicing`

| Código                               | Nivel | `msg`                           | Campos propios                                                     | Cuándo                                            | Alerta |
| ------------------------------------ | ----- | ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- | ------ |
| `invoicing.billing_profile.updated`  | info  | `Datos fiscales guardados`      | —                                                                  | Perfil o paso de compra                           | —      |
| `invoicing.billing_profile.rejected` | info  | `Datos fiscales rechazados`     | `reason` {`tax_id_invalid`, `validation`}                          | Validación fallida                                | —      |
| `invoicing.invoice.issued`           | info  | `Factura emitida`               | `status` {`simplified`, `full`, `corrective`}, `provider`          | Compra real, reembolso o contracargo              | —      |
| `invoicing.invoice.skipped`          | debug | `Factura no emitida`            | `reason` {`simulated`, `provider_none`}                            | Compra simulada o proveedor `none` (v4)           | —      |
| `invoicing.invoice.duplicate`        | info  | `Emisión ya realizada`          | `reason` (`already_issued`)                                        | Emisión repetida para el mismo pago (idempotente) | —      |
| `invoicing.full_invoice.requested`   | info  | `Factura completa solicitada`   | —                                                                  | Petición desde el panel                           | —      |
| `invoicing.export.generated`         | info  | `Exportación contable generada` | `reason` {`sales`, `ai_costs`, `monthly_summary`}, `count` (filas) | Descarga CSV del administrador                    | —      |

### 3.8 `accounts`

| Código                                       | Nivel | `msg`                                                    | Campos propios                                                                                                                                           | Cuándo                                                                                                                        | Alerta |
| -------------------------------------------- | ----- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| `accounts.signup.completed`                  | info  | `Cuenta registrada`                                      | — (`appId` de contexto = app de origen, si la hay)                                                                                                       | Registro aceptado (cuenta sin verificar creada)                                                                               | —      |
| `accounts.signup.rejected`                   | info  | `Registro rechazado`                                     | `reason` {`validation`, `captcha_invalid`, `disposable_domain`, `ip_limit`, `email_exists`, `legal_version_changed`}                                     | Cualquier rechazo; `email_exists` responde igual que un éxito (antienumeración)                                               | —      |
| `accounts.captcha.unavailable`               | warn  | `Captcha no disponible`                                  | `provider` (`turnstile`), `err`                                                                                                                          | El adaptador `CaptchaVerifier` de `accounts` no obtiene respuesta de Turnstile (D-02)                                         | V      |
| `accounts.email.verified`                    | info  | `Email verificado`                                       | —                                                                                                                                                        | Verificación correcta                                                                                                         | —      |
| `accounts.verification.rejected`             | info  | `Verificación rechazada`                                 | `reason` {`expired`, `used`, `invalid`}                                                                                                                  | Enlace no válido                                                                                                              | —      |
| `accounts.verification.resend_requested`     | info  | `Reenvío de verificación solicitado`                     | `status` {`sent`, `suppressed`}                                                                                                                          | API o web; `suppressed` = sin cuenta, ya verificada o límite por email (respuesta neutra)                                     | —      |
| `accounts.login.succeeded`                   | info  | `Inicio de sesión correcto`                              | `status` {`web`, `app`}                                                                                                                                  | Login web o de app (sesión creada)                                                                                            | —      |
| `accounts.login.failed`                      | info  | `Inicio de sesión fallido`                               | `reason` {`invalid_credentials`, `not_verified`, `blocked`}, `errorCode`                                                                                 | Login rechazado                                                                                                               | —      |
| `accounts.login.locked`                      | warn  | `Login bloqueado temporalmente`                          | `reason` (`too_many_failures`), `count` (fallos)                                                                                                         | Se alcanza `login_max_failures` o se intenta durante el bloqueo (señal de abuso)                                              | V      |
| `accounts.rate_limit.exceeded`               | warn  | `Límite por IP de autenticación superado`                | `reason` {`login`, `signup`, `resend_verification`, `password_reset`, `email_change`}                                                                    | Contador por IP de `accounts` en `auth_rate_limits` (D-02; el `rateLimit` de Better Auth no se usa). La IP **no** se registra | V      |
| `accounts.session.rejected`                  | info  | `Sesión rechazada`                                       | `reason` {`missing_token`, `expired`, `revoked`, `other_app`, `bearer_on_web`, `cookie_on_api`}, `errorCode`                                             | Autenticación fallida en API o web                                                                                            | —      |
| `accounts.session.renewed`                   | debug | `Sesión renovada`                                        | —                                                                                                                                                        | Uso con más de 24 h desde la última renovación                                                                                | —      |
| `accounts.session.revoked`                   | info  | `Sesiones revocadas`                                     | `reason` {`logout`, `user_closed_one`, `user_closed_others`, `password_changed`, `email_changed`, `blocked`, `account_deleted`, `admin_closed`}, `count` | Cualquier revocación                                                                                                          | —      |
| `accounts.password.reset_requested`          | info  | `Recuperación solicitada`                                | `status` {`sent`, `suppressed`}                                                                                                                          | Solicitud (respuesta neutra)                                                                                                  | —      |
| `accounts.password.reset_completed`          | info  | `Contraseña restablecida`                                | —                                                                                                                                                        | Enlace válido usado                                                                                                           | —      |
| `accounts.password.changed`                  | info  | `Contraseña cambiada`                                    | `count` (sesiones revocadas)                                                                                                                             | Cambio desde el perfil                                                                                                        | —      |
| `accounts.password.change_rejected`          | info  | `Cambio de contraseña rechazado`                         | `reason` {`wrong_password`, `validation`}                                                                                                                | Rechazo                                                                                                                       | —      |
| `accounts.email_change.requested`            | info  | `Cambio de email solicitado`                             | `status` {`sent`, `suppressed`}                                                                                                                          | `suppressed` = dirección de otra cuenta (respuesta neutra)                                                                    | —      |
| `accounts.email_change.applied`              | info  | `Email cambiado`                                         | `count` (sesiones revocadas)                                                                                                                             | Enlace de la nueva dirección usado                                                                                            | —      |
| `accounts.email_change.rejected`             | info  | `Cambio de email rechazado`                              | `reason` {`wrong_password`, `expired`, `used`, `invalid`}                                                                                                | Rechazo                                                                                                                       | —      |
| `accounts.user.blocked`                      | info  | `Usuario bloqueado`                                      | `reason` {`admin`, `chargeback`}                                                                                                                         | Bloqueo (revoca sesiones)                                                                                                     | —      |
| `accounts.user.unblocked`                    | info  | `Usuario desbloqueado`                                   | —                                                                                                                                                        | Desbloqueo por el administrador                                                                                               | —      |
| `accounts.role.changed`                      | info  | `Rol cambiado`                                           | `status` {`tester_on`, `tester_off`, `admin_on`}                                                                                                         | Cambio de rol                                                                                                                 | —      |
| `accounts.admin.promoted`                    | info  | `Administrador promovido`                                | —                                                                                                                                                        | Verificación del email de `ADMIN_EMAIL`                                                                                       | —      |
| `accounts.admin.promotion_refused`           | error | `Promoción de administrador rechazada`                   | `reason` (`admin_exists`)                                                                                                                                | Ya existe otra cuenta `admin` (constitución, «Variables»)                                                                     | V      |
| `accounts.guard.denied`                      | info  | `Acceso denegado por el guard`                           | `reason` {`anonymous`, `unverified`, `not_admin`}, `httpStatus`                                                                                          | Un _guard_ rechaza un `load`, _action_ o descarga                                                                             | —      |
| `accounts.unverified.purged`                 | info  | `Cuentas sin verificar eliminadas`                       | `count`                                                                                                                                                  | Tarea `unverified-accounts-cleanup`                                                                                           | —      |
| `accounts.disposable_domains.refreshed`      | info  | `Lista de dominios desechables actualizada`              | `count` (dominios)                                                                                                                                       | Tarea `disposable-domains`                                                                                                    | —      |
| `accounts.disposable_domains.refresh_failed` | warn  | `No se pudo actualizar la lista de dominios desechables` | `httpStatus`, `err`                                                                                                                                      | Fallo de la descarga; se mantiene la lista anterior                                                                           | —      |

### 3.9 `payments`

| Código                        | Nivel | `msg`                          | Campos propios                                                                                        | Cuándo                                                              | Alerta |
| ----------------------------- | ----- | ------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| `payments.purchase.completed` | info  | `Compra completada`            | `provider` {`simulated`, `stripe`}, `status` {`simulated`, `real`}                                    | Acreditación correcta                                               | —      |
| `payments.purchase.duplicate` | info  | `Compra repetida`              | `reason` (`intent_already_used`)                                                                      | Doble clic, reenvío o «atrás» con el mismo identificador de intento | —      |
| `payments.purchase.rejected`  | info  | `Compra rechazada`             | `reason` {`not_available`, `waiver_missing`, `pack_inactive`, `intent_invalid`, `billing_incomplete`} | Rechazo de negocio                                                  | —      |
| `payments.purchase.failed`    | warn  | `Error del proveedor de pagos` | `provider`, `errorCode`, `err`                                                                        | El proveedor falla (no se cobra)                                    | V      |
| `payments.webhook.received`   | info  | `Webhook de pago recibido`     | `provider`, `status` {`payment_completed`, `payment_refunded`, `chargeback_opened`}                   | Fase Stripe (sin uso en la v4)                                      | —      |
| `payments.webhook.duplicate`  | info  | `Webhook repetido ignorado`    | `provider`, `status`                                                                                  | Evento ya procesado (idempotente)                                   | —      |
| `payments.webhook.rejected`   | warn  | `Webhook rechazado`            | `provider`, `reason` {`signature_invalid`, `schema_invalid`}                                          | Firma o esquema inválidos                                           | V      |
| `payments.refund.applied`     | info  | `Reembolso aplicado`           | `provider`                                                                                            | Reembolso manual del administrador                                  | —      |
| `payments.chargeback.applied` | warn  | `Contracargo aplicado`         | `provider`                                                                                            | Contracargo (retira saldo, deuda sin tope y bloquea la cuenta)      | V      |
| `payments.pack.updated`       | info  | `Paquete guardado`             | `status` {`created`, `updated`}                                                                       | El administrador crea o edita un paquete                            | —      |

### 3.10 `sync`

| Código                   | Nivel | `msg`                                                   | Campos propios                                                                                 | Cuándo                                                                    | Alerta |
| ------------------------ | ----- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| `sync.document.seeded`   | info  | `Documento sembrado con predeterminados`                | —                                                                                              | Primer `GET /sync` (o `PUT`) de la cuenta en esa app                      | —      |
| `sync.document.read`     | debug | `Documento leído`                                       | `durationMs`                                                                                   | `GET /sync`                                                               | —      |
| `sync.document.written`  | info  | `Documento escrito`                                     | `durationMs`                                                                                   | `PUT /sync` correcto                                                      | —      |
| `sync.document.rejected` | info  | `Escritura del documento rechazada`                     | `reason` {`revision_conflict`, `schema_invalid`, `too_large`, `if_match_invalid`}, `errorCode` | 412, 400 o 413                                                            | —      |
| `sync.document.corrupt`  | error | `Documento sincronizado corrupto en la BD`              | —                                                                                              | Al leer un `sync_documents.data` que no supera su esquema; no se modifica | V      |
| `sync.tombstones.purged` | info  | `Marcas de borrado antiguas eliminadas`                 | `count`                                                                                        | Tarea `sync-tombstones-cleanup` (> 30 días)                               | —      |
| `sync.defaults.updated`  | info  | `Predeterminados actualizados`                          | `count` (categorías)                                                                           | El administrador guarda predeterminados                                   | —      |
| `sync.defaults.copied`   | info  | `Datos del administrador copiados como predeterminados` | `count` (categorías sustituidas)                                                               | Copia con vista previa                                                    | —      |

### 3.11 `protections`

| Código                         | Nivel | `msg`                                   | Campos propios                                                                                                                                                                                                       | Cuándo                                                                                                                                       | Alerta |
| ------------------------------ | ----- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `protections.request.rejected` | info  | `Petición rechazada por una protección` | `reason` {`rate_limited_account`, `rate_limited_app`, `concurrency_account`, `concurrency_app`, `maintenance_global`, `maintenance_app`, `upgrade_required`, `service_limited`}, `errorCode`, `operation` (si es IA) | 429, 503 o 426. `rate_limited_app` / `concurrency_app` = límite propio de la app alcanzado antes que el de la cuenta (aclaración 2026-10-10) | —      |
| `protections.brake.activated`  | warn  | `Freno global de gasto activado`        | —                                                                                                                                                                                                                    | El coste real del día + reservas de cuentas sin compras supera el freno                                                                      | A      |
| `protections.brake.released`   | info  | `Freno global liberado`                 | `reason` {`manual`, `new_day`}                                                                                                                                                                                       | Liberación por el administrador o cambio de día (Madrid)                                                                                     | —      |

### 3.12 `ai`

| Código                               | Nivel | `msg`                                                    | Campos propios                                                                                                                                                                                           | Cuándo                                                                                                                                                                           | Alerta |
| ------------------------------------ | ----- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `ai.operation.started`               | debug | `Operación de IA iniciada`                               | `operationId`, `operation`                                                                                                                                                                               | Tras reservar                                                                                                                                                                    | —      |
| `ai.operation.completed`             | info  | `Operación de IA completada`                             | `operationId`, `operation`, `status` (`ok`), `reason` {`truncated`, `structured_invalid`} (opcional), `provider` {`openrouter`, `mistral`}, `model`, `durationMs`, `attempt`                             | Respuesta entregada                                                                                                                                                              | —      |
| `ai.operation.rejected`              | info  | `Operación de IA rechazada`                              | `operation`, `reason` {`unknown_operation`, `validation`, `payload_too_large`, `audio_too_long`, `audio_unreadable`, `operation_too_expensive`, `request_in_progress`, `duplicate_request`}, `errorCode` | Rechazo antes de llamar al proveedor (sin cobro)                                                                                                                                 | —      |
| `ai.operation.failed`                | error | `Fallaron todos los proveedores`                         | `operationId`, `operation`, `errorCode` {`PROVIDER_ERROR`, `PROVIDER_TIMEOUT`, `TRANSCRIPTION_FAILED`}, `provider`, `attempt`, `durationMs`, `err`                                                       | Agotados respaldos y reintentos (sin cobro)                                                                                                                                      | V      |
| `ai.operation.cancelled`             | info  | `Operación de IA cancelada por el cliente`               | `operationId`, `operation`, `status` {`cancelled`, `undelivered`}                                                                                                                                        | Desconexión del cliente (7.4)                                                                                                                                                    | —      |
| `ai.cancellation_cost.recorded`      | info  | `Coste de una operación cancelada registrado`            | `operationId`, `provider`, `reason` {`from_response`, `from_generation_lookup`}                                                                                                                          | Se conoce el coste que el proveedor factura por una operación `cancelled` sin cobro; se guarda en `ai_operations` como pérdida por cancelación (D-05). El importe no se registra | —      |
| `ai.operation.interrupted`           | warn  | `Operaciones interrumpidas por reinicio`                 | `count`                                                                                                                                                                                                  | Arranque con operaciones en curso                                                                                                                                                | V      |
| `ai.operation.flagged`               | warn  | `Contenido rechazado por moderación del proveedor`       | `operationId`, `operation`, `provider`                                                                                                                                                                   | Rechazo por moderación (`flagged = true`, sin contenido)                                                                                                                         | V      |
| `ai.flagged.threshold_reached`       | warn  | `Usuario con operaciones marcadas por encima del umbral` | `count`                                                                                                                                                                                                  | `flagged_ops_alert_per_day` alcanzado en el día                                                                                                                                  | A      |
| `ai.provider.retry`                  | debug | `Reintento con el proveedor`                             | `operationId`, `provider`, `attempt`, `httpStatus`, `errorCode`                                                                                                                                          | Reintentos de Voxtral (2, 4, 8 s) o del modelo principal                                                                                                                         | —      |
| `ai.provider.fallback`               | warn  | `Modelo de respaldo utilizado`                           | `operationId`, `provider`, `model`, `attempt`                                                                                                                                                            | Falla el modelo principal y se prueba un respaldo                                                                                                                                | —      |
| `ai.provider.invalid_response`       | warn  | `Respuesta inválida del proveedor`                       | `operationId`, `provider`, `model`, `reason` {`schema_invalid`, `empty`}                                                                                                                                 | La respuesta no supera el esquema del adaptador (saneada)                                                                                                                        | —      |
| `ai.transcription.backup_used`       | warn  | `Transcripción servida por el backup`                    | `operationId`, `provider`                                                                                                                                                                                | Voxtral falla y responde el backup                                                                                                                                               | —      |
| `ai.cost.estimated`                  | warn  | `Coste real estimado por precios del modelo`             | `operationId`, `provider`, `model`                                                                                                                                                                       | Sin `usage.cost` ni `/generation` (`cost_estimated = true`)                                                                                                                      | —      |
| `ai.idempotency.replayed`            | info  | `Repetición de operación no entregada`                   | `operationId`, `reason` (`undelivered_retry`)                                                                                                                                                            | Misma clave tras `undelivered` (no se cobra)                                                                                                                                     | —      |
| `ai.temp_file.cleanup_failed`        | error | `No se pudo borrar el temporal de audio`                 | `operationId`, `err`                                                                                                                                                                                     | Fallo del `finally` de borrado (riesgo de privacidad)                                                                                                                            | V      |
| `ai.models.refreshed`                | info  | `Caché de modelos actualizada`                           | `provider` (`openrouter`), `count` (modelos)                                                                                                                                                             | Tarea `models-refresh`                                                                                                                                                           | —      |
| `ai.model.retired`                   | warn  | `Modelo asignado retirado o incompatible`                | `operation`, `model`                                                                                                                                                                                     | Vigilancia diaria (BE-FR-80)                                                                                                                                                     | A      |
| `ai.model.price_changed`             | warn  | `Precio de un modelo asignado cambiado`                  | `operation`, `model`                                                                                                                                                                                     | Cambio > `model_price_change_alert_pct` (el precio y el porcentaje se consultan en `model_cache`)                                                                                | A      |
| `ai.provider_balance.checked`        | debug | `Saldo del proveedor consultado`                         | `provider` (`openrouter`)                                                                                                                                                                                | Tarea `openrouter-balance`                                                                                                                                                       | —      |
| `ai.provider_balance.check_disabled` | warn  | `Alerta de saldo de OpenRouter desactivada`              | `provider` (`openrouter`), `reason` (`management_key_missing`)                                                                                                                                           | Al arrancar sin `OPENROUTER_MANAGEMENT_KEY` (p. ej. en staging): la tarea `openrouter-balance` no se registra (D-04)                                                             | —      |
| `ai.provider_balance.low`            | warn  | `Saldo de OpenRouter bajo`                               | `provider`                                                                                                                                                                                               | Saldo < `openrouter_balance_alert_usd` (el saldo no se registra)                                                                                                                 | A      |
| `ai.provider.billing_error`          | warn  | `Error de facturación del proveedor`                     | `provider` (`mistral`), `httpStatus` {401, 402, 429}                                                                                                                                                     | Mistral devuelve errores de pago o cuota                                                                                                                                         | A      |

### 3.13 `privacy`

| Código                              | Nivel | `msg`                               | Campos propios                                                              | Cuándo                                         | Alerta |
| ----------------------------------- | ----- | ----------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- | ------ |
| `privacy.export.generated`          | info  | `Exportación de datos generada`     | `durationMs`                                                                | Descarga RGPD (el contenido nunca se registra) | —      |
| `privacy.account.deleted`           | info  | `Cuenta borrada`                    | `reason` {`user`, `inactivity`}, `count` (sesiones revocadas)               | Borrado y anonimización                        | —      |
| `privacy.account.deletion_rejected` | info  | `Borrado de cuenta rechazado`       | `reason` {`wrong_password`, `confirmation_missing`}                         | Rechazo                                        | —      |
| `privacy.inactive.notified`         | info  | `Avisos de inactividad enviados`    | `count`                                                                     | Tarea `inactive-accounts`                      | —      |
| `privacy.inactive.cancelled`        | info  | `Borrado por inactividad cancelado` | —                                                                           | Actividad dentro del plazo de aviso            | —      |
| `privacy.retention.applied`         | info  | `Plazos de retención aplicados`     | `reason` {`sessions`, `ai_operations`, `registration_ip`, `other`}, `count` | Tarea `retention` (una línea por categoría)    | —      |

### 3.14 `stats`

| Código                         | Nivel | `msg`                                    | Campos propios                                    | Cuándo                    | Alerta |
| ------------------------------ | ----- | ---------------------------------------- | ------------------------------------------------- | ------------------------- | ------ |
| `stats.downloads.fetched`      | info  | `Descargas de GitHub Releases obtenidas` | `provider` (`github`), `count` (apps consultadas) | Tarea `release-downloads` | —      |
| `stats.downloads.fetch_failed` | warn  | `No se pudieron obtener las descargas`   | `provider`, `httpStatus`, `err`                   | Fallo de la API de GitHub | —      |

---

## 4. Alertas al administrador (5.13) y su origen

| Alerta (5.13)                       | Evento que la origina          | Clave de `alerts_state` / `reason` |
| ----------------------------------- | ------------------------------ | ---------------------------------- |
| Freno global activado               | `protections.brake.activated`  | `global_brake`                     |
| Saldo de OpenRouter bajo            | `ai.provider_balance.low`      | `openrouter_balance_low`           |
| Errores de pago de Mistral          | `ai.provider.billing_error`    | `mistral_billing_error`            |
| Modelo retirado                     | `ai.model.retired`             | `model_retired`                    |
| Modelo con cambio de precio         | `ai.model.price_changed`       | `model_price_changed`              |
| Operaciones marcadas por moderación | `ai.flagged.threshold_reached` | `flagged_ops`                      |
| Discrepancia en el ledger           | `credits.ledger.mismatch`      | `ledger_mismatch`                  |
| Tipo de cambio sin actualizar       | `pricing.fx.stale`             | `fx_stale`                         |

En todos los casos el email lo envía `notifications`, que emite `notifications.alert.triggered` (primer
cruce) o `notifications.alert.suppressed` (repetición sin normalizar).

## 5. Cómo se prueba (Historias 15.19)

- **Registrador falso** en unit e integración: cada rechazo de negocio (saldo, tope diario, límite,
  conflicto de sincronización, login bloqueado) comprueba `event` y `reason`, y que
  `JSON.stringify(eventos)` no contiene el email, el importe ni la fecha de la operación.
- **Test del catálogo**: códigos únicos, prefijo correcto y firma tipada (`check`).
- **Serializador de errores**: el `message` de errores de bibliotecas no llega al log.
- **Marcador de privacidad** (tests HTTP y E2E con `LOG_LEVEL=debug`): un texto, audio o imagen con un
  marcador único enviado a `/ai/*` y `/sync` no aparece en stdout ni en la BD.
- **`redact`**: test con el registrador real sobre stdout.
- **`/client-errors`**: > 4 KB rechazado y `204` sin log al superar el límite.

## 6. Resumen

| Ámbito          | Eventos |
| --------------- | ------- |
| `app.*`         | 9       |
| `http.*`        | 5       |
| `log.*`         | 3       |
| `client.*`      | 4       |
| `audit`         | 1       |
| `notifications` | 5       |
| `apps`          | 6       |
| `legal`         | 4       |
| `pricing`       | 5       |
| `credits`       | 19      |
| `invoicing`     | 7       |
| `accounts`      | 29      |
| `payments`      | 10      |
| `sync`          | 8       |
| `protections`   | 3       |
| `ai`            | 23      |
| `privacy`       | 6       |
| `stats`         | 2       |
| **Total**       | **149** |

Eventos que originan alertas por email (A): 8, más `notifications.alert.triggered`, que registra el envío. Eventos de vigilancia (V): 23.
