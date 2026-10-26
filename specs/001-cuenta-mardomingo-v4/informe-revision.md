# Informe de la revisión de la implementación (2026-10-19)

Revisión del código de `001-cuenta-mardomingo-v4` frente a `tasks.md`, `Historias.md` y los contratos, hecha con un modelo más
potente que el que implementó. Cinco auditorías de solo lectura (cuentas y base, dinero y panel, API e IA, administración y
tareas, UX y CI) y después correcciones y trabajo pendiente con prueba. **Sin commits**: todo está en el árbol de trabajo.

## Estado medido al terminar

| Comprobación           | Resultado                                                                  |
| ---------------------- | -------------------------------------------------------------------------- |
| `pnpm check`           | 0 errores y 0 avisos                                                       |
| `pnpm lint`            | Sin avisos (Prettier y ESLint)                                             |
| `pnpm test`            | Todo en verde (unitarios, componente, integración y arquitectura)          |
| `pnpm test:http`       | 155 pruebas en verde contra el build                                       |
| E2E en Chromium        | Todo en verde en la última pasada completa (154); ver «Pruebas inestables» |
| WebKit y Firefox       | **No ejecutados**                                                          |
| `pnpm validate` entero | **No ejecutado** como cadena; cada puerta se ha ejecutado por separado     |
| Contenedor Docker, CI  | **No verificado** (sin Docker ni GitHub Actions en esta sesión)            |

## Errores encontrados y corregidos

| Gravedad | Hallazgo                                                                                                                                                              | Corrección                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta     | El freno global de gasto rechazaba también a las cuentas con compra real (BE-FR-46 CA1).                                                                              | `protections/service.ts`: las cuentas con compra real pasan. Test nuevo en `brake.int.test.ts`.                                                    |
| Alta     | El refresco diario del BCE sustituía en silencio el tipo de cambio manual (BE-FR-87 CA3).                                                                             | `pricing/service.ts`: con un manual vigente, la observación se guarda sin entrar en vigor. Test nuevo en `fx.int.test.ts`.                         |
| Alta     | La última actividad de la cuenta solo se anotaba al abrir el panel: quien usa una app a diario podía acabar borrado por inactividad (BE-FR-86).                       | `accounts/activity.ts` anota la actividad en toda petición autenticada (web o API), como mucho una vez por hora. Se engancha en `hooks.server.ts`. |
| Alta     | No existía ninguna retención de datos, ni purga de cuentas sin verificar, ni borrado por inactividad (BE-FR-68, 83, 86).                                              | Implementados (ver «Trabajo hecho»).                                                                                                               |
| Alta     | No había ninguna tarea programada real: el único programador era un `setInterval` con 3 pasos, y `refreshFxFromEcb` y `refreshModelCache` no los llamaba nadie.       | Infraestructura con croner (`src/lib/server/jobs/`) con 10 tareas en horario de Madrid.                                                            |
| Media    | `settleOk` no liberaba la reserva si el cobro lanzaba un error inesperado.                                                                                            | `ai/service.ts`: se libera como en el resto de fallos inesperados.                                                                                 |
| Media    | Un contracargo sobre una compra sin acreditar bloqueaba la cuenta y rectificaba una factura inexistente.                                                              | `payments/service.ts`: solo se aplica a compras acreditadas. Test nuevo.                                                                           |
| Media    | La acreditación de una compra podía quedarse sin factura para siempre si el proceso caía entre pasos.                                                                 | `completePayment` reordenado: acreditar y facturar (idempotentes) antes de marcar `completed`. **Sin test de caída intermedia**.                   |
| Media    | Los créditos se mostraban sin decimales en el saldo y las listas (0,8 salía «1»), contra BE-FR-22.                                                                    | `payments/format.ts` delega en `$lib/format/credits`; `movimientos` y `consumo` también.                                                           |
| Media    | `resolve()` en un `load` devolvía rutas relativas (`./terminos`) que quedan rotas al reutilizar los datos desde otra profundidad (también el menú de administración). | `svelte.config.js`: `paths.relative: false`.                                                                                                       |
| Media    | El registro y el aviso de documentos pendientes pedían aceptar textos sin enlazarlos (BE-FR-70 CA2); no existían las páginas legales.                                 | Páginas W04–W07, enlaces en el registro, en el panel y en el pie.                                                                                  |
| Media    | El layout raíz devolvía `account: { signedIn: false }` y `supportEmail: null` fijos: la cabecera nunca mostraba la sesión.                                            | `+layout.server.ts` lee la sesión y el soporte; cabecera con `AccountMenu`.                                                                        |
| Baja     | `resetTokenStateOf` leía `Date.now()` en lugar del `Clock` inyectado.                                                                                                 | Usa `deps.clock.now()`.                                                                                                                            |
| Baja     | `Button` como enlace deshabilitado seguía navegando, y su `eslint-disable` no tenía motivo.                                                                           | Sin `href` cuando está deshabilitado; motivo escrito.                                                                                              |
| Baja     | Tabla de `/cookies` y otras con desbordamiento a 320 px.                                                                                                              | `DataTable` (contenedor desplazable).                                                                                                              |
| Baja     | `T273` figuraba hecha sin estarlo.                                                                                                                                    | Reabierta en `tasks.md`.                                                                                                                           |

## Trabajo hecho

- **L15 (US11), T346–T354**: páginas W01 (landing con `LandingHero`), W02 (`/apps/[slug]`, con matcher `appSlug`), W03
  (`/precios`) y W04–W07 (documentos legales y declaración de cookies); convertidor de Markdown propio con escape total
  (`legal/domain/markdown.ts`); presentadores de landings y precios; tests unitarios, de integración, HTTP y E2E.
