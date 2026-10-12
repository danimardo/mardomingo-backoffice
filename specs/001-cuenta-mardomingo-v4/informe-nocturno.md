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

## Puesta en marcha (propuesta, pendiente de ejecutar)

Orden recomendado. Nada de esto se ha desplegado; lo ejecutas tú en Coolify.

1. **Variables de entorno** (antes de desplegar):
   - `BODY_SIZE_LIMIT=10M`. Obligatoria: sin ella la aplicación se niega a arrancar (`app.config.body_limit_incoherent`).
   - `MISTRAL_API_KEY`: clave de Voxtral. Sin ella, el principal figura como no configurado y solo queda el respaldo.
   - `OPENROUTER_API_KEY`: ya existía. Sirve también al respaldo de la transcripción y a la imagen.
   - `OPENROUTER_MANAGEMENT_KEY` (opcional): saldo de OpenRouter, para la alerta de L14.
2. **Imagen**: el `Dockerfile` ya instala ffmpeg 7.1 (apt, trixie) con ffprobe. No hay que cambiarlo.
3. **Migraciones** (se aplican solas al arrancar): `0005` (caché de modelos), `0006` (tope de imagen a 200 créditos, solo la fila sembrada con el valor antiguo) y `0007` (tabla de anuncios).
4. **Verificación manual en staging** (no se puede automatizar aquí):
   - V05, paso 1: un WebM real de 118 s de MediaRecorder con Voxtral caído. Comprobar que la conversión a mp3 con ffmpeg llega al respaldo, que el cobro es solo de lo facturado y que los reintentos son a 2, 4 y 8 s. Anotar el comando de ffmpeg confirmado en `research.md` (R11).
   - V05, pasos 2 y 3: ambos caídos (502 sin cobro) y un audio de 311 s (413 `AUDIO_TOO_LONG` con `maxSeconds` 300).
   - V05, paso 4 (fichero ilegible) y paso 5 (tercera transcripción simultánea): el paso 5 depende de la ranura de transcripción (T202), que todavía no está implementada.
   - V13 (no se guarda contenido): comprobar en staging que ni el audio ni el texto aparecen en la base ni en los logs.
5. **Dos cosas que siguen abiertas y te afectan**: el CI nunca se ha ejecutado en remoto (la protección de `main` y `staging` depende de eso, T060), y las operaciones de medios se activan por SQL en las pruebas, así que hasta L13 la activación real la haces tú desde la base.

## Lote L09 (parcial): versiones, mantenimiento y protecciones de la API

**Estado (2026-10-12)**: T189 a T203 hechos; **T195 (checkpoint) abierto**. Lo verificado está abajo; lo que falta, al final.

**Hecho y verificado**

- Versiones, mantenimiento y acceso (T189–T191): `shared/semver.ts`, `protections/domain/access.ts`, `guardAccess`.
- Anuncios y estado de app (T192–T194): tabla `announcements` en `apps` (decisión A del propietario), `GET /api/v1/app/status`, pruebas de integración (8) y HTTP (5).
- Límites (T196–T202): `protection_state` (migración `0008`), límite por minuto de la cuenta (suma de sus apps) y de la app (nunca mayor que el global), ranuras de transcripción liberadas en `finally`, `429 RATE_LIMITED` con `Retry-After` (cabecera y `details.retryAfterSeconds`).
- Tope diario de cuentas sin compra real (T201): en la transacción de `reserve`, con los cobros de uso del día de Madrid, las reservas activas y la nueva. `402 DAILY_FREE_LIMIT_REACHED` en chat, imagen y transcripción. Las cuentas con compra real quedan exentas.
- Freno global (T199, T202, T203): coste real del día de las cuentas sin compra real (conversión con `fx_usd_eur`, redondeo hacia arriba) más sus reservas en curso. Al cruzar 500 céntimos se activa, se guarda, avisa una vez al administrador y responde `503 SERVICE_LIMITED`. Liberación manual con auditoría (`protections.brake.released`).

**Verificación ejecutada**

