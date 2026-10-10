# Research: Cuenta Mardomingo v4 (aplicación completa)

Fase 0 de `/speckit-plan`. Resuelve las incógnitas técnicas del plan con las versiones fijadas en la constitución. Cada tema indica lo que queda pendiente de comprobar en L01 o en su lote.

Actualizado con las decisiones de la revisión del plan del 2026-10-10 (D-01…D-22, sección «Decisiones de la revisión del plan» de `plan.md`), recogidas en la constitución v2.1.1 y en `Historias.md` 2.6: cada tema afectado da ya la decisión final.

Este documento es la **parte 1 (R01–R08)** de `research.md` para la funcionalidad
`001-cuenta-mardomingo-v4`. Resuelve las incógnitas técnicas de **cómo** aplicar las decisiones ya
tomadas en la constitución, `ARCHITECTURE.md` y los ADR 0001–0007 con las versiones fijadas
(SvelteKit 2.70.3, Better Auth 1.7.7, Drizzle 0.45.4, Zod 4.6.5, zod-openapi 6.0.2, Paraglide
2.27.0, Tailwind 4.3.3, ESLint 10.12.0, Vitest 5.0.3…). No reabre decisiones. Fuentes consultadas
el 2026-10-10: context7 (docs de svelte.dev, better-auth, drizzle, zod v4.6.5, zod-openapi,
paraglide-js, tailwindcss, vitest v5.0.3), el `CHANGELOG.md` de la rama `version-2` de
`sveltejs/kit` (última entrada 2.70.3), el código fuente de `respond.js`, `write_server.js` y
`utils/http.js` de esa rama, el código del plugin `captcha` de Better Auth, el registro de npm
(`zod-openapi@6.0.2`) y el `CHANGELOG.md` de `eslint-plugin-svelte`. La documentación de svelte.dev
ya describe SvelteKit 3 (`$app/env`, `defineEnvVars`, `trustedOrigins` en `vite.config`): todo lo
de SvelteKit se ha contrastado con el changelog de la rama 2. Lo que no se ha podido confirmar
para la versión fijada se marca **NO VERIFICADO — comprobar en L01**.

## R01 SvelteKit 2.70

