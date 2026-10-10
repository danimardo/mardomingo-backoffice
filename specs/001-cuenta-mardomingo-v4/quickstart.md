# Quickstart: validación de extremo a extremo de la Cuenta Mardomingo v4

**Funcionalidad**: `001-cuenta-mardomingo-v4` · **Fase**: 1 de `/speckit-plan` · **Fecha**: 2026-10-10

> **Estado: comandos PENDIENTES DEL SCAFFOLD (L01).** El repositorio aún no tiene `package.json`, scripts,
> suites ni servidores simulados. Los comandos de esta guía son los fijados por la constitución («Scripts
> estándar») y por `Historias.md` 15.25; se crean en L01 (T-TEST-006) y se documentan en `CLAUDE.md`. Hasta
> entonces, ningún escenario puede marcarse como **comprobado**. Los nombres de las variables exclusivas de
> test (simuladores, _outbox_, captcha falso) los fija `env-schema.ts` en L01.

Esta guía **no** explica cómo implementar: describe cómo comprobar que la funcionalidad completa cumple la
especificación. Cada escenario enlaza a los contratos:

- API de las apps: [contracts/api-v1.md](./contracts/api-v1.md) (endpoints `E01`–`E14`, códigos de la
  sección 2).
- Web: [contracts/web-routes.md](./contracts/web-routes.md) (rutas `W01`–`W52`).
- Eventos de log: [contracts/log-events.md](./contracts/log-events.md).
- Datos: [data-model.md](./data-model.md) (tablas, dueños y restricciones).
- Decisiones de la revisión del plan (D-01…D-22): [plan.md](./plan.md).

---

## 1. Requisitos previos

| Herramienta               | Versión                                                | Para qué                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js                   | **24.21.0** (LTS «Krypton»)                            | Runtime, build y tests (`engines.node: ">=24.21.0 <25"`)                                                                                                                                                     |
| pnpm                      | **12.8.1** (campo `packageManager`; `corepack enable`) | Instalación con `--frozen-lockfile` y scripts                                                                                                                                                                |
| ffmpeg / ffprobe          | **7.1.x** en el `PATH`                                 | Medición real de la duración del audio en los tests de integración de transcripción (BE-FR-44) y conversión a mp3 o wav del audio del respaldo por OpenRouter (D-08). En la imagen Docker viene de Debian 13 |
| Docker                    | Reciente, con soporte de contenedores Linux            | Capturas de regresión visual **solo** en el contenedor oficial de Playwright 1.64.0 (nunca en Windows)                                                                                                       |
| Navegadores de Playwright | Los de `@playwright/test` 1.64.0                       | `pnpm exec playwright install chromium` (y `firefox webkit` para la matriz)                                                                                                                                  |
| Git                       | Reciente                                               | Selección de ficheros cambiados (`lint:changed`)                                                                                                                                                             |

En Windows, una persona administradora puede aplicar las exclusiones de Windows Defender del script de
T-TEST-008 (nunca el agente).

## 2. Preparación

1. Instalar dependencias:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. **No se crea `.env` para los tests** (Historias 15.22). Las suites `http` y Playwright arrancan el build
   con un conjunto mínimo de variables que generan ellas mismas (`webServer.env` o `globalSetup`), sin
   sintaxis de shell:

   | Variable                                   | Valor en test                                                                                                                                                                                   | Nota                                                                                                                |
   | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
   | `APP_ENV`                                  | `test`                                                                                                                                                                                          | Único entorno que admite simuladores, captcha falso y _outbox_ en fichero; no exige las variables de producción     |
   | `DATABASE_PATH`                            | Fichero temporal por ejecución                                                                                                                                                                  | BD de test con migraciones y _seed_ (app `secretario`, ajustes, paquetes)                                           |
   | `PUBLIC_WEB_URL` / `PUBLIC_API_URL`        | Dos hosts distintos (p. ej. `http://localhost:<puerto>` y `http://127.0.0.1:<puerto>`)                                                                                                          | Ejercen la separación por host (15.27-8)                                                                            |
   | `BETTER_AUTH_SECRET`                       | Aleatorio, generado al arrancar la suite                                                                                                                                                        | Nunca un valor real                                                                                                 |
   | `EMAIL_HASH_KEY`                           | Aleatorio, generado al arrancar la suite                                                                                                                                                        | Clave del HMAC-SHA256 del email normalizado (D-11); en producción nunca se rota                                     |
   | `OPENROUTER_MANAGEMENT_KEY`                | Ausente (salvo en el test de la alerta de saldo, contra el simulador)                                                                                                                           | Sin ella la alerta de saldo queda desactivada y se registra `ai.provider_balance.check_disabled` al arrancar (D-04) |
   | `ADMIN_EMAIL`                              | `admin@example.test`                                                                                                                                                                            | Promoción del administrador al verificar                                                                            |
   | `PAYMENTS_PROVIDER` / `INVOICING_PROVIDER` | `simulated` / `none`                                                                                                                                                                            | Únicos valores admitidos en la v4                                                                                   |
   | `LOG_LEVEL`                                | `debug`                                                                                                                                                                                         | El marcador de privacidad ve todos los niveles                                                                      |
   | `PORT`                                     | Libre, elegido por la suite                                                                                                                                                                     | En producción y staging, 7311 y 7312                                                                                |
   | Simuladores, _outbox_, captcha falso       | `MOCK_OPENROUTER_URL`, `MOCK_MISTRAL_URL`, `MOCK_RESEND_URL`, `MOCK_BCE_URL`, `MOCK_TURNSTILE_URL`, `MOCK_GITHUB_URL` (URL base), `EMAIL_OUTBOX_DIR` (carpeta `.outbox/`) y `CAPTCHA_FAKE=true` | Solo con `APP_ENV=test`; el resto de entornos los rechaza (`env-schema.ts`)                                         |

   Hosts en Windows y en el CI (decisión del propietario): `localhost` para la web y `127.0.0.1` para la API. `HOST` vale `0.0.0.0` por defecto (comprobado: `localhost` responde); `HOST=::` solo si hiciera falta IPv6.