- `pnpm validate` completo, en la última ejecución: `check` sin errores ni avisos; `lint` correcto; `test:coverage` con 110 ficheros y 742 pruebas en verde, cobertura de dominios al 100 %; `build` correcto; E2E 53 en verde. Código de salida 0.
- `pnpm test:http`: 12 ficheros, 84 pruebas en verde, sobre el build.
- `pnpm test:trace`: sale en 0. Lista criterios UX de lotes posteriores (interfaz de L13), no de este tramo.
- Dos fallos intermedios de `validate` fueron míos y están corregidos: formato de `messages/es.json` y una rama de dominio sin cubrir (`brake.ts`, estado del día que no puede darse con las escrituras actuales; la función se simplificó).

**Decisiones tomadas (conservadoras; revisar)**

1. Límite de cuenta: `ai_requests_per_minute` global, sobre la suma de todas las apps. Límite de app: el valor efectivo de la app (override ≤ global). Gana el primero alcanzado; la cuenta se comprueba antes.
2. `Retry-After` de la frecuencia: segundos hasta que sale de la ventana la petición más antigua. Para la concurrencia, 5 s fijos (no hay un plazo que calcular).
3. El freno se evalúa en cada petición de IA, con la agregación del día, salvo que ya esté activo hoy. Puede ser caro con mucho tráfico; a revisar con datos reales.
4. El aviso del freno sale en segundo plano, sin retrasar el rechazo. Si el envío falla, queda registrado como `protections.brake.alert_failed`.
5. El guard sigue siendo síncrono: la reserva ocurre en el mismo turno que antes, y las pruebas de cancelación (D-05) dependen de ese orden.
6. `global_daily_free_cost_brake_eur` está en céntimos (500 = 5 €, como indica `Historias.md`). El nombre con `_eur` es engañoso; no lo renombro porque el spec lo usa así.
7. Las cachés de frecuencia y concurrencia son de una instancia y se pierden al reiniciar (T200, aceptado). Con varias instancias, los límites se multiplicarían.
8. Al cambiar de día el freno se rearma solo (el estado va por día). No se escribe auditoría `new_day`: no hay tarea programada que lo haga. Queda pendiente de decidir.
9. En pruebas, los ajustes se cambian por `updateSetting` (valida, audita e invalida la caché). Cambiarlos en SQL directo dejaba la caché vieja y la prueba no medía nada.
10. Las pruebas de concurrencia de saldo (créditos y chat) marcan su cuenta como compra real para no mezclar el saldo con el tope; el tope tiene sus propias pruebas.

**Pendiente (no cerrado)**

- **T195 (checkpoint L04)**: abierto. Lo cubierto: arquitectura (test de `tests/architecture`, en verde), `check`, `lint:changed`, build y HTTP. Falta V09 (mantenimiento por app):
  - Paso 1, activar el mantenimiento desde la administración (W40): no tiene E2E en esta suite. Lo que sí hay es la prueba de integración del guard con el mantenimiento global.
  - Pasos 2 a 4 por HTTP con Bearer y con dos apps: no están en `test:http`. Montarlos requiere activar el mantenimiento por la vía del administrador en el proceso del build, y eso no se ha hecho.
- Liberación del freno desde la interfaz: `releaseBrake` existe y tiene pruebas; la pantalla es de L13.
- Auditoría `new_day` (decisión 8).
- Commits locales de L06–L09: no subidos. L06 a L08 siguen parciales, así que no se cumple la condición de subir al cerrar cada lote.

## Lote L08: transcripción (E08) e imagen (E09)

**Estado**: parcial. Implementado y verificado con dobles y con ffprobe y ffmpeg reales en la suite HTTP. Quedan los pasos manuales de staging y del quickstart (V05) y el checkpoint T188 abierto por ellos.

**Hecho**: contratos E08 y E09 (con registro en OpenAPI y `format: binary`); puerto y adaptador de Voxtral con su simulador; adaptadores de ffprobe y ffmpeg con `execFile` sin shell (tiempo máximo, `SIGKILL`, señal); reglas de transcripción en `ai/domain/transcription.ts`; `ai/media.ts` con transcripción e imagen; rutas `api/v1/ai/transcribe` e `api/v1/ai/image`; comprobación fatal de `BODY_SIZE_LIMIT` en el arranque. Refactor de `service.ts`: se extraen `admissionOf` (legal e idempotencia) y `billAndClose` (cobro y cierre), que usan el chat, la transcripción y la imagen. El chat sigue en verde (23 pruebas de integración y 11 HTTP).