- **Decisión**:
  - `init` (`ServerInit`, desde 2.10) en `hooks.server.ts` con `if (building) return;` (`building` de `$app/environment`; **no** `$app/env`, que es de Kit 3). Ahí se valida el entorno, se abre la BD, se migran y se crea `composition.ts` (Better Auth incluido).
  - `resolve()` de `$app/paths` (2.26): `resolve('/panel/movimientos')` o `resolve('/admin/usuarios/[id]', { id })`. Desde **2.54** admite sufijo `?…`/`#…`: la query se añade así: ``resolve(`/admin/usuarios?${new URLSearchParams(q)}`)``.
  - `$app/state` (`page`, `navigating`, `updated`) solo en componentes; en servidor, `event`.
  - `handle = sequence(...)` (`@sveltejs/kit/hooks`). La separación por host compara `event.url.host` con el host de `PUBLIC_API_URL`/`PUBLIC_WEB_URL` y devuelve `new Response(null, { status: 404 })` sin llamar a `resolve`; `/api/v1/health` se comprueba **antes**.
  - adapter-node: `PORT`, `HOST`, `PROTOCOL_HEADER=x-forwarded-proto`, `ADDRESS_HEADER=x-forwarded-for`, `XFF_DEPTH=1` (toma la IP por la derecha), `BODY_SIZE_LIMIT` (admite `K`/`M`/`G`; por defecto 512K).
  - **`getClientAddress()` lanza si falta `X-Forwarded-For`**: el _healthcheck_ de Coolify llega sin proxy, así que el contexto de petición la lee de forma perezosa (nunca en `/api/v1/health`) y los tests HTTP envían la cabecera.
  - **CSRF y comprobación de origen (D-01)**: la comprobación propia de Kit se ejecuta antes de `handle` y rechaza con 403 todo POST de formulario (`multipart/form-data` incluido) sin `Origin`; las apps de escritorio no lo envían, así que bloquearía `POST /api/v1/ai/transcribe`. Por eso:
    - se desactiva la comprobación de Kit con `kit.csrf.trustedOrigins: ['*']` (o la opción equivalente que confirme el changelog de 2.70.3);
    - se implementa una equivalente en `handle`, **solo en el host web**: todo POST/PUT/PATCH/DELETE con tipo de contenido de formulario (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`) debe traer `Origin` igual al origen de `PUBLIC_WEB_URL`; si falta o no coincide → 403 y `http.origin.rejected`;
    - el host de la API solo acepta Bearer (sin cookies), así que CSRF no aplica allí; su CORS por app no cambia;
    - lo autoriza la enmienda PATCH de la constitución v2.1.1 (principio III; `Historias.md` 10.1) y se prueba en N3 HTTP (formulario sin `Origin` o con otro origen → 403 en el host web; `multipart` sin `Origin` con Bearer → aceptado en el host de la API).
  - `handleError({ error, event, status, message })` devuelve `App.Error = { message, requestId }` y solo registra `status >= 500`.
  - Formularios GET: Kit los intercepta como enlaces; `data-sveltekit-keepfocus` y `data-sveltekit-noscroll` conservan el foco.
- **Justificación**: changelog de la rama 2 (2.10.0 `init`, 2.26.0 `resolve`, 2.54.0 query y hash en `resolve`, 2.36 `csrf.trustedOrigins`, 2.37 sin CSRF en dev, 2.70.0 CSRF activo con `NODE_ENV` distinto de producción); docs de adapter-node.
- **Alternativas consideradas**: `ORIGIN` (un solo origen); `HOST_HEADER` (innecesario, NPM conserva `Host`).
- **Pendiente de comprobar en L01**:
  - La opción exacta de 2.70.3 para desactivar la comprobación de Kit (`trustedOrigins: ['*']` o equivalente) y que no quede otra comprobación de origen antes de `handle`.
  - Que `handleError` reciba los 404 de ruta inexistente (NO VERIFICADO).
  - El evento `sveltekit:shutdown` de adapter-node 5.5.7 para cerrar la BD (NO VERIFICADO).

## R02 Better Auth 1.7.7 con SvelteKit 2

- **Decisión**:
  - **No se monta `svelteKitHandler`**: `/api/auth/*` violaría la separación por host. `accounts` llama a la API de servidor desde las actions y desde `/api/v1/auth/*`: `auth.api.signUpEmail`, `signInEmail` (con `returnHeaders: true` en la API para leer el token Bearer), `verifyEmail`, `resetPassword`, `changePassword({ revokeOtherSessions: true })`, `changeEmail`, `getSession({ headers })`.
  - El plugin `sveltekitCookies(getRequestEvent)` escribe la cookie desde las actions.
  - La instancia se crea con una fábrica `createAuth(deps)` llamada desde `init`, nunca al nivel del módulo.
  - Los enlaces de los emails se construyen con el `token` de `sendVerificationEmail`/`sendResetPassword` hacia rutas propias.
  - Configuración:
    - `drizzleAdapter(db, { provider: 'sqlite', schema })`, con las tablas en `features/accounts/schema.ts` y columnas `timestamp_ms`.
    - `session: { expiresIn: 30 d, updateAge: 24 h }` y `cookieCache` desactivado, para que revocar tenga efecto inmediato.
    - `emailAndPassword: { requireEmailVerification: true, autoSignIn: false, minPasswordLength: 8, maxPasswordLength: 128, resetPasswordTokenExpiresIn: 3600, revokeSessionsOnPasswordReset: true }` y `emailVerification.expiresIn: 86400`.
    - Hash por defecto (scrypt), sin sustituirlo.
    - `user.additionalFields.emailNormalized` y `session.additionalFields.{appId, deviceName, appVersion}` con `input: false`, rellenados en `databaseHooks.*.create.before`.
    - Plugins: solo `bearer()` (token de las apps) y `admin()` (`role` y `banned`). **No** se usan el plugin `captcha` ni el `rateLimit` de Better Auth (`rateLimit: { enabled: false }`): con `auth.api` no actúan.
    - IP: cabecera interna `ipAddressHeaders: ['x-mm-client-ip']` puesta desde `event.getClientAddress()` en las cabeceras que se pasan a `auth.api` (y borrada si llega del cliente).
  - Web: a `getSession` se le pasan las cabeceras sin `authorization`; API: sin `cookie`, y el _handle_ quita `set-cookie` en el host de la API.
  - `ADMIN_EMAIL` se aplica en `emailVerification.afterEmailVerification`, con una transacción propia e idempotente (igual que la bolsa de bienvenida).
  - **Captcha y límites de autenticación (D-02)**, implementados en `accounts`:
    - Turnstile se verifica con un adaptador `CaptchaVerifier` (real y `fake.ts`) que lee el campo `cf-turnstile-response` que el widget inyecta en el `<form>` (R12);
    - los límites por IP de BE-FR-45 (login, registro, reenvío de verificación, recuperación y cambio de email) usan contadores en la tabla propia `auth_rate_limits`, que sustituye a la `rate_limit` de Better Auth; las altas por IP (BE-FR-11.4) se cuentan sobre `user.signup_ip`;
    - el bloqueo por email (BE-FR-67) usa `login_attempts`; los parámetros salen de `settings`.
- **Justificación**: docs de better-auth (integración con SvelteKit, `sveltekitCookies` desde Kit ≥ 2.20, `changeEmail` que verifica la **nueva** dirección por defecto, `advanced.ipAddress`). Aviso explícito de la documentación de rate limit: «Server-side requests made using `auth.api` aren't affected by rate limiting». Código del plugin `captcha`: la comprobación está en `onRequest` (solo en `auth.handler`) y lee `x-captcha-response`.
- **Alternativas consideradas**: montar `svelteKitHandler` (expone `/api/auth/*` en ambos hosts); llamar a `auth.handler(new Request(...))` desde la action (artificioso).
- **Pendiente de comprobar en L01**:
  - Que `afterEmailVerification`, `trustedProxies`/`ipAddressHeaders` y la opción `transaction` del adaptador de Drizzle (debe quedar desactivada: better-sqlite3 no admite transacciones asíncronas) existan así en 1.7.7.
  - Que `signUpEmail` acepte `name: ''`.
  - Cómo bloquear o revocar sin una sesión de administrador (contracargo); probablemente escribiendo directamente en las tablas de `accounts`.
  - Comprobar la contraseña en el cambio de email.
  - El coste de scrypt en el bucle de eventos (medir).

## R03 better-sqlite3 + Drizzle 0.45

- **Decisión**:
  - Una conexión por proceso: `new Database(path)` y `db.pragma()` con `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000` y `synchronous=NORMAL`.
  - Transacción: `db.transaction((tx) => { …; return r; }, { behavior: 'immediate' })`. El callback es **síncrono**: usa `.run()`, `.all()` y `.get()`, sin `await`. Drizzle delega en la transacción nativa de better-sqlite3 (`.immediate()`), que lanza si el callback devuelve una promesa. Un helper `$lib/server/db/tx.ts` fija `immediate` y un tipo `Tx`.
  - _Triggers_ de solo inserción (`credit_movements`, `admin_audit`, `invoices`, `prompt_templates`): `drizzle-kit generate --custom --name=<f>-immutable-triggers` y SQL a mano (`CREATE TRIGGER … BEFORE UPDATE … BEGIN SELECT RAISE(ABORT, …); END;`), cada sentencia separada por `--> statement-breakpoint`.
  - `drizzle.config.ts`: `{ dialect: 'sqlite', schema: './src/lib/server/features/*/schema.ts', out: './drizzle' }`, leyendo la URL con `env-schema.ts`.
  - Claves foráneas: `references(() => user.id)` importando el `schema.ts` de la dueña. Las importaciones `schema.ts` → `schema.ts` que **solo** declaran `references()` quedan fuera del orden y del cálculo de ciclos del principio IV (son declaraciones de la BD, no llamadas en ejecución; D-03, constitución v2.1.1 y `ARCHITECTURE.md` §3/§4). El test de arquitectura las reconoce y las excluye; cualquier otra importación sigue las reglas de siempre.
  - µc: columna propia `micro()` con `customType<{ data: Micro; driverData: number }>` cuyo `fromDriver` aplica `toMicro` (que comprueba `Number.isSafeInteger`), más `check()` de no negativo. Los productos intermedios, con `BigInt` en el dominio. Las agregaciones `sql<number>` se pasan por `toMicro` en el repositorio.
- **Justificación**: docs de Drizzle (`SQLiteTransactionConfig.behavior`, `generate --custom`, `schema` con glob, `breakpoints`); constitución I y «Datos y almacenamiento».
- **Alternativas consideradas**: `sql\`BEGIN IMMEDIATE\``a mano (duplica lo que ofrece Drizzle);`blob({ mode: 'bigint' })`(rompe`CHECK`y sumas);`.$type<Micro>()` (se salta la comprobación de entero seguro).
- **Pendiente de comprobar en L01**:
  - Formato de salida de drizzle-kit 0.31 (`0000_x.sql` + `meta/_journal.json`; la doc de context7 muestra el de la 1.0 beta).
  - Que el migrador ejecute bien los `CREATE TRIGGER` con `;` internos.
  - Que `fromDriver` se aplique también en selecciones parciales.
  - Que el test de arquitectura distingue de forma fiable una importación de `schema.ts` usada solo en `references()` de cualquier otro uso del mismo módulo.

## R04 Zod 4.6 + zod-openapi 6

- **Decisión**:
  - Cada `contract.ts` exporta sus esquemas y un fragmento `paths` (`ZodOpenApiPathsObject`) con `requestParams` (`path`, `query`, `header`), `requestBody` y `responses`. `$lib/server/api/openapi.ts` los reúne (una línea por funcionalidad) y llama a `createDocument({ openapi: '3.1.0', … })` una sola vez, con el resultado en caché en un `*.cache.ts`, para `/api/v1/openapi.json`.
  - Los `id` de `.meta({ id })` llevan el prefijo de la funcionalidad.
  - Mensajes: `z.config({ customError: (iss) => … })` mapea `iss.code` (`invalid_type`, `too_small`, `too_big`, `invalid_format`, `unrecognized_keys`…) a `m.validation_*()` sin usar `iss.input`. Se registra en `init` del servidor y en `hooks.client.ts`, desde `$lib/schemas/common/`.
  - `z.strictObject` en entradas; `z.file().max(bytes).mime([...])` construido por una fábrica con `max_audio_mb`; `z.input`/`z.output`.
  - _Branded_: un único tipo por concepto, `type Micro = number & z.$brand<'Micro'>`. El constructor de `$lib/shared` es la única aserción permitida; los esquemas usan `.brand<'Micro'>()`, así que no hace falta `transform` en las respuestas.
  - Validación de respuestas en los tests: con los mismos esquemas Zod, sin validador JSON Schema (sería una dependencia nueva).
- **Justificación**: docs de zod v4.6.5 (`z.config`, `z.file`, `.brand` con dirección `out` por defecto); README y tipos de zod-openapi; npm: `zod-openapi@6.0.2` con _peer_ `zod ^4.0.0`.
- **Alternativas consideradas**: generar el OpenAPI en el build (complica el build sin secretos); `transform` a `Micro` en las respuestas (zod-openapi no puede representar el tipo de salida).
- **Pendiente de comprobar en L01**:
  - Cómo representa zod-openapi 6 `z.file()` en `multipart/form-data` (`format: binary`).
  - Que `.brand()` sea transparente en el documento.
  - Que los `transform` de entrada no exijan `override` en `requestBody`.
  - Los tipos de v6 se basan en OAS 3.2: confirmar que el documento emitido es 3.1 válido.

## R05 Paraglide 2.27 en SvelteKit 2

- **Decisión**:
  - `project.inlang/settings.json` con `baseLocale: 'es'`, `locales: ['es']` y el plugin _message format_ con `pathPattern: './messages/{locale}.json'`.
  - En `vite.config.ts`, `paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide', strategy: ['baseLocale'] })`. La salida no se versiona y queda fuera de ESLint y Prettier.
  - Sin estrategia de URL no hace falta `reroute` ni `deLocalizeUrl`.
  - En `handle`: `paraglideMiddleware(event.request, ({ request }) => resolve({ ...event, request }))`, en la posición que fija la constitución. Activa el `AsyncLocalStorage` del servidor; `app.html` lleva `lang="es"` literal.
  - Uso: `import { m } from '$lib/paraglide/messages'` en componentes, servidor y plantillas de email (funciones puras en `notifications`). El dominio devuelve códigos, nunca mensajes.
  - Las tareas de `croner` se ejecutan fuera de una petición y usan `baseLocale`.
- **Justificación**: docs de paraglide-js (firma de `paraglideMiddleware(request, resolve, options)`, `compile` y opciones del plugin, ejemplo de SvelteKit); `ARCHITECTURE.md` §8 (no usar `@inlang/paraglide-sveltekit`).
- **Alternativas consideradas**: prescindir del _middleware_ con un solo idioma (más simple, pero la constitución lo fija y deja preparada la incorporación de otros idiomas).
- **Pendiente de comprobar en L01**:
  - Que `getLocale()` fuera de una petición devuelva `es` sin error.
  - Si hace falta `emitTsDeclarations` para que `svelte-check --fail-on-warnings` no avise con los JS generados.

## R06 Tailwind 4.3 con los tokens del sistema de diseño

- **Decisión**:
  - `src/lib/design-system/tokens.css` es el único sitio con valores. Hoy (en `Design/`) usa `:root` oscuro con sobrescritura `[data-theme="light"]`. En L01 (DS-02) cada token de color pasa a **`light-dark(claro, oscuro)`**, con `:root { color-scheme: light dark }` y `:root[data-theme=light|dark] { color-scheme: … }`. Así el modo Sistema funciona sin JS, cambia en vivo (UX-TEMA CA2) y no duplica valores. Los pocos tokens que no son colores y dependen del tema usan un bloque `@media (prefers-color-scheme)` acotado.
  - `app.css`: `@import 'tailwindcss';`, después `tokens.css` y luego `@theme { --color-*: initial; --shadow-*: initial; }` y `@theme inline { --color-surface: var(--surface); … }`. Solo se repiten **nombres**, no valores.
  - Efectos: `[data-effects=reduced]` y `@media (prefers-reduced-transparency: reduce)` ponen a cero `--glass-blur` y pasan a opacos los tokens de material en `tokens.css`. Movimiento: `prefers-reduced-motion` y el mismo atributo anulan los tokens de duración. `prefers-contrast: more` y `forced-colors: active` refuerzan bordes y foco.
  - Colores arbitrarios: **solo `lint:tokens`** (evolución de `verify-tokens`), sin dependencia nueva. Busca en `.svelte`, `.ts` y `.css` (salvo `tokens.css`):
    - valores arbitrarios con color (`-[#…]`, `[rgb(`, `[oklch(`, `[color:…]`);
    - nombres de la paleta por defecto (`-(red|slate|…)-(50…950)`);
    - literales de color, gradiente o sombra de color.
- **Justificación**: docs de Tailwind (`--color-*: initial`, `@theme inline` para variables por tema, ejemplo con `data-theme`); `ARCHITECTURE.md` §8; DS-02, DS-05 y DS-08.
- **Alternativas consideradas**: regla de ESLint (`eslint-plugin-better-tailwindcss`: dependencia nueva, exige enmienda); `@custom-variant dark` (sin modo Sistema sin JS); dos bloques claro/oscuro duplicados.
- **Pendiente de comprobar en L01**:
  - Tailwind 4.3 no tiene opción para prohibir valores arbitrarios, y una clase de la paleta desactivada **no genera CSS en silencio**: solo la detecta `lint:tokens` (NO VERIFICADO).
  - Soporte por navegador, a confirmar en MDN o caniuse:
    - `light-dark()`: Chrome 123, Firefox 120 y Safari 17.5;
    - `prefers-reduced-transparency`: solo Chromium (Firefox tras un _flag_, Safari no), así que el ajuste propio es el mecanismo universal;
    - `prefers-contrast` y `forced-colors`: soportados en los tres (`forced-colors` solo tiene efecto real en Windows).

## R07 ESLint 10 + typescript-eslint + eslint-plugin-svelte

- **Decisión**:
  - `eslint.config.js` _flat_: `@eslint/js` recommended, `tseslint.configs.strictTypeChecked` con `parserOptions.projectService`, `svelte.configs.recommended` con el parser de TS en `.svelte`, `eslint-config-prettier` al final y `globals`.
  - **`svelte/no-navigation-without-resolve` existe** (desde 3.12.0, incluida en `recommended`; la versión fijada es 3.23.1, compatible con ESLint 10 desde 3.15.0). Cubre `<a href>`, `goto`, `pushState` y `replaceState`, **no `redirect()`**: para `redirect` se añade `no-restricted-syntax` sobre `CallExpression[callee.name='redirect'] > Literal`.
  - Pureza del dominio: bloques `files` por carpeta con `no-restricted-imports` (patrones `$app/*`, `$env/*`, `drizzle-orm*`, `node:*`, `$lib/server/features/*`…), `no-restricted-globals` (`fetch`, `process`) y `no-restricted-syntax` (`NewExpression[callee.name='Date']`, `Date.now()`).
  - **Ojo**: en _flat config_ un bloque posterior **sustituye** las opciones de la misma regla, no las fusiona. Las listas se componen a partir de constantes compartidas (base + específicas).
  - `@typescript-eslint/consistent-type-assertions: ['error', { assertionStyle: 'never' }]` (`as const` sigue permitido), con excepción en `src/lib/shared/**`; `no-non-null-assertion` ya está en `strict`.
  - `--concurrency auto` (multihilo, desde ESLint 9.34).
  - Sin `--cache`: la caché por fichero no invalida cuando un cambio de tipos en otro fichero altera el resultado del lint con tipos, además del fallo con configuraciones que contienen funciones que registra `Historias.md` 15.26.
  - `scripts/lint-changed.mjs`: `git diff --name-only --diff-filter=ACMR HEAD` + `git ls-files --others --exclude-standard`, filtrado por extensión, con `eslint --max-warnings 0 --no-warn-ignored --concurrency auto`. Si falla por bloqueo, reintenta con `--concurrency off`. Si cambian `eslint.config.js` o un `tsconfig*`, lint completo.
- **Justificación**: changelog de eslint-plugin-svelte (3.12.0, 3.14.0 `rel=external`, 3.15.0 ESLint 10); constitución, «Verificación de esta sección»; `Historias.md` 15.25 y 15.26.
- **Alternativas consideradas**: `eslint-plugin-boundaries` o dependency-cruiser (pospuesto, ARCHITECTURE §14).
- **Pendiente de comprobar en L01**:
  - Si la regla acepta ``resolve(`/x?${params}`)`` sin falsos positivos y cómo trata `href` dinámicos.
  - El consumo de memoria de `--concurrency auto` con `projectService` (cada hilo crea su programa).
  - `--no-warn-ignored` es necesario para que `--max-warnings 0` no falle con ficheros ignorados (NO VERIFICADO en 10.12).

## R08 Vitest 5

- **Decisión**:
  - `vite.config.ts` con `test.testTimeout: 30_000` y `test.projects` en línea (heredan la raíz):
    - `unit`: Node, `src/**/*.test.ts` + `tests/architecture/**`;
    - `component`: `environment: 'jsdom'`, `*.svelte.test.ts`, plugin `svelteTesting()` de `@testing-library/svelte/vite` (condición `browser` y limpieza automática);
    - `integration`: Node, `**/*.int.test.ts`, una BD temporal por fichero;
    - `http`: Node, `tests/http/**`, `globalSetup` que arranca `node build` con un conjunto mínimo de variables (sin `.env`), y un único _worker_.
  - Cobertura v8 con `include: ['src/lib/**']`:
    - umbral global de 80 en las cuatro métricas;
    - por glob: `'src/lib/server/features/*/domain/**'`, `'src/lib/shared/**'` y `'src/lib/server/shared/**'` a 100 (los globs **no heredan** el umbral global ni `perFile`).
    - `test:coverage` se limita a los tres proyectos sin `http`.
  - Svelte 5: `render(Componente, { props })`; las _runes_ funcionan en `.svelte.test.ts`.
  - Propiedades: `@fast-check/vitest` (`test.prop([fc.integer()])(…)`), con `fc.configureGlobal({ seed, numRuns })` en el _setup_ del proyecto `unit` para que sea determinista. Otra semilla en la ejecución nocturna.
  - `vitest related <ficheros> --run` para el nivel 1.
  - Test de arquitectura:
    - API de `typescript`: `parseJsonConfigFileContent` del `tsconfig.json` (requiere `svelte-kit sync`), `preProcessFile` y `resolveModuleName` para los alias `$lib`;
    - en `.svelte`, `parse` de `svelte/compiler` (`modern: true`) para extraer los `<script>`;
    - los especificadores `.svelte` y `$app/*`/`$env/*` se resuelven o clasifican a mano;
    - se construye el grafo de funcionalidades y se comprueban orden, ciclos y fronteras.
- **Justificación**: docs de Vitest v5.0.3 (proyectos en línea, umbrales por glob que no heredan, guía de migración: `clearMocks` activo por defecto, Vite ≥ 6.4, Node ≥ 22.12, `workspace` sustituido por `projects`); `Historias.md` 15.24 y 15.25; ARCHITECTURE §13 (resolver con el compilador, no con regex).
- **Alternativas consideradas**: Vitest Browser Mode (excluido en 15.3); expresiones regulares para los imports (frágiles con los alias).
- **Pendiente de comprobar en L01**:
  - Si un fichero que coincide con un glob de umbral también cuenta en el global.
  - El nombre exacto de la opción de _workers_ por proyecto en Vitest 5 (`maxWorkers`/`fileParallelism`).
  - Compatibilidad de `@testing-library/svelte` 5.4.2 con Vitest 5 y Svelte 5.57.
  - Que `resolveModuleName` no resuelve `.svelte` (se trata a mano).

<!-- Parte 2 de research.md (R09–R16). Se une a la parte 1 (R01–R08) en un único research.md. -->

Esta es la **parte 2 (R09–R16)** de `research.md` de la Fase 0 de `/speckit-plan` para
`001-cuenta-mardomingo-v4`. Resuelve **cómo** implementar, con las versiones fijadas en la
constitución, las decisiones de arquitectura ya tomadas (ADR 0001–0007), sin reabrirlas. Las
afirmaciones se verificaron el 2026-10-10 con documentación oficial (Playwright, protocolo de
Chrome DevTools, pino, OpenRouter, Mistral, Resend, Cloudflare, BCE, GitHub, croner, Litestream,
Coolify y adapter-node), con context7 y con consultas reales a las API públicas del BCE y de
GitHub. Lo que no se pudo confirmar se marca **NO VERIFICADO — comprobar en L01** (o en el lote
que corresponda).

## R09 Playwright 1.64 y verificación de UX

- **Decisión**:
  - **Preferencias del sistema**: `page.emulateMedia({ colorScheme, reducedMotion, forcedColors, contrast })`.
    `contrast` admite `'more' | 'no-preference'`.
  - **`prefers-reduced-transparency`** (solo Chromium): una sesión CDP
    (`context.newCDPSession(page)`) envía
    `Emulation.setEmulatedMedia({ features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] })`
    **después** de cualquier `emulateMedia`, porque este reescribe la lista de características. Se
    comprueba con `matchMedia(...).matches`. Si da `false`, la comprobación se marca «no verificable
    en este entorno»; en Firefox y WebKit siempre se marca así.
  - **Sin JavaScript**: un proyecto o `test.use({ javaScriptEnabled: false })`.
  - **axe** (`@axe-core/playwright` 4.13.0, con `axe-core ~4.13.0`):
    - criterio de fallo: cero violaciones `serious` o `critical`;
    - las superficies de cristal llevan un marcador (`data-surface="glass"`);
    - cualquier resultado de `color-contrast` dentro de una superficie de cristal (`incomplete`,
      pero también `pass`, porque axe no tiene en cuenta `backdrop-filter`) se anota como
      **pendiente DS-09** y se mide a mano.
  - **Web Vitals de laboratorio sin dependencias nuevas**:
    - un `addInitScript` registra `PerformanceObserver` con `buffered: true` para
      `largest-contentful-paint`, `layout-shift` (CLS por ventanas de sesión) y `event`
      (`durationThreshold: 16`; INP ≈ la interacción más lenta por `interactionId` en la secuencia
      guionizada);
    - la limitación se aplica por CDP: `Emulation.setCPUThrottlingRate({ rate: 4 })` y
      `Network.emulateNetworkConditions` con el perfil móvil de Lighthouse (150 ms, ~1,6 Mbps de
      bajada, 750 kbps de subida; está obsoleto en CDP pero sigue disponible);
    - se mide solo en Chromium y se compara la versión con cristal con la de efectos reducidos.
  - **Capturas**: solo en `mcr.microsoft.com/playwright:v1.64.0-noble` (con `--init --ipc=host`),
    en el CI nocturno o con `docker run` en local.
  - **Dos hosts**: un único `webServer` (`command: 'node build'`, `env` explícito, `url` hacia
    `http://127.0.0.1:<puerto>/api/v1/health`):
    - web: `http://localhost:<puerto>`;
    - API: `http://127.0.0.1:<puerto>`.
- **Justificación**: la API de Playwright documenta `contrast` desde la 1.51, `forcedColors` desde
  la 1.15 y `reducedMotion` desde la 1.12. El protocolo de DevTools define
  `setEmulatedMedia(features: MediaFeature{name, value}[])` y `setCPUThrottlingRate`. Chrome admite
  `prefers-reduced-transparency` desde la versión 118. Lighthouse documenta 150 ms de RTT y
  4× de CPU.
- **Alternativas consideradas**:
  - **Lighthouse**: se descarta. Es una dependencia nueva y pesada, lanza su propio Chrome y en
    modo navegación no mide INP (usa TBT).
  - **`web-vitals`**: se descarta. Sería una dependencia nueva para algo que cubren unas pocas
    líneas con `PerformanceObserver`.
- **Pendiente de comprobar en L01**:
  - que `matchMedia('(prefers-reduced-transparency: reduce)')` responde a la CDP en el Chromium
    de la 1.64;
  - `forcedColors` en Firefox y WebKit: **NO VERIFICADO**;
  - que `localhost` llega al servidor cuando `HOST=0.0.0.0` (resolución a `::1` en Windows y en
    Node 24): si no, usar `HOST=::`;
  - si `webServer.command` usa un shell en Windows (no afecta a `node build`, pero no se ha
    confirmado).

## R10 pino 10 y salida de logs de la v4

- **Decisión**:
  - **Salida**: JSON por stdout en todos los entornos; Docker conserva esa copia con rotación.
  - **Desarrollo**:
    - `pino-pretty` dentro de un módulo _target_ propio (las funciones no pueden cruzar al
      _worker_);
    - `customPrettifiers.time` con `Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid' })`;
    - además, `pino/file` hacia `.logs/app.log`.
  - **`redact`**: `{ paths: [...], remove: true }` sobre `req.headers.authorization`,
    `req.headers.cookie`, `*.password`, `*.token`, `*.email`, `*.idempotencyKey`, `*.ip`…
  - **Serializador `err` propio**: `{ type, code, stack? }`. El `stack` solo se incluye si el error
    es una subclase de nuestro error tipado; el `message` de bibliotecas y proveedores **nunca**
    se registra.
  - **Navegador**: `loglevel` con `setLevel(nivel, false)`, para que el nivel **no** se guarde en
    `localStorage` ni en una cookie. `window.onerror` y `unhandledrejection` envían a
    `/client-errors` (esquema de XI).
  - **Transport al Log Gateway: APLAZADO** a una fase posterior (enmienda 2.2.0; D-06). En la v4 no hay envío remoto. Diseño aplazado: transport en worker, búfer acotado, descarte con `log.gateway.dropped`, clave de solo escritura.
- **Justificación**:
  - `pino.transport` crea un _worker_ (`thread-stream`) y vacía en `beforeExit` y `exit`.
  - `redact.remove` está documentado (pino 10.4.0 depende de `@pinojs/redact` y de `pino-abstract-transport ^3`, que llega así como dependencia indirecta y no se declara en la v4).
  - `loglevel` 1.9.2 persiste el nivel salvo que se pase `persist=false`.
- **Alternativas consideradas para el envío aplazado**:
  - **Envío en el hilo principal**: lo prohíbe XI.
  - **`pino-socket` o `pino-http-send`**: dependencias nuevas sin control del descarte.
  - **Un `Writable` propio sin `pino-abstract-transport`**: posible, pero reimplementa el troceado
    de líneas y el cierre.
- **Pendiente de comprobar en la fase posterior**:
  - cómo localizar el fichero del _transport_ tras `vite build`: un `.mjs` sin compilar resuelto
    con `new URL(..., import.meta.url)`, o una copia a `build/`. **NO VERIFICADO**;
  - **contrato del Log Gateway** (lo entrega el propietario al activar la fase posterior):
    - URL de ingesta;
    - autenticación (cabecera y formato de la clave);
    - formato del lote (NDJSON o array JSON, campo `service` o `env` en la URL o en el cuerpo);
    - tamaño máximo del lote y de cada evento;
    - códigos de respuesta (¿`207`? ¿`429` con `Retry-After`?);
    - compresión, idempotencia y límite de frecuencia.

## R11 Proveedores de IA

- **Decisión**:
  - **Chat**: `POST https://openrouter.ai/api/v1/chat/completions`, sin _streaming_, con
    `provider: { data_collection: "deny", allow_fallbacks: true, order?, require_parameters? }`,
    `max_tokens`, `temperature`, `response_format: { type: "json_schema", json_schema }` y
    `tools`/`tool_choice`, más las cabeceras `HTTP-Referer` y `X-Title`.
  - **Coste**:
    - se toma de `usage.cost` de la respuesta (D-09; `usage: { include: true }` ya no tiene efecto y
      no se envía);
    - si falta, `GET /api/v1/generation?id=` (`data.total_cost` en USD);
    - si tampoco está, se estima con `/models`.
  - **Errores**: hay que tratar el **200 con `error` en el cuerpo**. `error.metadata.flagged_input`
    (moderación) contiene texto del usuario: se descarta y solo se conserva la marca.
  - **Modelos**: `GET /api/v1/models?output_modalities=all`, porque por defecto solo devuelve los
    de salida de texto. Los precios vienen en USD por token, como texto, y se convierten a enteros
    con cuidado. Las capacidades salen de `architecture.input_modalities` y `supported_parameters`.
  - **Saldo (D-04)**: `GET /api/v1/credits` **exige una clave de gestión** (con otra clave responde
    403). Se usa la variable secreta `OPENROUTER_MANAGEMENT_KEY`, solo para esta consulta horaria
    (BE-FR-56). Si falta (p. ej. en staging), la alerta de saldo queda desactivada y se registra
    `ai.provider_balance.check_disabled` al arrancar.
  - **Cancelación**: el `AbortSignal` de la petición se combina con `AbortSignal.timeout` mediante
    `AbortSignal.any`. Sin _streaming_, OpenRouter **factura la respuesta completa** aunque se
    aborte (D-05): la operación queda `cancelled` sin cobro al usuario; cuando se conoce el coste
    del proveedor (en la respuesta o con la consulta posterior de la generación), se guarda en
    `ai_operations.cost_micro_usd` y cuenta en estadísticas como **pérdida por cancelación**
    (BE-FR-37, BE-FR-54); se registra `ai.cancellation_cost.recorded`.
  - **Voxtral**: `POST https://api.mistral.ai/v1/audio/transcriptions` en _multipart_
    (`model=voxtral-mini-latest`, `file`). De la respuesta se usan `text` y
    `usage.prompt_audio_seconds`.
  - **ffprobe**:
    - se invoca con `execFile('ffprobe', [...], { timeout, killSignal: 'SIGKILL', signal, maxBuffer })`,
      sin shell;
    - el audio se guarda en un directorio de `fs.mkdtemp`, con modo `0o600`, y se borra en un
      `finally` con `rm({ recursive: true, force: true })`;
    - primero se lee `format=duration`; si devuelve `N/A` (WebM de `MediaRecorder`), se leen
      `packet=pts_time,duration_time` del flujo de audio y se calcula el máximo.
  - **Audio del respaldo por OpenRouter (D-08)**: OpenRouter no documenta WebM en `input_audio`
    (`wav`, `mp3`, `ogg`, `flac`, `m4a`…). Antes de enviarlo, el audio se convierte con ffmpeg (ya en
    la imagen) a mp3 o wav, con `execFile` sin shell y en el mismo directorio temporal; los
    temporales se borran en el `finally`.
- **Justificación**: documentación de OpenRouter (contabilidad de uso, `get-a-generation`,
  `get-credits`, `get-models`, enrutado de proveedores, _streaming_ y errores) y referencia de la
  API de Mistral (`/v1/audio/transcriptions`).
- **Alternativas consideradas**:
  - **_Streaming_ interno**: obtiene el `id` antes y permite cancelar en algunos proveedores, pero
    exige analizar SSE. Se pospone.
  - **`GET /api/v1/key`** (`limit_remaining`) en lugar de `/credits`: no necesita clave de gestión,
    pero solo mide el tope de esa clave. Descartada (D-04).
- **Pendiente de comprobar en L07 y L08**:
  - el comando exacto de ffmpeg para la conversión (mp3 o wav) y su duración con un audio de 5 min;
  - el tamaño máximo y la duración de Voxtral, y la forma de sus errores 401/402/429 de
    facturación: **NO VERIFICADO**;
  - el comando exacto de ffprobe con un fixture real de `MediaRecorder`.

## R12 Resend 6 y Turnstile

- **Decisión**:
  - **Envío**: `resend.emails.send({ from: EMAIL_FROM, to, subject, text, html, replyTo: support_email, tags }, { idempotencyKey })`.
    El SDK **no lanza excepciones**: devuelve `{ data, error }`, con
    `error: { name, statusCode, message }`.
    - Se registra solo `errorCode = error.name`, sin `message`.
    - `429` (`rate_limit_exceeded`, `daily_quota_exceeded`) → `warn`, sin reintentos infinitos.
    - `validation_error` → `error`.
  - **Plantillas**: funciones puras que devuelven `{ subject, text, html }` con
    `m.clave(params, { locale: 'es' })` de Paraglide.
    - El HTML lleva estilos en línea, `<meta name="color-scheme" content="light dark">`,
      `supported-color-schemes` y un bloque `@media (prefers-color-scheme: dark)`.
    - El diseño debe aguantar la inversión forzada: el logotipo es texto o lleva fondo propio, sin
      PNG transparentes con texto oscuro.
    - Siempre lleva parte de texto.
  - **Dominio**: SPF, DKIM y DMARC con los registros que da Resend.
  - **Turnstile (D-02)**, solo en el registro:
    - se verifica en `accounts` con el adaptador `CaptchaVerifier` (real y `fake.ts`); el plugin
      `captcha` de Better Auth no se usa porque no actúa con `auth.api` (R02);
    - la action de registro lee el campo `cf-turnstile-response` del formulario y la IP de
      `getClientAddress()`;
    - el verificador real llama a `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`
      (`secret`, `response`, `remoteip`, `idempotency_key`). El token dura 300 s, es de un solo uso
      y mide 2.048 caracteres como máximo.
  - **Modo falso (`APP_ENV=test`)**: el widget no se carga; en unit e integración se usa `fake.ts` y
    en los tests HTTP y E2E el verificador real apunta al simulador local (URL base que solo acepta
    `APP_ENV=test`), que decide el resultado según el token (válido, inválido o servicio caído).
    Staging usa las claves de prueba (`1x00000000000000000000AA` /
    `1x0000000000000000000000000000000AA`), y el esquema las rechaza en producción.
- **Justificación**: referencia de la API de Resend (envío, errores y límite de 10 peticiones por
  segundo por equipo), documentación de `resend-node` (`idempotencyKey`, `ErrorResponse`),
  validación en servidor y pruebas de Cloudflare, y aviso de Better Auth de que `auth.api` no pasa
  por los plugins de `onRequest` ni por `rateLimit`.
- **Alternativas consideradas**:
  - **react-email o MJML**: dependencias nuevas.
  - **Plugin `captcha` de Better Auth**: descartado; con `auth.api` desde las actions no actúa.
- **Pendiente de comprobar en L03 y L14**:
  - cómo se ven los emails en Gmail, Outlook y Apple Mail en modo oscuro: **NO VERIFICADO**
    (prueba manual);
  - que Paraglide 2.27 acepta `{ locale }` por llamada.

## R13 BCE y GitHub

- **Decisión**:
  - **BCE**: `GET https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=csvdata&detail=dataonly&lastNObservations=1`.
    - Respuesta: `text/csv` con la cabecera
      `KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE`.
    - `OBS_VALUE` son los USD por 1 EUR, con 4 decimales (p. ej. `2026-10-09,1.1206`).
    - El CSV se valida con Zod y el decimal se convierte a ppm sin `float`, con un analizador de
      decimales en texto.
    - Se guarda el `TIME_PERIOD` como fecha efectiva.
  - **Días sin publicación** (fines de semana y festivos de TARGET): si se consulta un rango sin
    datos, el BCE responde **200 con el cuerpo vacío**. Con `lastNObservations=1` se recibe el
    último día hábil. Ese día no se considera «fallo».
    - `fx_stale_alert_days` cuenta los fallos reales (error HTTP, CSV inválido) y, como
      salvaguarda, también si el `TIME_PERIOD` es más antiguo de lo esperable.
    - La tarea corre después de la publicación (en torno a las 16:00 CET).
  - **GitHub (D-21)**: el repositorio de descargas de Secretario es **público** (lo exige la descarga
    del instalador por los usuarios), así que la consulta diaria se hace **sin token** (60 peticiones
    por hora y por IP bastan). `GET https://api.github.com/repos/{owner}/{repo}/releases` (paginado),
    con `Accept: application/vnd.github+json` y `X-GitHub-Api-Version`. El total diario es la suma de
    `assets[].download_count` de los instaladores; se guarda el acumulado y se calcula el
    incremento por día.
- **Justificación**:
  - Consultas reales a la API del BCE el 2026-10-10: CSV, `Last-Modified`, y 200 con 0 bytes para
    el sábado y el domingo.
  - El título de la serie indica «ECB reference exchange rate, US dollar/Euro, 2.15 pm (C.E.T.)».
  - GitHub responde `X-RateLimit-Limit: 60` sin token (por IP y hora); `download_count` es un
    campo de cada asset.
- **Alternativas consideradas**:
  - **XML de `eurofxref-daily.xml`**: otro formato; la decisión 15.27 ya eligió SDMX en CSV.
  - **`/releases/latest`**: pierde las descargas de versiones anteriores.
- **Pendiente de comprobar en L06 y L14**:
  - el valor vigente de `X-GitHub-Api-Version` (la documentación muestra `2026-03-10`);
  - el límite de frecuencia del BCE: **NO VERIFICADO**.

## R14 croner 10

- **Decisión**:
  - **Registro de tareas**: `jobs/` registra cada tarea con
    `new Cron(patrón, { name, timezone: 'Europe/Madrid', protect: alSolapar, catch: último recurso, unref: false }, envoltorio)`.
  - **Envoltorio**: mide la duración, registra el resultado una sola vez
    (`<f>.job.completed` o `<f>.job.failed`) y nunca relanza.
  - **`protect`**: evita que una ejecución empiece mientras sigue la anterior de la misma tarea, y
    su _callback_ registra `debug`.
  - **Horas**: ninguna tarea diaria entre las **02:00 y las 03:00** locales.
    - croner **omite** las ejecuciones que caen en el hueco del cambio de hora de marzo y ejecuta
      **una sola vez** las del solapamiento de octubre.
    - Las tareas se escalonan (04:00, 04:10, 04:20…) para no competir por el bloqueo de escritura
      de SQLite. Cada una trabaja en transacciones cortas, porque `better-sqlite3` bloquea el bucle
      de eventos.
    - BCE a las 16:30 y saldo de OpenRouter cada hora (`0 * * * *`).
  - **Reinicio**: croner no guarda estado, así que las ejecuciones perdidas mientras el proceso
    estaba parado no se recuperan.
    - Cada tarea es **idempotente** por su clave de día (`CivilDate`).
    - Las que deben ponerse al día (BCE, caducidad, limpieza de reservas) se lanzan también al
      arrancar con `job.trigger()`, después de las migraciones.
    - Al parar se llama a `stop()` en `sveltekit:shutdown`.
  - **Tests**:
    - la lógica de cada tarea es un servicio que recibe el `Clock` (falso) y se prueba sin croner;
    - la planificación se prueba de forma pura con
      `new Cron(p, { timezone: 'Europe/Madrid', paused: true }).nextRuns(n, desde)` alrededor del
      **2026-10-25** y del **2027-03-28**;
    - el envoltorio, con `trigger()`.
- **Justificación**: README y tipos de croner 10.0.1 (opciones `timezone`, `protect`, `catch`,
  `unref` y `paused`; métodos `nextRuns`, `trigger` e `isBusy`; «Jobs scheduled during DST gaps
  are skipped; jobs in DST overlaps run once at first occurrence»).
- **Alternativas consideradas**:
  - **`setInterval` propio**: sin zona horaria ni cambios de hora.
  - **Una tabla `job_runs` para recuperar ejecuciones perdidas**: se añade solo si una tarea no
    puede deducir su estado de sus propios datos.
- **Pendiente de comprobar en L14**:
  - el comportamiento con `vi.useFakeTimers()` y `vi.setSystemTime()` (croner fragmenta los
    _timeouts_ largos): **NO VERIFICADO**; por eso la planificación se prueba con `nextRuns`;
  - que `domAndDow` sustituye a `legacyMode` en la 10.0.1 (sin efecto si no se combinan día del
    mes y día de la semana).

## R15 Despliegue

- **Decisión**:
  - **Dockerfile multietapa**:
    - etapa de construcción: `node:24.21.0-trixie-slim`, `pnpm@12.8.1`,
      `pnpm install --frozen-lockfile`, `vite build` y `pnpm prune --prod`;
    - etapa final: `node:24.21.0-trixie-slim`, con
      `apt-get install --no-install-recommends ffmpeg ca-certificates` (trixie trae
      **ffmpeg 7.1.5-0+deb13u1**; ffprobe va en ese paquete) y el `.deb` oficial
      `litestream-0.5.17-linux-x86_64.deb`, con su suma de comprobación de `checksums.txt`;
    - `USER node`;
    - `/data` creado con `chown node:node` antes de declararlo como volumen.
  - **Litestream en el mismo contenedor** como supervisor. El _entrypoint_ hace:
    1. `litestream restore -if-db-not-exists -if-replica-exists -config /etc/litestream.yml "$DATABASE_PATH"`;
    2. `exec litestream replicate -exec "node build" -config /etc/litestream.yml`.
  - **Configuración de Litestream** (formato 0.5):
    - `replica:` única, `type: s3`, con `endpoint` de B2 EU Central (detecta B2 y ajusta
      `force-path-style` y `sign-payload`);
    - credenciales con `${VAR}`;
    - **`snapshot.retention: 720h`** (30 días; el valor por defecto es 24 h). Como alternativa,
      `retention.enabled: false` más una regla de ciclo de vida de 30 días en B2.
  - **Healthcheck**: un `HEALTHCHECK` en el Dockerfile, que Coolify detecta, con
    `node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"`
    (sin curl).
  - **Parada previa**: publicar el puerto en el host (`7311:7311`, que necesita NPM) ya hace que
    Coolify **pare el contenedor anterior antes de arrancar el nuevo**. Además se elige
    «Consistent name (no rolling updates)» para dejarlo explícito.
  - **Migraciones**: en `init`, si hay migraciones pendientes, se copia la BD con
    `db.backup('/data/pre-migrate/<versión>.db')` (se conservan las 3 últimas) y después se migra.
  - **Staging**: otra aplicación de Coolify en el mismo servidor, puerto 7312, con su propio
    volumen, bucket y clave de B2.
- **Justificación**: referencia de Litestream (configuración 0.5, `restore`, guías de Backblaze y
  Docker: «Litestream will monitor your application's process»), guías de Coolify (_rolling
  updates_ y _health checks_), adapter-node (SIGTERM, `SHUTDOWN_TIMEOUT` y `sveltekit:shutdown`)
  y la página del paquete en Debian.
- **Alternativas consideradas**:
  - **Litestream como contenedor aparte (Compose)**: no se puede ordenar la restauración antes del
    arranque, hay dos procesos sobre el mismo volumen y Compose cambia el modelo de despliegue de
    Coolify.
  - **s6-overlay**: innecesario con un único proceso hijo.
- **Pendiente de comprobar en L01** (y en el simulacro de L16):
  - si Litestream reenvía SIGTERM al hijo y espera a que termine antes de la última
    sincronización: **NO VERIFICADO**. Si no lo hace, se añade `--init` o `tini`;
  - que la retención de 720 h permite restaurar a un punto de 30 días atrás: **NO VERIFICADO**;
  - la propiedad del volumen de Coolify para `node`;
  - los scripts de compilación de `better-sqlite3` permitidos en pnpm 12.

## R16 Infraestructura de tests

- **Decisión**:
  - **Suite `http`**:
    - el `globalSetup` del proyecto `http` comprueba que existe `build/` (si no, ejecuta
      `spawn(process.execPath, [viteBin, 'build'])`);
    - obtiene un puerto libre con `net.createServer().listen(0)`;
    - arranca los simuladores y después
      `spawn(process.execPath, ['build/index.js'], { env: mínimo, stdio: 'pipe' })`, **sin shell**
      (válido en Windows);
    - espera a que `/api/v1/health` responda y pasa las URL con `provide`/`inject`;
    - en el _teardown_, `child.kill()` y cierre de los simuladores;
    - el proyecto se ejecuta con un solo _worker_ (`fileParallelism: false`).
  - **Simuladores**: `node:http` en `tests/mock-servers/<proveedor>.ts` (OpenRouter, Mistral,
    Resend, BCE, Turnstile y GitHub).
    - Cada uno escucha en el puerto 0, reproduce el formato real (p. ej. el CSV del BCE, el 200
      con `error`) y admite escenarios mediante una ruta de control `/__scenario` y una latencia
      configurable.
    - Las URL base llegan como variables que solo acepta `APP_ENV=test`.
    - En Playwright, un `webServer` en array arranca primero los simuladores (puertos fijos en
      7380–7389) y después la app.
  - **Outbox**: la implementación de prueba de `EmailSender` escribe
    `.outbox/<epochMs>-<uuid>.json` (`to`, `subject`, `text`, `html`). Los tests filtran por su
    destinatario único.
  - **BD plantilla**: el `globalSetup` del proyecto `integration` aplica las migraciones de
    Drizzle (`migrate`) a `template.db`, con `wal_checkpoint(TRUNCATE)`. Cada fichero de test hace
    `copyFileSync` a su propio directorio temporal, con los mismos pragmas que producción.
  - **`RequestEvent`**: una fábrica tipada `makeRequestEvent<P, R>()` que construye el objeto
    **completo** con `satisfies RequestEvent<P, R>`, `Cookies` en memoria y `locals` tipados. Si
    SvelteKit añade un miembro, la compilación falla, que es la señal que se busca. Sin `as`.
- **Justificación**: la constitución («Configuración»: `globalSetup` sin sintaxis de shell) y
  `Historias.md` 15.22, 15.23 y 15.25; documentación de Playwright (`webServer` en array, `env`,
  `url`).
- **Alternativas consideradas**:
  - **`msw` o `nock`**: dependencias nuevas que no interceptan el proceso del build.
  - **BD en memoria con `serialize()` y `new Database(buffer)`**: más rápida, pero sin WAL. Se
    usa solo si la medición lo justifica.
  - **`vite preview`**: no es el servidor de producción.
- **Pendiente de comprobar en L01**:
  - que el `webServer` de Playwright arranca antes que el `globalSetup` (por eso los simuladores
    van en un `webServer`): **NO VERIFICADO**;
  - el nombre de las opciones de Vitest 5 (`fileParallelism`, `maxWorkers`, `provide`);
  - la lista exacta de miembros de `RequestEvent` en SvelteKit 2.70.3.