- **L14 privacidad (US10), T291–T297**: `jobs/` (envoltorio, horario, registro), retención con plazos en Madrid, purga de cuentas
  sin verificar, cuentas inactivas con aviso, cancelación y borrado (nunca con compra real), plantilla del aviso, y sus tests con
  reloj falso (incluida la aceptación SC-016).
- **L14 emails y tareas (US12), parcial**: `ledger-check` con alerta `ledger_mismatch`; planificación de `free-credits-expiry`,
  `holds-cleanup`, `price-references`, `release-downloads`, `models-refresh` y `fx-ecb`.
- **L01 (T044)**: `AccountMenu`, cabecera con navegación y `aria-current`, pie con documentos legales y soporte.
- **Tareas cerradas en `tasks.md` tras comprobar que ya estaban hechas**: T229, T236, T238, T256, T268.

## Lo que sigue pendiente (priorizado)

1. **L14 sin hacer**: `openrouter-balance` (T333), `sync-tombstones-cleanup` (T338; necesita entender el formato de las marcas de
   borrado dentro del documento sincronizado), `disposable-domains` (T340), alertas `openrouter_balance` y `mistral_billing`
   (T325, T326, T334), aviso `free_expiry_warning` (T330), `detectAssignedModelIssues` (T335) y el adaptador de GitHub con
   interfaz, paginación y `X-GitHub-Api-Version` (T339).
2. **IA (L07)**: `ai.cancellation_cost.recorded` solo está declarado; la cancelación deja `cost_micro_usd = 0` (T170) y falta el
   test de deuda dentro de `max_debt` (T174), el de dos apps (T175) y `accounts.session.renewed` (T132).
3. **API**: el orden de comprobaciones de `api-v1 §1.8` no coincide (las rutas validan cuerpo e `Idempotency-Key` antes de versión,
   mantenimiento y freno, y se consume cupo con peticiones inválidas); `Cache-Control` es `no-store` y el contrato dice
   `private, no-store`; `insertOperation` detecta el UNIQUE por el texto del mensaje.
4. **Administración (L13)**: W40, W35 (ficha incompleta), W43, W44 y los nombres de las acciones frente al contrato. Otra sesión
   estaba trabajando en estas partes durante la revisión y no las he tocado.
5. **Tests que faltan**: acciones por ruta con `makeRequestEvent` (T109, T246, T270, T321), `tests/http/roles-l03.test.ts`,
   `tests/http/panel-downloads.test.ts` (solo un caso), `e2e/setup/auth.setup.ts` con `storageState` (T112) y los E2E de compra,
   panel, privacidad y legal (T247, T288), `e2e/ux-matrix.spec.ts`, `no-js.spec.ts`, `keyboard.spec.ts`, visual, carga y Web Vitals.
6. **Panel**: `ChartContainer` no se usa en ningún sitio (faltan las gráficas de consumo y de estadísticas), y
   `PendingAcceptancesBanner` ya existe pero T286 pedía también su test propio.
7. **Documentación**: `CLAUDE.md` no recoge `test:e2e:visual`, `test:e2e:cross-browser`, `test:mutation` ni `docs:api` (T379);
   `docs/operaciones/` y `docs/usabilidad/` no existen (T372–T376).
8. **Requiere a una persona o un entorno que no he tenido**: textos legales definitivos (T092; los borradores de
   `docs/legal/borradores/` están marcados «NO VIGENTE» y **no** se cargan en el seed a propósito), captura de SmartScreen
   (UX-16), medición de contraste sobre cristal (T055, T363), NVDA y VoiceOver (T364), verificación del proxy y de la IP real,
   simulacro de Litestream, release (T372–T375).

## Decisiones que conviene revisar

- **`paths.relative: false`** cambia todas las rutas de las páginas a absolutas. Es lo correcto para esta aplicación (cuelga siempre
  de la raíz del dominio), pero afecta a todo el HTML generado.
- **Las tareas son un registro único** (`jobs/index.ts`) y no un fichero por tarea como pedía T291–T341. Es más fácil de probar
  (el horario es solo datos) pero se aparta de la letra de las tareas.
- **La tarea diaria anterior desaparece**: `runDailyJob` y su programador (`setInterval`) se han sustituido por tareas
  independientes. La tabla `daily_job_runs` queda sin uso (no he creado ninguna migración para quitarla).
- **`protect` de croner** solo actúa en las ejecuciones programadas; `trigger()` (la puesta al día al arrancar) no lo respeta. Las
  tareas con puesta al día no coinciden con su hora programada, así que no se solapan.
- **Las rutas públicas de las apps usan `appSlug`**, pero las de administración siguen con `[slug]` y `[key]` sin matcher.

## Pruebas inestables observadas

Bajo la suite E2E completa en paralelo fallaron, en pasadas distintas y siempre pasando en aislamiento, `accounts.spec.ts` (dos
pruebas), una prueba nueva mía (`ERR_ABORTED` de la carga de datos al terminar justo tras navegar, ya corregida con
`networkidle`) y `admin-contenido.spec.ts` (una vez). Es el patrón de contención que describe `CLAUDE.md`, no una regresión
demostrada, pero no lo he investigado a fondo.

## Procedimiento

- Las auditorías se hicieron por lectura, sin ejecutar nada; sus hallazgos se verificaron antes de corregir.
- Cada corrección de comportamiento tiene un test que la cubre, salvo la de `completePayment` (una caída entre pasos no es fácil
  de simular con los dobles actuales) y la de `settleOk`.
- Comprobado que los tests de las tres correcciones de dinero y protecciones (freno, tipo de cambio manual y contracargo) fallan
  si se revierte su corrección y pasan con ella. Los de `settleOk` y `completePayment` no existen (ver arriba).
