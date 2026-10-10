# Constitución de Cuenta Mardomingo (mardomingo-backoffice)

Marco innegociable del backend multi-app de IA «Cuenta Mardomingo»: API `api.mardomingo.com`, web
`cuenta.mardomingo.com`, paneles de usuario y de administración. Toda especificación, plan, tarea
e implementación posterior DEBE cumplirla. La especificación funcional vive en `Historias.md`; esta
constitución fija **cómo** se construye.

Las palabras DEBE, NO DEBE y PROHIBIDO indican obligación. DEBERÍA indica una recomendación fuerte
que solo se puede incumplir dejando la justificación por escrito en el plan
(sección «Complexity Tracking»).

## Principios fundamentales (Core Principles)

### I. Integridad del dinero (NO NEGOCIABLE)

El saldo de los usuarios es dinero real. Ningún atajo justifica ponerlo en riesgo.

- Todos los importes se almacenan y operan como **enteros**: créditos en microcréditos (µc), euros
  en céntimos y USD en micro-USD. PROHIBIDO usar `number` con decimales o `float`/`REAL` de SQLite
  para importes.
- Los parámetros decimales de la tarificación (margen, comisiones, colchón y tipo de cambio) se
  almacenan como enteros escalados ×1.000.000 (ppm). La fórmula de cobro (BE-FR-19) se calcula con
  `BigInt` y redondea con `ceil` solo en el paso final a µc. Los decimales solo existen en la capa
  de presentación, con las reglas de redondeo de BE-FR-22.
- Todo valor monetario que cruce una frontera (BD → código, código → JSON) DEBE comprobarse con
  `Number.isSafeInteger`; si no lo es, se lanza un error y la operación no continúa.
- Toda escritura que afecte a saldo, bolsas, deuda, reservas o ledger se ejecuta en **una única
  transacción `BEGIN IMMEDIATE`** de SQLite. Como `better-sqlite3` es síncrono, la función de la
  transacción NO DEBE contener `await` ni llamadas de red: las llamadas a proveedores ocurren
  **fuera** de la transacción, entre la reserva y el cobro (sección 8 de `Historias.md`).
- `credit_movements`, `admin_audit`, `invoices` y `prompt_templates` son **solo de inserción**: el
  código NO DEBE contener `UPDATE` ni `DELETE` sobre ellas, salvo la anonimización legal de BE-FR-07
  y BE-FR-83, que se hace en funciones dedicadas y testeadas.
- El saldo materializado DEBE poder reconstruirse desde el ledger. Existe un test y una tarea
  diaria que lo comprueban (BE-FR-15).
- La acreditación de pagos, la emisión de facturas y las operaciones de IA son **idempotentes**
  (BE-FR-24, BE-FR-75, BE-FR-81), con restricciones `UNIQUE` en la BD, no solo en el código.

### II. Privacidad por diseño (NO NEGOCIABLE)

- PROHIBIDO persistir el contenido de los usuarios (textos, prompts, variables, audios, imágenes y
  resultados de IA) en la BD, en logs, en trazas de error o en ficheros que sobrevivan a la
  petición (BE-FR-38). Los temporales se borran en un `finally`.
- Los errores de proveedores se **sanean** antes de registrarse o devolverse, sin contenido, sin
  nombres de modelo y sin datos internos.
- Toda llamada a OpenRouter incluye `data_collection: "deny"` (BE-FR-33). El cliente nunca ve ni
  elige el modelo ni el proveedor.
- Servidor, BD y backups residen en la **UE**. Solo cookies técnicas. PROHIBIDAS la analítica de
  terceros, las fuentes, los scripts y los CDN externos en la web (todo se sirve desde el propio
  dominio), salvo Cloudflare Turnstile en el registro.
- Los plazos de retención de BE-FR-83 se aplican de forma automática. Ningún dato personal se
  conserva más allá de su plazo.
- Los datos de producción NUNCA se copian a staging ni a desarrollo.

### III. Seguridad por defecto (NO NEGOCIABLE)

- La autenticación se hace **solo con Better Auth**, con sesiones opacas en BD. PROHIBIDO
  implementar hashing de contraseñas, sesiones o tokens propios, y PROHIBIDOS los JWT de sesión.
- **Toda entrada externa** (cuerpo, query, cabeceras, formularios, webhooks, respuestas de
  proveedores y JSON de la BD) se valida con un esquema **Zod** antes de usarse.
- Los secretos solo se leen de variables de entorno, según la sección «Configuración y variables
  de entorno»: si falta alguno o es inválido, el proceso no arranca. PROHIBIDO commitear
  secretos. Cada entorno usa claves distintas.
- Respuestas anti-enumeración en registro, login, recuperación y cambio de email (BE-FR-01, 03 y
  66).
- La web aplica CSP estricta (`kit.csp`), HSTS, cookies `Secure`/`HttpOnly`/`SameSite=Lax` y la
  protección CSRF de SvelteKit. La API aplica CORS por app (BE-FR-65).
- La autorización se comprueba en el servidor y en cada endpoint o acción: rol, propiedad del
  recurso y pertenencia de la sesión a la app de `X-App-Id`. La interfaz no es una barrera de
  seguridad.
- El CI falla si `pnpm audit --prod` detecta vulnerabilidades de severidad alta o crítica.

### IV. Arquitectura por capas y separación de responsabilidades

El código de servidor se organiza en capas con dependencias en una sola dirección
(presentación → aplicación → dominio; la infraestructura implementa los puertos del dominio):