Para depurar a mano contra el build, se lanzan esas mismas variables en el proceso (`node build`), nunca
con claves reales de OpenRouter, Mistral, Resend o Turnstile.

3. Datos: cada test crea los suyos con _builders_ que llaman a los servicios (emails únicos
   `e2e-<worker>-<uuid>@example.test`). Los E2E reutilizan el `storageState` por rol (`anonymous`, `user`,
   `tester`, `admin`, `blocked`) del proyecto `setup`.

## 3. Comandos

Todos **pendientes de L01**.

| Comando                                          | Qué valida                                                                                                                                                         | Cuándo (15.24)                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `pnpm check`                                     | `svelte-kit sync` + `svelte-check --fail-on-warnings` (tipos, firmas de eventos)                                                                                   | Siempre                          |
| `pnpm lint`                                      | `prettier --check .` y `eslint . --max-warnings 0` (fronteras, sin `as`, sin `$app/stores`, a11y de Svelte)                                                        | PR                               |
| `pnpm lint:changed`                              | ESLint solo sobre lo cambiado (completo si cambia la configuración)                                                                                                | Durante el lote                  |
| `pnpm lint:tokens`                               | Sin colores, gradientes ni sombras literales fuera de los tokens (puerta 10)                                                                                       | PR                               |
| `pnpm test`                                      | Vitest `unit` + `component` + `integration` (sin `http`), incluido el test de arquitectura                                                                         | Lote y PR                        |
| `pnpm test:unit` / `test:component` / `test:int` | Un proyecto de Vitest                                                                                                                                              | Bucle de desarrollo              |
| `pnpm test:related <ficheros>`                   | `vitest related`                                                                                                                                                   | Bucle de desarrollo              |
| `pnpm test:http`                                 | Hooks y API contra el build: separación por host, CORS, comprobación de origen del host web (D-01), cabeceras, códigos de 7.2, conformidad con el OpenAPI, IP real | PR                               |
| `pnpm test:coverage`                             | Umbrales: 100 % en `domain/` y los dos `shared/`; 80 % en `src/lib/**`                                                                                             | PR                               |
| `pnpm test:trace`                                | Lista los `CA` de `Historias.md` y los criterios `UX-xx` sin test                                                                                                  | Cierre de lote e historia        |
| `pnpm test:e2e:smoke`                            | Arranque, estilos, navegación, sin errores de consola ni hidratación, login y panel                                                                                | PR                               |
| `pnpm test:e2e:critical`                         | Los 10 E2E críticos de 15.17 (incluido sin JavaScript)                                                                                                             | PR                               |
| `pnpm test:e2e:a11y`                             | axe en **todas** las rutas, tema claro y oscuro: cero `serious`/`critical`                                                                                         | PR                               |
| `pnpm test:e2e`                                  | Todo Playwright en Chromium                                                                                                                                        | `main`                           |
| `pnpm test:e2e:cross-browser`                    | Chromium, Firefox y WebKit (también WebKit móvil)                                                                                                                  | Nocturna, release y PR de riesgo |
| `pnpm test:e2e:visual`                           | Regresión visual (8–10 capturas), **solo dentro del contenedor oficial de Playwright 1.64.0**                                                                      | Nocturna                         |
| `pnpm test:e2e:ui` / `:headed` / `:debug`        | Depuración                                                                                                                                                         | Local                            |
| `pnpm test:mutation`                             | Stryker incremental sobre el dominio                                                                                                                               | Semanal                          |
| `pnpm build`                                     | `vite build` sin secretos                                                                                                                                          | PR                               |
| `pnpm validate`                                  | `check` → `lint` → `test:coverage` → `build` → `test:e2e`, parando en el primer fallo                                                                              | Antes de integrar                |
| `pnpm perf:seed` / `pnpm perf:load`              | Siembra con semilla fija y carga (1 sesión y 20 sesiones con pausas de ~5 s), reservas correctas bajo carga y volumen de logs por petición                         | L12, L16 y release               |

