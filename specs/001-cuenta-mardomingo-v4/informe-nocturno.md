# Informe nocturno de implementación

**Funcionalidad**: `001-cuenta-mardomingo-v4` · **Rama**: `001-cuenta-mardomingo-v4` (solo commits locales; sin push, sin `main`).

## Autorización y criterios de la noche

- **Alcance**: lo máximo posible, lote a lote, en el orden de `tasks.md`: resto de L01 → fase 16 (convergencia) → L02 → L03 → …
- **Commits**: uno en español por grupo de tareas, en la rama de trabajo. Sin push y sin tocar `main`.
- **Docker**: el daemon se arranca manualmente; si cae, las tareas de imagen quedan como no verificadas.
- **Decisiones que el spec no fija**: se elige la opción más conservadora, sin cambiar la constitución ni los requisitos, y queda anotada aquí.
- **Lo que no se hace**: despliegues, Coolify, Litestream en servidor, DNS, release de Secretario, ejecución remota de GitHub Actions (T060) y cualquier llamada a un proveedor real sin credenciales.
- **Verificación**: `check`, `lint` y tests se encadenan. Lo que no se ejecute se marca como «no verificado».

## Bloqueos conocidos (registrados de antemano)

| Tarea                                                                            | Motivo                                                        | Tratamiento                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| T001                                                                             | Contrato del Log Gateway, aplazado (enmienda 2.2.0)           | No se hace                                                                             |
| T060                                                                             | Ejecución remota de CI requiere autorización expresa          | Solo se escribe el workflow; no se ejecuta en GitHub                                   |
| T079, T092                                                                       | Valores del seed y textos legales los da el propietario       | Se implementa el mecanismo; el contenido queda marcado como provisional y sin publicar |
| T274, T367, T368                                                                 | Pruebas de carga, capturas visuales y _mutation_ base         | Capturas solo en el contenedor oficial de Playwright (CLAUDE.md); lo demás se anota    |
| T372–T375                                                                        | Restauración, verificación de staging, smoke remoto y release | No se hace: requieren servidor y despliegue                                            |
| Proveedores reales (Turnstile, Resend, OpenRouter, Mistral, BCE, GitHub, Stripe) | Sin credenciales                                              | Adaptadores reales con HTTP real, probados con simuladores; sin contacto real          |

## Progreso por grupo

_(Se actualiza al cerrar cada grupo.)_

| Grupo                                           | Tareas                                               | Estado                                                                             | Commit                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Resto de L01                                    | T049–T066                                            | Hecho (T001, T005, T038, T044, T055, T060 quedan con motivo, ver arriba)           | `ad2265d`, `4d49a2a`, `e0a1e4f`, `799042e`, `1db151f`, `15bc157`, `c90ae26`, `5a630e4` |
| Fase 16 (convergencia)                          | T381–T392                                            | Hecho; T390 se cierra en L02 (global-setup migra con `migrateDatabase`)            | `c887cb0`, `e0ad9da`, `ea1bf3a`                                                        |
| L02, fechas y columnas                          | T067, T068                                           | Hecho (incluye la corrección de tipos del punto siguiente)                         | `bac8df6` y el commit de corrección                                                    |
| L02, esquemas, migraciones, servicios y pruebas | T069–T083, T390                                      | Hecho; verificado con las comprobaciones del checkpoint (ver abajo)                | `0482722`, `0734ecd`                                                                   |
| L02, datos del propietario                      | T079                                                 | **Hecho el 2026-10-11**: valores aprobados (ver `data-model.md` 3.0)               | —                                                                                      |
| L02, checkpoint                                 | T084                                                 | Hecho salvo `pnpm validate` completo (E2E completo no ejecutado)                   | `53732c6`                                                                              |
| L03, backend de cuentas, adaptadores y legales  | T085–T099                                            | Hecho (ver «Lote L03» abajo)                                                       | `98d44e4`                                                                              |
| L03, páginas, sesión web, CSP y pruebas web     | T100–T107, T110, T111                                | Hecho en su mayoría; E2E de cuentas (8 + 3 de 320 px), HTTP (7) y componentes (14) | `b62e6b3`, `e3cdee8`, `35dd866`, `208a4ec`, y el commit de 320 px y revocación         |
| L03, pendientes                                 | T092, T095, T098, T100, T108, T109, T112, T113, T114 | **Abiertos o parciales** (ver «Lote L03»)                                          | —                                                                                      |