| Capa | Ubicación | Reglas |
|---|---|---|
| Dominio | `src/lib/server/domain/` | Funciones puras: tarificación, consumo de bolsas, reservas, deuda, estimación de coste, validación del documento de sincronización y reglas de idempotencia. **Sin I/O**: no importa SvelteKit, Drizzle, `fetch`, `Date.now()` ni `process.env`. El tiempo y la configuración entran como parámetros. |
| Aplicación (servicios) | `src/lib/server/services/` | Casos de uso: orquestan dominio, repositorios y adaptadores, y definen los límites de transacción. Sin conocimiento de HTTP. |
| Infraestructura | `src/lib/server/db/`, `src/lib/server/adapters/` | Esquema Drizzle, repositorios y adaptadores de proveedores (IA, pagos, facturación, email, tipo de cambio, captcha, reloj). Cada proveedor externo se usa **solo** a través de una interfaz (`PaymentsProvider`, `InvoicingProvider`, `EmailSender`, `AiGateway`, `FxSource`, `Clock`…) con una implementación real y una falsa para tests. |
| Presentación | `src/routes/`, `src/lib/components/` | `+server.ts`, `+page.server.ts` y componentes. Solo analizan la entrada (Zod), llaman a un servicio y serializan la salida. PROHIBIDA la lógica de negocio en rutas y componentes. |

- Todo el código de servidor vive bajo `$lib/server` (SvelteKit impide importarlo desde el cliente).
- Los componentes `.svelte` no acceden a la BD ni calculan importes; reciben datos ya calculados.
- Las tareas programadas son finas: invocan servicios y no contienen lógica propia.

### V. Test-first y cobertura mínima (NO NEGOCIABLE)

- **TDD obligatorio** (rojo → verde → refactor) en los módulos críticos: tarificación, bolsas,
  reservas, deuda, caducidad, ledger, pagos, facturación, idempotencia, límites, antiabuso y
  validación de sincronización. El test que falla se escribe y se ve fallar **antes** de la
  implementación.
- **Cobertura mínima**, comprobada por Vitest en el CI (el CI falla si no se alcanza):
  - **100 %** de líneas, ramas, funciones y sentencias en `src/lib/server/domain/**`.
  - **80 %** de líneas, ramas, funciones y sentencias en el conjunto del proyecto.
  - Las exclusiones (`/* v8 ignore */`) solo se permiten con un comentario que las justifique.
- Los tests de integración usan **SQLite real** (fichero temporal con WAL) y migraciones reales.
  PROHIBIDO simular la BD con mocks.
- Los tests NUNCA llaman a proveedores reales (IA, pagos, email, BCE o Turnstile): usan las
  implementaciones falsas de los adaptadores.
- Son obligatorios todos los tests de la sección 10.4 de `Historias.md`, incluidos los de
  **concurrencia** (N peticiones simultáneas sobre el mismo saldo), los de **aislamiento entre
  apps** y la validación de respuestas contra el **OpenAPI**.
- Cada endpoint tiene tests de sus códigos de error documentados (sección 7.2).
- Cada página de la web tiene un test E2E (Playwright) del recorrido principal y una comprobación
  automática de accesibilidad (principio IX).
- Un bug corregido lleva un test de regresión que lo reproduce.

### VI. Contrato de API primero

- Los esquemas **Zod** son la fuente única de verdad: de ellos se derivan los tipos TypeScript, la
  validación en tiempo de ejecución y el documento **OpenAPI 3.1** (`zod-openapi`) publicado en
  `/api/v1/openapi.json`.
- Antes de implementar un endpoint se define su esquema de petición, de respuesta y de errores.
- Todas las respuestas de error usan el formato `{ error: { code, message, details } }` y solo los
  códigos de la tabla 7.2. Un código nuevo exige actualizar la especificación.
- La API se versiona por ruta. Un cambio incompatible exige `/api/v2` y mantener `/api/v1` durante
  la transición. Son incompatibles: eliminar o renombrar campos, cambiar tipos o semántica y
  añadir campos obligatorios en la petición.
- Los importes en la API son enteros en µc con sufijo `Micro`. Las fechas, ISO 8601 en UTC.

### VII. Plataforma multi-app desde el núcleo

- El núcleo NO DEBE contener código específico de ninguna app. Lo propio de una app (operaciones,
  esquema de sincronización, predeterminados, límites de audio) son **datos** (registro de apps,
  catálogo de operaciones y `settings_overrides`), y el perfil `secretario` se crea con un *seed*
  de datos, no con ramas `if (app === 'secretario')`.
- Todo dato dependiente de la app lleva `app_id`. Los datos de la cuenta (saldo, bolsas, pagos,
  facturas, datos fiscales y aceptaciones) no lo llevan, salvo como dato informativo
  (`Historias.md` 4.3).
- Toda consulta sobre datos de una app se filtra por `app_id` y `user_id` en el repositorio, no en
  la ruta. Hay tests de aislamiento entre apps.

### VIII. Todo configurable sin redesplegar

- Ningún parámetro de la sección 9 de `Historias.md` se escribe en el código. Se leen de `settings`
  (o del registro de apps y del catálogo de operaciones) a través de un único servicio de
  configuración tipado y validado con Zod, que resuelve la herencia global → app → operación.
- Los valores por defecto viven en un único módulo de *seed* y se muestran en el panel
  (BE-FR-61 CA4).
- Cada cambio se valida (tipos, rangos y coherencia) y queda en `admin_audit` con el valor anterior
  y el nuevo.
- Solo son variables de entorno los secretos y la infraestructura que enumera la sección 9.

### IX. Accesibilidad y usabilidad (WCAG 2.2 AA)

Accesibilidad:

- Toda la web (landings, páginas legales, registro, panel de usuario y panel de administración) y
  los emails cumplen **WCAG 2.2 nivel AA**.
- HTML semántico primero: `button` para acciones, `a` para navegación, encabezados jerárquicos,
  *landmarks* y tablas con `th`/`scope`/`caption`. ARIA solo cuando el HTML no basta.
- Todo es usable **solo con teclado**: foco visible (contraste ≥ 3:1), orden lógico, enlace
  «Saltar al contenido», sin trampas de foco, y los diálogos gestionan y devuelven el foco.