Ejemplo orientativo de la regresión visual en el contenedor (lo concreta L15/L16):

```bash
docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.64.0-noble \
  sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm test:e2e:visual"
```

## 4. Escenarios de validación

Cada escenario indica la suite que lo automatiza, los pasos y el resultado esperado. Al informar, cada uno se
marca como **comprobado**, **pendiente**, **no verificable en este entorno** o **no aplica** (con el motivo).
Ningún informe declara un escenario como comprobado sin haberlo ejecutado.

### V01 · Registro y verificación con origen `secretario`

- **Requisitos**: BE-FR-01, 02, 11, 12, 64, 69; UX-01–UX-03; aclaración «pasos tras verificar».
- **Contratos**: W08, W09, W10, W19; eventos `accounts.signup.*`, `accounts.email.verified`,
  `credits.bucket.granted`, `credits.welcome.denied`.
- **Suite**: `test:e2e:critical` (E2E 1) + `test:int` (`accounts`, `credits`). L03 comprueba la verificación y
  los pasos siguientes; la concesión de la bienvenida (pasos 4 y 6) se añade en L05 (D-20).
- **Pasos**:
  1. Abrir `/registro?app=secretario`; comprobar que las casillas legales y la de edad **no** vienen
     marcadas y que la regla 8–128 se ve antes de escribir.
  2. Enviar con una contraseña de 7 caracteres → error junto al campo, foco en el resumen, lo escrito se
     conserva salvo la contraseña.
  3. Enviar datos válidos (captcha falso válido, verificado por `CaptchaVerifier` de `accounts`, D-02).
  4. Leer el enlace en el _outbox_ y abrir `/verificar?token=…`; pulsar «Verificar».
  5. Repetir el registro con el mismo email.
  6. Registrar y verificar `<usuario>+2@gmail.com` cuando `<u.suario>@gmail.com` ya recibió la bienvenida.
  7. Con la app `secretario` con texto propio de pasos siguientes, repetir 1–4 con otra cuenta.
- **Resultado esperado**:
  - Paso 3: pantalla «Te hemos enviado un email» con la dirección, qué hacer si no llega y el reenvío;
    cuenta sin verificar; `terms_acceptances` con versión y fecha de términos, privacidad, uso aceptable y
    `age_declaration`; `user.signup_app_id` = `secretario`.
  - Paso 4: redirección a `/panel/bienvenida` con **1.000 créditos** gratuitos que caducan a los 30 días y el
    paso siguiente genérico («Descarga Secretario AI e inicia sesión con tu email» con su botón).
  - Paso 5: misma respuesta neutra, sin revelar que existía.
  - Paso 6: cuenta creada **sin** bienvenida y explicación visible en el panel.
  - Paso 7: se muestra el texto propio de la app en lugar del genérico.
  - Sin JavaScript, el registro muestra el aviso `<noscript>` del captcha (única excepción).

### V02 · Login de app y operación de chat con cobro

- **Requisitos**: BE-FR-03, 04, 19, 20, 22, 30, 34, 65, 71, 80; flujo §8.
- **Contratos**: E02, E05, E07, W24; eventos `accounts.login.succeeded`, `credits.hold.*`,
  `credits.charge.applied`, `ai.operation.completed`.
- **Suite**: `test:http` + `test:e2e:critical` (E2E 5).
- **Pasos**:
  1. Cuenta verificada con la bienvenida (1.000 créditos = `1000000000` µc).
  2. `POST /api/v1/auth/login` con `X-App-Id: secretario`, `X-App-Version: 4.0.0`,
     `X-Device-Name: PC-PRUEBA`.
  3. `POST /api/v1/ai/chat` `{ "operation": "fix", "messages": [...] }` con el Bearer; el proveedor simulado
     devuelve `usage.cost = 0.0004` USD (valores por defecto: `fx_usd_eur = 0,92`, comisión 5,5 %, margen
     2,0).
  4. `GET /api/v1/me`.
  5. Repetir 3 con el mismo token y `X-App-Id` de otra app sembrada en test.
  6. Abrir `/panel/consumo` en la web.