**Nota de honestidad**: el commit `bac8df6` (fechas y columnas) se hizo sin ejecutar `pnpm check`. `svelte-check` encontró 13 errores de tipos que no había visto. Se corrigen en un commit posterior; no se reescribe la historia.

## Lote L03 (en curso): registro, verificación, login y recuperación

**Estado**: el backend y las páginas de L03 están hechos y probados; **el lote no está cerrado**. El checkpoint (T114)
no se ha ejecutado completo.

### Hecho y verificado

- **Backend**: normalización del email y su hash HMAC (TDD), validación de `redirectTo` y de formularios, repositorio de
  contadores, intentos fallidos y dominios desechables, servicio de cuentas (registro con su antiabuso en el orden de la
  especificación, verificación, reenvío, login con bloqueo, recuperación, cierre y promoción por `ADMIN_EMAIL`).
- **Better Auth 1.7.7** (`auth.ts`): probado con SQLite real. Sin `svelteKitHandler`, sin plugin `captcha` ni `rateLimit`,
  transacciones desactivadas. Las columnas de tiempo que gestiona en `timestamp_ms` (mismo DDL).
- **Adaptadores**: Turnstile (siteverify validado y con tiempo límite), Resend con el SDK y clave de idempotencia, outbox
  en `APP_ENV=test`, memoria y simuladores de R12.
- **Notificaciones y legal**: plantillas de los tres emails con texto plano y escapado; versiones legales con comprobación
  de versión vigente; seed provisional.
- **Rutas**: W08, W09, W10, W11, W12, W13, W15, W19 y el panel con su guard. Paso de sesión en `hooks.server.ts`. CSP de
  Turnstile solo en `/registro`.
- **Pruebas**: unitarias, de componentes e integración suman 358 (ver la verificación); HTTP de la web (7); E2E en Chromium
  (47 en total, con las de cuentas, la página sin JavaScript, 320 px, el flujo crítico 1 y la accesibilidad).

### Decisiones tomadas esta noche (confirmadas por el propietario el 2026-10-11)

1. **Eslint**: `fetch` queda permitido solo en `src/lib/server/adapters/**` (la regla decía «usa un adaptador»).
2. **`timestamp_ms` en las tablas de Better Auth**: Better Auth escribe `Date`; drizzle convierte en la frontera.
3. **Verificación «ya usada»**: Better Auth responde igual la primera vez y la repetida (`user: null`), así que el servicio
   decide con el estado de la cuenta leído antes de llamar (el token se valida igual).
4. **Registro de un email ya existente**: Better Auth devuelve un usuario sintético (anti-enumeración). El servicio lo
   detecta porque ese id no está en la base de datos y responde lo mismo, sin email ni escrituras.
5. **Remitente y reply-to**: `EMAIL_FROM` ya existía (constitución); el soporte se lee de `settings` al enviar.
6. **Email de soporte en la auditoría**: redactado (`[redactado]`), igual que en L02.
7. **Eventos**: el catálogo de `accounts` está completo (3.8) y registrado; los eventos de guard no se emiten desde las rutas
   todavía.

### Respuestas del propietario (2026-10-11)