- Contraste ≥ 4,5:1 en texto y ≥ 3:1 en componentes y gráficos, **en ambos temas**.
- Los formularios tienen `label` visible y asociado, errores en texto junto al campo, enlazados con
  `aria-describedby` y anunciados (`aria-live`), y `autocomplete` correcto. El color nunca es el
  único indicador.
- Las gráficas (LayerChart) tienen un título descriptivo y una **tabla de datos equivalente**
  accesible.
- Se respeta `prefers-reduced-motion`. La interfaz funciona con zoom al 200 % y con una anchura de
  320 px sin desplazamiento horizontal.
- Los componentes interactivos complejos (diálogos, menús, pestañas, combobox) siguen los patrones
  de la WAI-ARIA Authoring Practices Guide; como no hay librería de componentes, cada uno lleva sus
  tests de teclado.
- Verificación: `eslint-plugin-svelte` (reglas a11y) sin avisos y `@axe-core/playwright` con
  **cero violaciones** `serious` o `critical` en cada página y en cada tema.

Usabilidad:

- Diseño *mobile-first* y adaptable. Tema claro y oscuro: por defecto sigue
  `prefers-color-scheme`, con selector manual guardado en una cookie técnica.
- **Mejora progresiva**: todos los formularios funcionan sin JavaScript (form actions de SvelteKit
  con `use:enhance`). Solo las gráficas pueden requerir JavaScript, y su tabla equivalente no.
- Todo el texto visible está en español y sale de los mensajes de **Paraglide**. PROHIBIDO el texto
  visible *hardcodeado* en componentes, servidores o emails.
- Los mensajes de error explican qué ha pasado y qué puede hacer el usuario, sin jerga técnica.
- Las acciones destructivas o irreversibles (borrar la cuenta, reembolsos, ajustes de saldo,
  bloqueos) piden confirmación explícita y, cuando la especificación lo indica, la contraseña.
- Los importes se muestran siempre con las reglas de redondeo de BE-FR-22 y el formato español
  (coma decimal, punto de miles). Al usuario nunca se le muestran modelos ni costes reales.

### X. Simplicidad operativa

- **Una sola instancia** por entorno, **SQLite** como única BD y tareas programadas **dentro del
  proceso**. PROHIBIDO añadir Redis, colas, otra BD, microservicios o *workers* externos sin
  enmendar esta constitución.
- Dependencias mínimas: cada dependencia de producción nueva se justifica en el plan (para qué
  sirve, por qué no basta la plataforma y cuál es su mantenimiento). Se prefieren las APIs nativas
  de Node 24 y de la plataforma web.
- YAGNI: no se construye nada que no exija `Historias.md`. Lo «preparado para el futuro» (Stripe,
  OAuth y apps móviles) se limita a interfaces y modelo de datos, sin implementaciones
  especulativas.

### XI. Registro y diagnóstico sin contenido

**Propósito.** Los logs sirven para diagnosticar fallos y reconstruir el recorrido de una petición.
**No** son el registro de auditoría: el dinero, las operaciones y las acciones del administrador se
reconstruyen desde la BD (`credit_movements`, `ai_operations`, `payments`, `admin_audit`). Nadie
debe dar por hecho que un log existe para siempre: se pueden perder eventos si el Gateway cae y
Docker rota sus ficheros, o si el proceso se cae antes de vaciar el búfer.

**Una API de registro por capa**

- Servidor: `pino` (dependencia de producción, no de desarrollo) detrás de un puerto `Logger`
  propio, en `$lib/server/logging/`. Solo ese módulo importa `pino`.
- Navegador: `loglevel` detrás de `$lib/logging/client.ts`. Solo ese módulo importa `loglevel`.
- Comparten únicamente los tipos y el catálogo de códigos de evento; ninguna biblioteca de
  servidor llega al bundle del cliente. ESLint lo comprueba con `no-restricted-imports` y
  `no-console` (salvo en los módulos de logging).
- El **dominio no registra nada**: es puro. Los servicios reciben el `Logger` por parámetro, ya
  enriquecido con el contexto de la petición.

**Eventos**

- Cada línea tiene un `event` con código estable `dominio.objeto.resultado` (p. ej.
  `credits.hold.rejected`) y un `msg` fijo tomado del catálogo. PROHIBIDO construir mensajes con
  datos.
- La firma del logger está tipada por evento: cada código solo admite sus campos (lista permitida
  comprobada en compilación).
- **Campos permitidos:** `time`, `level`, `event`, `msg`, `schema`, `service`, `env`, `version`,
  `requestId`, `appId`, `userId`, `sessionId`, `operationId`, `operation`, `route` (id de la
  ruta, nunca la URL con su query), `method`, `httpStatus`, `status`, `errorCode`, `reason`,
  `durationMs`, `attempt`, `count`, `provider`, `model`, `task` y `err` (serializado según
  «Un error, un registro»). Solo identificadores, códigos y recuentos.
- **Prohibido:** contenido de usuario (cuerpos de `/ai/*` y `/sync` incluidos), emails, nombres,
  **IP**, datos fiscales, importes, fechas de negocio, valores de formulario, textos libres
  (motivos del administrador incluidos), contraseñas, tokens, cookies, cabeceras
  `Authorization`/`Cookie`, claves e `Idempotency-Key`.
- `sessionId` es el id de la fila de sesión, **nunca** el token.
- Además, `pino.redact` actúa como segunda barrera sobre rutas sensibles conocidas. Mantener un
  dato para diagnosticar nunca justifica registrar un secreto.

**Niveles**

- `fatal`: el proceso no puede seguir (configuración inválida, BD o migración fallida).
- `error`: fallo técnico que requiere atención (excepción no controlada, todos los proveedores
  caídos, discrepancia del ledger, tarea fallida, JSON corrupto en la BD).