- **Resultado esperado**:
  - Paso 2: `200` con `token`, `expiresAt` (+30 días), `pendingAcceptances: []`; la sesión guarda app,
    equipo y versión.
  - Paso 3: `200` con `text`, `truncated: false`, `operationId` y **`chargedMicro = 776480`**
    (0,0004 × 1,055 × 0,92 × 2,0 × 1.000 = 0,77648 créditos, redondeo `ceil` a µc). Sin modelo ni proveedor
    en la respuesta.
  - El saldo resumido de la respuesta incluye `reservedMicro` (D-19).
  - Paso 4: `totalMicro = 999223520`, `reservedMicro = 0`, `availableMicro = 999223520`.
  - Paso 5: `401 UNAUTHENTICATED` (sesión ligada a la app).
  - Paso 6: la operación aparece con su nombre amigable, «0,8» créditos y sin modelo ni coste real.
  - Es el ejemplo de `Historias.md` 7.3 y de BE-FR-22 (fila 1) en la versión 2.6: `chargedMicro: 776480`,
    0,77648 créditos, mostrado «0,8» (D-07).

### V03 · Saldo insuficiente con 20 peticiones simultáneas

- **Requisitos**: BE-FR-17, BE-FR-71 CA1–CA2; SC-002.
- **Contratos**: E07 (`402 INSUFFICIENT_BALANCE` con `details.requiredMicro` y `details.availableMicro`);
  eventos `credits.hold.rejected`.
- **Suite**: `test:int` (concurrencia, proveedor simulado con promesas diferidas) + `test:http`.
- **Pasos**:
  1. Configurar la operación para que su reserva estimada sea 50 créditos y fijar `max_debt = 0` en el test.
  2. Dejar la cuenta con 160 créditos disponibles.
  3. Lanzar 20 `POST /ai/chat` a la vez; el simulador retiene las respuestas hasta que se han intentado
     todas las reservas.
  4. Liberar las respuestas; comprobar saldo y ledger.
  5. Repetir con el `max_debt` por defecto (200 créditos).
- **Resultado esperado**:
  - Paso 3: exactamente **3** operaciones reservan y llaman al proveedor; **17** reciben
    `402 INSUFFICIENT_BALANCE` sin llamar al proveedor ni cobrar.
  - Paso 4: cero cobros dobles; saldo materializado = reconstrucción desde `credit_movements`.
  - Paso 5: el número lanzado respeta `reserva ≤ disponible + (max_debt − deuda)` y
    `disponible ≥ min_balance_to_operate`; la exposición total nunca supera saldo + `max_debt`.
  - [Hueco] «saldo para 3 operaciones» (BE-FR-71 CA1) no dice si cuenta el margen de deuda; por eso el
    paso 1 fija `max_debt = 0`.

### V04 · Idempotencia de `/ai/*`

- **Requisitos**: BE-FR-81, BE-FR-37, BE-FR-21; SC-005.
- **Contratos**: E07, api-v1.md 1.6 y 1.7; eventos `ai.idempotency.replayed`, `ai.operation.cancelled`,
  `ai.cancellation_cost.recorded`.
- **Suite**: `test:int` + `test:http` (cierre de conexión).
- **Pasos** (misma `Idempotency-Key` UUID en cada caso):
  1. Lanzar una operación con el simulador retenido y repetirla mientras sigue en curso.
  2. Dejar que termine y se entregue; repetirla.
  3. Nueva clave: cerrar la conexión **después** de que responda el simulador; repetir.
  4. Nueva clave: cerrar la conexión **antes** de que responda (el simulador factura igualmente la generación
     y la expone en su consulta posterior); repetir.
  5. Sin cabecera: enviar dos veces la misma petición.
- **Resultado esperado**:
  1. `409 REQUEST_IN_PROGRESS`, sin segunda llamada al proveedor.
  2. `409 DUPLICATE_REQUEST` con `details.operationId`; el saldo no cambia.
  3. La primera queda `undelivered` y cobrada; la repetición se ejecuta, responde `200` y **no se cobra**
     (coste absorbido en estadísticas).
  4. La primera queda `cancelled` sin cobro al usuario; el coste facturado por el simulador se guarda en
     `ai_operations.cost_micro_usd` y aparece en las estadísticas como **pérdida por cancelación** (D-05); la
     repetición se ejecuta y se cobra con normalidad.
  5. Dos operaciones y dos cobros.

### V05 · Transcripción con respaldo

- **Requisitos**: BE-FR-35, 20, 21, 38 CA2, 44; SC-006.
- **Contratos**: E08; eventos `ai.provider.retry`, `ai.transcription.backup_used`, `ai.operation.failed`.
- **Suite**: `test:int` (ffprobe real con audios de fixture y temporizadores falsos) + `test:http`.
- **Pasos**:
  1. Simulador de Voxtral que falla siempre; backup que responde. Enviar un WebM de 118 s.
  2. Ambos fallan.
  3. Audio de 311 s (más de 300 + 10 de tolerancia).
  4. Fichero que ffprobe no puede leer.
  5. Tercera transcripción simultánea del mismo usuario.