- **Cookies de tema y efectos**: duran un año desde la última elección, como en el código. Corregido 16.4 CA3 de `Historias.md` (versión 2.11). Falta copiar `Historias.md` a `F:\Apps\secretario2\docs\v4-backend-spec.md` (regla de documentos): ese repositorio lo decide el propietario.
- **Email de soporte**: `soporte@mardomingo.com` (sección 9). Sustituido en los borradores.
- **Proveedor de alojamiento**: pendiente. El borrador de privacidad lo deja como marcador hasta el abogado.
- **Decisiones conservadoras de la noche**: confirmadas.

### Pendiente (no cerrado)

- **T092 (abogado)**: los textos definitivos. Hay borradores no vigentes en `docs/legal/borradores/`, con los marcadores de lo que el abogado debe decidir.
- **T095 (parcial)**: falta `domain/abuse.test.ts`.
- **T109 (parcial)**: faltan las pruebas de acciones con `makeRequestEvent` y la matriz de roles. Sin simulador de captcha no se pueden crear usuarios por HTTP.
- **T111 (parcial)**: el atributo `Secure` no se verifica en el entorno http.
- **T112 (parcial)**: faltan los `storageState` de admin, cuenta bloqueada y tester, y ampliar `smoke`. El servidor de pruebas no da acceso a su base y no hay herramienta de administración todavía.
- **T113 (parcial)**: falta el recorrido completo con teclado y la medición de DS-09 (manual).
- **T114**: checkpoint de L03 no cerrado. El propietario decide cerrar L03 como parcial: quedan los parciales de arriba, anotados en cada tarea de `tasks.md`.
- **Push**: pendiente. El remoto `danimardo/mardomingo-backoffice` no responde: no existe para las cuentas de `gh` disponibles. Los commits están en local en `001-cuenta-mardomingo-v4`.
- **Corrección de esta noche**: la página de nueva contraseña marcaba como no válido cualquier enlace válido. Lo encontró el E2E de recuperación y está corregido (`78a9b2d`).

### Verificación de L03 (lo ejecutado)

