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
- La web aplica CSP estricta (`kit.csp`), HSTS y cookies `Secure`/`HttpOnly`/`SameSite=Lax`.
- **CSRF**: la comprobación de origen de SvelteKit se desactiva, porque rechaza los POST
  `multipart/form-data` sin `Origin` que envían las apps de escritorio a la API. En su lugar,
  `handle` aplica una comprobación equivalente **solo en el host web**: todo POST, PUT, PATCH o
  DELETE con tipo de contenido de formulario debe traer un `Origin` igual al de `PUBLIC_WEB_URL`;
  si no, `403`. El host de la API usa solo el token Bearer y no lee cookies, así que no es
  vulnerable a CSRF; aplica CORS por app (BE-FR-65). Ambas reglas tienen tests HTTP.
- La autorización se comprueba en el servidor y en cada endpoint o acción: rol, propiedad del
  recurso y pertenencia de la sesión a la app de `X-App-Id`. La interfaz no es una barrera de
  seguridad.
- El CI falla si `pnpm audit --prod` detecta vulnerabilidades de severidad alta o crítica.

### IV. Monolito modular por funcionalidades

El código de servidor se organiza **por funcionalidad**, con capas dentro de cada una y
dependencias en una sola dirección (presentación → servicio → dominio; los repositorios y los
adaptadores son infraestructura). El mapa operativo (dónde va cada cosa, flujos y ejemplos) está
en `ARCHITECTURE.md`, y la decisión, en `docs/adr/0005`.

| Ubicación | Contenido y reglas |
|---|---|
| `src/lib/server/features/<funcionalidad>/domain/` | Funciones puras: tarificación, consumo de bolsas, reservas, deuda, estimación de coste, validación del documento de sincronización, reglas de idempotencia… **Sin I/O**: no importa SvelteKit, Drizzle, `better-sqlite3`, `fetch`, `node:*`, `Date.now()`, `new Date()` ni `process.env`. El tiempo y la configuración entran como parámetros. Solo importa `zod`, `$lib/shared/`, `$lib/server/shared/` y su propio `domain/`; nunca otras funcionalidades. |
| `…/<funcionalidad>/service.ts` | Casos de uso: orquestan dominio, repositorios, adaptadores y las API públicas de otras funcionalidades. Sin conocimiento de HTTP. |
| `…/<funcionalidad>/repository.ts` y `schema.ts` | `schema.ts` contiene **solo** las tablas Drizzle de las que la funcionalidad es **dueña**; solo puede importar el `schema.ts` de otra funcionalidad para declarar una clave foránea (`references()`); esas importaciones son declaraciones de la BD y quedan fuera del orden de funcionalidades y del cálculo de ciclos. `repository.ts` es el único código que lee o escribe esas tablas, y valida sus columnas JSON. |
| `…/<funcionalidad>/contract.ts` | Esquemas Zod del contrato de la API de la funcionalidad (entrada, salida y OpenAPI). |
| `…/<funcionalidad>/events.ts` | Catálogo de eventos de log de la funcionalidad (principio XI). |
| `…/<funcionalidad>/presenters.ts` | Modelos de vista con mapeo explícito (sin filas de la BD ni objetos de Better Auth). |
| `…/<funcionalidad>/index.ts` | **API pública**: lo único que pueden importar otras funcionalidades, las rutas, los *hooks* y las tareas. Es el único fichero obligatorio; los demás se crean cuando hacen falta. |
| `src/lib/shared/` | Núcleo **puro** compartido por cliente y servidor: tipos *branded* de dinero y de fecha (`Micro`, `EpochMs`, `CivilDate`) y sus constructores. No importa nada de `$lib/server`. |
| `src/lib/server/shared/` | Núcleo **puro** del servidor: ids y errores tipados. No importa funcionalidades ni infraestructura. |
| `src/lib/server/{db,adapters,config,logging,forms,api,jobs}/` | Infraestructura común: cliente y transacciones de SQLite y migraciones; proveedores externos, cada uno tras una interfaz (`PaymentsProvider`, `InvoicingProvider`, `EmailSender`, `AiGateway`, `FxSource`, `Clock`…) con su implementación real y su implementación falsa (`adapters/<proveedor>/fake.ts`); entorno; logging; helper de formularios; utilidades de la API (formateador de errores de 7.1, esquemas de cabeceras comunes y montaje del OpenAPI); y tareas programadas finas que solo llaman a API públicas. |
| `src/lib/server/composition.ts` | **Punto de composición**: construye una vez (desde `init`) la BD, los adaptadores, el `Clock` y el `Logger`, y los pasa a los servicios por parámetro. En los tests se sustituyen por los falsos. |
| `src/routes/`, `src/lib/components/` | Presentación: analizan la entrada (Zod), comprueban la autorización y serializan la salida. Las actions y los endpoints que escriben llaman a **un** servicio; un `load` puede componer varias API públicas en paralelo. PROHIBIDA la lógica de negocio en rutas y componentes. |

- Funcionalidades de la v4: `audit`, `notifications`, `apps`, `legal`, `pricing`, `credits`,
  `invoicing`, `accounts`, `payments`, `sync`, `protections`, `ai`, `privacy` y `stats`. Su orden,
  sus tablas y sus dependencias permitidas están en `ARCHITECTURE.md` (sección 3). Crear, fusionar
  o dividir una funcionalidad se decide en el plan y se refleja allí.
- **Fronteras**:
  - Una funcionalidad solo importa de otra su `index.ts`. PROHIBIDOS los imports profundos.
  - El grafo de dependencias entre funcionalidades es **acíclico**. `audit` es una hoja (no
    importa ninguna funcionalidad) y `notifications` solo importa `audit`.
  - Cuando una funcionalidad necesita un agregado de otra que está por encima en el orden (p. ej.
    el coste del día de `ai` para el freno global de `protections`), lo recibe **como parámetro**
    del servicio o la tarea que orquesta; nunca lo importa.
  - **Cada tabla tiene un único dueño.** Ningún repositorio lee ni escribe tablas de otra
    funcionalidad: los datos ajenos se piden por su API pública. `credits` es la **única**
    funcionalidad que escribe en las tablas de saldo (`credit_buckets`, `user_balances`,
    `credit_holds`, `credit_movements`), por el principio I.
  - Los *guards* de autorización (`requireUser`, `requireVerifiedUser`, `requireAdmin`) los
    exporta `accounts` en su `index.ts`.