- **Resultado esperado**:
  1. Reintentos de Voxtral a los 2, 4 y 8 s (reloj falso), después backup; `200` con
     `providerUsed: "backup"`, `audioSeconds: 118`, sin nombre de modelo; cobro solo de lo facturado por cada
     proveedor. El simulador de OpenRouter recibe el audio convertido con ffmpeg a mp3 o wav, nunca WebM
     (D-08).
  2. `502 TRANSCRIPTION_FAILED` con `primaryError` y `backupError` saneados; sin cobro.
  3. `413 AUDIO_TOO_LONG` con `details.maxSeconds = 300`, sin llamar al proveedor.
  4. `400 VALIDATION_ERROR` (`details.field = "file"`), sin cobro.
  5. `429 RATE_LIMITED` con `Retry-After`.
  - En todos los casos, ni el temporal de audio ni el convertido existen al terminar (también en error y
    cancelación).

### V06 · Compra simulada sin doble acreditación

- **Requisitos**: BE-FR-17, 23–26, 74; UX-05, UX-06; SC-005.
- **Contratos**: W20, W21; eventos `payments.purchase.*`, `credits.bucket.granted`, `credits.debt.settled`.
- **Suite**: `test:e2e:critical` (E2E 4) + `test:int` (`payments`, `credits`).
- **Pasos**:
  1. Como `tester`, abrir `/panel/comprar`, elegir el paquete de 10 € y enviar **sin** marcar la casilla de
     desistimiento.
  2. Marcarla, pedir factura completa sin datos fiscales e introducir un NIF inválido; corregirlo.
  3. Confirmar con doble clic; después volver atrás y reenviar.
  4. Repetir con una cuenta que tiene deuda.
  5. Servicio de pagos con la regla de producción (`APP_ENV = production` inyectado en el test de
     integración) y un usuario sin rol `tester`.
- **Resultado esperado**:
  1. Error junto a la casilla; no se compra nada.
  2. Error del NIF junto al campo; corregido, se acepta.
  3. **Una sola** bolsa `paid` con `simulated = true` de **10.500 créditos** (`10500000000` µc); la página de
     resultado muestra el saldo nuevo y, en las repeticiones, «Esta compra ya se completó».
  4. La compra liquida primero la deuda (`debt_settlement`) y el resto queda como saldo comprado.
  5. «Próximamente» visible y accesible con su explicación; `403 PURCHASE_NOT_AVAILABLE` si se fuerza el
     envío. La compra simulada no genera factura ni cuenta como compra real.

### V07 · Panel sin JavaScript

- **Requisitos**: FR-112, SC-012; Historias 15.17 E2E 10, 16.11.
- **Contratos**: W11, W16, W18, W20, W22, W27, W36; web-routes.md 1.4–1.6 (el navegador envía `Origin`, así
  que la comprobación de origen del host web no afecta a estos flujos).
- **Suite**: `test:e2e:critical` con `javaScriptEnabled: false`.
- **Pasos**: con JavaScript desactivado, iniciar sesión; comprar un paquete; guardar datos fiscales; aceptar
  un documento legal pendiente; como administrador, hacer un ajuste de saldo (previsualizar y confirmar);
  cambiar tema y efectos; filtrar movimientos por app y pasar de página; abrir el registro.
- **Resultado esperado**: todos los flujos se completan con `<form>` y `<a>` nativos y POST-redirect-GET;
  los filtros y la página quedan en la URL y se restauran al volver; la confirmación no usa
  `window.confirm`; el contenido esencial está en el HTML inicial; el registro solo muestra el aviso del
  captcha.

### V08 · Tema Sistema sin destello

- **Requisitos**: UX-TEMA CA1–CA5, UX-EFECTOS CA1–CA4; FR-108, FR-109; SC-017; DS-02, DS-03.
- **Contratos**: W16 (cookies `mdm_theme` y `mdm_effects`, nombres propuestos); layout raíz.
- **Suite**: `test:e2e:smoke` / `test:e2e:a11y` + spec de tema (Playwright `emulateMedia`).
- **Pasos**:
  1. Sin cookie y `colorScheme: "light"`, JavaScript desactivado: abrir `/`.
  2. Lo mismo con `colorScheme: "dark"`.
  3. Con JavaScript y «Sistema»: escribir en un campo de `/panel/perfil`, dejar el foco en él y cambiar
     `emulateMedia` a oscuro.
  4. Elegir «Oscuro» en el selector; recargar.
  5. Activar «Reducir transparencia y movimiento»; emular `reducedMotion: "reduce"` con el ajuste
     desactivado.