| Comprobación                                                  | Resultado                                                                                                                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm validate` (check, lint, test:coverage, build, test:e2e) | Pasa. El fallo intermitente de los E2E era una carrera de los tests con la hidratación (actuaban antes de que la página estuviera lista); corregido esperando a networkidle tras goto. Tres ejecuciones seguidas del E2E: 52/52 |
| Unitarias, componentes e integración                          | 392 pasan en 66 ficheros                                                                                                                                                                                                        |
| Cobertura                                                     | Ramas 85,05 % (umbral 80 %); el resto de umbrales también pasan                                                                                                                                                                 |
| E2E en Chromium                                               | 52 pasan: críticos 1, 2 y 3, 320 px, accesibilidad de todas las páginas en ambos temas, teclado y apariencia                                                                                                                    |
| `pnpm test:http`                                              | 46 pasan                                                                                                                                                                                                                        |
| `pnpm lint:tokens`                                            | Pasa. Los dos colores de los emails están en `tokens.css` como `--email-*`, y la plantilla los lee con `?raw`. No forma parte de `validate`.                                                                                    |
| `db:check`                                                    | Sin cambios en la última ejecución; no se ha repetido en este ciclo                                                                                                                                                             |
| E2E completo, Firefox y WebKit                                | **No ejecutados** (`test:e2e` solo usa Chromium)                                                                                                                                                                                |

**Ciclo de cobertura de ramas**: `pnpm validate` falló en el umbral de ramas (73,97 % frente al 80 %). Se han añadido pruebas a los módulos de L03 sin cobertura. Quedan sin cubrir, sobre todo, ramas de `features/accounts/service.ts` (L03) y `features/apps/service.ts` (L02): caminos de error que piden pruebas de integración.

## Lote L05: saldo, bolsas, reservas, deuda, caducidad y ajustes

**Estado**: lote hecho salvo T-MUT-001 (piloto de _mutation_, tras L06, según la tarea). Lo que no está en las tareas del lote queda anotado abajo.

**Hecho**: esquema de `credits` (cinco tablas) y migraciones (`0002` con las tablas, `0003` con los disparadores de solo-anexar sobre `credit_movements`); dominio puro `domain/ledger.ts`; propiedades con semilla fija; formato de importes (`src/lib/format/credits.ts`); servicio con una transacción `BEGIN IMMEDIATE` por operación; bienvenida al verificar; W19 con importe, caducidad o explicación; eventos y presentadores; arranque con reservas interrumpidas; E2E de bienvenida y de la segunda cuenta de Gmail.

**Decisiones tomadas (a confirmar)**

1. Un solo módulo `domain/ledger.ts` en lugar de los siete ficheros de T119.
2. Formato: `Intl` de es-ES no agrupa cifras de cuatro dígitos (1000, no 1.000), como manda la RAE. El texto de la especificación dice «1.000»; no lo he cambiado.
3. Los ajustes negativos reducen solo bolsas del tipo indicado, y nunca superan el disponible (D-16).
4. Una bolsa gratuita sin caducidad (el esquema no la admite) se consume al final entre las gratuitas.
5. Los eventos de créditos no llevan importes, saldos ni emails (Historias 15.19).
6. El cambio de esquema del índice de caducidades se resolvió regenerando la migración, porque nunca se había aplicado en ningún entorno.
7. Un ajuste positivo liquida la deuda en el mismo par que el dominio (D13). La pérdida de un ajuste gratuito (D14) se calcula, pero no se guarda en estadísticas: esa tabla no es de L05.

**Pendiente (no cerrado)**

- **T-MUT-001**: piloto de _mutation_, tras cerrar L06.
- **Tope diario sin compras (BE-FR-11.6)** y **aviso de saldo bajo**: aparecen en la fila de `credits` de `ARCHITECTURE.md`, pero no en las tareas de L05. Van a un lote posterior.
- **Compras**: el asiento de `purchase` lo crea L10 (pagos). El esquema ya lo admite.
- **`app.started` sin `count`** de reservas liberadas: el evento `credits.hold.released_on_startup` sí lo lleva.
- **Reservas de `ai_operations`**: las filas `in_progress` de los tests las inserta el builder hasta que L07 introduzca el servicio de `ai`.

**Verificación**: `pnpm validate` completo, código 0 (2134 ficheros sin problemas; 464 pruebas unitarias, de componentes e integración; ramas 83,95 %; 53 E2E en Chromium). `pnpm test:http`, 59 de 59. Cobertura: 100 % en `domain/` y en `src/lib/format/credits.ts` (umbrales en `vite.config.ts`). Arquitectura y `db:check` sin cambios. Trazado de BE-FR-15/CA1, 18/CA1 y 71/CA1–CA2 sin huecos.

**Bug de prueba corregido**: la prueba de reconstrucción usaba un tope de deuda de 200 créditos, así que pedía un saldo que el propio tope impedía. Se subió el tope en esa prueba.

**Incidencia E2E**: `appearance.spec` falló por una petición `__data.json` abortada al cerrar la página. Se arregló esperando a que la página esté estable antes de comprobar el resultado, sin excepción en el guard. Tres ciclos seguidos pasan.

## Lote L04 (parte US2): login de app, sesión por app y CORS

**Estado**: parte US2 hecha salvo `GET /api/v1/me` (T136) y lo marcado como parcial en `tasks.md`. El cierre de L04 (T195) queda para después.

**Hecho**: cabeceras `X-App-Id`, `X-App-Version` y `X-Device-Name`; `UNKNOWN_APP` y `APP_DISABLED` (exigidos por `requireApp` en cada ruta, para que las rutas inexistentes sigan dando `404`); CORS por app con _preflight_; sesión por Bearer ligada a la app (`other_app`, `cookie_on_api`, `bearer_on_web`); última actividad como mucho una vez por minuto; login de app con documentos pendientes y actividad en `user_app_activity`; logout (204); reenvío de verificación (202); esquemas en OpenAPI.

**Decisiones tomadas esta noche (a confirmar)**

1. La sesión de app (`app_id`, `device_name`, `app_version`) se escribe en el servicio tras el login, no con `databaseHooks` de Better Auth: el hook no recibe la app. Resultado igual, en la misma petición.
2. Una app desconocida o desactivada no se rechaza en el paso «app» de `hooks`, sino en cada ruta con `requireApp`: así una ruta inexistente sigue dando `404 NOT_FOUND`, como exigen las pruebas que ya existían.
3. El `Balance` de `/me` (T136) espera a L05 (`credits`), que el plan pone antes de L04.

**Pendiente**

- **T136** `GET /api/v1/me`: necesita `credits` (L05).
- **T132** `accounts.session.renewed`: Better Auth renueva la sesión y aquí no se distingue.
- **T131** preflight permitido (204): sin prueba HTTP, porque el build no tiene apps con orígenes permitidos.
- **T139**: faltan la app `disabled`, el token de otra app y `/me`, que necesitan datos de prueba por HTTP.
- **T140**: el escenario V02 de `quickstart.md` no se ha ejecutado.
- **L09 (T205)**: el contador por IP del login de app.

**Verificación**: `pnpm validate` completo, código 0 (2275 ficheros sin problemas; 406 pruebas unitarias, de componentes e integración; ramas 83,36 %; 52 E2E en Chromium). `pnpm test:http`, 59 de 59. `pnpm lint:tokens`, pasa. Arquitectura, 22 pruebas unitarias y de arquitectura, pasan.

**E2E intermitentes (corregidos)**: tres pruebas fallaban de forma aleatoria con `net::ERR_ABORTED` en `__data.json`. La causa era que la prueba terminaba con una carga de datos de SvelteKit en vuelo, y el guard de consola lo cuenta como fallo. Se corrigió esperando a que la página esté estable y apartando el ratón del botón tras la navegación (precarga por hover). Seis ciclos de la suite de Chromium: cinco limpios y uno con un fallo de contención (`ERR_NO_BUFFER_SPACE` al cargar un CSS), que no se ha tocado.

## Checkpoint de L02 (T084)

**Resultado**: comprobaciones del lote en verde salvo el E2E completo (no ejecutado: solo el _smoke_). No es `pnpm validate` completo.

| Comprobación                                                                                         | Resultado                                                                                |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `check` (svelte-check)                                                                               | 0 errores, 0 avisos (1433 ficheros)                                                      |
| `lint` sobre `src/lib/server`, `src/lib/shared`, `tests` y `lint:changed` (44 ficheros)              | Pasan                                                                                    |
| `db:check` y comprobación de deriva (`generate` sin cambios)                                         | Pasan: «No schema changes»                                                               |
| Migraciones sobre BD vacía (SQL aplicado en SQLite, comprobado a mano y en `migrations.int.test.ts`) | 19 tablas, 4 triggers, `one_admin` y la inmutabilidad funcionan                          |
| Tests de arquitectura (dentro de unit)                                                               | 17 pasan                                                                                 |
| Unitarias (incluye esquemas JSON, configuración y declaración de tablas)                             | 174 pasan                                                                                |
| Integración (SQLite real, plantilla migrada con `migrateDatabase`)                                   | 59 pasan                                                                                 |
| Cobertura (`test:coverage`)                                                                          | Pasa: funciones 84,85 % (umbral 80 %), líneas 91,36 %, ramas 85,28 %, sentencias 89,66 % |
| `build`                                                                                              | Pasa (22,9 s)                                                                            |
| HTTP contra el build                                                                                 | 38 pasan                                                                                 |
| E2E smoke (Chromium)                                                                                 | 2 pasan (la BD se siembra en el arranque)                                                |
| E2E completo, a11y, Firefox y WebKit tras L02                                                        | **No ejecutados**: queda por verificar                                                   |

### Decisiones conservadoras tomadas esta noche (confirmadas por el propietario el 2026-10-11)

1. **Tablas de §2.8 no nombradas en ninguna tarea**: `auth_rate_limits`, `login_attempts`, `disposable_domains` y `user_app_activity` se declaran en `accounts/schema.ts`, porque son de su dueño y así la migración inicial queda completa (T071 solo nombraba las de Better Auth).
2. **Auditoría de `support_email`**: el valor es una dirección de email y la auditoría nunca guarda emails (3.7). Se registra como `[redactado]` en `before` y `after`. El cambio sí queda auditado; el valor exacto no.
3. **`ON DELETE RESTRICT`** en las claves a `apps` y `user` que la especificación no detalla. Es el valor más estricto; no borra nada en cascada salvo donde la especificación lo pide (`session`, `account`, `terms_acceptances.user_id`, `user_app_activity.user_id`).
4. **Prefijo de los eventos de funcionalidad**: `tests/architecture/log-events.test.ts` aceptaba solo prefijos de infraestructura. Ahora acepta también el nombre de cada funcionalidad, como dice su propia cabecera y `contracts/log-events.md` 1.1.
5. **Error de configuración corrupta**: `INTERNAL_ERROR` (no se añade ningún código nuevo). El evento `apps.config.corrupt` queda en el log con la tabla y la columna, nunca con el valor.
6. **Modelo de la transcripción**: `primary` = `voxtral-mini-latest` y `backup` = `google/gemini-3.7-flash`, aprobados el 2026-10-11 (T079).
7. **`price_references` y `model_cache`** no se declaran: ninguna tarea de L02 las pide y pertenecen a lotes posteriores.

### Valores de `secretario` (T079, aprobados el 2026-10-11)

- **Operaciones de `secretario`**: modelos, respaldos y topes aprobados. Siguen inactivas (`active = 0`): las activa el administrador.
- **`voxtral_price_per_minute_usd`** = 0,003 USD por minuto, aprobado. La transcripción sigue inactiva hasta que se active.
- **Topes**: 8.192 tokens de salida en chat; 12 créditos en el Corrector y en la transcripción de imagen, 100 en PRO, 25 en la transcripción de audio y 80 en la imagen. Aprobados; el coste por imagen es una estimación.
- **Respaldo de transcripción**: `google/gemini-3.7-flash` (60 s), aprobado.
- **URL de descarga de `secretario`** (D-21): `https://github.com/danimardo/secretario2/releases/latest/download/SecretarioAI-Setup.exe`. No resuelve hasta que haya una release con ese nombre; la 3.4.0 usa otro.
- **Textos de `legal_documents`**: no se siembran aquí (son de L03, T092).