**Decisiones tomadas (a confirmar)**

1. Voxtral reintenta según `retry_delays_ms` de la operación (2, 4 y 8 s), con 45 s por intento. El respaldo por OpenRouter recibe el audio en mp3 con `input_audio` y su propio tiempo (60 s). Un 401, 402 o 429 es de facturación: no reintenta y pasa al respaldo.
2. Se cobra solo lo que factura cada proveedor. Voxtral: segundos del proveedor o, si no los informa, los medidos en el servidor (nunca los del cliente), × precio por minuto / 60. Respaldo: su coste (respuesta, `/generation` o estimación).
3. Coste máximo de la transcripción: el mayor entre Voxtral y el respaldo. Sin coste estimado del respaldo se usa el tope de la operación, así que la reserva es de hasta 25 créditos por petición; es conservador.
4. Un fichero no legible o más largo que `max_audio_seconds` más la tolerancia se rechaza antes de reservar nada. Sobre el tamaño, se responde 413 si la cabecera declara más que `max_audio_mb`.
5. La imagen se devuelve como data URL y no se guarda. Sin imagen en la respuesta, `PROVIDER_ERROR` sin cobro.
6. El temporal de audio es un directorio de `mkdtemp` con el original y el convertido, con permisos `0o600` en los ficheros, y se borra en `finally`. Si el borrado falla, se registra `ai.temp_file.cleanup_failed`.
7. Las pruebas de integración usan dobles de Voxtral, ffprobe y ffmpeg, como se acordó. La suite HTTP usa los binarios reales, porque el plan (T188) exige que ffmpeg y ffprobe estén disponibles en el checkpoint. Están instalados en este equipo (`C:\ProgramData\chocolatey\bin`).

**Hallazgos que necesitan tu decisión**

- **Imagen (valor aprobado)**: con los valores aprobados en T079, `image-generation` estima 80.000 µUSD (0,08 USD) por imagen, que con la comisión, el tipo de cambio y el margen por defecto son unos 155 créditos. Su tope es de 80 créditos. **Toda imagen se rechazaría con `OPERATION_TOO_EXPENSIVE`**. En las pruebas he subido el tope a 200 créditos, sin tocar el valor sembrado. Hay que decidir si se sube el tope o se baja la estimación.
- **`BODY_SIZE_LIMIT` es obligatorio en el despliegue**: SvelteKit usa 512 KB si la variable no existe. He quitado el valor por defecto `10M` del esquema de entorno, porque no llegaba al adaptador y ocultaba el problema. La aplicación ahora **se niega a arrancar** si `BODY_SIZE_LIMIT` no cubre los 10 MB de audio. En Coolify hay que definir `BODY_SIZE_LIMIT=10M` antes de desplegar esta versión.
- **CI no verificado**: `ci.yml` usa `ubuntu-24.04` y no instala ffmpeg de forma explícita. CI nunca se ha ejecutado en remoto, así que no lo puedo comprobar.
- **Dockerfile**: `trixie` con `ffmpeg` por apt (7.1; ffprobe va en el mismo paquete). Leído, no ejecutado.

**Pendiente (no cerrado)**

- **Staging**: probar el respaldo con conversión real en staging y anotar el comando de ffmpeg confirmado en `research.md` (R11, T187).
- **Quickstart V05** y el checkpoint T188 (escenarios manuales).
- **Activación de las operaciones de medios** en la base de prueba: se hace por SQL como precondición, hasta que L13 active operaciones desde el administrador.

**Verificación**: `pnpm validate` en código 0 (664 pruebas en 100 ficheros; cobertura del dominio al 100 %; build; 53 E2E). `pnpm test:http` en verde (79 pruebas, con 9 de medios contra el build, ffprobe y ffmpeg reales). Arquitectura y lint en verde.

**Incidencias**: la comprobación de `BODY_SIZE_LIMIT` falló en el E2E porque el servidor de Playwright no lo definía; ya está en su configuración. Una subida por encima del límite del servidor llegaba como 400 y ahora responde 413 por la cabecera declarada. La regex de claves de operación no admitía guiones (`image-generation`).

## Lote L07: chat de IA (E07): flujo, proveedor, cobro, moderación y cancelación