- **Resultado esperado**:
  1. El HTML inicial no lleva `data-theme` y la primera pintura usa los tokens claros (fondo y variable del
     tema comprobados con `getComputedStyle`); sin destello del oscuro.
  2. Primera pintura oscura.
  3. La página cambia sin recargar; el texto, el foco y la posición se conservan.
  4. Cookie técnica guardada; el servidor pinta `data-theme="dark"` en el HTML inicial.
  5. Superficies de cristal opacas y sin movimiento no esencial; con el ajuste desactivado se respeta igual
     `prefers-reduced-motion`. axe sin violaciones `serious`/`critical` en ambos temas.

### V09 · Mantenimiento por app

- **Requisitos**: BE-FR-47, 48 CA2; E2E crítico 8.
- **Contratos**: W40 (`?/guardarMantenimiento`), E01, E02, E05, E07, E10; eventos
  `protections.request.rejected`, `audit.entry.recorded`.
- **Suite**: `test:e2e:critical` (admin) + `test:http`.
- **Pasos**:
  1. Como administrador, activar el mantenimiento de `secretario` con el mensaje «Volvemos a las 18:00»
     (previsualizar y confirmar).
  2. Con un Bearer de `secretario`: `POST /ai/chat`, `GET /sync`, `GET /defaults`, `POST /auth/login`,
     `GET /me`, `GET /app/status`.
  3. Repetir 2 con otra app sembrada.
  4. Desactivar el mantenimiento.
- **Resultado esperado**:
  - Paso 1: entrada de auditoría enlazada tras guardar.
  - Paso 2: IA y sincronización → `503 MAINTENANCE` con `message` = «Volvemos a las 18:00»; login, `/me`,
    `/defaults` (D-19) y `/app/status` → `200`; `/app/status` con `maintenance.active: true` y el mensaje.
  - Paso 3: la otra app no se ve afectada.
  - Paso 4: la siguiente petición funciona sin redesplegar.

### V10 · Conflicto de sincronización

- **Requisitos**: BE-FR-39–41, BE-FR-65 CA3; SC-008, SC-009.
- **Contratos**: E10, E11; eventos `sync.document.seeded`, `sync.document.rejected`.
- **Suite**: `test:int` (concurrencia) + `test:http`.
- **Pasos**:
  1. Cuenta nueva: dos clientes hacen `GET /sync` con `X-App-Id: secretario`.
  2. Ambos hacen `PUT /sync` con `If-Match` igual a la revisión leída, a la vez.
  3. El perdedor vuelve a leer, fusiona y reintenta.
  4. `PUT` con una categoría no declarada; `PUT` de más de `max_sync_doc_kb`; `PUT` sin `If-Match`.
  5. `GET /sync` con otra app.
- **Resultado esperado**:
  1. Documento sembrado con los predeterminados, todos los `updatedAt = 0` y `revision = 1` (D-19).
  2. Uno `200` con revisión nueva; el otro `412 SYNC_CONFLICT`; ninguna escritura se pierde en silencio.
  3. `200` con la revisión siguiente.
  4. `400 VALIDATION_ERROR`, `413 PAYLOAD_TOO_LARGE` y `400 VALIDATION_ERROR` con `details.field = "If-Match"`.
  5. Documento propio de esa app, sin datos de `secretario`.

### V11 · Borrado de cuenta

- **Requisitos**: BE-FR-07, 11.5; UX-07; FR-104, FR-121; E2E crítico 6.
- **Contratos**: W29, W17, E05; eventos `privacy.account.deleted`, `credits.balance.forfeited`,
  `accounts.session.revoked`.
- **Suite**: `test:e2e:critical` + `test:int` (`privacy`, anonimización).
- **Pasos**:
  1. Cuenta con saldo, una sesión web y un Bearer de app; abrir `/panel/perfil/borrar`.
  2. Enviar con contraseña incorrecta.
  3. Enviar con la contraseña correcta y la casilla marcada.
  4. Usar el Bearer en `GET /api/v1/me`.
  5. Registrar de nuevo una variante normalizada del mismo email y verificarla.
- **Resultado esperado**:
  1. Se ven el saldo que se pierde en créditos y euros y las apps afectadas; el foco inicial no está en
     «Borrar mi cuenta».
  2. Error, nada borrado.
  3. Redirección a `/cuenta-borrada`; sesión web cerrada; bolsas restantes a cero con movimientos `forfeit`
     que cuentan en estadísticas como saldo perdido (D-15); email, perfil, datos fiscales y documentos
     sincronizados eliminados; `deleted_at` fijado; movimientos, operaciones y pagos conservados solo con el
     `user_id` opaco, sin desactivar ningún _trigger_ (D-18); hash en `welcome_grants` conservado.
  4. `401 UNAUTHENTICATED`.
  5. Cuenta creada **sin** bienvenida.

### V12 · Alertas al administrador