### Pendiente de tu revisión (no es un bloqueo)

- **T079**: hecho. Valores en `data-model.md` 3.0 y en `apps/defaults.ts`. Pendiente de comprobar con una llamada real que `max_output_tokens` no corta las respuestas de los modelos GPT-5.x.
- **E2E completo, a11y, Firefox y WebKit**: no se han ejecutado tras L02. El smoke de Chromium pasa.
- **Commits**: en la rama de trabajo `001-cuenta-mardomingo-v4`, subidos a `origin` a petición del propietario. Nada en `main`.

## Checkpoint de L01 (T066)

**Resultado**: `pnpm validate` completo, código 0, en 129 s (check, lint, test:coverage, build y E2E de Chromium, 18 pruebas).

Comprobaciones del checkpoint:

| Comprobación                               | Resultado                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| N0: `check` y `lint` completo              | Pasan (0 errores, 0 avisos)                                                           |
| N0: `build` sin secretos y `lint:tokens`   | Pasan                                                                                 |
| N0: imagen Docker                          | Construida; sana y parada limpia (ver T057)                                           |
| N1: unitarias, de componente e integración | 160 pruebas, pasan                                                                    |
| N2: E2E smoke y a11y en ambos temas        | Pasan en Chromium; Firefox y WebKit también (70 pruebas, 2 no verificables en WebKit) |
| N3: HTTP contra el build                   | 38 pruebas, pasan                                                                     |
| Tiempos anotados                           | En `CLAUDE.md` y `research.md` (T064–T065)                                            |
| CI en el remoto                            | **No ejecutada**: T060 pide autorización expresa                                      |