- **Transacciones**: las abre el servicio que orquesta el caso de uso (`BEGIN IMMEDIATE`, sin
  `await` dentro). Las funciones públicas que escriben reciben esa transacción como parámetro y
  nunca abren otra.
- Todo el código de servidor vive bajo `$lib/server` (SvelteKit impide importarlo desde el
  cliente). PROHIBIDAS las carpetas globales por capa (`src/lib/server/domain`,
  `src/lib/server/services`) y `src/lib/services`.
- Los componentes `.svelte` no acceden a la BD ni calculan importes: reciben datos ya calculados.
- **La complejidad se justifica**: una capa, abstracción general, caché, sistema de eventos o
  dependencia transversal nueva solo se introduce explicando en el plan qué problema concreto
  resuelve. Se prefiere una implementación local sencilla hasta que haya reutilización real.

### V. Test-first y cobertura mínima (NO NEGOCIABLE)

- **TDD obligatorio** (rojo → verde → refactor) en los módulos críticos: tarificación, bolsas,
  reservas, deuda, caducidad, ledger, pagos, facturación, idempotencia, límites, antiabuso y
  validación de sincronización. El test que falla se escribe y se ve fallar **antes** de la
  implementación.
- **Cobertura mínima**, comprobada por Vitest en el CI (el CI falla si no se alcanza):
  - **100 %** de líneas, ramas, funciones y sentencias en
    `src/lib/server/features/*/domain/**`, `src/lib/shared/**` y `src/lib/server/shared/**`.
  - **80 %** de líneas, ramas, funciones y sentencias en `src/lib/**`. Las rutas, los *hooks* y
    los `+server.ts` se ejecutan en el proceso del build, que v8 no mide: los cubren los tests
    HTTP, los E2E y `test:trace` (cada `CA` con su test).
  - Las exclusiones (`/* v8 ignore */`) solo se permiten con un comentario que las justifique.
- Los tests de integración usan **SQLite real** (fichero temporal con WAL) y migraciones reales.
  PROHIBIDO simular la BD con mocks. Viven junto a su funcionalidad
  (`features/<f>/*.int.test.ts`) y solo importan el interior de esa funcionalidad; las demás, por
  su `index.ts` o con *builders*. Los tests HTTP, de arquitectura y E2E viven aparte
  (`Historias.md` 15.25).
- Los tests NUNCA llaman a proveedores reales (IA, pagos, email, BCE o Turnstile): usan las
  implementaciones falsas de los adaptadores.
- Son obligatorios todos los tests de la sección 10, punto 4, de `Historias.md`, incluidos los de
  **concurrencia** (N peticiones simultáneas sobre el mismo saldo), los de **aislamiento entre
  apps** y la validación de respuestas contra el **OpenAPI**.
- Todos los códigos de error documentados (sección 7.2) están cubiertos por tests de la API,
  agrupados en tablas de casos parametrizadas (no un test por endpoint).
- **Accesibilidad en todas las páginas, E2E en los flujos críticos**: una spec recorre todas las
  páginas de la web con axe en ambos temas (principio IX), y los E2E de Playwright se reservan
  para los flujos críticos de `Historias.md` 15.17, también sin JavaScript. No se escriben E2E
  que repitan lo que demuestra un test más barato.
- Un bug corregido lleva un test de regresión que lo reproduce.
- **Implementación por lotes con checkpoint**: cada lote cierra con sus tests (deuda de tests solo
  dentro del lote activo) y ninguna historia se cierra con tests obligatorios pendientes. Fuera de
  los módulos con TDD obligatorio, los tests se escriben al estabilizar el lote, salvo
  autenticación, autorización, concurrencia, privacidad, migraciones y bugs, que se prueban antes
  o inmediatamente después.
- **Trazabilidad**: cada test que demuestra un criterio `CA` lleva su identificador
  (`[BE-FR-XX/CAn]` o la etiqueta `@BE-FR-XX`) y `test:trace` lista los criterios sin test.
- **Determinismo**: el tiempo, los ids y la aleatoriedad se inyectan (`Clock`, generador con
  semilla). PROHIBIDOS en los tests `waitForTimeout`, `sleep` y esperas arbitrarias. Un test
  inestable es un defecto: los reintentos solo sirven para diagnosticar, nunca para ocultarlo.
- **E2E contra el build de producción** en `APP_ENV=test` (adaptadores contra servidores
  simulados locales, captcha falso, emails en un *outbox* en fichero, sin red externa).
- **Navegadores**: Chromium en cada PR; Firefox y WebKit en las PR de riesgo, cada noche y antes
  de cada release. Las capturas de regresión visual solo se generan en el contenedor oficial de
  Playwright y solo se actualizan con un cambio intencionado y revisado.
- **Property-based** (fast-check) donde haya invariantes del dominio y **mutation testing**
  (Stryker) sobre `src/lib/server/features/*/domain/**` y los módulos de dinero y fecha de
  `src/lib/shared/**`, con línea base y ejecución programada;
  nunca en el bucle de desarrollo.
- La estrategia detallada (niveles, lotes, suites, comandos, CI y criterios de cierre) está en
  `Historias.md`, sección 15, y es de obligado seguimiento en el plan y las tareas.

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
  configuración tipado y validado con Zod (la API pública de `apps`; no confundir con
  `$lib/server/config/`, que solo lee el entorno), que resuelve la herencia global → app →
  operación.
- Los valores por defecto viven en un único módulo de *seed* y se muestran en el panel
  (BE-FR-61 CA4).
- Cada cambio se valida (tipos, rangos y coherencia) y queda en `admin_audit` con el valor anterior
  y el nuevo.
- Solo son variables de entorno los secretos y la infraestructura que enumera la sección 9.

### IX. Accesibilidad, usabilidad y experiencia de uso (WCAG 2.2 AA)

Accesibilidad:

- Toda la web (landings, páginas legales, registro, panel de usuario y panel de administración) y
  los emails cumplen **WCAG 2.2 nivel AA**.
- HTML semántico primero: `button` para acciones, `a` para navegación, encabezados jerárquicos,
  *landmarks* y tablas con `th`/`scope`/`caption`. ARIA solo cuando el HTML no basta.