- **Requisitos**: BE-FR-15 CA1, 46, 56, 58, 80, 82, 87; SC-015, SC-019.
- **Contratos**: log-events.md §4; eventos con marca **A** y `notifications.alert.*`.
- **Suite**: `test:int` con reloj falso (cambios de día en Europe/Madrid) y _outbox_.
- **Pasos** (cada uno dos veces seguidas y, después, tras normalizar la condición):
  1. Superar el freno global (coste real del día + reservas de cuentas sin compras > 5 €).
  2. Saldo de OpenRouter simulado < 10 USD en la tarea horaria.
  3. Errores 402 de facturación de Mistral.
  4. Modelo asignado retirado; precio de otro modelo +25 %.
  5. Tres operaciones marcadas por moderación del mismo usuario en un día.
  6. Corromper el saldo materializado de una cuenta y ejecutar `ledger-check`.
  7. Tres días seguidos sin poder consultar el BCE.
- **Resultado esperado**: un **único** email al administrador por cruce de umbral; ninguno en la
  repetición; se rearma al normalizarse. En 1, las cuentas con compras reales siguen operando y las demás
  reciben `503 SERVICE_LIMITED`. En 6, evento `credits.ledger.mismatch` de nivel `error`. En 4 (retirado),
  también aviso en el panel de administración.

### V13 · No se guarda contenido

- **Requisitos**: BE-FR-38 CA1–CA2, BE-FR-78 CA4, BE-FR-37; principio XI; SC-004.
- **Contratos**: api-v1.md 1.1 y §5; log-events.md 1.2 y §5.
- **Suite**: `test:http` y `test:e2e` con el **marcador de privacidad** y `LOG_LEVEL=debug`; `test:int`
  para temporales.
- **Pasos**:
  1. Generar un marcador único (`PRIV-<uuid>`) e incluirlo en `messages`, en `variables`, en el `prompt` de
     imagen, en una imagen de `image-transcription`, en un audio de fixture y en un documento `PUT /sync`.
  2. Ejecutar las operaciones con resultado correcto, con fallo de todos los proveedores, con cancelación y
     con un error de validación (que no debe devolver el valor recibido).
  3. Buscar el marcador en stdout, en el fichero SQLite (incluido el WAL), en el directorio temporal y en las
     respuestas de error.
  4. En staging, buscar en OpenObserve un texto enviado en una operación.
- **Resultado esperado**:
  - Paso 3: **cero** apariciones (el documento sincronizado sí se guarda en `sync_documents.data`, que es su
    función, pero nunca en logs). `ai_operations` solo tiene metadatos.
  - Paso 4: sin resultados (BE-FR-38 CA1). En `APP_ENV=test` este paso es **no verificable en este
    entorno**; se comprueba en staging.

### V14 · Límites por cuenta y por app

- **Requisitos**: BE-FR-43, BE-FR-63 CA4; aclaración «límites cuenta + app».
- **Contratos**: E07 (`429 RATE_LIMITED`), W40 (`?/guardarSobrescrituras`); eventos
  `protections.request.rejected` (`rate_limited_app`, `rate_limited_account`), `apps.settings.rejected`.
- **Suite**: `test:int` (contadores con reloj falso) + `test:http`.
- **Pasos**:
  1. Global `ai_requests_per_minute = 30`; la app A con valor propio 5; la app B sin valor propio.
  2. Seis peticiones de IA de la app A en un minuto.
  3. Peticiones de la app B hasta sumar 30 en la cuenta; una más de cualquiera de las dos.
  4. Intentar fijar en la app A un valor de 40 (mayor que el global).
- **Resultado esperado**: 2. La sexta → `429 RATE_LIMITED` con `Retry-After` (`reason = rate_limited_app`). 3. La app B sigue funcionando hasta que la suma llega a 30; la siguiente → `429` (`reason =
 rate_limited_account`). 4. Rechazado al guardar con el error junto al campo.

### V15 · Ajuste del administrador que liquida deuda

- **Requisitos**: BE-FR-17, BE-FR-18; aclaración «deuda por ajuste»; UX-13.
- **Contratos**: W36; eventos `credits.adjustment.applied`, `credits.debt.settled`, `audit.entry.recorded`.
- **Suite**: `test:int` (`credits`) + `test:e2e:critical` (E2E 8).
- **Pasos**:
  1. Cuenta con deuda de 3,236 créditos.
  2. Previsualizar un ajuste **gratuito** de +10 créditos sin motivo; con motivo.
  3. Confirmar.
  4. Previsualizar un ajuste negativo de −10 créditos (mayor que el saldo disponible de 6,764).