### Estado del sistema de diseño (T003 y D-20)

| Punto                                 | Estado                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| DS-01 (renombrar a Cuenta Mardomingo) | Resuelto: títulos, cookie `mdm_theme` y `Design/` archivado                     |
| DS-02 (Sistema sin JavaScript)        | Resuelto: `light-dark()` con `color-scheme` y pintado desde la cookie           |
| DS-03 (tema por contexto y cookie)    | Resuelto: `AppearanceState` en contexto, sin `localStorage`                     |
| DS-04 (tipografía en rem)             | Resuelto: cuerpo 1rem, pila del sistema                                         |
| DS-05 (accesibilidad de efectos)      | Resuelto: `data-effects`, reducción de movimiento, contraste y colores forzados |
| DS-06 (componentes del marco)         | Parcial: marco en L01; `AccountMenu` pasa a L03                                 |
| DS-07 (nombres por rol)               | Resuelto: `--color-accent` y `--color-ambient`                                  |
| DS-08 (Tailwind)                      | Resuelto por decisión: no se exponen colores a Tailwind (Historias 2.10)        |
| DS-09 (contraste sobre cristal)       | **Pendiente**: medición manual (T055 y T363)                                    |
| DS-10 (semántica de componentes)      | Resuelto para `Button`, `TextField`, `ThemeToggle` y el marco                   |