- Todo es usable **solo con teclado**: foco visible (contraste ≥ 3:1), orden lógico, enlace
  «Saltar al contenido», sin trampas de foco, y los diálogos gestionan y devuelven el foco.
- Al cambiar de ruta, al fallar un envío o al desaparecer el elemento con el foco, se decide
  dónde va el foco y qué se anuncia. Se conserva el anuncio de ruta de SvelteKit; si se
  personaliza, se comprueba que no empeora.
- Contraste ≥ 4,5:1 en texto y ≥ 3:1 en componentes y gráficos, **en ambos temas**.
- Los formularios tienen `label` visible y asociado, errores en texto junto al campo, enlazados con
  `aria-describedby` y anunciados (`aria-live`), y `autocomplete` correcto. El color nunca es el
  único indicador.
- Las gráficas (LayerChart) tienen un título descriptivo y una **tabla de datos equivalente**
  accesible.
- Se respeta `prefers-reduced-motion`. La interfaz funciona con zoom al 200 %, con el espaciado
  de texto de WCAG y con una anchura de 320 px sin desplazamiento horizontal de la página (las
  tablas pueden desplazarse dentro de su contenedor).
- Los tamaños de letra usan unidades relativas (`rem`), para respetar la ampliación del navegador.
- Objetivos táctiles de **al menos 44 × 44 px CSS** en toda la web, incluido el panel de
  administración (política propia, por encima del mínimo de 24 × 24 de WCAG).
- Los componentes interactivos complejos (diálogos, menús, pestañas, combobox) siguen los patrones
  de la WAI-ARIA Authoring Practices Guide; como no hay librería de componentes, cada uno lleva sus
  tests de teclado.
- Verificación: `eslint-plugin-svelte` (reglas a11y) sin avisos y `@axe-core/playwright` con
  **cero violaciones** `serious` o `critical` en cada página y en cada tema. Lo automático no
  sustituye a la auditoría manual previa al lanzamiento (`Historias.md` 15.18).

Usabilidad:

- Cada historia con interfaz se especifica con **criterios observables** (qué ve el usuario, qué
  puede hacer, qué ocurre si falla). PROHIBIDOS los requisitos del tipo «será intuitiva» o «tendrá
  buena UX». Los patrones de interfaz se eligen por las tareas aprobadas; no justifican
  funcionalidades nuevas.
- **Estados**: cada pantalla con datos define los estados que le apliquen (primer uso, vacío,
  sin coincidencias, carga, éxito, error recuperable, resultado incierto, sin permiso, sesión
  caducada) según el catálogo de `Historias.md` 16.6. Toda acción significativa da una
  respuesta perceptible. Un indicador de carga representa una espera real y nunca oculta un fallo.
- **Lo escrito no se pierde**: ante un error se conservan los datos válidos (salvo contraseñas y
  secretos), y tras iniciar sesión se vuelve a la página pedida. Nunca se presenta como confirmado
  un resultado con consecuencias (compra, ajuste, borrado) antes de que lo confirme el servidor.
- Diseño *mobile-first* y adaptable en **toda** la web, panel de administración incluido.
- **Tema**: claro y oscuro, con selector **Sistema / Claro / Oscuro** disponible en todas las
  páginas. Sistema es la elección inicial, funciona sin JavaScript y sin destello del otro tema, y
  sigue los cambios del sistema durante la sesión sin perder estado. Claro u Oscuro se guardan en
  una cookie técnica y el servidor pinta la página ya con el tema elegido (principio XIII).
- **Mejora progresiva**: todos los formularios funcionan sin JavaScript (form actions de SvelteKit
  con `use:enhance`). Solo las gráficas y el captcha del registro pueden requerir JavaScript
  (sección «Mejora progresiva»).
- Todo el texto visible está en español y sale de los mensajes de **Paraglide**. PROHIBIDO el texto
  visible *hardcodeado* en componentes, servidores o emails.
- Los mensajes de error explican qué ha pasado, dónde, qué puede hacer el usuario y qué se ha
  conservado, sin jerga técnica. Los botones nombran su resultado concreto.
- Las acciones destructivas o irreversibles (borrar la cuenta, reembolsos, ajustes de saldo,
  bloqueos) piden confirmación explícita mostrando el objeto y el alcance y, cuando la
  especificación lo indica, la contraseña. El foco inicial de la confirmación no está en la acción
  destructiva.
- **PROHIBIDOS los patrones manipulativos**: urgencia falsa, opciones preseleccionadas que
  favorecen al negocio, casillas legales marcadas de antemano, bajas o borrados más difíciles que
  las altas y textos que culpabilizan.
- Los importes se muestran siempre con las reglas de redondeo de BE-FR-22 y el formato español
  (coma decimal, punto de miles). Al usuario nunca se le muestran modelos ni costes reales.
- Las personas y tareas de `Historias.md` 16.1 son hipótesis. Antes del lanzamiento público con
  cobros reales se hace la prueba de usabilidad de 16.10 y se corrigen sus hallazgos.

### X. Simplicidad operativa

- **Una sola instancia** por entorno, **SQLite** como única BD y tareas programadas **dentro del
  proceso**. PROHIBIDO añadir Redis, colas, otra BD, microservicios o *workers* externos sin
  enmendar esta constitución.
- Dependencias mínimas: cada dependencia nueva (de producción o de desarrollo significativa) se
  justifica en el plan: para qué sirve, por qué no basta la plataforma ni una dependencia ya
  presente, mantenimiento, licencia, seguridad y tamaño o impacto cuando sea relevante. Una
  dependencia transversal **nueva** (la usarán varias funcionalidades o sustituye a otra) exige
  además un ADR.
  No se introducen dos librerías para resolver el mismo problema. Se prefieren las APIs nativas
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