- `warn`: modo degradado o *fallback* (modelo de respaldo, backup de transcripción, coste
  estimado, tipo de cambio antiguo, email no enviado, freno global, eventos descartados por el
  Gateway) y señales de abuso.
- `info`: ciclo de vida, una línea por petición terminada (`http.request.completed`),
  operaciones completadas y **rechazos de negocio esperados** (saldo, límites, conflicto de
  sincronización, validación), siempre con `reason`.
- `debug`: transiciones intermedias y reintentos.
- `LOG_LEVEL`: `info` en producción, `debug` en staging y desarrollo. `/health` se registra en
  `debug`.
- Un rechazo de negocio **nunca** es `error`.

**Un error, un registro**

- Las capas lanzan errores tipados con código; solo la frontera los registra (el hook
  `handleError` o el envoltorio de la tarea programada). PROHIBIDO registrar y relanzar.
- Los reintentos van en `debug` y el resultado final se registra una vez.
- Los errores se serializan con un serializador propio: `type`, `code` y, si el error es interno,
  el `stack`. El `message` de errores de bibliotecas o proveedores **no** se registra, porque
  puede contener contenido del usuario.

**Ciclo de vida**

- `app.started` incluye versión, commit, versión de Node, `APP_ENV`, proveedores activos (solo
  sus nombres), versión de las migraciones y reservas liberadas al arrancar. Nunca valores de
  configuración ni credenciales.
- `app.stopping` se registra al recibir SIGTERM, y se vacía el búfer en 5 s como máximo.

**Correlación**

- El servidor genera un `requestId` (UUID) por petición y lo devuelve en la cabecera
  `X-Request-Id`. La página de error de la web lo muestra como «Código de referencia». Una
  cabecera `X-Request-Id` entrante se ignora. El `requestId` no se añade al cuerpo JSON de los
  errores (el contrato de 7.1 no cambia).
- `operationId` enlaza el log con `ai_operations`.
- Se usa `time` en ISO 8601 UTC con milisegundos.

**Destinos**

- Siempre: JSON por stdout. Es la copia que conserva Docker con rotación.
- Staging y producción: además, un *transport* de Pino en un *worker thread* envía lotes al **Log
  Gateway** (delante de OpenObserve) como servicio `mardomingo_backoffice`, con `env` =
  `APP_ENV`. Usa una clave propia de **solo escritura**, limitada a ese servicio.
- El búfer está acotado. Si el Gateway falla, el envío no bloquea las peticiones: descarta los
  eventos más antiguos y registra en stdout `log.gateway.dropped` con el recuento.
- Desarrollo: JSON en `.logs/app.log` (ignorado por Git y vaciado en cada arranque) y consola
  legible con `pino-pretty` (solo dependencia de desarrollo), con la hora en `Europe/Madrid`. El
  formato legible nunca sustituye al JSON.

**Cliente (navegador)**

- `loglevel` registra en `warn` en producción y en `debug` en desarrollo. El nivel llega en los
  datos del layout raíz, nunca leyendo `$env` desde el cliente.
- Los errores no capturados se envían a `POST /client-errors`, una ruta interna de la web y no de
  `/api/v1`, con esquema estricto y como máximo 4 KB. Solo se envía:
  - `name` del error;
  - `fingerprint`, un hash de nombre + mensaje + primera línea de la pila, calculado en el
    navegador;
  - las líneas de la pila que pertenecen al propio bundle, sin query;
  - `routeId`, `version` y un recuento.
- **El mensaje del error no sale del navegador.** Los *sourcemaps* se generan ocultos (no se
  sirven) para poder traducir esas líneas.
- El endpoint tiene un límite de frecuencia en memoria por sesión o visitante y uno global.
  Cuando se supera responde `204` sin registrar nada, y lo aceptado se registra como
  `client.error.reported` (`warn`).

**Retención y acceso**

- OpenObserve conserva los logs 30 días (BE-FR-83) y los consulta solo el propietario, a través
  del Gateway.
- La retención se configura en OpenObserve o en el Gateway, no en la app. Se verifica, igual que
  la rotación de los logs de Docker en el host, en cada cambio de infraestructura.

**Catálogo y alertas**

- Cada plan (`/speckit-plan`) incluye un **catálogo de eventos** de la funcionalidad: código,
  nivel, campos y cuándo se emite. Los catálogos se reúnen en `$lib/logging/events.ts`, que es
  la fuente única.
- `/health` comprueba la BD. Las alertas al administrador son las de la sección 5.13 y no se
  repiten por el mismo cruce de umbral (`alerts_state`).

### XII. Validación en las fronteras

Todo dato no confiable se valida con **Zod** al cruzar una frontera, y solo ahí.

- **Fronteras de este proyecto**: cuerpos JSON de `/api/v1/*`; multipart de `/ai/transcribe`;
  cabeceras (`X-App-Id`, `X-App-Version`, `X-Device-Name`, `Idempotency-Key`, `If-Match`); query
  y parámetros de ruta; form actions de la web; webhooks de pagos; respuestas de OpenRouter,
  Mistral, BCE, Turnstile, Resend y GitHub; columnas JSON de la BD; cookies (tema); variables de
  entorno.
- **Tipos inferidos del esquema**: `z.input` para lo que llega y `z.output` para lo ya
  normalizado. Los servicios que reciben datos de consulta aceptan `z.input` y normalizan dentro
  con `Esquema.parse`. PROHIBIDO usar aserciones de tipo (`as`, `!`, `as unknown as`) en lugar de
  validar: ESLint aplica `strictTypeChecked` y `consistent-type-assertions`
  (`assertionStyle: "never"`). La única excepción es el módulo de constructores de tipos
  *branded*.
- **Tres responsabilidades separadas**:
  - El esquema valida **forma** y es puro: sin I/O ni `refine` asíncronos.
  - Las **reglas de negocio** (operación activa, saldo, revisión de sincronización, unicidad)
    viven en los servicios.
  - La **autorización** (sesión ligada a la app, rol, propiedad del recurso) vive en guardas o
    hooks.
  - Superar un esquema no concede permisos ni garantiza la consistencia de los datos.