- **Resultado esperado**: 2. Sin motivo, error junto al campo; con motivo, la vista previa muestra saldo antes (−3,236) → después
  (6,764) y la deuda liquidada. 3. Movimientos `debt_settlement` (3,236) y `adjustment`; bolsa gratuita de 6,764 créditos; la parte que
  liquida consta como pérdida absorbida en estadísticas; entrada de auditoría enlazada; doble envío sin
  duplicar el ajuste. 4. Error de validación junto al importe y ningún movimiento: un ajuste negativo no puede superar el saldo
  disponible ni crear deuda (D-16; `credits.adjustment.rejected` con `reason = exceeds_available`).

### V16 · Anuncios del panel

- **Requisitos**: BE-FR-85 CA1–CA2; UX-12; aclaración «anuncios del panel».
- **Contratos**: W18, E01.
- **Suite**: `test:int` (composición del modelo de vista con `toStrictEqual`) + `test:http`.
- **Pasos**:
  1. Crear anuncios activos: para todas las apps; para `secretario` con rango de versiones `< 4.0.0`; para
     una app que la cuenta nunca ha usado.
  2. La cuenta tiene una sesión pasada de `secretario`. Abrir `/panel`.
  3. `GET /app/status` con `X-App-Version: 4.0.0`.
- **Resultado esperado**: 2. El panel muestra el anuncio general y el de `secretario` (sin filtrar por versión), cada uno con el
  nombre de su app y el nivel con icono y texto; no muestra el de la app no usada. 3. `/app/status` devuelve solo el general (el de `secretario` no aplica a 4.0.0), con su `id` estable.

### V17 · Comprobación de origen en la web y subida de audio sin `Origin`

- **Requisitos**: constitución v2.1.1, principio III (enmienda D-01); BE-FR-65 CA2; D-19 (CORS).
- **Contratos**: web-routes.md 1.4 (comprobación de origen), api-v1.md 1.1 y 1.5, E08; eventos
  `http.origin.rejected`, `http.cors.rejected`.
- **Suite**: `test:http` (N3 HTTP, contra el build).
- **Pasos**:
  1. En el host web, `POST /login?/entrar` como formulario **sin** `Origin`.
  2. Lo mismo con `Origin: https://otro.example`.
  3. Lo mismo con `Origin` igual al de `PUBLIC_WEB_URL`.
  4. En el host de la API, `POST /api/v1/ai/transcribe` en `multipart/form-data` **sin** `Origin`, con Bearer
     de `secretario` y un audio válido.
  5. En el host de la API, `POST /api/v1/ai/chat` con un `Origin` que no está en `allowed_origins` de la app.
  6. _Preflight_ `OPTIONS` con el `Origin` de una app activa; otro con un origen que no figura en ninguna.
- **Resultado esperado**:
  1. y 2. `403` sin ejecutar la _action_ (`http.origin.rejected`, `reason = origin_missing` /
     `origin_mismatch`).
  2. La _action_ se ejecuta con normalidad.
  3. `200`: la comprobación de origen de SvelteKit está desactivada y la propia solo actúa en el host web.
  4. `403 ORIGIN_NOT_ALLOWED` sin `Access-Control-Allow-Origin`.
  5. `204` con las cabeceras CORS de api-v1.md 1.5; el segundo, sin `Access-Control-Allow-Origin`.

## 5. Resumen de cobertura

| Escenario | Suite principal            | Lote (15.6)                                   |
| --------- | -------------------------- | --------------------------------------------- |
| V01       | E2E crítico 1, `test:int`  | L03, L05 (bienvenida, D-20)                   |
| V02       | `test:http`, E2E crítico 5 | L04, L07, L12                                 |
| V03       | `test:int` (concurrencia)  | L05, L07                                      |
| V04       | `test:int`, `test:http`    | L07                                           |
| V05       | `test:int` (ffprobe real)  | L08                                           |
| V06       | E2E crítico 4              | L10                                           |
| V07       | E2E crítico 10 (sin JS)    | L01–L13                                       |
| V08       | Spec de tema, smoke, a11y  | L01                                           |
| V09       | E2E crítico 8, `test:http` | L04, L13                                      |
| V10       | `test:int`, `test:http`    | L11                                           |
| V11       | E2E crítico 6, `test:int`  | L12                                           |
| V12       | `test:int` (reloj falso)   | L09, L14                                      |
| V13       | Marcador de privacidad     | L07, L08, L11                                 |
| V14       | `test:int`, `test:http`    | L09                                           |
| V15       | `test:int`, E2E crítico 8  | L05, L13                                      |
| V16       | `test:int`, `test:http`    | L04, L12                                      |
| V17       | `test:http`                | L01 (origen), L04 (CORS), L08 (transcripción) |

Antes del lanzamiento público con cobros reales se añaden, fuera de esta guía automática: la auditoría
manual WCAG 2.2 AA (NVDA y VoiceOver), la prueba de usabilidad de 16.10, el simulacro de restauración de
Litestream y la verificación de proxy e IP real en staging (constitución, «Proxy, puerto e IP del cliente»).