### Pendientes de L01 (sin hacer, con motivo)

- **T001** (contrato del Log Gateway): aplazada por la enmienda 2.2.0.
- **T005** (proyecto con `sv`): no se usó `sv` porque genera SvelteKit 3; el proyecto se creó a mano con Kit 2.70.3.
- **T038** (adaptadores del modo test): parcial. La validación del entorno está hecha; los simuladores y el _outbox_ llegan en L02–L03.
- **T044** (`AccountMenu`): parcial. Sus enlaces necesitan `/login`, `/panel` y `/admin` (L03 y L10).
- **T055** (medición manual del contraste): requiere una persona que mire la pantalla.
- **T060** (CI en el remoto y protección de ramas): requiere tu autorización expresa.

### Observaciones para revisar por la mañana

1. **Mensaje del commit `5a630e4`**: dice «Cierra el lote L01», y es inexacto. Queda constancia aquí y en esta sección; no se reescribe historia subida.
2. **CSP**: el anunciador de rutas de SvelteKit lleva un `style` fijo. Se permite solo ese valor, por hash, en `style-src-attr` (decisión mía, la más estrecha posible). Lo bloquea el E2E si se quita.
3. **Cookies `Secure` sobre `http://localhost`**: WebKit no las envía. Por eso esa comprobación queda «no verificable» en WebKit; en producción el sitio es https.
4. **Exenciones de ESLint**: `vite.config.ts`, `drizzle.config.ts` y `playwright.config.ts` pueden leer el entorno. Son herramientas, igual que en la decisión de L01.
5. **Litestream**: con una réplica inalcanzable, `litestream restore` bloquea el arranque. Es el comportamiento seguro (no arrancar con una BD vacía), pero depende de que Backblaze responda al iniciar.
6. **Firefox y WebKit de Playwright**: instalados esta noche (versión 1.64 de los navegadores).
7. **Bug real encontrado por el E2E**: el redirect de `/preferencias` sin query volvía a la portada. Corregido.