- Cada línea tiene un `event` con código estable `funcionalidad.objeto.resultado` (p. ej.
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
- Test (`APP_ENV=test`): solo stdout, sin Gateway ni `.logs/`, con `LOG_LEVEL=debug` para que el
  marcador de privacidad vea todos los niveles. Los tests unitarios y de integración usan el
  registrador falso.

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
  nivel, campos y cuándo se emite. Vive en `features/<f>/events.ts`, y el prefijo de cada código
  es el nombre de la funcionalidad. Los eventos de infraestructura (`app.*`, `http.*`, `log.*`)
  están en `$lib/server/logging/events.ts`, que reúne todos los catálogos con una línea por
  funcionalidad; los del navegador (`client.*`), en `$lib/logging/`. Un test comprueba que los
  códigos son únicos y llevan el prefijo correcto.
- `/health` comprueba la BD. Las alertas al administrador son las de la sección 5.13 y no se
  repiten por el mismo cruce de umbral (`alerts_state`).

### XII. Validación en las fronteras

Todo dato no confiable se valida con **Zod** al cruzar una frontera, y solo ahí.

- **Fronteras de este proyecto**: cuerpos JSON de `/api/v1/*`; multipart de `/ai/transcribe`;
  cabeceras (`X-App-Id`, `X-App-Version`, `X-Device-Name`, `Idempotency-Key`, `If-Match`); query
  y parámetros de ruta; form actions de la web; webhooks de pagos; respuestas de OpenRouter,
  Mistral, BCE, Turnstile, Resend y GitHub; columnas JSON de la BD; cookies (tema y efectos); variables de
  entorno.
- **Tipos inferidos del esquema**: `z.input` para lo que llega y `z.output` para lo ya
  normalizado. Los servicios que reciben datos de consulta aceptan `z.input` y normalizan dentro
  con `Esquema.parse`. PROHIBIDO usar aserciones de tipo (`as`, `!`, `as unknown as`) en lugar de
  validar: ESLint aplica `strictTypeChecked` y `consistent-type-assertions`
  (`assertionStyle: "never"`), también en los tests. La única excepción es el módulo de
  constructores de tipos *branded* (`$lib/shared/`).
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
- **Dónde vive cada esquema**:
  - contrato de la API de una funcionalidad: `features/<f>/contract.ts`;
  - columnas JSON: junto al `repository.ts` de su dueña;
  - respuestas de proveedores: en su `adapters/<proveedor>/`;
  - cabeceras comunes de la API: `$lib/server/api/`;
  - formularios compartidos con el cliente: `$lib/schemas/<funcionalidad>/`;
  - primitivas reutilizables (lista repetida, decimal español, fecha `dd/mm/aaaa`):
    `$lib/schemas/common/`.
  Los esquemas de `$lib/schemas` no importan código de servidor. El servidor valida siempre,
  aunque el cliente también valide.

### XIII. Sistema de diseño, apariencia y rendimiento percibido

- **Fuente canónica**: hasta L01, la carpeta `Design/` define la identidad, los tokens, los
  materiales y los componentes base. **Desde L01** mandan el código de la app:
  `src/lib/design-system/` (tokens y tema) y `src/lib/components/ui/` y `layout/`; `Design/`
  queda como documentación de la identidad y de sus reglas, y apunta a ellos (`docs/adr/0007`).
  Nunca hay dos ficheros de tokens. PROHIBIDO imponer la identidad de otro producto. Las
  adaptaciones pendientes (`Historias.md` 16.2, DS-xx) se resuelven en el sistema de diseño, de
  forma centralizada, nunca con estilos locales repetidos.
- **Estilos**: las primitivas de `ui/` y `layout/` tienen su `<style>` con tokens; Tailwind se usa
  para componer en rutas y en `components/<f>/`, **solo con tokens**: la paleta por defecto de
  Tailwind está desactivada y se rechazan los colores arbitrarios (`bg-[#fff]`).
- **Sin valores literales**: ningún componente ni ruta escribe colores, gradientes ni sombras de
  color literales; usa siempre los tokens (con pareja clara y oscura). Lo comprueba un script en
  el CI. Si falta un token, se añade al sistema antes de usarlo.
- **Cristal selectivo** (lenguaje inspirado en Liquid Glass):
  - Solo en navegación (cabecera, pie, lateral), superposiciones (diálogos, *toasts*, menús) y
    tarjetas de resumen destacadas. Tablas, formularios, listas, gráficas, paso de compra, textos
    legales y pantallas de datos de la administración son **siempre opacos**. Los emails, sin
    cristal.
  - Cada uso tiene una función concreta. PROHIBIDO anidar superficies de cristal o aplicarlo por
    fila o por icono.
  - Toda superficie de cristal tiene una **alternativa opaca** con las mismas acciones,
    información, jerarquía y foco. El material nunca sustituye a la semántica, al nombre
    accesible, al foco ni a los estados.
- **Preferencias**: se respetan `prefers-reduced-transparency`, `prefers-reduced-motion`,
  `prefers-contrast` y `forced-colors`. Además hay un ajuste propio **«Reducir transparencia y
  movimiento»**, junto al selector de tema y guardado en una cookie técnica, que pasa todo a opaco
  y retira el movimiento no esencial. El ajuste propio solo puede reducir efectos, nunca reactivar
  lo que el sistema pide reducir. Tema y efectos son decisiones independientes.
- **Temas**: el oscuro se diseña expresamente (no es una inversión del claro), con sus estados,
  foco, gráficas e imágenes. El contraste se mide sobre la **composición real** (cristal sobre el
  fondo, en ambos temas y con efectos reducidos), no solo entre pares de tokens.
- **Movimiento**: cada animación tiene una función (confirmar, orientar, mostrar progreso), se
  puede interrumpir sin perder foco ni estado y nunca retrasa la respuesta. Duraciones y curvas
  son tokens.
- **Rendimiento percibido**: objetivos **LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1**, medidos en
  laboratorio sobre el build de producción con perfil móvil limitado, en las páginas de
  `Historias.md` 16.8. No hay datos de campo (sin analítica de terceros) y los resultados se
  presentan como medidas de laboratorio. El cristal se compara con la versión de efectos
  reducidos; si supera los objetivos o perjudica la lectura, se simplifica o se retira.

## Orden de prioridades

Cuando dos objetivos entren en conflicto, prevalece el primero de esta lista. La decisión y su
justificación se anotan en el plan.

1. **Integridad del dinero**: saldo, ledger, cobros y pagos correctos.
2. **Privacidad**: no guardar contenido y minimizar los datos.
3. **Seguridad**.
4. **Simplicidad operativa**: una instancia, SQLite y pocas dependencias.
5. **Accesibilidad, usabilidad y experiencia de uso**.
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
| Autenticación | `better-auth` | **1.7.7** (plugins `bearer` y `admin`; adaptador Drizzle). El captcha (Turnstile) y los límites de autenticación son propios de la funcionalidad `accounts` (D-02), porque por la API de servidor no actúan ni el plugin `captcha` ni el `rateLimit` |
| Validación | `zod` | **4.6.5** |
| OpenAPI | `zod-openapi` | **6.0.2** |
| i18n | `@inlang/paraglide-js` | **2.27.0** (solo `es`) |
| Plugins de mensajes de Paraglide | `@inlang/plugin-message-format` / `@inlang/plugin-m-function-matcher` | **4.5.0** / **2.3.0** (devDependencies). `project.inlang/settings.json` los carga desde `node_modules`; el valor por defecto de Paraglide los descarga de jsDelivr en cada build, algo que queda PROHIBIDO |
| Estilos | `tailwindcss` / `@tailwindcss/vite` | **4.3.3** / **4.3.3** |
| Gráficas | `layerchart` | **2.6.1** |
| Email | `resend` | **6.32.1** |
| Tareas programadas | `croner` | **10.0.1** (zona `Europe/Madrid` explícita en cada tarea) |
| Logs del servidor | `pino` / `pino-abstract-transport` | **10.4.0** / **3.0.0** (ambas en `dependencies`; la segunda solo para el *transport* del Log Gateway) |
| Logs del navegador | `loglevel` | **1.9.2** |

No se usa ninguna librería de componentes de UI: los componentes son propios, sobre Tailwind
(ver principios IX y XIII).

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
| Property-based testing | `fast-check` / `@fast-check/vitest` | **4.10.2** / **0.5.0** |
| Mutation testing | `@stryker-mutator/core` / `@stryker-mutator/vitest-runner` | **10.0.0** / **10.0.0** |

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

## Arquitectura idiomática de SvelteKit

El proyecto sigue estrictamente el modelo mental de SvelteKit 2 y Svelte 5. Esta sección concreta
los principios IV (funcionalidades y capas), IX (accesibilidad y mejora progresiva) y XII (validación) para el
framework.

### Rutas y dominios

- Organización con grupos de rutas: `src/routes/(web)/(public)/…` (landings, precios, legales,
  registro, login), `(web)/panel/…`, `(web)/admin/…`, `api/v1/…` y `client-errors/`. Las URL
  visibles son las de `Historias.md` (`/registro`, `/panel`, `/admin`, `/precios`…).
- Los parámetros de ruta (`slug`, ids) se restringen con *param matchers* en `src/params/`.
- Los enlaces y navegaciones internas (`href`, `goto`, `redirect`) se construyen con `resolve()`
  de `$app/paths`, que tipa la ruta y sus parámetros; la consulta se añade con
  `URLSearchParams`. PROHIBIDO saltarse esta regla con `eslint-disable`, `@ts-expect-error` o
  componentes envoltorio.
- **Separación por host**, aplicada en `handle`:
  - El host de la API (`PUBLIC_API_URL`) solo responde a `/api/v1/*`.
  - El host de la web (`PUBLIC_WEB_URL`) solo responde a la web y a `/client-errors`.
  - Cualquier otra combinación devuelve `404` sin ejecutar la ruta.
  - Excepción: `/api/v1/health` responde con cualquier `Host`, porque el *healthcheck* de
    Coolify llama al contenedor directamente.
  - En desarrollo, si ambas URL comparten host, la separación se desactiva.
- Opciones de página: `ssr = true` en todo el proyecto; `prerender = false` en la v4 (el
  contenido de landings, precios y legales sale de la BD); `trailingSlash` por defecto.
- `handle` es un `sequence(...)` con este orden: contexto de la petición (`requestId`, logger) →
  separación por host → middleware de Paraglide → preferencias de apariencia (cookies de tema y
  efectos validadas con Zod → `event.locals`, solo en la web) → resolución de la app (`X-App-Id`,
  solo en la API) → sesión (Better Auth → `event.locals`) → cabeceras de seguridad. `event.locals` está
  tipado en `src/app.d.ts`.

### Carga de datos

- Las páginas cargan datos **solo** con `+page.server.ts` y `+layout.server.ts`. Los componentes
  reciben datos listos para pintar a través de la prop `data`. PROHIBIDOS los `load` universales
  (`+page.ts`, `+layout.ts`) salvo justificación en el plan.
- La web **nunca** llama a `/api/v1` ni a sus propios `+server.ts` para obtener datos: el `load`
  llama directamente a los servicios.
- Todo lo que devuelve un `load` se serializa y llega al navegador. Por eso un `load` devuelve
  **modelos de vista** construidos con funciones de mapeo explícitas
  (`presenters.ts` de cada funcionalidad), nunca filas de la BD ni objetos de Better Auth. Al
  usuario nunca
  le llegan campos internos (modelo, coste real, `has_real_purchase` de otros, hashes, tokens).
- Sin cascadas: las cargas independientes se lanzan en paralelo (`Promise.all`); `await parent()`
  solo cuando hace falta y después del trabajo independiente.
- Los datos no críticos y lentos (p. ej. gráficas) se pueden enviar como promesas en
  *streaming*, con un estado de carga accesible (`aria-busy`).
- Para refrescar se usan `invalidate`, `depends` o `invalidateAll`, nunca un `fetch` manual.
- Las páginas autenticadas responden con `cache-control: private, no-store` (`setHeaders`).

### Mutaciones: form actions

- Toda mutación de la web es una **action con nombre** (`?/guardarPerfil`) en `+page.server.ts`,
  invocada desde un `<form method="POST">` con `use:enhance`.
  - PROHIBIDO el `fetch` manual para enviar formularios o mutar datos desde componentes.
  - PROHIBIDO usar `+server.ts` para mutaciones de la web.
  - PROHIBIDAS las *remote functions* (`kit.experimental.remoteFunctions`), porque son
    experimentales. Se reevaluarán con SvelteKit 3.
- Una action es un **controlador** y sigue siempre estos pasos:
  1. Autorización con los *guards* (ver «Autenticación y autorización»).
  2. Lectura y validación del `FormData` con el helper de formularios.
  3. Llamada a **un** servicio, a través del `index.ts` de su funcionalidad.
  4. Traducción del resultado:
     - Éxito: `redirect(303, …)` (patrón POST-redirect-GET) o `{ success: true }` con una clave
       de mensaje.
     - Validación: `fail(400, { values, errors })`.
     - Rechazo de negocio: `fail(4xx, { formError })` con el código del error.
- **La lógica de negocio no vive en rutas ni en actions**, sino en los servicios de cada
  funcionalidad (principio IV). PROHIBIDO `src/lib/services`, porque SvelteKit solo protege del
  cliente `src/lib/server/**` y los ficheros `*.server.ts`. Las rutas no importan
  `$lib/server/db` ni los adaptadores; solo la API pública de las funcionalidades (servicios y
  *presenters*), los *guards* y el helper de formularios.
- **Helper de formularios propio** (`$lib/server/forms/`), sin dependencias nuevas
  (`sveltekit-superforms` no se usa). Hace estas cosas:
  - Convierte `FormData` en un objeto normalizado (campos repetidos como lista, cadena vacía como
    `undefined`, casillas como booleano), según el principio XII.
  - Valida con `safeParse`.
  - Si falla, devuelve `fail(400, { values, errors })`, donde `errors` contiene los errores por
    campo (mensajes de Paraglide) y un error general opcional.
  - `values` reenvía lo escrito para no perderlo, **excepto** contraseñas, tokens y cualquier
    campo marcado como sensible.
  - Nunca devuelve detalles internos.
- En `use:enhance`:
  - Durante el envío, el botón queda desactivado con `aria-busy="true"`.
  - Si el envío falla, el foco va al resumen de errores o al primer campo inválido y el error se
    anuncia (`aria-live`).
  - Se conserva el comportamiento por defecto de `applyAction` e `invalidateAll`.
- Las confirmaciones de acciones destructivas son un paso de formulario (página o diálogo
  accesible con su propio `<form>`), nunca `window.confirm`, para que funcionen sin JavaScript.

### Mejora progresiva

- Toda interacción crítica funciona **sin JavaScript** mediante `<form>` y `<a>` correctos.
  Interacciones críticas: registro, verificación, login, recuperación y cambio de contraseña,
  cambio de email, compra, datos fiscales, aceptación legal, sesiones, borrado y exportación de
  la cuenta, y todas las acciones del panel de administración.
- JavaScript solo mejora la experiencia (estados de envío, gráficas y filtros instantáneos). Las
  gráficas tienen su tabla equivalente (principio IX).
- **Filtros, orden, búsqueda y paginación** son un `<form method="GET">` con botón visible y
  enlaces de página, de modo que la URL guarda el estado. Aplicar al cambiar un control es solo
  una mejora. PROHIBIDO un formulario oculto enviado con `requestSubmit()`.
- Se usan los controles nativos cuando bastan (incluido `<select>`, estilizado con tokens). Un
  control propio (combobox) solo se crea si hace falta búsqueda, con alternativa sin JavaScript.
- **Excepción: el captcha del registro.** Turnstile necesita JavaScript, así que el registro es la
  única interacción crítica que lo requiere. Sin JavaScript, el formulario lo explica con un aviso
  visible (`<noscript>`) en lugar de fallar en silencio; el resto del formulario sigue siendo un
  `<form>` nativo. No se ofrece un camino sin captcha.
- El selector de tema y el ajuste de efectos funcionan sin JavaScript (formulario que guarda la
  cookie); con JavaScript se aplican sin recargar.

### Autenticación y autorización

- `handle` resuelve la sesión una vez y la deja en `event.locals` (`user`, `session`).
- **Cada** `load`, **cada** action y **cada** `+server.ts` protegido comprueba la autorización con
  *guards* explícitos (`requireUser`, `requireVerifiedUser`, `requireAdmin`). El `load` de un
  layout **no** es una barrera de seguridad: las actions y los `+server.ts` no lo ejecutan, y los
  `load` se ejecutan en paralelo.
- La web redirige a `/login?redirectTo=…` y solo acepta en `redirectTo` rutas internas
  relativas, para evitar redirecciones abiertas.
- La API usa **solo** el token Bearer (BE-FR-65) y no lee cookies. La web usa **solo** la cookie
  de sesión y no acepta tokens Bearer.

### Estado y componentes (Svelte 5)

- **Solo runes**:
  - `$state` para el estado local y `$derived` para los valores derivados.
  - PROHIBIDO usar `$effect` para sincronizar o derivar estado. `$effect` solo para efectos con
    el DOM o APIs externas, con limpieza.
  - `$props()` con su interfaz tipada; *callback props* en lugar de `createEventDispatcher`;
    *snippets* (`{#snippet}`/`{@render}`) en lugar de slots; atributos de evento (`onclick`).
- `page`, `navigating` y `updated` se importan de `$app/state`. PROHIBIDO `$app/stores`
  (obsoleto) y `svelte/store` en código nuevo.
- **PROHIBIDO el estado mutable a nivel de módulo** en todo código que se ejecute en el
  servidor, incluidos los `.svelte` y `.svelte.ts` que se importan durante el SSR. En el servidor
  ese estado se comparte entre peticiones y filtraría datos entre usuarios.
  - El estado compartido en el cliente se crea por árbol de componentes con
    `setContext`/`getContext` (p. ej. en el layout).
  - Los datos por petición del servidor viven solo en `event.locals`.
  - Cuenta también como estado mutable una colección de módulo (`const x = new Map()`, `Set`,
    arrays u objetos): se congela con `Object.freeze` o no se declara a nivel de módulo.
  - Excepción: las cachés y contadores deliberados del proceso (caché de configuración y de
    modelos, límites de frecuencia) viven en ficheros `*.cache.ts` dentro de su funcionalidad,
    documentados y testeados, y nunca guardan datos de renderizado.
- Organización de componentes: `src/lib/components/ui/` para primitivas accesibles genéricas
  (botón, campo de formulario, diálogo, tabla, paginación, aviso, estado vacío),
  `src/lib/components/layout/` para el marco (cabecera, pie, navegación, menú de cuenta,
  selector de tema y efectos, fondo) y `src/lib/components/<funcionalidad>/` para el resto.
  `layout/` solo importa `ui/` y `$lib/format`; un componente de una funcionalidad no importa los
  de otra (lo compartido pasa a `ui/`). Ficheros en `PascalCase.svelte`; módulos con runes en
  `*.svelte.ts`. Los iconos son los del sistema de diseño (componente `Icon`); si se añade una
  librería de iconos, se importan por su ruta, nunca desde el índice.
- Los componentes no acceden a la BD, a los servicios ni a `fetch`. El formato de importes
  (BE-FR-22), fechas y números vive en funciones puras de `$lib/format/`, compartidas por
  servidor, cliente y emails.

### Endpoints `+server.ts`

- Solo se usan para:
  - la API de las apps (`/api/v1/*`);
  - los webhooks de pagos;
  - las descargas autenticadas por `GET` (CSV, PDF de facturas, exportación RGPD);
  - `/client-errors`.
- Cada endpoint valida con Zod (principio XII). La API responde con `json()` y el formato de
  error de 7.1, mediante un formateador común; nunca con `error()` ni `+error.svelte`.

### Errores

- **Esperados** (no encontrado, sin permiso): `error(404 | 403, …)` en los `load`, con mensaje de
  Paraglide, y páginas `+error.svelte` accesibles que muestran el «Código de referencia»
  (`requestId`).
- **Inesperados**: `handleError` en `hooks.server.ts` los registra una vez (principio XI) y
  devuelve `{ message, requestId }` con un mensaje genérico. Nunca devuelve la pila ni detalles
  internos.

### Verificación de esta sección

- **ESLint** (`no-restricted-imports` y `no-restricted-syntax`):
  - `$app/stores` y `svelte/store`, en todo el proyecto.
  - `$lib/server/db` y `$lib/server/adapters`, en `src/routes/**`.
  - `fetch` en `src/lib/components/**`.
  - En `src/lib/server/features/*/domain/**`, `src/lib/shared/**` y `src/lib/server/shared/**`:
    `$app/*`, `$env/*`, `@sveltejs/*`, `drizzle-orm*`, `better-sqlite3`, `node:*`, la
    infraestructura común (`$lib/server/db`, `adapters`, `config`, `logging`, `forms`, `api` y
    `jobs`) y `$lib/server/features/*`, además de `Date.now()`, `new Date()`, `process` y `fetch`.
  - `consistent-type-assertions` con `assertionStyle: "never"` en todo el código y los tests,
    salvo `$lib/shared/` (principio XII).
  - `no-console`, salvo en los módulos de logging; `pino` solo en `$lib/server/logging/` y
    `loglevel` solo en `$lib/logging/client.ts`.
  - La regla de navegación sin `resolve()` de `eslint-plugin-svelte`, si existe en la versión
    fijada (se comprueba en L01).
- **Tests de arquitectura**:
  - No existen `+page.ts`/`+layout.ts` con `load` fuera de la lista justificada.
  - No existen `src/lib/services`, `src/lib/server/domain` ni `src/lib/server/services`.
  - Una funcionalidad solo importa de otra su `index.ts`; el grafo entre funcionalidades no tiene
    ciclos y respeta el orden de `ARCHITECTURE.md` (las importaciones `schema.ts` → `schema.ts`
    para `references()` no cuentan); `audit` y los dos `shared/` no importan funcionalidades y
    `notifications` solo importa `audit`.
  - Ningún `repository.ts` importa el `schema.ts` de otra funcionalidad (un `schema.ts` solo lo
    hace para `references()`), y solo `credits` escribe en las tablas de saldo.
  - No hay `let`, `$state` ni colecciones sin congelar a nivel de módulo en ficheros que se
    importan durante el SSR, salvo en los `*.cache.ts`.
  - Solo `$lib/server/config/env.ts` importa `$env/*` o lee `process.env`; ningún
    `+layout.server.ts` usa `strictObject`; `prerender` no se activa.
  - Los códigos de evento son únicos y llevan el prefijo de su funcionalidad.
  - `components/layout/` solo importa `ui/` y `$lib/format`, y los componentes de una
    funcionalidad no importan los de otra.
  - El test de arquitectura **siempre** se ejecuta en cada lote: `vitest related` no lo
    selecciona porque no importa el código que comprueba.
- **Tests de integración**:
  - Cada action y cada endpoint protegidos responden `401`/`403` o redirigen sin sesión o con
    el rol equivocado.
  - Los `load` no devuelven campos prohibidos: la función que compone el modelo de vista (en
    `presenters.ts` o en un `*.data.server.ts` de la ruta) se prueba con las claves exactas
    (`toStrictEqual`), porque los `load` no se llaman en los tests (`Historias.md` 15.2).
  - La separación por host devuelve `404` en las combinaciones cruzadas, y `/api/v1/health`
    responde con cualquier `Host`.
- **E2E** con Playwright y `javaScriptEnabled: false`: todos los recorridos críticos de
  «Mejora progresiva» se completan sin JavaScript.

## Configuración y variables de entorno

### Acceso y validación

- Se usa la API estable de SvelteKit 2: **`$env/dynamic/private`** en el servidor. PROHIBIDO
  `$env/static/private` para secretos, porque copiaría su valor en el build y en la imagen
  Docker. El prefijo `PUBLIC_` solo para valores no sensibles; ningún secreto lo lleva.
- Las variables `PUBLIC_` (`PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `PUBLIC_TURNSTILE_SITE_KEY`) se
  leen con **`$env/dynamic/public`**, también desde `env.ts`. PROHIBIDO `$env/static/public`,
  porque los valores cambian por entorno sin reconstruir. El navegador solo las recibe por los
  datos del layout raíz.
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
- `APP_ENV` admite `development`, `test`, `staging` y `production`. **Solo** con `APP_ENV=test`
  se aceptan las opciones de prueba: URL base de los servidores simulados, captcha falso, *outbox*
  de emails en fichero y secretos de prueba. `APP_ENV=test` no exige las variables de producción.
- **Coherencia entre variables**, comprobada por el esquema:
  - En la v4 se rechazan `PAYMENTS_PROVIDER=stripe` e `INVOICING_PROVIDER` distinto de `none`.
  - Con `APP_ENV=production` se rechazan las claves de prueba de Turnstile y los valores de
    ejemplo de `.env.example`.
  - Al arrancar, tras abrir la BD, se comprueba que `BODY_SIZE_LIMIT` es mayor o igual que el
    mayor `max_audio_mb` configurado en cualquier app.
- Los servicios reciben la configuración por parámetro; los tests unitarios y de integración no
  leen el entorno. Solo los tests HTTP y Playwright arrancan el build con un conjunto mínimo de
  variables, pasado por `webServer.env` o por el proceso que lanza el `globalSetup`, sin `.env` ni
  sintaxis de shell (`Historias.md` 15.22).
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
| `EMAIL_FROM` | `Cuenta Mardomingo <no-reply@mardomingo.com>` | Dominio con SPF, DKIM y DMARC. `Reply-To`: el email de soporte (`soporte@mardomingo.com`). |
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
  - `url.origin` es `https://cuenta-staging.mardomingo.com` y los formularios de la web no reciben
    un 403 de la comprobación de origen propia.
  - Un `X-Forwarded-For` falsificado por el cliente no cambia la IP registrada.
  - El puerto 7312 no responde desde fuera del host.

## Flujo de desarrollo y puertas de calidad

### Proceso

- Toda funcionalidad sigue el flujo de spec-kit: `/speckit-specify` → `/speckit-clarify` →
  `/speckit-plan` (con la comprobación de esta constitución) → `/speckit-tasks` →
  `/speckit-analyze` → `/speckit-implement` → `/speckit-converge` (comprueba que lo implementado
  cumple la especificación, el plan y los contratos de UX antes de cerrar).
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
| `lint` | `prettier --check .` y `eslint . --max-warnings 0` (en dos pasadas, `Historias.md` 15.26) |
| `lint:tokens` | Script de tokens del sistema de diseño (puerta 10) |
| `test` | `vitest run` de los proyectos `unit`, `component` e `integration` (sin `http`) |
| `test:http` | `vitest run --project http`: hooks y API contra el build |
| `test:coverage` | `vitest run --coverage` |
| `test:e2e` | `playwright test` |
| `build` | `vite build` |
| `validate` | `check`, `lint`, `test:coverage`, `build` y `test:e2e`, en ese orden, deteniéndose en el primer fallo |
| `lint:changed` | ESLint solo sobre los ficheros cambiados (nivel de lote; ver `Historias.md` 15.25) |
| `test:e2e:smoke` / `test:e2e:critical` | Smoke y flujos críticos de Playwright por etiqueta |

El resto de scripts de testing (`test:unit`, `test:int`, `test:http`, `test:trace`,
`test:e2e:a11y`, `test:e2e:visual`, `test:e2e:cross-browser`, `test:mutation`…) se definen en
`Historias.md` 15.25.

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
5. `pnpm test:http`: hooks, API, validación del OpenAPI generado y tests de contrato.
6. `pnpm test:e2e:smoke`, `pnpm test:e2e:critical` y `pnpm test:e2e:a11y` en Chromium contra un
   build de producción en `APP_ENV=test`; Firefox y WebKit además si la PR toca formularios,
   foco, descargas, subida de ficheros o CSS global. En `main` se ejecutan todos los E2E; cada
   noche, la matriz de navegadores y la regresión visual; cada semana, el mutation testing.
7. `pnpm build` **sin variables de entorno secretas** y build de la imagen Docker.
8. `pnpm audit --prod` sin vulnerabilidades altas ni críticas.
9. Comprobación de que las migraciones están al día con el esquema (`drizzle-kit check` y
   generación sin cambios).
10. `pnpm lint:tokens`: ningún color, gradiente ni sombra de color literal fuera del fichero de
    tokens del sistema de diseño (principio XIII).

### Definición de terminado

Una tarea está terminada cuando pasa todas las puertas del CI, cumple los criterios de aceptación
(`CA`) de sus requisitos, tiene sus tests escritos según el principio V, sus textos en Paraglide,
su documentación actualizada (incluido el OpenAPI) y, si cambia parámetros o comportamiento
visible, su reflejo en el panel de administración y en la auditoría. Si tiene interfaz, además
se ha comprobado en tema claro y oscuro, con efectos reducidos, a 320 px de ancho, solo con
teclado y sin JavaScript (salvo las excepciones de «Mejora progresiva»), y cada comprobación se
informa como **comprobado**, **pendiente**, **no verificable en este entorno** o **no aplica** (con
el motivo). Los lotes cierran con la
*Definition of Checkpoint* y las historias con la *Definition of Done* de `Historias.md` 15.29 y
15.30.

### Despliegue

- Primero se despliega a staging. A producción solo llega lo que se ha validado en staging.
- Despliegue con parada previa: nunca hay dos contenedores escribiendo en el mismo SQLite.

## Gobernanza (Governance)

- Esta constitución **prevalece** sobre cualquier otra práctica, plantilla, especificación, plan o
  tarea. Si `Historias.md` u otro documento técnico la contradice, prevalece la constitución, y la
  contradicción se resuelve enmendando uno de los dos de forma explícita. Por ejemplo, la plantilla
  de plan de Spec Kit propone carpetas `services/`, pero se aplica la estructura del principio IV.
- Cada plan (`/speckit-plan`) incluye la sección «Constitution Check» con el cumplimiento de cada
  principio. Una violación solo se admite si queda justificada en «Complexity Tracking» y es
  compatible con el orden de prioridades. Los principios marcados como NO NEGOCIABLE no admiten
  excepciones.
- Cada plan incluye también el **«Architecture Check»** de `ARCHITECTURE.md` (fronteras,
  dependencias, dueños de tablas, reutilización, abstracciones justificadas, tests, seguridad e
  impacto en otras funcionalidades). Si una funcionalidad necesita romper una regla
  arquitectónica, no lo hace en silencio: se cambia el diseño de la funcionalidad o se cambia la
  arquitectura de forma consciente con un ADR y, si corresponde, una enmienda de esta constitución.
- **ADR**: las decisiones importantes y difíciles de revertir (framework, persistencia,
  autenticación, estructura, validación, despliegue, dependencias transversales) se registran en
  `docs/adr/NNNN-titulo.md` (contexto, decisión, alternativas, consecuencias y estado). Un ADR
  aceptado no se edita: se sustituye por otro.
- `ARCHITECTURE.md` es el mapa operativo de la arquitectura y concreta esta constitución sin
  contradecirla. `CLAUDE.md` contiene las instrucciones para los agentes y remite a ambos.
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

**Version**: 2.1.3 | **Ratified**: 2026-10-10 | **Last Amended**: 2026-10-10