**Estado**: parcial. Núcleo del chat hecho y verificado, y la suite HTTP contra el build (T178) en verde. Faltan parte de T166, varias pruebas de T174–T176 y los escenarios manuales del quickstart. El checkpoint T179 queda abierto por esos escenarios.

**Hecho**: dominio puro de `ai` (idempotencia, estados y cobro, pipeline de §8, respaldos, validación de entrada y de variables de plantilla) y `apps/domain/total-timeout.ts`; contrato E07 (`contract.ts`, OpenAPI); adaptador de OpenRouter con su puerto, su doble y su simulador HTTP; migración `0005` de `model_cache`; repositorio, catálogo de eventos y servicio de chat (`runChat`, en dos partes); arranque que interrumpe las operaciones en curso; ruta `POST /api/v1/ai/chat`; cableado en la composición (`pricing`, `ai`). Evento `legal.acceptance.required` añadido al catálogo de `legal`.

**Decisiones tomadas (a confirmar)**

1. `timeout_ms` de la operación es el tiempo máximo de **cada intento** (45 s en el chat). El total de la operación es la suma de sus intentos y esperas, la cifra que informa `/app/status`. No es un tope: si el principal agota su tiempo, el respaldo corre con el suyo. Una versión anterior usaba `timeout_ms` como tope y el respaldo nunca llegaba a ejecutarse; se corrigió.
2. Reintentos del principal: 1 reintento tras 2 s (`DEFAULT_RETRY_POLICY`). La especificación no fija el número; es una elección conservadora.
3. Una repetición tras `undelivered` no reserva saldo: vuelve a llamar al proveedor y su coste queda absorbido (`absorbed_reason = undelivered_replay`), sin cobro al usuario.
4. Sin saldo (402): la fila queda `rejected` sin reserva. El rechazo lo registra `credits.hold.rejected`; `ai.operation.rejected` solo lleva los motivos del catálogo, que no incluyen saldo.
5. Coste máximo: sin precio conocido del modelo, la estimación es `estimated_max_cost_micro_usd` de la operación, o el propio tope de la operación si tampoco existe. Con precio, la estimación usa el más caro entre principal y respaldos (BE-FR-72).
6. Coste real: el de la respuesta; si falta, `/generation`; si falta también, la estimación por el precio del modelo (`cost_estimated`); si no hay precio, se cobra la reserva (el máximo acordado).
7. Reserva mínima de 1 µc (la restricción de `hold_micro` exige positivo).
8. Tamaño de imagen estimado por exceso (sin restar el relleno): conservador para `max_image_mb`.
9. Mensajes con rol `tool` y `tool_calls` admitidos en modo libre, como dice el contrato.
10. Cancelación antes de la respuesta: sin cobro. No se registra coste de cancelación (`ai.cancellation_cost.recorded`): el adaptador aborta sin id de generación, así que no hay forma de conocer el coste. Si el proveedor ya respondió y el cliente se fue, la operación queda `undelivered` y se cobra.
11. `ai.operation.interrupted` solo se emite al arrancar si hay operaciones afectadas.
12. Moderación: estado `provider_error` con `flagged = true`, sin cobro. El aviso del umbral se emite cuando el recuento del día llega exactamente al umbral; la alerta del día tiene su propia clave, así que no se repite.
13. En las pruebas, la operación de chat se activa por SQL: la activación real (con su comprobación de compatibilidad) es de L13.
14. La suite HTTP escribe la cuenta de chat en la base del servidor después de su arranque: sesión con token Bearer propio (el servidor lo firma al leerlo), aceptaciones legales, bienvenida y operación activa. Son precondiciones del escenario, no pasos del flujo.
15. El proyecto `http` de Vitest recibe la misma opción de CSS crudo que `unit` e `integration` (`css.include` de `tokens.css`): el global setup importa servicios que leen `tokens.css` con `?raw`.

**Pendiente (no cerrado)**

