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
| L02, datos del propietario                      | T079                                                 | **Abierto**: requiere respuestas del propietario (valores provisionales en uso)    | —                                                                                      |
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

### Decisiones tomadas esta noche (conservadoras, a confirmar)

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

### Pendiente (no cerrado)

- **T092 (propietario)**: los textos definitivos de los documentos legales. Hoy son provisionales y no se publican.
- **T095**: los tests de antiabuso están dentro de `accounts.int.test.ts`; no existen `domain/abuse.test.ts` ni
  `abuse.int.test.ts` como pide la tarea.
- **T098**: `accounts.guard.denied` no se emite desde las rutas. El paso de sesión sí está hecho.
- **T100**: `RegisterForm`, `LoginForm` y `ResetForm` no existen como componentes; los formularios están en sus páginas.
- **T108**: faltan los tests de sesión deslizante con reloj falso, de caducidad de 24 h del enlace, de cuenta bloqueada, de `signup_app_id` y de eventos sin email. La revocación inmediata ya está probada.
- **T109**: faltan los tests de las _actions_ con `makeRequestEvent` y la matriz de roles (`roles-l03.test.ts`). Hechos los de
  los guards (`accessFor`, `denialOf`), los auxiliares de las acciones (`clientIpOf`, `failureOf`), los textos de error y el
  estado de formulario.
- **T111**: faltan la cookie `Secure`/`HttpOnly`/`SameSite` en HTTP y la cabecera `cache-control` del panel.
- **T112**: el crítico 1 (registro → `.outbox` → verificación → bienvenida) está hecho en `e2e/verificacion.spec.ts`, con el
  simulador de Turnstile conectado al servidor de pruebas. Faltan los _builders_ de usuarios con `storageState` (`auth.setup.ts`)
  y los críticos 2 y 3 completos (login y logout con sesión real, recuperación de extremo a extremo con el `.outbox`).
- **T113**: las rutas nuevas entran solas en la matriz de accesibilidad (ambos temas, todas pasan tras corregir `/registro`).
  Hecho: 320 px sin desplazamiento en login, registro y recuperación. Faltan: navegación con teclado, el cambio de tema del sistema
  en `/login` (`appearance.spec.ts`) y la medición de DS-09 (manual: requiere una persona).
- **T114**: checkpoint de L03, no cerrado. `pnpm validate` completo pasa (ver la verificación), pero siguen abiertas las
  tareas de arriba (T092, T095, T098, T100, T108, T109, T111, T112 y T113).

### Verificación de L03 (lo ejecutado)

| Comprobación                                           | Resultado                                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` (en `pnpm validate`)                      | 0 errores y 0 avisos en 2090 ficheros                                                                                       |
| `pnpm lint` (en `pnpm validate`)                       | Pasa                                                                                                                        |
| Unitarias, componentes e integración (`test:coverage`) | 358 pasan en 61 ficheros                                                                                                    |
| Cobertura (`test:coverage`)                            | Pasa: ramas 82,08 % (umbral 80 %), funciones 85,77 %, líneas 90,51 %, sentencias 89,16 %                                    |
| `pnpm build` (en `pnpm validate`)                      | Pasa                                                                                                                        |
| E2E en Chromium (`test:e2e`, en `pnpm validate`)       | 47 pasan: smoke, cuentas (8 y 3 de 320 px), flujo crítico 1, accesibilidad de todas las páginas en ambos temas y apariencia |
| HTTP contra el build (`test:http`)                     | 45 pasan en la última ejecución, anterior a este ciclo; no forma parte de `validate`                                        |
| `db:check` y deriva del esquema                        | Sin cambios en la última ejecución; no se ha repetido en este ciclo                                                         |
| E2E completo, Firefox y WebKit                         | **No ejecutados**                                                                                                           |

**Ciclo de cobertura de ramas**: `pnpm validate` falló en el umbral de ramas (73,97 % frente al 80 %). Se han añadido
pruebas a los módulos de L03 sin cobertura de ramas: los _guards_ de la cuenta (`accessFor`, `denialOf`), los auxiliares de
las acciones (`clientIpOf`, `failureOf`), los textos de error, el estado de formulario, `sessionUserOf`, el envío de
notificaciones (también el fallo del proveedor), las excepciones del adaptador de Resend y los componentes `Checkbox` y
`Notice`. No se ha bajado ningún umbral ni excluido ningún fichero. Con ello, las ramas pasan a 82,08 %.

Quedan sin cubrir, sobre todo, ramas de `features/accounts/service.ts` (36, L03) y `features/apps/service.ts` (27, L02).
Son caminos de error que piden pruebas de integración; quedan para una pasada posterior.

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

### Decisiones conservadoras tomadas esta noche (anotadas, a confirmar)

1. **Tablas de §2.8 no nombradas en ninguna tarea**: `auth_rate_limits`, `login_attempts`, `disposable_domains` y `user_app_activity` se declaran en `accounts/schema.ts`, porque son de su dueño y así la migración inicial queda completa (T071 solo nombraba las de Better Auth).
2. **Auditoría de `support_email`**: el valor es una dirección de email y la auditoría nunca guarda emails (3.7). Se registra como `[redactado]` en `before` y `after`. El cambio sí queda auditado; el valor exacto no.
3. **`ON DELETE RESTRICT`** en las claves a `apps` y `user` que la especificación no detalla. Es el valor más estricto; no borra nada en cascada salvo donde la especificación lo pide (`session`, `account`, `terms_acceptances.user_id`, `user_app_activity.user_id`).
4. **Prefijo de los eventos de funcionalidad**: `tests/architecture/log-events.test.ts` aceptaba solo prefijos de infraestructura. Ahora acepta también el nombre de cada funcionalidad, como dice su propia cabecera y `contracts/log-events.md` 1.1.
5. **Error de configuración corrupta**: `INTERNAL_ERROR` (no se añade ningún código nuevo). El evento `apps.config.corrupt` queda en el log con la tabla y la columna, nunca con el valor.
6. **Modelo de la transcripción**: `primary` = `voxtral-mini-latest` (lo fija la documentación) y `backup` = nulo (PROVISIONAL, T079).
7. **`price_references` y `model_cache`** no se declaran: ninguna tarea de L02 las pide y pertenecen a lotes posteriores.

### Valores PROVISIONALES (T079): no activar operaciones antes de confirmarlos

- **Operaciones de `secretario`**: inactivas (`active = 0`) y sin modelo. Ninguna petición real puede usarlas hasta que el propietario dé modelos, topes y respaldos.
- **`voxtral_price_per_minute_usd` = 0**: PROVISIONAL. Si se activa la transcripción sin el precio real, el coste sería cero. Por eso la transcripción está inactiva.
- **Topes de salida y de coste**: 4096 tokens en chat; 1, 5 y 10 créditos de tope en chat, transcripción e imagen. Todos PROVISIONALES.
- **Respaldo de transcripción**: nulo. Con el primario activo, la configuración es válida, pero no hay respaldo.
- **URL de descarga de `secretario`** (D-21): nula. Sin ella, la landing no muestra botón de descarga.
- **Textos de `legal_documents`**: no se siembran aquí (son de L03, T092).

### Pendiente de tu revisión (no es un bloqueo)

- **T079**: el propietario debe dar los valores anteriores y anotarlos en `data-model.md` §3.
- **E2E completo, a11y, Firefox y WebKit**: no se han ejecutado tras L02. El smoke de Chromium pasa.
- **Commits**: todo es local. No hay push ni cambios en `main`.

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