- **Estricto o tolerante**:
  - `z.strictObject` en las entradas de la API, en los formularios y en el `load` de la página
    que es dueña de sus parámetros: una clave desconocida se rechaza.
  - `z.object` en el `load` de los **layouts**, que reciben la query de la página hoja. Un test
    de arquitectura impide `strictObject` en los `+layout.server.ts`.
  - `z.object` en las **respuestas de proveedores externos**, que añaden campos sin avisar. Solo
    se valida lo que se usa.
- **Errores**:
  - Un fallo de validación produce `400 VALIDATION_ERROR` con `details.field` (la ruta del primer
    error) y un mensaje en español procedente de Paraglide, mediante `z.config({ customError })`.
  - PROHIBIDO incluir el valor recibido (`reportInput`) en respuestas, logs o errores: en `/ai/*`
    y `/sync` sería contenido del usuario.
  - Una respuesta inválida de un proveedor produce `PROVIDER_ERROR` saneado y un evento en el log
    sin contenido.
- **Esquemas dinámicos** con fábricas puras: el documento de sincronización a partir del
  `sync_schema` de la app, las variables a partir de la plantilla y los límites de tamaño a partir
  de la configuración efectiva. Se cachean por app y versión. El OpenAPI documenta los valores por
  defecto.
- **Sin revalidación interna**: lo que ya pasó por una frontera viaja tipado entre capas. Las
  columnas tipadas de Drizzle no se revalidan. Las columnas JSON sí, **al leerlas**: si una está
  corrupta, se rechaza de forma controlada, se registra un evento y no se modifica el dato.
- **Formularios**:
  - Los campos repetidos (`roles=a&roles=b`) se declaran con un esquema reutilizable que
    normaliza siempre a lista (`z.union([item, z.array(item)]).optional().transform(...)`).
  - La cadena vacía se convierte en `undefined` antes de validar; las casillas, en booleano.
  - Un `transform` seguido de `pipe` fija su tipo de retorno con `z.input<typeof Destino>`.
- **Números e importes**:
  - PROHIBIDO `z.coerce.number()` en importes y en entradas de usuario: en español `"1.000"` da
    1, `"1,5"` da `NaN` y `""` da 0. Los importes del panel usan un esquema propio de texto
    decimal español a entero escalado (principio I).
  - Los enteros de la API usan `z.int()` (entero seguro) con `nonnegative()` o `positive()` cuando
    proceda. `If-Match` se valida como texto de solo dígitos.
  - `Idempotency-Key` se valida con `z.uuid()`.
- **Ficheros**: el audio se valida con `z.file()` (tamaño máximo según la configuración). El MIME
  declarado no es una prueba: la verificación real la hace ffprobe (BE-FR-44).
- **Fechas**: los esquemas de entrada aceptan el formato visible (`dd/mm/aaaa`) y el ISO, y
  devuelven los tipos de fecha del proyecto (sección «Datos y almacenamiento»), nunca `Date`.
- Los esquemas compartidos entre servidor y cliente viven en `$lib/schemas` y no importan código
  de servidor. El servidor valida siempre, aunque el cliente también valide.

## Orden de prioridades

Cuando dos objetivos entren en conflicto, prevalece el primero de esta lista. La decisión y su
justificación se anotan en el plan.

1. **Integridad del dinero**: saldo, ledger, cobros y pagos correctos.
2. **Privacidad**: no guardar contenido y minimizar los datos.
3. **Seguridad**.
4. **Simplicidad operativa**: una instancia, SQLite y pocas dependencias.
5. **Accesibilidad y usabilidad**.
6. **Rendimiento**.
7. **Velocidad de entrega** de funcionalidades.

## Stack tecnológico y versiones

Versiones **fijadas exactamente** (`save-exact`, sin `^` ni `~`) y verificadas en el registro de
npm el 2026-10-10. Su uso es obligatorio; sustituir una pieza por otra exige enmendar esta
constitución.

### Entorno de ejecución y herramientas base