- **T178**: hecho (ver verificación). Antes de cerrarlo hubo que añadir la opción de CSS crudo al proyecto `http` (decisión 15).
- **T166**: `checkOperationActivatable`, `activateOperation` en `apps` y `detectAssignedModelIssues` (retirados y cambios de precio). Van con L13 y L14.
- **T170**: `ai.cancellation_cost.recorded` (ver decisión 10).
- **T174–T176**: deuda dentro de `max_debt` (−3.236.000 µc), dos apps en concurrencia, y cancelación con coste de la respuesta.
- **T165**: validación Zod de las columnas JSON de `model_cache` al leer.
- **T179 / quickstart V02–V04 y V13**: no ejecutados. El resto del checkpoint (N1, N3 en integración y HTTP, privacidad, arquitectura, lint, check, build) está verificado.

**Verificación**: `pnpm validate` completo, código 0 (613 pruebas en 93 ficheros; cobertura con el 100 % en `domain/`; build; 53 E2E). `pnpm test:http` en verde (70 pruebas, 11 de ellas de chat contra el build). `pnpm exec eslint` y `prettier --check` limpios. Arquitectura en verde.

**Incidencias**: la prueba de migraciones pasa a 26 tablas con `model_cache`. Una versión previa de `runChat` lanzaba el fallo del proveedor dentro del `try` de liberación y lo sobrescribía como `INTERNAL_ERROR`; se separó el `try` a la llamada del proveedor. El piloto de mutación de L06 sigue sin resultados válidos (ver su sección).

## Lote L06: tarificación, coste máximo, tipo de cambio y alertas

**Estado**: lote hecho salvo el piloto de mutación (T154, parcial).

**Hecho**: fórmula de cobro en enteros con `BigInt` (ejemplos exactos de BE-FR-22); estimación del coste máximo con el precio más caro entre principal y respaldos; tipo de cambio en ppm sin `float`, con vigencia y valor manual; adaptador del BCE con validación del CSV y simulador con escenarios; `alerts_state` y la regla de alertas (envío, supresión, rearme); servicio de precios con auditoría; regresión de extremo a extremo del formato de D-07.

**Decisiones tomadas (a confirmar)**

1. El tipo de cambio se redondea al ppm más cercano (mitad hacia arriba). El cobro sube siempre al µc superior (`ceil`).
2. Una observación del BCE solo cuenta como actual si es la última publicación esperada (hoy si es laborable; el viernes si es fin de semana). Una observación antigua es un fallo de contenido.
3. Un envío de alerta fallido deja la alerta inactiva, para que el siguiente cruce la reintente (no se pierde el aviso).
4. Sin filas de tipo de cambio, el valor por defecto de la configuración (920.000 ppm).
5. Desactivar el manual inserta una fila `ecb` con el último valor del BCE; sin ningún valor del BCE no hay a qué volver y no hace nada.
6. El dominio de precios, notificaciones y créditos llega al 100 % de cobertura (umbral de `vite.config.ts`).

**Pendiente**

- **T154 (piloto de mutación, parcial)**: Stryker no produce resultados válidos en este proyecto. Con el runner de Vitest por proyectos, la cobertura por prueba no llega a los mutantes (`covered 0`), y la ejecución completa agota el tiempo inicial. La configuración (`stryker.config.mjs`) carga el plugin explícitamente, pero la integración no está resuelta. Hace falta investigarla antes de dar el piloto por hecho. Intento acotado (2026-10-12): con una configuración de Vitest de un solo proyecto (unitarias, 46 pruebas) y con la selección por relación desactivada (426 pruebas), el resultado es el mismo: ningún mutante recibe pruebas (`Ran 0.00 tests per mutant`) y todo queda como vivo. El problema está en el runner de Stryker con este setup, no en el número de proyectos ni en la selección. Queda pendiente una investigación dedicada o una alternativa; no se ha cambiado ninguna configuración.
- **Composición**: `pricing` y `alerts` todavía no están cableados en `composition.ts`; los necesita L07 (cobro del chat).
- **Tarea `fx-ecb` (L14)** y **interfaz del valor manual (L13)**: fuera de este lote.

**Verificación**: `pnpm validate` completo, código 0 (2155 ficheros sin problemas; 519 pruebas; ramas 83,86 %; 53 E2E). Cobertura del 100 % en `domain/` de créditos, precios y notificaciones. Arquitectura, 17 pruebas, en verde.

**Incidencias**: la prueba de migraciones fijaba 24 tablas; con `alerts_state` son 25 y se actualizó. El cuerpo del piloto de mutación (Stryker) falló en la configuración de la integración con Vitest por proyectos, descrito arriba.

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