| Pieza | Versión | Notas |
|---|---|---|
| Node.js | **24.21.0** (LTS «Krypton») | `engines.node: ">=24.21.0 <25"`. Node 26 no se usa hasta que sea LTS y se enmiende esta tabla. |
| Imagen Docker | `node:24.21.0-trixie-slim` | Debian 13; incluye ffmpeg del repositorio de Debian. |
| ffmpeg / ffprobe | **7.1.x** (paquete de Debian 13 «trixie») | Medición de la duración del audio (BE-FR-44). |
| pnpm | **12.8.1** | Campo `packageManager` en `package.json`. `pnpm-lock.yaml` versionado; el CI usa `--frozen-lockfile`. |
| TypeScript | **6.0.3** | `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. TypeScript 7 queda excluido porque SvelteKit 2, svelte-check y typescript-eslint no lo admiten todavía. |
| Litestream | **0.5.17** | Replicación continua a Backblaze B2 (región UE). |

### Aplicación

| Pieza | Paquete | Versión |
|---|---|---|
| Framework | `@sveltejs/kit` | **2.70.3** |
| Adaptador | `@sveltejs/adapter-node` | **5.5.7** |
| UI | `svelte` | **5.57.2** (modo *runes* obligatorio; PROHIBIDA la sintaxis heredada de Svelte 4: `export let`, `$:`, `on:`) |
| Plugin de Vite | `@sveltejs/vite-plugin-svelte` | **7.3.1** |
| Bundler | `vite` | **8.3.4** |
| CLI de andamiaje | `sv` | **1.1.1** |
| BD (driver) | `better-sqlite3` / `@types/better-sqlite3` | **13.0.3** / **9.6.0** |
| ORM | `drizzle-orm` / `drizzle-kit` | **0.45.4** / **0.31.11** (no se usan las versiones 1.0 beta ni rc) |
| Autenticación | `better-auth` | **1.7.7** (plugins `bearer`, `admin` y `captcha`; adaptador Drizzle) |
| Validación | `zod` | **4.6.5** |
| OpenAPI | `zod-openapi` | **6.0.2** |
| i18n | `@inlang/paraglide-js` | **2.27.0** (solo `es`) |
| Estilos | `tailwindcss` / `@tailwindcss/vite` | **4.3.3** / **4.3.3** |
| Gráficas | `layerchart` | **2.6.1** |
| Email | `resend` | **6.32.1** |
| Tareas programadas | `croner` | **10.0.1** (zona `Europe/Madrid` explícita en cada tarea) |
| Logs del servidor | `pino` | **10.4.0** (en `dependencies`) |
| Logs del navegador | `loglevel` | **1.9.2** |

No se usa ninguna librería de componentes de UI: los componentes son propios, sobre Tailwind
(ver principio IX).

### Calidad y tests

| Pieza | Paquete | Versión |
|---|---|---|
| Tests unitarios y de integración | `vitest` / `@vitest/coverage-v8` | **5.0.3** / **5.0.3** |
| Tests de componentes | `@testing-library/svelte` / `@testing-library/jest-dom` / `jsdom` | **5.4.2** / **7.0.1** / **30.1.2** |
| E2E | `@playwright/test` | **1.64.0** |
| Accesibilidad automática | `@axe-core/playwright` | **4.13.0** |
| Comprobación de tipos | `svelte-check` | **4.7.6** |
| Lint | `eslint` / `@eslint/js` / `typescript-eslint` / `eslint-plugin-svelte` / `eslint-config-prettier` / `globals` | **10.12.0** / **10.0.1** / **8.71.1** / **3.23.1** / **10.1.8** / **17.13.0** |
| Formato | `prettier` / `prettier-plugin-svelte` / `prettier-plugin-tailwindcss` | **3.9.9** / **4.1.1** / **0.8.1** |
| Tipos de Node | `@types/node` | **24.19.2** |
| Logs legibles en desarrollo | `pino-pretty` | **13.2.0** |

### Servicios externos

| Servicio | Uso |
|---|---|
| Coolify | Despliegue (entornos `production` y `staging`). |
| Backblaze B2 (EU Central) | Destino de Litestream. Bucket privado y clave limitada a ese bucket. |
| Log Gateway + OpenObserve | Logs y monitorización (servicio `mardomingo_backoffice`). Retención de 30 días. |
| Resend | Emails transaccionales; dominio con SPF, DKIM y DMARC. |
| Cloudflare Turnstile | Captcha del registro. |
| Mistral API | Voxtral (`voxtral-mini-latest`) para transcripción. |
| OpenRouter API v1 | Texto, imagen y respaldo de audio. |
| BCE | Tipo de referencia diario EUR/USD. |
| GitHub + GitHub Actions | Repositorio privado `mardomingo-backoffice` y CI. |

### Política de actualización

- **Parches**: PR propio con el CI en verde. No requieren enmienda.
- **Menores**: PR propio con el CI en verde y revisión de las notas de versión. Actualizan esta
  tabla con una enmienda PATCH.
- **Mayores**: enmienda MINOR de esta constitución, con justificación y plan de migración probado
  en staging.
- **Migración prevista**: SvelteKit 3 / adapter-node 6, cuando `better-auth` declare
  compatibilidad con `@sveltejs/kit@^3`. Hasta entonces, PROHIBIDA.

## Datos y almacenamiento

- **SQLite** es la única BD, en un fichero sobre volumen persistente, abierto con
  `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000` y `synchronous=NORMAL`.
- El esquema se define **solo** con Drizzle. Las migraciones generadas con `drizzle-kit generate`
  se versionan en el repositorio y no se editan después de aplicarse en un entorno. PROHIBIDO
  `drizzle-kit push` contra staging o producción.
- Las migraciones se aplican al arrancar, después de un backup. Se prueban primero en staging. Una
  migración destructiva (borrar columnas o tablas) requiere una migración previa de compatibilidad
  y un despliegue intermedio.
- **Tipos de fecha del proyecto** (sin dependencias nuevas):
  - Instantes: `EpochMs`, un entero de milisegundos UTC con *brand*.
  - Fechas de calendario: `CivilDate`, texto `YYYY-MM-DD` con *brand*, interpretado en
    `Europe/Madrid`.
  - Las conversiones viven en un único módulo de fechas y los cortes diarios usan `Intl` a través
    del adaptador `Clock`.
  - `Date` solo se permite en la capa de infraestructura, donde lo exigen Drizzle o Better Auth, y
    se convierte a `EpochMs` al salir de ella. PROHIBIDO `Date` en el dominio, los servicios y los
    esquemas de la API.
  - En la API, los instantes se serializan en ISO 8601 UTC y las fechas de calendario como
    `YYYY-MM-DD`.
- Las columnas JSON (`settings`, `sync_documents.data`, configuraciones de apps y operaciones)
  tienen un esquema Zod y se validan al leer y al escribir.
- Las restricciones de integridad (`UNIQUE`, `FOREIGN KEY`, `CHECK` de importes no negativos donde
  proceda) se declaran en la BD, no solo en el código.
- Los backups son continuos con Litestream, con retención de 30 días. El procedimiento de
  restauración está documentado y se prueba antes del lanzamiento público y después de cada cambio
  de infraestructura.

## Configuración y variables de entorno

### Acceso y validación

- Se usa la API estable de SvelteKit 2: **`$env/dynamic/private`** en el servidor. PROHIBIDO
  `$env/static/private` para secretos, porque copiaría su valor en el build y en la imagen
  Docker. El prefijo `PUBLIC_` solo para valores no sensibles; ningún secreto lo lleva.
  `kit.experimental.explicitEnvironmentVariables` no se activa.
- Un único módulo, `$lib/server/config/env.ts`, lee el entorno. Ningún otro módulo importa
  `$env/*` ni lee `process.env`; un test de arquitectura lo comprueba. Así la migración a
  SvelteKit 3 (que elimina `$env/*` en favor de `defineEnvVars`) afecta a un solo fichero.
- El esquema vive en `$lib/server/config/env-schema.ts`, sin imports de SvelteKit, para que las
  herramientas de Node externas al runtime (`drizzle.config.ts`, scripts de seed y de
  mantenimiento) lo reutilicen pasándole `process.env`. Esas herramientas no importan `$env`.
- **Cuándo se valida**: en el hook `init` de `hooks.server.ts`, protegido con `building` de
  `$app/environment`. PROHIBIDO validar o abrir la BD al nivel superior de un módulo: el análisis
  del build importa los módulos de servidor y el build del CI no tiene secretos. Si hubiera
  páginas prerenderizadas, `init` también se ejecuta en el build y `building` lo evita.
- **Si falta configuración**: el proceso termina con código distinto de 0 y un error que
  enumera **los nombres** de las variables ausentes o inválidas, nunca sus valores.
- **Coherencia entre variables**, comprobada por el esquema:
  - En la v4 se rechazan `PAYMENTS_PROVIDER=stripe` e `INVOICING_PROVIDER` distinto de `none`.
  - Con `APP_ENV=production` se rechazan las claves de prueba de Turnstile y los valores de
    ejemplo de `.env.example`.
  - Al arrancar, tras abrir la BD, se comprueba que `BODY_SIZE_LIMIT` es mayor o igual que el
    mayor `max_audio_mb` configurado en cualquier app.
- Los servicios reciben la configuración por parámetro; los tests no leen el entorno.
- `.env` está en `.gitignore`. Se versiona `.env.example` con **todas** las variables, valores
  de ejemplo no sensibles y un comentario que indica si cada una es secreta.
- **Cómo recibe el proceso las variables**: en desarrollo, Vite carga `.env`. En staging y
  producción, Coolify las inyecta al contenedor; adapter-node **no** carga `.env`. Cambiar una
  variable exige reiniciar el contenedor, nunca reconstruir la imagen.
- El código privado vive solo en `src/lib/server/**` o en módulos `*.server.ts`. SvelteKit no
  protege otras carpetas.

### Variables

Además de las que enumera la sección 9 de `Historias.md`:

| Variable | Valor | Notas |
|---|---|---|
| `ADMIN_EMAIL` | Email del administrador | La cuenta que se registra y **verifica** con ese email (normalizado) recibe el rol `admin`. Nunca hay más de una cuenta `admin`: si ya existe otra, no se promueve y se registra un error. Cambiar la variable no retira el rol al anterior; eso exige una acción explícita, auditada. |
| `BETTER_AUTH_URL` y orígenes de confianza | Las URL de `cuenta.` y `api.` del entorno | Better Auth atiende los dos dominios. |
| `PUBLIC_TURNSTILE_SITE_KEY` | Clave pública de Turnstile | No es secreta. |
| `EMAIL_FROM` | Remitente de los emails | Dominio con SPF, DKIM y DMARC. |
| `LOG_LEVEL` | `info` en producción; `debug` en staging y desarrollo | Valores de pino. |
| `CLIENT_LOG_LEVEL` | `warn` en producción; `debug` en desarrollo | No es secreta. Llega al navegador en los datos del layout raíz. |
| `LOG_GATEWAY_URL` | URL de ingesta del Log Gateway | Obligatoria en staging y producción; ausente en desarrollo. |
| `LOG_GATEWAY_KEY` | Clave de **solo escritura** del servicio `mardomingo_backoffice` | **Secreta.** Una por entorno. |
| `PORT` | Producción **7311**, staging **7312** | Ver «Proxy, puerto e IP del cliente». |
| `HOST` | `0.0.0.0` dentro del contenedor | La exposición se limita fuera del contenedor. |
| `PROTOCOL_HEADER` | `x-forwarded-proto` | |
| `ADDRESS_HEADER` | `x-forwarded-for` | |
| `XFF_DEPTH` | `1` | |
| `ORIGIN` | **No se define** | Admite un solo origen y la instancia sirve dos dominios. |

### Proxy, puerto e IP del cliente

- Cadena de proxies: cliente → **Nginx Proxy Manager** (mismo host que Coolify, termina TLS) →
  **directamente al puerto de la app**. Ningún otro proxy intermedio.
- **Puerto no estándar**: la app escucha en **7311** (producción) y **7312** (staging). PROHIBIDO
  usar puertos habituales (80, 81, 443, 3000, 4173, 5173, 5080, 4317, 5432, 6001, 6002, 8000,
  8080, 8443, 9000…), porque en el host hay otras aplicaciones. Antes del primer despliegue se
  comprueba que el puerto está libre en el host (`ss -ltn`). Si estuviera ocupado, se elige otro
  del rango 7300–7399 y se actualiza esta tabla con una enmienda PATCH.
- El puerto de la app **no** debe ser accesible desde fuera del host: solo desde Nginx Proxy
  Manager (cortafuegos o publicación limitada a la interfaz o red que usa Nginx Proxy Manager).
  Si fuera accesible, cualquiera podría saltarse el proxy y falsificar `X-Forwarded-For`.
- Nginx Proxy Manager conserva la cabecera `Host` y añade `X-Forwarded-Proto` y
  `X-Forwarded-For`. Por eso basta con `PROTOCOL_HEADER`, `ADDRESS_HEADER` y `XFF_DEPTH=1`, sin
  `HOST_HEADER` ni `ORIGIN`.
- **Fuente única de la IP del cliente**: `event.getClientAddress()`. Todo límite o registro por
  IP (altas por IP, *rate limit* de autenticación, IP de sesiones y aceptaciones legales) usa esa
  fuente. Better Auth se configura para obtener la IP de forma coherente; nunca debe confiar en
  el valor más a la izquierda de `X-Forwarded-For`, que controla el cliente.
- **Verificación obligatoria en staging** antes de dar por buenos los límites por IP:
  - Se registra la IP real del cliente.
  - `url.origin` es `https://cuenta-staging.mardomingo.com` y los formularios no reciben un 403
    de CSRF.
  - Un `X-Forwarded-For` falsificado por el cliente no cambia la IP registrada.
  - El puerto 7312 no responde desde fuera del host.

## Flujo de desarrollo y puertas de calidad

### Proceso

- Toda funcionalidad sigue el flujo de spec-kit: `/speckit-specify` → `/speckit-clarify` →
  `/speckit-plan` (con la comprobación de esta constitución) → `/speckit-tasks` →
  `/speckit-analyze` → `/speckit-implement`.
- Cada especificación cita los requisitos `BE-FR-XX` de `Historias.md` que cubre.
- Identificadores del código, nombres de tablas y columnas en **inglés**. Documentación, textos
  visibles y mensajes de commit en **español**.
- Commits con **Conventional Commits** (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`).
- Ramas: `main` (despliega a producción), `staging` (despliega a staging) y ramas de trabajo
  `NNN-nombre-corto`, creadas por spec-kit. `main` y `staging` están protegidas: solo se integra
  mediante PR con el CI en verde.

### Scripts estándar

Los mismos comandos se usan en local y en el CI, y se documentan en `CLAUDE.md`:

| Script | Comando |
|---|---|
| `check` | `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings` |
| `lint` | `prettier --check . && eslint . --max-warnings 0` |
| `test` | `vitest run` |
| `test:coverage` | `vitest run --coverage` |
| `test:e2e` | `playwright test` |
| `build` | `vite build` |
| `validate` | `check`, `lint`, `test:coverage`, `build` y `test:e2e`, en ese orden, deteniéndose en el primer fallo |

- `svelte-kit sync` se ejecuta antes de `svelte-check` (y en `prepare`), porque el `tsconfig.json`
  del proyecto extiende el que genera SvelteKit en `.svelte-kit/`.

### Política de errores y avisos

- **Cero errores y cero avisos** en `check` y `lint`. Los avisos del compilador de Svelte
  (incluidos los de accesibilidad) cuentan como avisos.
- Un `svelte-ignore`, `eslint-disable`, `@ts-expect-error` o `v8 ignore` exige un comentario en la
  misma línea que justifique la excepción. PROHIBIDO `@ts-ignore`.
- Los avisos del build de Vite no bloquean, pero se revisan en cada PR y no se acumulan.
- No se ocultan fallos preexistentes ni se rebajan umbrales para que el CI pase.
- Ningún informe, PR o resumen declara una comprobación como pasada sin haberla ejecutado; si
  no se ejecutó, se dice expresamente.

### Puertas del CI (GitHub Actions, en cada PR; todas bloqueantes)

1. `pnpm install --frozen-lockfile`.
2. `pnpm lint`.
3. `pnpm check`.
4. `pnpm test:coverage` con los umbrales del principio V.
5. Validación del OpenAPI generado y tests de contrato.
6. `pnpm test:e2e` (E2E + axe) contra un build de producción con proveedores falsos.
7. `pnpm build` **sin variables de entorno secretas** y build de la imagen Docker.
8. `pnpm audit --prod` sin vulnerabilidades altas ni críticas.
9. Comprobación de que las migraciones están al día con el esquema (`drizzle-kit check` y
   generación sin cambios).

### Definición de terminado

Una tarea está terminada cuando pasa todas las puertas del CI, cumple los criterios de aceptación
(`CA`) de sus requisitos, tiene sus tests escritos según el principio V, sus textos en Paraglide,
su documentación actualizada (incluido el OpenAPI) y, si cambia parámetros o comportamiento
visible, su reflejo en el panel de administración y en la auditoría.

### Despliegue

- Primero se despliega a staging. A producción solo llega lo que se ha validado en staging.
- Despliegue con parada previa: nunca hay dos contenedores escribiendo en el mismo SQLite.

## Gobernanza (Governance)

- Esta constitución **prevalece** sobre cualquier otra práctica, plantilla, especificación, plan o
  tarea. Si `Historias.md` u otro documento técnico la contradice, prevalece la constitución, y la
  contradicción se resuelve enmendando uno de los dos de forma explícita. Por ejemplo, los
  `+server.js` que cita `Historias.md` son `+server.ts` por el principio de TypeScript estricto.
- Cada plan (`/speckit-plan`) incluye la sección «Constitution Check» con el cumplimiento de cada
  principio. Una violación solo se admite si queda justificada en «Complexity Tracking» y es
  compatible con el orden de prioridades. Los principios marcados como NO NEGOCIABLE no admiten
  excepciones.
- `/speckit-analyze` trata cualquier conflicto con esta constitución como hallazgo CRÍTICO.
- **Enmiendas**: las propone el propietario, o la IA a petición suya, mediante
  `/speckit-constitution`, con un informe de impacto. Se aprueban por el propietario y se integran
  por PR. Si afectan a código existente, se acompañan de un plan de migración.
- **Versionado semántico** de la constitución:
  - MAJOR: se elimina o redefine un principio de forma incompatible.
  - MINOR: se añade un principio o una sección, se amplía una regla de forma material o se cambia
    la versión mayor de una pieza del stack.
  - PATCH: aclaraciones, redacción y actualizaciones de versión menores o de parche del stack.
- **Revisión periódica**: al cerrar cada fase (v4, Stripe y fase 2) se revisa la constitución,
  sobre todo la tabla de versiones y la migración pendiente a SvelteKit 3.

**Version**: 1.2.0 | **Ratified**: 2026-10-10 | **Last Amended**: 2026-10-10
