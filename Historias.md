# Backend de IA multi-app — Especificación (primera app: Secretario AI v4)

| Campo | Valor |
|---|---|
| Estado | Diseño en revisión (v2: plataforma multi-app) |
| Fecha | 2026-10-10 |
| Versión del documento | 2.7 (2026-10-10: altas por IP en L03 tras `/speckit-analyze`; la 2.6 recogió las decisiones de la revisión del plan 001: CSRF propio del host web; captcha Turnstile y límites de autenticación en `accounts` (tabla `auth_rate_limits`), sin los plugins `captcha` ni `rateLimit` de Better Auth; saldo de OpenRouter con `OPENROUTER_MANAGEMENT_KEY`; pérdida por cancelación; logs solo a stdout hasta el contrato del Log Gateway; ejemplos de cobro exactos; audio de respaldo convertido con ffmpeg; coste real de OpenRouter sin `usage: { include: true }`; email normalizado no único y hash HMAC con `EMAIL_HASH_KEY`; estado `in_progress` para la idempotencia; tabla `user_app_activity` y columnas que faltaban; movimiento `forfeit` al borrar la cuenta; ajuste negativo limitado al saldo disponible; IVA de las compras simuladas; anonimización sin desactivar *triggers*; contrato de la API (códigos nuevos, CORS, `/sync`, `/health`, IP aproximada); coherencia de lotes y de las adaptaciones DS; la 2.5 aclaró la especificación 001: deuda y ajustes, límites por cuenta y por app, anuncios en el panel, pasos tras verificar, categorías de sincronización y `ADMIN_EMAIL`; la 2.4 hizo la revisión cruzada de los prompts de preparación: modelo de datos, secciones 15 y 16; la 2.3 añadió la arquitectura por funcionalidades, 15.2 y 15.28; la 2.2 añadió la experiencia de usuario y diseño, sección 16, y la 2.1, la estrategia de testing, sección 15; sustituye a la 2.0 y a la 1.0 del 2026-10-06) |
| Copias | `mardomingo-backoffice/Historias.md` (original) y `secretario2/docs/v4-backend-spec.md` (copia literal para la app). Se editan en el original y se vuelven a copiar. |
| Primera app cliente | Secretario AI — cambios en la app: `secretario2/docs/v4-app-spec.md` |
| Repositorio del backend | Privado, `mardomingo-backoffice` (https://github.com/danimardo/mardomingo-backoffice) |
| Marca y dominios | «Cuenta Mardomingo». API: `https://api.mardomingo.com` · Web (registro, login, panel, administración): `https://cuenta.mardomingo.com` |

> Este documento es el **diseño del backend**. No sustituye a `secretario2/Especificaciones/specs.md`, que sigue siendo la fuente de verdad funcional de la app Secretario. Cuando se implemente cada bloque, su contenido se volcará a la documentación del repositorio que corresponda.
>
> Los valores numéricos que aparecen (créditos, márgenes, límites) son **sugerencias por defecto**: todos son configurables desde el panel de administración (sección 9) salvo que se diga lo contrario.
>
> **Identificadores.** Los requisitos `BE-FR-01` a `BE-FR-61` conservan su número de la versión 1.0 (los cita `v4-app-spec.md`). Los nuevos empiezan en `BE-FR-62` y se ubican en la sección temática que les corresponde, por lo que la numeración no es correlativa dentro de cada sección.

---

## 1. Visión y alcance

### 1.1 Objetivo

Ofrecer una **plataforma común** para las apps de IA del propietario (escritorio, web y móvil), de modo que cualquier persona pueda usarlas **sin registrarse en proveedores de IA, sin generar API keys, sin recargar saldo en varias plataformas y sin elegir modelos**. El usuario crea **una única cuenta** (marca paraguas «Cuenta Mardomingo»), recibe un saldo de bienvenida en créditos (por defecto, 1.000 créditos = 1 €) y ese mismo saldo le sirve en todas las apps. El backend:

1. Gestiona **cuentas y sesiones** de usuario, compartidas entre apps.
2. Gestiona un **saldo único en créditos** (bienvenida gratuita + recargas de pago), con **reservas** que impiden gastar más de lo disponible.
3. Mantiene un **registro de apps** y, para cada una, su **catálogo de operaciones** de IA (modelo, límites, prompts de servidor opcionales).
4. Actúa como **intermediario único** entre las apps y los proveedores de IA (Mistral y OpenRouter), con las claves del administrador, decidiendo qué modelo se usa en cada operación y **cobrando el coste real más un margen**.
5. **Almacena los datos de usuario** sincronizables de cada app y sirve los **valores predeterminados** que define el administrador para cada app.
6. Gestiona **datos fiscales, facturas y exportación contable**.
7. Ofrece una **web** de la marca paraguas (landing, landings de cada app, registro, panel de usuario y panel de administración).

**Secretario AI** es la **primera app** cliente. Lo específico de Secretario (sus operaciones, su documento de sincronización, el límite de duración de audio) se describe como el **perfil de la app `secretario`** dentro de las secciones correspondientes; el núcleo no depende de él.

### 1.2 Dentro del alcance de la v4

- **Plataforma multi-app**: registro de apps, catálogo de operaciones y configuración por app; cuenta y saldo compartidos. Solo se da de alta la app `secretario`, pero el diseño y el modelo de datos son multi-app desde el principio.
- Registro con email y contraseña, verificación de email, recuperación y cambio de contraseña, cambio de email, sesiones revocables ligadas a la app.
- Créditos con bolsas (gratuitos con caducidad / comprados sin caducidad), **reservas de saldo**, saldo negativo tolerado con tope.
- Tarificación por coste real × comisión del proveedor × margen, con **coste máximo por operación** y **precios orientativos** públicos.
- Compra de paquetes con **proveedor de pagos simulado** (Stripe se implementa después sobre la misma interfaz).
- **Facturación**: datos fiscales del cliente, modelo de facturas, interfaz de proveedor de facturación y exportación contable. La emisión real de facturas llega con el primer cobro real (fase Stripe).
- API de IA: chat por operación (operaciones **libres** o **con plantilla**, salida estructurada en JSON y *tool calling*), transcripción de audio con *fallback*, generación de imágenes. Modelos de respaldo y vigilancia de modelos.
- **Idempotencia** de las peticiones de IA.
- Sincronización de datos de usuario por app y valores predeterminados del administrador por app.
- Protecciones: antiabuso, límites, freno global de gasto, mantenimiento (global y por app), versión mínima por app.
- Panel de usuario (con gráficas, aviso de saldo bajo por email, exportación CSV, datos fiscales y facturas).
- Panel de administración (un único administrador) con alertas de saldo de proveedores y de modelos.
- Emails transaccionales con Resend.
- Landing básica de la marca paraguas, landing básica por app y páginas legales (contenido legal redactado por un profesional, fuera de este documento).
- Soporte por email y anuncios del administrador a las apps.
- **Experiencia de usuario y diseño** (sección 16): sistema de diseño propio, temas claro y oscuro con selector Sistema / Claro / Oscuro y ajuste «Reducir transparencia y movimiento».
- Entorno de **staging** y contrato **OpenAPI**.

### 1.3 Fuera de alcance (v4)

- Integración real con **Stripe** (fase inmediatamente posterior; ver BE-FR-29).
- Emisión real de facturas (llega con Stripe; ver BE-FR-75).
- **Login en el navegador con retorno a la app** (OAuth con PKCE) y **"Entrar con Google"**: fase 2. El modelo de datos y la API no deben impedirlo (ver 12, decisión 12).
- *Streaming* de respuestas, *embeddings* y texto a voz.
- Moderación de contenido propia (se confía en la de los proveedores; ver BE-FR-82).
- Suscripciones, recarga automática, importe de compra libre, códigos promocionales.
- Varios administradores o roles de soporte; sistema de tickets.
- Apps web y móviles reales: la plataforma las admite (CORS, sesión por app), pero ninguna se construye en la v4.
- Idiomas distintos del español (los textos sí se preparan para traducción, ver 4.3).
- Landing "bonita" definitiva (la v4 lleva una básica).

---

## 2. Glosario

| Término | Definición |
|---|---|
| **App** | Cliente registrado en la plataforma (p. ej. `secretario`). Se identifica con un `slug` estable que envía en `X-App-Id`. |
| **Cuenta Mardomingo** | Marca paraguas: una cuenta y un saldo válidos en todas las apps. |
| **Crédito** | Unidad de saldo que ve el usuario. Internamente se almacena en **microcréditos** (entero; 1 crédito = 1.000.000 µc) para evitar errores de redondeo. |
| **Bolsa** | Lote de créditos con origen y reglas propias: `free` (bienvenida/ajustes gratuitos, caduca) o `paid` (compra, no caduca). |
| **Reserva** | Bloqueo temporal de saldo por el coste máximo estimado de una operación en curso. No es un movimiento del ledger; se libera al terminar la operación. |
| **Saldo disponible** | Suma de bolsas − deuda − reservas activas. |
| **Deuda** | Saldo negativo tolerado tras una operación cuyo coste final superó el saldo disponible. |
| **Operación** | Cada tipo de uso de IA facturable de una app (`fix`, `transcription`…). Se define en el **catálogo de operaciones** de la app. |
| **Operación libre** | El cliente envía los mensajes completos (prompts incluidos). |
| **Operación con plantilla** | El servidor guarda los mensajes (plantilla) y el cliente solo envía las variables. |
| **Modo cuenta** | La app usa el backend con sesión de usuario. Es el modo por defecto en Secretario v4. |
| **Modo BYOK** | *Bring Your Own Key*: la app usa las API keys del propio usuario, sin backend. No afecta a este documento salvo para delimitarlo. |
| **Tester** | Rol de usuario que puede simular compras en producción mientras el proveedor de pagos sea el simulado. |
| **Predeterminados** | Plantilla de datos de usuario de una app (en Secretario: sustituciones, textos rápidos, prompts, preferencias) que define el administrador y se copia a la cuenta la primera vez que usa esa app. |
| **Coste real** | Lo que el proveedor de IA cobra al administrador por una llamada, en USD. |
| **Comisión del proveedor** | Coste indirecto que no aparece en el coste real de cada llamada (p. ej. la comisión de OpenRouter al recargar saldo). |
| **Idempotency-Key** | Identificador único que el cliente asigna a una acción y reutiliza en sus reintentos para no ejecutarla ni cobrarla dos veces. |

---

## 3. Actores

| Actor | Descripción |
|---|---|
| **Visitante** | Persona sin sesión. Ve la landing, las landings de las apps, las páginas legales y de precios, el registro y el login web. |
| **Usuario** | Cuenta verificada. Usa cualquier app cliente y el panel de usuario. |
| **Tester** | Usuario marcado por el administrador; puede simular compras en producción. |
| **Administrador** | Una única cuenta con rol `admin`. Accede al panel de administración y gestiona apps, operaciones y economía. |
| **App cliente** | Cliente registrado que consume la API `/api/v1` con un token Bearer. Tipos: escritorio (Secretario, Electron/Windows), web o móvil. |
| **Proveedores de IA** | Mistral (Voxtral, transcripción) y OpenRouter (texto, imagen, audio de respaldo). |
| **Resend** | Servicio de envío de emails transaccionales. |
| **Proveedor de pagos** | `simulated` en la v4; `stripe` en la fase siguiente. |
| **Proveedor de facturación** | `none` en la v4; servicio externo o Stripe en la fase de cobros reales (ver BE-FR-75). |

---

## 4. Arquitectura y stack

### 4.1 Stack

| Pieza | Elección | Notas |
|---|---|---|
| Framework | **SvelteKit** (`adapter-node`) | Un único proyecto para landing, panel de usuario, panel de administración y API (`+server.ts`). Sirve los dos dominios (API y web) desde la misma instancia. |
| Base de datos | **SQLite** en modo **WAL** | Un fichero en volumen persistente. Las escrituras se serializan, lo que garantiza que dos peticiones simultáneas no gasten ni reserven el mismo crédito. |
| ORM | **Drizzle** (`sv add drizzle`) | Migraciones versionadas en el repositorio. |
| Autenticación | **Better Auth** (`sv add better-auth`) con adaptador Drizzle | Plugins: `bearer` y `admin`; cambio de email con verificación. Las form actions lo llaman con su API de servidor (`auth.api`), y por esa vía no actúan sus plugins `captcha` ni `rateLimit`, que no se usan: el captcha Turnstile (adaptador `CaptchaVerifier`) y los límites de autenticación por IP (tabla `auth_rate_limits`) los implementa la funcionalidad `accounts` (BE-FR-01, BE-FR-45). |
| Audio | **ffmpeg** y **ffprobe** en la imagen del contenedor | ffprobe mide en el servidor la duración del audio (BE-FR-44); ffmpeg convierte el audio que se envía al respaldo de OpenRouter (BE-FR-35). |
| Validación y contrato | **Zod 4** + **zod-openapi** | De los esquemas se genera el **OpenAPI** de la API (ver 7.1). |
| Internacionalización | **Paraglide** (`sv add paraglide`) | Solo `es` en la v4. |
| Estilos | **Tailwind CSS** | |
| Tests | **Vitest** | Obligatorios para la lógica de créditos, reservas y tarificación (ver 10.4). |
| Emails | **Resend** | Tras una interfaz de envío propia (ver 5.13). |
| Backups | **Litestream** → **Backblaze B2** (región UE, EU Central) | Bucket privado dedicado; clave de aplicación limitada a ese bucket. |
| Despliegue | **Coolify** | Una sola instancia por entorno (requisito de SQLite); entornos `production` y `staging`. |
| Logs y monitorización | **pino** (servidor) y **loglevel** (navegador) → stdout + **Log Gateway** → **OpenObserve** | Constitución, principio XI. El envío al Gateway es un adaptador con interfaz propia; hasta que el propietario entregue el contrato de ingesta (entrada de L01), los logs solo van a stdout. |

### 4.2 Componentes lógicos

```
                    ┌──────────────────────────── SvelteKit (una instancia) ───────────────────────────┐
Apps cliente ──────►│ api.mardomingo.com/api/v1/*  (Bearer + X-App-Id)                                 │
(escritorio, web,   │   auth · me · ai/chat · ai/transcribe · ai/image · sync · defaults · app/status   │
 móvil)             │                                                                                   │
Navegador ─────────►│ cuenta.mardomingo.com: /  /apps/<slug>  /precios  /registro  /login  /panel/*     │
                    │                        /admin/*  /terminos /privacidad /cookies /uso-aceptable     │
                    │                                                                                   │
                    │  Servicios: apps y catálogo · auth · créditos (ledger + reservas) · tarificación · │
                    │             pasarela IA · plantillas · pagos · facturación · sincronización ·      │
                    │             límites · anuncios · emails · tareas programadas                       │
                    └───────┬─────────────────────┬──────────────────────┬──────────────────────────────┘
                            │                     │                      │
                        SQLite (WAL)         Mistral / OpenRouter     Resend · Proveedor de pagos ·
                            │                                         Proveedor de facturación
                       Litestream → B2 (UE)
```

### 4.3 Convenciones

- Todo el texto visible (web y emails) en **español**, a través de los mensajes de Paraglide; ningún texto visible *hardcodeado* en componentes.
- Fechas almacenadas en UTC (ISO 8601). Los cortes "diarios" (topes, estadísticas) usan la zona **Europe/Madrid**.
- Importes en euros almacenados en **céntimos** (entero). Costes en USD almacenados en **micro-USD** (entero).
- La API es JSON salvo la subida de audio (`multipart/form-data`).
- Todo dato que dependa de la app (operaciones, sincronización, predeterminados, versiones, mantenimiento, enlaces, anuncios) se guarda con `app_id`. Lo que pertenece a la cuenta (saldo, bolsas, pagos, facturas, datos fiscales, aceptaciones legales) **no** tiene `app_id`, salvo como dato informativo (p. ej. qué app originó un consumo).

---

## 5. Requisitos funcionales

Cada requisito tiene identificador `BE-FR-XX` y criterios de aceptación (`CA`).

### 5.1 Apps cliente y cuenta compartida

**BE-FR-62 — Registro de apps.** El administrador da de alta y edita apps desde el panel, sin redesplegar. Cada app tiene:
- `slug` (identificador estable, p. ej. `secretario`), nombre visible, descripción corta y tipos de cliente (`desktop`/`web`/`mobile`).
- Estado: `active` o `disabled`.
- Enlaces: landing (interna `/apps/<slug>` o externa), descarga, notas de versión.
- Versión mínima y recomendada, y si se exige la versión (`enforce_version`; normalmente desactivado en apps web).
- Mantenimiento propio (además del global) con mensaje.
- Texto opcional de pasos siguientes tras verificar la cuenta (BE-FR-64 CA2).
- Orígenes permitidos para CORS (solo apps web).
- Sobrescrituras de límites y parámetros globales (sección 9, los marcados como "por app").
- Esquema del documento de sincronización (BE-FR-39) y predeterminados (BE-FR-42).
- Catálogo de operaciones (BE-FR-77).
- Email de soporte propio opcional (BE-FR-84).
- CA1: Toda petición a `/api/v1` (salvo `/health`, `/openapi.json` y el *preflight* CORS, BE-FR-65 CA2) lleva `X-App-Id`. Ausente o desconocido → `400 UNKNOWN_APP`; app `disabled` → `503 APP_DISABLED`.
- CA2: `X-App-Id` **identifica, no autentica**: los clientes públicos no pueden guardar secretos. La seguridad descansa en la sesión del usuario, los límites y las reservas.
- CA3: Dar de alta una app o una operación no requiere redesplegar.
- **Perfil inicial:** se crea la app `secretario` (tipo `desktop`) con las operaciones de BE-FR-31, el esquema de sincronización de BE-FR-39 y los parámetros de audio de la sección 9.

**BE-FR-63 — Cuenta y saldo compartidos.** Una cuenta sirve en todas las apps y tiene **un único saldo**.
- CA1: El saldo de bienvenida se concede **una vez por cuenta** (no por app).
- CA2: El ledger, las reservas y `ai_operations` registran la app que originó cada consumo; el panel de usuario permite filtrar el consumo por app.
- CA3: Los términos, la política de privacidad y la política de uso aceptable son **de la plataforma** y cubren todas las apps; la política de privacidad enumera las apps y los proveedores que procesan datos de cada una.
- CA4: Los topes por cuenta (tope diario sin compras, deuda máxima, peticiones por minuto) se aplican a la **suma** de todas las apps.

**BE-FR-64 — Marca paraguas y origen del registro.** La web (registro, login, panel, administración) y los emails usan la marca paraguas. El registro admite el parámetro `?app=<slug>`:
- CA1: Se guarda la app de origen en la cuenta (`signup_app_id`) a efectos estadísticos.
- CA2: Tras verificar el email, la página de confirmación muestra los siguientes pasos de esa app (p. ej. "Descarga Secretario AI e inicia sesión"). Por defecto el texto se genera con el nombre de la app, su botón de descarga o acceso e «inicia sesión con tu email»; si la app tiene un texto propio de pasos siguientes (BE-FR-62), se usa ese.
- CA3: Los emails que se refieren a una app concreta la mencionan por su nombre visible.

**BE-FR-65 — Clientes web y móviles.**
- CA1: Todas las apps se autentican con **token Bearer** (BE-FR-03); la cookie de sesión es exclusiva de la web de la cuenta.
- CA2: CORS por app. El *preflight* (`OPTIONS`, que no lleva `X-App-Id`) se acepta si el origen figura en la lista de alguna app activa. La petición real con cabecera `Origin` solo se acepta si el origen figura en la lista de la app indicada en `X-App-Id`; si no, `403 ORIGIN_NOT_ALLOWED`. Las apps de escritorio y móviles no envían `Origin`.
- CA3: La sesión queda **ligada a la app** con la que se inició; una petición con otro `X-App-Id` → `401 UNAUTHENTICATED`.

### 5.2 Cuentas y autenticación

**BE-FR-01 — Registro web.** El registro se hace **solo en la web** (`/registro`), con email, contraseña, aceptación de los términos, la política de privacidad y la política de uso aceptable vigentes, declaración de edad mínima (BE-FR-69) y captcha Turnstile.
- CA1: La contraseña tiene entre 8 y 128 caracteres.
- CA2: Se registra la versión de cada documento aceptado y la fecha (`terms_acceptances`).
- CA3: Sin captcha válido, el registro se rechaza. El token de Turnstile lo verifica en el servidor la funcionalidad `accounts` mediante el adaptador `CaptchaVerifier` (no el plugin `captcha` de Better Auth; 4.1).
- CA4: Tras registrarse, se envía el email de verificación y la cuenta queda **sin verificar** (`email_verified = false`).
- CA5: La respuesta no revela si el email ya existía (anti-enumeración): siempre "Te hemos enviado un email".

**BE-FR-02 — Verificación de email.** La cuenta solo puede usarse tras pulsar el enlace de verificación (validez: 24 h).
- CA1: Al verificar, se crea la **bolsa de bienvenida** (BE-FR-12). Los **datos predeterminados** de cada app se siembran la primera vez que la cuenta usa esa app (BE-FR-40).
- CA2: Un login (web o app) de una cuenta sin verificar responde `EMAIL_NOT_VERIFIED`.
- CA3: Existe "Reenviar email de verificación" (web y API), limitado por *rate limit*.

**BE-FR-03 — Login.** Por email y contraseña, en la web (cookie de sesión) y en las apps (token Bearer vía `POST /api/v1/auth/login`).
- CA1: Credenciales erróneas → `INVALID_CREDENTIALS`, sin distinguir entre email inexistente y contraseña incorrecta.
- CA2: Cuenta bloqueada → `ACCOUNT_BLOCKED`.
- CA3: El login desde una app registra en la sesión la **app**, el **nombre del equipo** y la **versión de la app** enviados por el cliente.

**BE-FR-04 — Sesiones.** Sesiones opacas almacenadas en base de datos (Better Auth), con **caducidad deslizante de 30 días**: cada uso con más de 24 h desde la última renovación extiende la caducidad a 30 días desde ese momento.
- CA1: Una sesión sin uso durante 30 días deja de ser válida (`UNAUTHENTICATED`).
- CA2: Revocar una sesión tiene efecto inmediato en la siguiente petición.
- CA3: Cambiar la contraseña revoca todas las sesiones excepto la actual.
- CA4: Bloquear a un usuario revoca todas sus sesiones.
- CA5: No hay límite de sesiones simultáneas por cuenta.
- CA6: Las sesiones caducadas se eliminan pasados 30 días desde su caducidad (BE-FR-83).

**BE-FR-05 — Recuperación y cambio de contraseña.** Solo en la web. El enlace de recuperación caduca en 1 h y es de un solo uso. El cambio de contraseña exige la contraseña actual. Ambos envían el email de aviso de seguridad (5.13).

**BE-FR-06 — Cerrar sesión.** `POST /api/v1/auth/logout` revoca la sesión del token usado. En el panel: cerrar una sesión concreta o todas.

**BE-FR-66 — Cambio de email.** Solo en la web, desde el perfil, con confirmación de la contraseña.
- CA1: Se envía un enlace de verificación (24 h) a la **nueva** dirección; el cambio solo se aplica al pulsarlo.
- CA2: Se envía un aviso de seguridad a la dirección **anterior**, con el email de soporte por si no fue el usuario.
- CA3: La nueva dirección no puede pertenecer a otra cuenta (la respuesta no lo revela: "Si la dirección es válida, recibirás un email").
- CA4: Se recalcula `email_normalized`. No se concede de nuevo saldo de bienvenida (es por cuenta, BE-FR-63).
- CA5: Al aplicarse el cambio se revocan todas las sesiones excepto la actual.

**BE-FR-67 — Bloqueo temporal por intentos fallidos.** Además del *rate limit* por IP (BE-FR-45), tras `login_max_failures` intentos fallidos para un mismo email en 15 minutos, los logins de ese email se rechazan durante `login_lock_minutes` con `429 LOGIN_TEMPORARILY_LOCKED` y `Retry-After`.
- CA1: El contador se lleva por email normalizado **exista o no la cuenta**, para no revelar qué emails están registrados.
- CA2: Un login correcto o una recuperación de contraseña completada ponen el contador a cero.

**BE-FR-68 — Limpieza de cuentas sin verificar.** Las cuentas sin verificar con más de `unverified_account_ttl_days` días se eliminan por completo (no tienen saldo ni datos), y el email queda libre.

**BE-FR-86 — Cuentas inactivas.** Una cuenta verificada **sin ninguna compra real** y sin actividad (ni login, ni uso de la API, ni acceso al panel; se registra en `user.last_activity_at`) durante `inactive_account_years` años recibe un email de aviso. Si no hay actividad en los `inactive_account_notice_days` días siguientes, se borra según BE-FR-07.
- CA1: Las cuentas con alguna compra real **nunca** se cierran de forma automática, tengan o no saldo, para no quedarse con dinero del usuario.
- CA2: Cualquier actividad durante el plazo de aviso cancela el borrado.
- CA3: Los créditos gratuitos restantes se pierden con el borrado (movimiento `forfeit`, BE-FR-07 CA4), aunque normalmente ya han caducado antes (BE-FR-16).

**BE-FR-69 — Edad mínima.** El registro exige marcar "Declaro tener al menos `min_age` años". La declaración se guarda en `terms_acceptances` (`document = age_declaration`). El valor por defecto (18) lo confirma el profesional legal (12, decisión 14).

**BE-FR-70 — Nuevas versiones de documentos legales.** El administrador publica versiones nuevas de términos, privacidad, cookies y uso aceptable indicando si **requieren nueva aceptación** o son **solo informativas**.
- CA1: Con una versión que requiere aceptación pendiente, `GET /me` y la respuesta de login la incluyen en `pendingAcceptances`, y las operaciones de IA y de sincronización responden `403 TERMS_ACCEPTANCE_REQUIRED`. Login, logout, `/me`, `/app/status`, `/defaults` y la aceptación siguen funcionando.
- CA2: La app muestra los documentos (enlaces) y acepta con `POST /api/v1/me/accept-terms`; la web muestra el mismo aviso al entrar en el panel.
- CA3: Las versiones solo informativas se notifican por email y en el panel, sin bloquear.

**BE-FR-07 — Borrado de cuenta.** Desde el panel, con confirmación de contraseña y aviso explícito de que **el saldo restante se pierde sin reembolso** y de que afecta a **todas las apps**.
- CA1: Se revocan todas las sesiones y se eliminan los datos personales de la fila de `user` (email incluido), el perfil, los datos fiscales y los datos sincronizados de todas las apps. La cuenta queda marcada con `deleted_at`. Las IP de registro y de aceptaciones legales siguen el plazo de BE-FR-83.
- CA2: Los movimientos de créditos, las operaciones y los pagos se **conservan anonimizados** por obligaciones contables y estadísticas: las tablas inmutables solo guardan el `user_id` opaco, de modo que quedan sin datos personales al borrarlos de `user` y **no** se modifican (no hace falta ninguna vía que desactive sus *triggers*, 15.27 pregunta 3). Las facturas emitidas se conservan íntegras durante el plazo legal (BE-FR-83), porque la normativa lo exige.
- CA3: El email queda libre para un registro nuevo, pero **no** recibe de nuevo el saldo de bienvenida si su forma normalizada ya lo recibió (se conserva en `welcome_grants` el hash HMAC del email normalizado, BE-FR-11.5).
- CA4: Las bolsas con saldo restante se ponen a cero con un movimiento `forfeit`, que cuenta en las estadísticas (BE-FR-54).

**BE-FR-08 — Exportación de datos (RGPD).** El panel permite descargar un JSON con perfil, datos fiscales, datos sincronizados de cada app, movimientos, operaciones (metadatos), pagos, facturas y aceptaciones legales del usuario.

**BE-FR-09 — Preparado para Google OAuth.** El modelo de cuentas de Better Auth (tabla `account` separada de `user`) se mantiene tal cual para poder añadir Google en fase 2 sin migraciones de datos. Como Google exige iniciar sesión en el navegador, la fase 2 añadirá un login en el navegador con retorno a la app (12, decisión 12) **además** de `POST /auth/login`, sin cambiar los endpoints existentes.

**BE-FR-10 — Seguridad de la cuenta de administrador.** La cuenta `admin` se protege solo con contraseña (decisión expresa: **sin segundo factor** en la v4). Se recomienda una contraseña larga y única, no reutilizada en otros servicios.

### 5.3 Antiabuso del saldo de bienvenida

**BE-FR-11 — Capas antiabuso.**
1. Verificación de email obligatoria antes de recibir créditos (BE-FR-02).
2. Bloqueo de **dominios de email desechables** mediante una lista mantenida y actualizable sin redesplegar.
3. **Turnstile** en el registro (BE-FR-01).
4. **Límite de altas por IP**: máximo `registrations_per_ip_24h` registros por IP en 24 h.
5. **Normalización del email** para la concesión del saldo de bienvenida: minúsculas, eliminación del sufijo `+etiqueta` en cualquier dominio y eliminación de puntos en `gmail.com`/`googlemail.com`. Se guarda `email_normalized` con índice, pero **no único** (CA1 admite varias cuentas con la misma forma normalizada). La concesión se controla con `welcome_grants`, que guarda, con restricción de unicidad, un hash **HMAC-SHA256** del email normalizado calculado con la clave secreta propia `EMAIL_HASH_KEY` (sección 9; nunca se rota) y sobrevive al borrado de la cuenta (BE-FR-07 CA3).
6. **Tope de gasto diario para cuentas sin compras**: un usuario sin ninguna compra real completada no puede gastar (cobros del día + reservas activas) más de `daily_cap_no_purchase` créditos al día (Europe/Madrid), sumando todas las apps. Al superarlo: `DAILY_FREE_LIMIT_REACHED`.
- CA1: Un segundo registro con `juan+2@gmail.com` cuando ya existe `j.uan@gmail.com` puede crear la cuenta, pero **no** recibe saldo de bienvenida (se le informa en el panel).
- CA2: Las compras simuladas **no** cuentan como compra a efectos de este tope.

### 5.4 Créditos, bolsas y reservas

**BE-FR-12 — Bolsa de bienvenida.** Al verificar el email se crea una bolsa `free` con `welcome_credits`, caducidad a `free_credits_expiry_days` días.

**BE-FR-13 — Tipos de bolsa.**

| Tipo | Origen | Caducidad |
|---|---|---|
| `free` | Bienvenida, ajuste manual gratuito del administrador | Sí (configurable; el ajuste manual puede fijar la suya) |
| `paid` | Compra (real o simulada), ajuste manual "como comprado" | **Nunca** |

**BE-FR-14 — Orden de consumo.** Primero bolsas `free` (la que caduca antes primero), después `paid` (la más antigua primero). Si no queda saldo, el resto pasa a **deuda** (BE-FR-17).

**BE-FR-15 — Libro de movimientos (ledger).** Todo cambio de saldo genera un movimiento inmutable en `credit_movements`: `welcome`, `purchase`, `usage`, `adjustment`, `expiry`, `refund`, `chargeback`, `debt_settlement`, `forfeit` (saldo anulado al borrar la cuenta, BE-FR-07 CA4). El saldo visible es siempre la suma de bolsas menos la deuda, y debe poder **reconstruirse** a partir del ledger. Las reservas (BE-FR-71) **no** son movimientos: no cambian el saldo, solo el saldo disponible.
- CA1: Existe una comprobación (tarea programada diaria y test) de que, para cada usuario, saldo materializado = reconstrucción desde el ledger; una discrepancia genera alerta al administrador.

**BE-FR-16 — Caducidad.** Una tarea diaria pone a cero las bolsas `free` caducadas y registra movimientos `expiry`. Siete días antes (`free_expiry_warning_days`) se envía un único email de aviso si la bolsa conserva saldo.

**BE-FR-17 — Saldo mínimo y deuda.**
- Para **lanzar** una operación hace falta `saldo disponible ≥ min_balance_to_operate` y que la reserva de la operación quepa (BE-FR-71); si no, `INSUFFICIENT_BALANCE` y **no se llama al proveedor**.
- Si el coste final supera el saldo (porque superó la estimación), se cobra igualmente: el exceso pasa a deuda, hasta `max_debt`. El exceso por encima de `max_debt` lo absorbe el administrador (se registra en estadísticas como pérdida).
- Con deuda > 0 no se pueden lanzar operaciones.
- La siguiente entrada de créditos `paid`, o cualquier ajuste positivo del administrador (BE-FR-18), gratuito o comprado, **liquida primero la deuda** (movimiento `debt_settlement`). En un ajuste gratuito, la parte que liquida la deuda se registra en estadísticas como pérdida absorbida.

**BE-FR-71 — Reservas de saldo.** Antes de llamar al proveedor, el backend calcula el **coste máximo estimado** de la operación (BE-FR-72) y, en una transacción, crea una **reserva** por ese importe.
- La operación solo se lanza si `reserva ≤ saldo disponible + (max_debt − deuda actual)` y `saldo disponible ≥ min_balance_to_operate`. Si no, `402 INSUFFICIENT_BALANCE` con `details.requiredMicro` y `details.availableMicro`.
- Al terminar, en la misma transacción del cobro (sección 8): se cobra el **coste real** y se libera la reserva. Si la operación no se cobra (BE-FR-21), la reserva se libera sin movimiento.
- Las reservas caducan a los `hold_ttl_seconds`. Al arrancar el servidor, todas las reservas abiertas se liberan y sus operaciones se marcan como `interrupted` (sin cobro).
- CA1: Un usuario con saldo para 3 operaciones que lanza 20 a la vez obtiene, como máximo, las que caben; el resto recibe `INSUFFICIENT_BALANCE`. La exposición total de una cuenta nunca supera `saldo + max_debt`, salvo que el coste real supere la estimación.
- CA2: El saldo que devuelve la API distingue total, reservado y disponible.
- *Compromiso conocido:* una operación con `max_output_tokens` alto exige más saldo disponible para lanzarse, aunque su coste real sea pequeño. El administrador lo ajusta por operación (BE-FR-77).

**BE-FR-18 — Ajustes manuales.** El administrador puede sumar o restar créditos a un usuario indicando tipo de bolsa, caducidad (si es `free`) y **motivo obligatorio**. Queda en el ledger y en la auditoría (BE-FR-55).
- CA1: Un ajuste negativo no puede superar el saldo disponible (BE-FR-71): si lo supera, se rechaza con un error de validación. El administrador no crea deuda por ajuste.

### 5.5 Tarificación

**BE-FR-19 — Fórmula de cobro.** Para cada operación completada:

```
coste_eur      = coste_real_usd × (1 + comision_proveedor) × fx_usd_eur
precio_eur     = coste_eur × margen(operación)          // margen por operación o, si no hay, margin_global
cobro_creditos = precio_eur × credits_per_eur_usage
cobro_µc       = ceil(cobro_creditos × 1.000.000)
```

- `comision_proveedor` es `provider_fee_pct_openrouter` o `provider_fee_pct_mistral` según el proveedor que respondió. Recoge costes indirectos que no aparecen en el coste de cada llamada (OpenRouter cobra una comisión al recargar saldo con tarjeta, ≈ 5,5 %; verificar la tarifa vigente).
- `credits_per_eur_usage` (valor de consumo) es un parámetro **distinto** de `credits_per_eur_purchase` (créditos que da cada euro al comprar). Así, una promoción de compra ("este mes 1 € = 120 créditos") no altera el precio de las operaciones, y cambiar la conversión de compra **no afecta a créditos ya comprados**.
- Ambos valen **1.000** por defecto (1 crédito = 0,1 céntimos).

**BE-FR-20 — Origen del coste real.**

| Proveedor | Fuente del coste |
|---|---|
| OpenRouter (texto, imagen, audio de respaldo) | Campo `usage.cost` de la respuesta (el parámetro `usage: { include: true }` ya no tiene efecto, así que no se depende de él). Si falta, se consulta `GET /api/v1/generation?id=<id>`. Si tampoco está disponible, se estima con los precios por token del modelo y se marca la operación como `cost_estimated = true`. |
| Mistral (Voxtral) | `segundos de audio × voxtral_price_per_minute_usd / 60`. Los segundos se toman del `usage` de la respuesta si lo incluye; si no, de la duración medida en el servidor (BE-FR-44). **Nunca** se confía en una duración enviada por el cliente. |

**BE-FR-21 — Qué no se cobra.**
- Operaciones rechazadas antes de llamar al proveedor (validación, saldo, límites, mantenimiento, coste máximo).
- Operaciones en las que **todos** los proveedores fallan.
- Operaciones **canceladas** por el cliente antes de que el proveedor respondiera. El proveedor puede facturarlas igualmente: ese coste, si se conoce, se registra como «pérdida por cancelación» (BE-FR-37). Si el proveedor ya había respondido (coste conocido), se cobra, salvo en el caso de reintento de BE-FR-81.
- Operaciones `interrupted` (reinicio del servidor durante la llamada).
- En la transcripción con *fallback*: si Voxtral falla y el backup responde, solo se cobra lo que haya facturado cada proveedor realmente (normalmente, solo el backup).

**BE-FR-87 — Tipo de cambio automático.** `fx_usd_eur` se calcula a diario a partir del **tipo de referencia del Banco Central Europeo** (publicación diaria, gratuita) más un colchón `fx_buffer_pct` que cubre la diferencia con el cambio que aplica el banco del administrador:

```
fx_usd_eur = (1 / tipo_BCE_EUR_USD) × (1 + fx_buffer_pct)
```

- CA1: Cada valor aplicado se guarda con su fecha y su origen (`ecb` / `manual`); las operaciones usan el vigente en el momento del cobro.
- CA2: Si la consulta falla, se mantiene el último valor; si falla `fx_stale_alert_days` días seguidos, se avisa al administrador.
- CA3: El administrador puede fijar un valor manual que sustituye al automático hasta que lo desactive (queda en la auditoría).

**BE-FR-22 — Ejemplos numéricos** (valores por defecto: `fx_usd_eur = 0,92`, `margin_global = 2,0`, `credits_per_eur_usage = 1.000`, comisión de OpenRouter 5,5 %, de Mistral 0 %).

| Caso | Coste real | Cálculo | Cobro |
|---|---|---|---|
| Fix de un párrafo (OpenRouter) | 0,00040 USD | 0,0004 × 1,055 × 0,92 × 2,0 × 1.000 | 0,77648 créditos (776.480 µc) → se muestra "0,8" |
| Transcripción de 2 min (Voxtral a 0,001 USD/min) | 0,002 USD | 0,002 × 1,0 × 0,92 × 2,0 × 1.000 | 3,68 créditos (3.680.000 µc) → "3,7" |
| Prompt Directo largo con modelo PRO | 0,03 USD | 0,03 × 1,055 × 0,92 × 2,0 × 1.000 | 58,236 créditos (58.236.000 µc) → "58" |
| Saldo 55; reserva estimada 50; coste final 58,236 (supera la estimación) | — | 55 de bolsas + 3,236 a deuda (≤ `max_debt`) | Saldo −3,236 → se muestra "−3,2" |

**Justificación del margen ×2,0:** con precios con IVA incluido (21 %) y la comisión de Stripe, un paquete de 5 € deja unos 3,80 € netos; el margen mínimo para no perder dinero es ≈ ×1,32. El ×2,0 cubre además el saldo de bienvenida, la deuda absorbida y los imprevistos, con un beneficio razonable.

**Redondeo de presentación** (web y apps): importes ≥ 10 sin decimales; entre 0,1 y 10 con un decimal; importes > 0 y < 0,1 se muestran como "< 0,1". Internamente siempre se cobra el valor exacto en microcréditos.

**BE-FR-72 — Coste máximo por operación.** Cada operación del catálogo tiene `max_output_tokens` (se envía al proveedor como `max_tokens`) y `max_cost_credits` (tope duro).
- Estimación del coste máximo, con la fórmula de BE-FR-19 sobre:
  - **Chat**: tokens de entrada estimados (`caracteres / chars_per_token_estimate` + `image_input_token_estimate` por imagen) × precio de entrada + `max_output_tokens` × precio de salida (incluye razonamiento). Precios tomados de la caché de modelos de OpenRouter (BE-FR-80); se usa el más caro entre el modelo principal y sus respaldos.
  - **Transcripción**: duración medida en el servidor × el precio más caro entre Voxtral y el backup.
  - **Imagen**: precio por imagen del modelo o, si no se conoce, `estimated_max_cost_usd` configurado en la operación.
- CA1: Si la estimación supera `max_cost_credits` → `413 OPERATION_TOO_EXPENSIVE` (con `details.estimatedMicro` y `details.maxMicro`), sin llamar al proveedor y sin cobrar.
- CA2: Si el modelo corta la respuesta por llegar a `max_output_tokens`, la respuesta lo indica con `truncated: true` y se cobra normalmente.
- CA3: Si no hay precio conocido para el modelo ni `estimated_max_cost_usd`, la operación no se puede activar en el panel.

**BE-FR-73 — Precios orientativos.** Página pública `/precios` (enlazada también desde la compra en el panel) con el coste típico de cada operación, agrupado por app, en créditos y con ejemplos legibles ("1 minuto de dictado ≈ 1,8 créditos"; "con 5 € puedes dictar unas N horas").
- CA1: El coste típico es la **mediana** de los cobros de los últimos `price_reference_window_days` días cuando hay al menos `price_reference_min_samples` operaciones; si no, un valor introducido por el administrador.
- CA2: Se recalcula a diario. La página indica que el cobro real depende de la longitud del texto o del audio y del modelo vigente.

### 5.6 Compras y pagos

**BE-FR-23 — Paquetes.** El administrador define paquetes (comunes a todas las apps): nombre, precio en euros (IVA incluido), bonificación porcentual en créditos, activo/inactivo y orden. Créditos de un paquete = `precio_eur × credits_per_eur_purchase × (1 + bonificación)`, calculados **en el momento de la compra**.
- Por defecto: 5 € (+0 %), 10 € (+5 %), 25 € (+10 %).

**BE-FR-24 — Interfaz de proveedor de pagos.** Toda la lógica de compra pasa por una interfaz única:

```
createCheckout(user, pack, billingProfile?) → { redirectUrl } | { completed: true, paymentId }
handleWebhook(request)                      → eventos normalizados: payment_completed | payment_refunded | chargeback_opened
refund(paymentId, amount)                   → resultado
```

El proveedor activo se elige con una **variable de entorno del servidor** (`PAYMENTS_PROVIDER=simulated|stripe`), no desde el panel, porque implica secretos.
- CA1: La acreditación de créditos es **idempotente** por identificador de pago/evento: un webhook repetido no acredita dos veces.

**BE-FR-25 — Proveedor simulado.** Con `simulated`, "Comprar" completa el pago al instante sin cobrar dinero y acredita una bolsa `paid` marcada `simulated = true`.
- CA1: Si `APP_ENV != production`, cualquier usuario puede simular compras.
- CA2: Si `APP_ENV = production`, solo los usuarios con rol `tester` o `admin` pueden; para el resto, los botones de compra aparecen desactivados con el texto "Próximamente".
- CA3: Las compras simuladas se excluyen de los ingresos en estadísticas, no generan factura y no cuentan como "compra" para el tope diario (BE-FR-11.6).
- CA4: Al abrir la página de compra, el servidor genera un **identificador de intento** de un solo uso que viaja en el formulario. La compra es idempotente por ese identificador: un doble clic, un reenvío o volver atrás y reenviar muestran la misma compra sin acreditar de nuevo. Funciona sin JavaScript y vale igual para el proveedor `stripe` (sesión de checkout).

- CA5: En la v4, las compras simuladas registran el IVA español del 21 % incluido en el precio y el país `ES` (`vat_rate`, `base_eur_cents`, `vat_eur_cents`, `country`). El cálculo real del IVA llega con Stripe Tax en la fase de cobros reales (BE-FR-29), pendiente de la gestoría (12, decisiones 2 y 3).

**BE-FR-26 — Aceptación previa al pago.** Antes de comprar, el usuario marca una casilla por la que acepta el inicio inmediato del servicio y reconoce la pérdida del derecho de desistimiento sobre el contenido digital. Se registra con fecha y versión del texto. En el mismo paso puede indicar que quiere **factura completa** (BE-FR-74).

**BE-FR-27 — Reembolsos.** No hay reembolsos automáticos ni solicitables desde el panel. El administrador puede reembolsar manualmente una compra: retira de la bolsa de esa compra el saldo no consumido que indique (movimiento `refund`), con un proveedor real ordena la devolución del importe que indique (≤ importe pagado) y se emite la factura rectificativa (BE-FR-75).

**BE-FR-28 — Contracargos.** Un `chargeback_opened` retira el saldo restante de la bolsa afectada; si no alcanza, el resto pasa a deuda **sin el tope `max_debt`**; la cuenta queda **bloqueada** hasta revisión del administrador.

**BE-FR-29 — Fase Stripe (posterior, fuera de la v4).** Implementación `stripe` de la interfaz: Stripe Checkout, Stripe Tax, webhooks `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`, recibos de Stripe y activación de la facturación real (BE-FR-75). Requiere resolver antes las decisiones fiscales (sección 12).

### 5.7 Facturación

**BE-FR-74 — Datos fiscales.** El perfil del usuario admite, de forma **opcional**, datos fiscales: tipo (`individual` / `business`), nombre o razón social, NIF/NIE/CIF o NIF-IVA, dirección, código postal, ciudad y país.
- CA1: Son obligatorios para obtener factura completa; se pueden rellenar en el perfil o en el paso de compra.
- CA2: Se valida el formato del identificador fiscal español; la comprobación de NIF-IVA intracomunitarios (VIES) se decide con la gestoría (12, decisión 2).
- CA3: Cada factura guarda una **copia** de los datos fiscales del momento de emisión (cambiar el perfil no altera facturas emitidas).

**BE-FR-75 — Facturas.** Cada compra **real** completada genera una factura a través de una interfaz propia:

```
issueInvoice(payment, billingSnapshot) → { invoiceId, number, pdfUrl }
issueCorrective(invoice, amount)        → { invoiceId, number, pdfUrl }
```

- Factura **simplificada** si el usuario no pidió factura completa; **completa** si la pidió y tiene datos fiscales; **rectificativa** en reembolsos y contracargos.
- Numeración correlativa por serie, facturas inmutables, PDF descargable en el panel.
- El usuario puede pedir después la factura completa de una compra con factura simplificada, en el plazo y la forma que indique la gestoría.
- **No se construye un motor de facturación propio**: la emisión se delega en un proveedor de facturación que cumpla la normativa española (Verifactu) o en Stripe Invoicing, a decidir con la gestoría (12, decisión 2). En la v4 el proveedor es `none` (no hay cobros reales).
- CA1: Las compras simuladas no generan factura.
- CA2: La emisión es idempotente por pago.

**BE-FR-76 — Exportación contable.** El administrador exporta en CSV, por periodo:
- **Ventas**: fecha, id de usuario, datos fiscales (si los hay), país, base imponible, tipo y cuota de IVA, total, número de factura, referencia del proveedor de pagos, reembolsos y contracargos asociados.
- **Costes de IA**: coste real por proveedor, día y app (USD y EUR), como soporte del gasto.
- **Resumen mensual**: ingresos, reembolsos, costes y margen bruto.

### 5.8 Pasarela de IA

**BE-FR-30 — Principio.** Cada app tiene un **catálogo de operaciones** (BE-FR-77). En las operaciones **libres**, la app **construye los mensajes** (prompts de sistema y de usuario); en las operaciones **con plantilla**, el servidor guarda los mensajes y la app solo envía variables (BE-FR-78). En ambos casos el backend **elige el modelo** según la operación, aplica las restricciones de privacidad, reserva saldo, llama al proveedor, cobra y devuelve el resultado. El cliente **nunca** indica el modelo ni el proveedor.

**BE-FR-31 — Operaciones válidas.** Solo las operaciones **activas** del catálogo de la app indicada en `X-App-Id`; cualquier otra → `VALIDATION_ERROR` (con `details.field = "operation"`).

**Perfil de la app `secretario`** (todas sus operaciones son **libres**):

| Operación | Endpoint | Origen en la app (v3) | Grupo de modelo por defecto |
|---|---|---|---|
| `improve` | `/ai/chat` | Procesar (Improve) | Corrector |
| `enhance` | `/ai/chat` | Botón 😎 | Corrector |
| `fix` | `/ai/chat` | Fix (normal y modo preguntas) | Corrector |
| `beautify` | `/ai/chat` | Beautify Markdown (niveles 1 y 2) | Corrector |
| `translate` | `/ai/chat` | Traducir | Corrector |
| `image-transcription` | `/ai/chat` | Transcripción de imagen del portapapeles | Corrector (con visión) |
| `direct-prompt` | `/ai/chat` | Prompt Directo | PRO |
| `custom-prompt` | `/ai/chat` | Botones de prompts personalizados | PRO |
| `adhoc-prompt` | `/ai/chat` | Prompt ad hoc | PRO |
| `transcription` | `/ai/transcribe` | Transcripción de audio | Voxtral + backup |
| `image-generation` | `/ai/image` | Botón IMG | Modelo de imagen |

**BE-FR-77 — Catálogo de operaciones.** Por cada app, el administrador define cada operación con:
- `key`, nombre amigable (el que ve el usuario en el panel), tipo (`chat` / `transcription` / `image`) y modo (`libre` / `plantilla`).
- Modelo principal y **modelos de respaldo** ordenados (BE-FR-80), proveedor preferido de OpenRouter, margen específico, temperatura.
- `max_output_tokens`, `max_cost_credits` (BE-FR-72), `estimated_max_cost_usd` (si el modelo no publica precio), *timeout* por intento.
- Capacidades permitidas: entrada de imagen, salida estructurada, herramientas (BE-FR-79).
- Límites de tamaño propios (sobrescriben los de la app y los globales).
- Grupo (etiqueta libre, p. ej. "Corrector" o "PRO") para aplicar cambios en bloque.
- Activa / inactiva.
- CA1: Un cambio se aplica a la siguiente petición, sin redesplegar ni publicar versión de la app.
- CA2: No se puede activar una operación sin modelo asignado ni con un modelo que no admita las modalidades o capacidades que la operación necesita.
- CA3: La lista de modelos se obtiene de la API de OpenRouter, filtrada por modalidades (imagen de entrada, salida de imagen, audio de entrada) y parámetros admitidos (`response_format`, `tools`).
- CA4: El backend calcula para cada operación su **tiempo máximo total** en el servidor (todos los intentos, esperas entre reintentos, *fallback* y modelos de respaldo) y lo publica en `/app/status` (`operations.<key>.timeoutMs`). Los clientes fijan su propio *timeout* a partir de ese valor (más un margen), así que cambiar un *timeout* en el panel no exige publicar una versión nueva de la app.

**BE-FR-32 — Modelos por operación.** El panel ofrece "aplicar a todo el grupo" sobre las operaciones de una app (BE-FR-77).

**BE-FR-78 — Plantillas de prompt.** Las operaciones en modo `plantilla` tienen una plantilla de mensajes con variables `{{nombre}}`. Cada variable se declara con tipo (`text` / `image`), si es obligatoria y su longitud o tamaño máximo.
- El cliente envía `{ operation, variables }`; el servidor construye los mensajes.
- CA1: Una variable que falta, sobra o excede su límite → `VALIDATION_ERROR`.
- CA2: Las plantillas se **versionan**: cada cambio crea una versión nueva e inmutable; `ai_operations` guarda la versión usada.
- CA3: En una operación con plantilla, el cliente **no** puede enviar `messages` ni alterar el esquema de salida o las herramientas definidas en la plantilla.
- CA4: Los valores de las variables son contenido del usuario: se rigen por BE-FR-38 (no se guardan ni se registran).

**BE-FR-79 — Salida estructurada y herramientas.** Si la operación lo permite:
- El cliente puede enviar `response_format` (`json_schema`) y `tools` / `tool_choice`; en operaciones con plantilla, los define la plantilla.
- El backend los reenvía a OpenRouter con `provider.require_parameters: true`, para que solo atiendan proveedores que los admitan.
- La respuesta incluye `json` (el objeto ya interpretado) y `structuredValid` (si cumple el esquema), o `toolCalls`.
- Las herramientas **se ejecutan en el cliente**: cada vuelta (el cliente envía los resultados de las herramientas en nuevos mensajes) es una operación independiente y se cobra por separado.
- CA1: Si el modelo devuelve un JSON que no cumple el esquema, se cobra (el proveedor lo ha facturado) y se devuelve `structuredValid: false` junto con el texto bruto.

**BE-FR-33 — Privacidad y parámetros en OpenRouter.** Toda llamada a OpenRouter incluye:
- `provider: { data_collection: "deny", allow_fallbacks: true }`, más `order: [proveedor]` si hay proveedor preferido y `require_parameters: true` si se usa BE-FR-79.
- Las cabeceras `HTTP-Referer: https://api.mardomingo.com` y `X-Title: <nombre visible de la app>`.
- `max_tokens` = `max_output_tokens` de la operación (BE-FR-72).
- `temperature` de la operación (0,7 por defecto en las de chat).

**BE-FR-34 — Chat (`POST /api/v1/ai/chat`).** Recibe `operation` y `messages` (operaciones libres; texto o partes multimodales `text`/`image_url` con *data URL*) o `variables` (con plantilla), y opcionalmente `response_format`, `tools` y `tool_choice` (BE-FR-79). Valida tamaños (`max_text_chars`, `max_image_mb`), comprueba saldo, reserva y límites, llama al proveedor con el *timeout* de la operación (por defecto 45 s; 60 s para `image-transcription`) y devuelve el resultado, el cobro y el saldo actualizado.

**BE-FR-35 — Transcripción (`POST /api/v1/ai/transcribe`).** Recibe `operation` y el audio en `multipart/form-data` (campo `file`, WebM/Opus) de hasta `max_audio_mb`. **Perfil `secretario`:** reproduce **en el servidor** la lógica actual de la app (`specs.md` 2.2):
- Escenarios configurados por el administrador en la operación: Voxtral solo; Voxtral + backup; solo backup (Voxtral desactivado). No se permite desactivar Voxtral sin backup configurado.
- Voxtral (`voxtral-mini-latest`, `POST https://api.mistral.ai/v1/audio/transcriptions`) con reintentos automáticos a los 2 s, 4 s y 8 s y *timeout* de 45 s por intento; si fallan, backup de OpenRouter (`input_audio` en base64, *timeout* de 60 s). Antes de enviarlo al backup, el audio WebM se convierte con ffmpeg (incluido en la imagen) a un formato que OpenRouter admite (mp3 o wav); los temporales de la conversión se borran al terminar, también en caso de error o cancelación (BE-FR-38 CA2).
- Si fallan ambos: `TRANSCRIPTION_FAILED` con el error saneado de cada proveedor (sin nombres de modelo ni datos internos).
- La respuesta indica si se usó el proveedor `primary` o `backup`, **sin el nombre del modelo**.
- Máximo `max_concurrent_transcriptions` transcripciones simultáneas por usuario.

**BE-FR-36 — Imagen (`POST /api/v1/ai/image`).** Recibe `operation` y el `prompt` construido por la app (o `variables` si la operación es con plantilla) y llama al modelo de imagen con `modalities: ["image"]` y el *timeout* de la operación (por defecto 60 s). Devuelve la imagen como *data URL*. **No se almacena** la imagen.

**BE-FR-80 — Modelos de respaldo y vigilancia.**
- Si el modelo principal falla (error del proveedor, modelo no disponible o *timeout*), se prueban los modelos de respaldo en orden, dentro del *timeout* total de la operación. Se cobra solo lo que haya facturado cada proveedor realmente.
- Una tarea diaria actualiza la **caché de modelos** de OpenRouter (precios, modalidades y parámetros admitidos) y comprueba cada modelo asignado:
  - si ha desaparecido o ya no admite lo que la operación necesita → email al administrador y aviso en el panel;
  - si su precio ha cambiado más de `model_price_change_alert_pct` → email al administrador.
- CA1: La respuesta al cliente nunca revela el modelo ni si se usó un respaldo (salvo `providerUsed` en la transcripción).

**BE-FR-81 — Idempotencia y resultados no entregados.** Las peticiones a `/ai/*` aceptan la cabecera `Idempotency-Key` (UUID que el cliente genera por cada acción del usuario y reutiliza en sus reintentos). Para un mismo usuario y clave, durante `idempotency_window_minutes`:
- Si la operación anterior **sigue en curso** (estado `in_progress`) → `409 REQUEST_IN_PROGRESS` (sin llamar al proveedor). Un índice único parcial sobre (`user_id`, `idempotency_key`) limitado al estado `in_progress` impide dos ejecuciones simultáneas y permite repetir tras `undelivered` o un fallo.
- Si terminó y su respuesta **se entregó** → `409 DUPLICATE_REQUEST` con `details.operationId` (sin llamar ni cobrar de nuevo). Protege frente a dobles clics y reintentos automáticos.
- Si terminó pero **no se entregó** (el cliente cerró la conexión después de que el proveedor respondiera; estado `undelivered`) → se ejecuta de nuevo y esa repetición **no se cobra** (el coste se registra como absorbido).
- Si falló o se canceló antes de que el proveedor respondiera → se ejecuta de nuevo con normalidad.
- CA1: El contenido **no** se guarda para volver a entregarlo (BE-FR-38); por eso se repite la llamada.
- CA2: Sin cabecera, cada petición es independiente.

**BE-FR-37 — Cancelación.** Si el cliente cierra la conexión, el backend aborta la llamada al proveedor en curso (`AbortSignal`), detiene los reintentos y registra la operación como `cancelled` (o `undelivered` si el proveedor ya había respondido). Cobro según BE-FR-21 y BE-FR-81.
- CA1: Cortar una petición sin *streaming* no evita que el proveedor la facture. La operación `cancelled` no se cobra al usuario; cuando se conoce el coste del proveedor (en la respuesta o en la consulta posterior de la generación, BE-FR-20), se guarda en `ai_operations` (`cost_µusd`) y cuenta en las estadísticas como **«pérdida por cancelación»** (BE-FR-54).

**BE-FR-38 — Registro de operaciones sin contenido.** Cada operación genera un registro en `ai_operations` con: usuario, app, sesión, operación, versión de plantilla, proveedor (`mistral`/`openrouter`), modelo, estado, tokens de entrada/salida, segundos de audio, coste real, reserva, cobro, duración, versión de la app, código de error, `Idempotency-Key` y si el proveedor marcó el contenido por moderación. **Nunca** se guardan audios, textos, prompts, variables, imágenes ni resultados: ni en base de datos, ni en logs, ni en ficheros temporales más allá de la vida de la petición.
- CA1: Una búsqueda en los logs de OpenObserve de un texto enviado en una operación no devuelve resultados.
- CA2: El audio recibido se procesa en memoria o en un temporal que se elimina al terminar la petición, también en caso de error o cancelación.

### 5.9 Datos de usuario, sincronización y predeterminados

**BE-FR-39 — Documento de sincronización por app.** Cada cuenta tiene **un documento por app**. Cada app declara su esquema: la lista de **categorías** y, para cada una, su estrategia de fusión: `items` (elementos con clave, `updatedAt` y marcas de borrado), `block` (bloque completo con `updatedAt`) o `keyed` (por clave, cada una con su `updatedAt`). **La fusión la hace el cliente**; el servidor valida que el documento solo contiene las categorías declaradas, con la forma de su estrategia, y que no supera `max_sync_doc_kb`.

**Perfil de la app `secretario`** (se almacena por cuenta y en ningún caso por dispositivo):

| Categoría | Nombre en el documento | Clave en la app (v3) | Estrategia |
|---|---|---|---|
| Sustituciones personalizadas | `customReplacements` (con `items` y `tombstones`) | `customReplacements` + `customReplacementsTombstones` | `items` (clave `from`; marcas de borrado que caducan a los 30 días). Lógica actual de `specs.md` 2.6. |
| Sustituciones core | `coreReplacements` | `coreReplacements` | `block` |
| Textos rápidos | `quickTexts` | `defaultTexts` | `block` |
| Prompts de IA | `prompts` | `defaultPrompts` | `block` |
| Preferencias de uso | `preferences` (una clave por preferencia) | `communicationStyle`, `messageType`, `language`, `targetPersons`, `processWithLLM`, `autoCopy`, `fixAuto`, `markdownMode`, `translationTargetLanguage`, `themePreference` | `keyed` |

No se sincronizan (quedan en cada equipo): tamaño y posición de la ventana, modo compacto, tamaños del editor y de la transcripción, paneles plegados, **atajos de teclado globales**, variables locales persistentes, historial de copias y todo lo relativo al modo BYOK.

**BE-FR-40 — Siembra de predeterminados.** La **primera vez** que una cuenta usa una app (primer `GET /sync` con ese `X-App-Id`), se crea su documento con `revision = 1` copiando los **predeterminados vigentes** de esa app, con todos los `updatedAt = 0` (época). Así, en la primera sincronización, cualquier dato local con fecha real del usuario **gana** (lo local prevalece, decisión 38).

**BE-FR-41 — Lectura y escritura del documento.**
- `GET /api/v1/sync` devuelve el documento de la app y su `revision` (entero creciente).
- `PUT /api/v1/sync` con cabecera `If-Match: <revision>` (obligatoria) sustituye el documento. Sin la cabecera → `VALIDATION_ERROR` con `details.field = "If-Match"`. Si la revisión no coincide → `412 SYNC_CONFLICT`; el cliente vuelve a leer, fusiona localmente y reintenta.
- Tamaño máximo del documento: `max_sync_doc_kb` (por defecto 1024 KB; sobrescribible por app).
- CA1: Dos `PUT` concurrentes con la misma revisión: uno tiene éxito y el otro recibe `412`. Nunca se pierde una escritura silenciosamente.
- CA2: Un documento con categorías no declaradas o con forma incorrecta → `VALIDATION_ERROR`.

**BE-FR-42 — Predeterminados del administrador.** El administrador edita los predeterminados de cada app (mismas categorías que su esquema) desde el panel. Además dispone de la acción **"Copiar mis datos actuales como predeterminados"**, que toma el documento sincronizado de su propia cuenta para esa app, para no tener que editar prompts largos en formularios web.
- CA1: Cambiar los predeterminados **no modifica** ninguna cuenta existente.
- CA2: `GET /api/v1/defaults` devuelve los predeterminados vigentes de la app (Secretario lo usa para "Restaurar valores predeterminados"). No se bloquea por mantenimiento (BE-FR-47) ni por documentos legales pendientes (BE-FR-70).
- CA3: Antes de copiar, se muestra una **vista previa** por categorías con casillas por elemento para excluir lo que no deba copiarse (p. ej. datos personales). Solo se sustituyen las categorías con algún elemento seleccionado.
- CA4: La copia queda registrada en la auditoría (BE-FR-55).

### 5.10 Protecciones

**BE-FR-43 — Límites por usuario.** Máximo `ai_requests_per_minute` peticiones de IA por minuto y `max_concurrent_transcriptions` transcripciones simultáneas. El valor global se aplica a la **suma de todas las apps** de la cuenta; si una app tiene su propio valor (sección 9, «por app»), es un límite adicional solo para las peticiones de esa app y no puede superar el global. Se aplica el primero que se alcance. Excederlos → `429 RATE_LIMITED` con cabecera `Retry-After`.

**BE-FR-44 — Límites de tamaño y duración.** Audio ≤ `max_audio_mb` y de duración ≤ `max_audio_seconds`, texto total de mensajes o variables ≤ `max_text_chars`, imagen ≤ `max_image_mb`.
- La duración del audio se **mide en el servidor con ffprobe**, porque el WebM que genera `MediaRecorder` no incluye la duración en la cabecera y hay que leer el flujo completo. Se admite una tolerancia de `audio_duration_tolerance_seconds` para absorber el desfase de la parada automática de la app. Un audio que ffprobe no puede leer → `VALIDATION_ERROR`.
- Exceso de tamaño → `413 PAYLOAD_TOO_LARGE`; exceso de duración → `413 AUDIO_TOO_LONG`. En ambos casos, sin llamar al proveedor y sin cobrar.
- La configuración de `adapter-node` (`BODY_SIZE_LIMIT`) debe ser coherente con el mayor `max_audio_mb` configurado en cualquier app.

**BE-FR-45 — Límites de autenticación.** *Rate limit* por IP en login, registro, reenvío de verificación, recuperación de contraseña y cambio de email, implementado en la funcionalidad `accounts` con contadores en su tabla propia `auth_rate_limits` (no se usa el `rateLimit` de Better Auth, que no actúa en las llamadas con `auth.api`; 4.1), más el límite de altas por IP (BE-FR-11) y el bloqueo por email (BE-FR-67).

**BE-FR-46 — Freno global de gasto.** Si el **coste real acumulado del día** (Europe/Madrid) de las operaciones de cuentas **sin compras reales**, más las reservas en curso de esas cuentas, supera `global_daily_free_cost_brake_eur`, el backend rechaza nuevas operaciones de esas cuentas con `503 SERVICE_LIMITED` hasta el día siguiente o hasta que el administrador lo libere. Se envía un email al administrador al activarse.
- CA1: Las cuentas con compras reales no se ven afectadas.

**BE-FR-47 — Modo mantenimiento.** Interruptor **global** y uno **por app** en el panel, cada uno con mensaje personalizable. Activo: las operaciones de IA y la sincronización (de todas las apps o de esa app) responden `503 MAINTENANCE` con el mensaje; el login, el logout, `/me`, `/app/status` y `/defaults` siguen funcionando.

**BE-FR-48 — Control de versiones de la app.** Las apps envían `X-App-Version` en cada petición. El administrador configura, por app, `min_app_version`, `recommended_app_version` y si se exige (`enforce_version`).
- CA1: Petición autenticada de una app con `enforce_version` y versión < mínima (o sin cabecera) → `426 UPGRADE_REQUIRED`. `POST /auth/logout` y `GET /app/status` no exigen la versión mínima.
- CA2: `GET /api/v1/app/status` (sin autenticación) devuelve, para la app de `X-App-Id`, ambas versiones, el estado de mantenimiento, los límites, el tiempo máximo de cada operación activa (BE-FR-77 CA4), los enlaces, el email de soporte y los anuncios activos.
- CA3: La API se versiona por ruta (`/api/v1`). Un cambio incompatible exige `/api/v2` manteniendo `/api/v1` durante un periodo de transición.

### 5.11 Panel de usuario (`/panel`)

**BE-FR-49 — Contenido.**
1. **Saldo**: total, reservado (si lo hay), desglose por bolsas (gratuitas con fecha de caducidad / compradas), deuda si existe y equivalencia en euros (según `credits_per_eur_purchase`).
2. **Comprar créditos**: paquetes activos (BE-FR-23, BE-FR-25, BE-FR-26), enlace a precios orientativos (BE-FR-73) y opción de factura completa (BE-FR-74).
3. **Movimientos**: lista paginada del ledger.
4. **Consumo**: lista paginada de operaciones con fecha, **app**, operación (nombre amigable), estado y **créditos cobrados**, con filtro por app. **No** se muestra el modelo ni el coste real.
5. **Gráficas de consumo**: créditos por día, por operación y por app, últimos 30 / 90 días.
6. **Exportar CSV**: movimientos y consumo, con filtro por fechas y app.
7. **Aviso de saldo bajo**: umbral elegido por el usuario (o desactivado). Se envía **un** email al cruzar el umbral hacia abajo; se rearma al volver a superarlo. El mismo umbral lo usan las apps para su aviso (ver `v4-app-spec.md`).
8. **Sesiones activas**: app, equipo, versión de la app, último uso, IP aproximada (IPv4 truncada a /24 e IPv6 a /48); cerrar una o todas.
9. **Perfil**: email (con cambio, BE-FR-66), cambio de contraseña, datos fiscales (BE-FR-74), exportar datos (BE-FR-08), borrar cuenta (BE-FR-07).
10. **Facturas**: lista y descarga en PDF (BE-FR-75); solicitud de factura completa de una compra.
11. **Mis apps**: apps disponibles con su enlace de descarga o acceso (p. ej. Secretario: `https://github.com/danimardo/secretario2/releases/latest/download/SecretarioAI-Setup.exe`).
12. **Avisos**: anuncios activos (BE-FR-85) y documentos legales pendientes de aceptar (BE-FR-70).
13. **Soporte**: email de soporte (BE-FR-84).

### 5.12 Panel de administración (`/admin`)

**BE-FR-50 — Usuarios.** Buscar por email; ver detalle (saldo, reservas, bolsas, movimientos, consumo por app, sesiones, pagos, facturas, datos fiscales, operaciones marcadas por moderación); bloquear o desbloquear (con motivo); ajustar saldo (BE-FR-18); marcar o desmarcar `tester`; cerrar sesiones; reembolsar compras (BE-FR-27).

**BE-FR-51 — Economía.** Edición de los parámetros económicos de la sección 9 y de los paquetes; valores manuales de precios orientativos (BE-FR-73).

**BE-FR-52 — Apps y modelos.** Registro de apps (BE-FR-62), catálogo de operaciones (BE-FR-77), plantillas (BE-FR-78), modelos y respaldos (BE-FR-80) y, en las operaciones de transcripción, la configuración de BE-FR-35: principal, backup, Voxtral desactivado, precio por minuto de Voxtral. Muestra los avisos de modelos retirados o con cambios de precio.

**BE-FR-53 — Protecciones y versiones.** Límites (globales y por app), freno global (y su liberación manual), mantenimiento (global y por app), versiones mínima y recomendada por app.

**BE-FR-54 — Estadísticas.** Por día, app, operación y usuario: coste real (USD y EUR), cobrado (créditos y su equivalente en EUR al valor de consumo), margen bruto, pérdidas por deuda absorbida, por repeticiones no cobradas (BE-FR-81) y por cancelación (coste del proveedor de operaciones canceladas sin cobro, BE-FR-37), saldo anulado al borrar cuentas (movimientos `forfeit`, BE-FR-07 CA4), operaciones fallidas, canceladas, interrumpidas o truncadas, uso de modelos de respaldo, usuarios activos, altas (por app de origen), compras reales (excluidas las simuladas) e ingresos.
- **Embudo de alta por app** (semanal y acumulado): descargas del instalador, registros con `?app=<slug>`, cuentas verificadas, primer login desde la app (`user_app_activity.first_login_at`) y primera operación de IA. Las descargas se obtienen a diario del contador de la API de GitHub Releases cuando el enlace de descarga de la app apunta a GitHub; el repositorio de descargas es público (los usuarios descargan de él el instalador), así que la consulta no necesita token. Este embudo es el criterio para decidir la firma del instalador de Secretario (12, decisión 11).

**BE-FR-55 — Auditoría.** Toda acción del administrador que modifique datos (ajustes de saldo, bloqueos, cambios de configuración, apps, operaciones, plantillas, modelos, paquetes, predeterminados, anuncios, documentos legales, reembolsos) se registra en `admin_audit` con fecha, acción, entidad, valores anterior/nuevo y motivo. El registro no se puede editar ni borrar desde el panel.

**BE-FR-56 — Alerta de saldo de proveedores.** Cada hora se consulta el saldo de OpenRouter (`GET https://openrouter.ai/api/v1/credits`) con la clave de gestión `OPENROUTER_MANAGEMENT_KEY` (variable secreta usada solo para esta consulta; sección 9). Si la variable falta (p. ej. en staging), la alerta de saldo queda desactivada y se registra un evento al arrancar. Si el saldo baja de `openrouter_balance_alert_usd`, se envía un email al administrador (uno por cruce de umbral). Para Mistral, que no expone saldo equivalente, se alerta cuando sus llamadas devuelvan errores de pago o cuota (HTTP 401/402/429 de facturación).

**BE-FR-57 — Predeterminados.** BE-FR-42, por app.

**Otras secciones del panel:** facturación y exportación contable (BE-FR-76), documentos legales y sus versiones (BE-FR-70), anuncios (BE-FR-85).

### 5.13 Emails (Resend)

**BE-FR-58 — Envío.** Los emails se envían a través de una interfaz propia con implementación Resend; el dominio remitente tiene SPF, DKIM y DMARC configurados. Plantillas en español mediante Paraglide, con la **marca paraguas** y, cuando el email se refiere a una app concreta, su nombre (BE-FR-64). El pie incluye el email de soporte.

| Email | Destinatario | Disparador |
|---|---|---|
| Verificación de cuenta | Usuario | Registro / reenvío |
| Recuperación de contraseña | Usuario | Solicitud |
| Aviso de seguridad: contraseña cambiada | Usuario | Cambio o recuperación |
| Verificación del nuevo email | Usuario (nueva dirección) | Cambio de email (BE-FR-66) |
| Aviso de seguridad: email cambiado | Usuario (dirección anterior) | Cambio de email (BE-FR-66) |
| Saldo bajo | Usuario | Cruce del umbral (BE-FR-49.7) |
| Créditos gratuitos a punto de caducar | Usuario | `free_expiry_warning_days` antes |
| Nueva versión de documentos legales | Usuario | Publicación (BE-FR-70) |
| Factura disponible | Usuario | Emisión (BE-FR-75; solo con cobros reales) |
| Freno global activado | Administrador | BE-FR-46 |
| Saldo de OpenRouter bajo / errores de pago de Mistral | Administrador | BE-FR-56 |
| Modelo retirado o con cambio de precio | Administrador | BE-FR-80 |
| Operaciones marcadas por moderación | Administrador | BE-FR-82 |
| Discrepancia en el ledger | Administrador | BE-FR-15 |
| Aviso de borrado por inactividad | Usuario | BE-FR-86 |
| Tipo de cambio sin actualizar | Administrador | BE-FR-87 |

Los recibos de compra no se envían con el proveedor simulado; con Stripe, los emite Stripe.

### 5.14 Landing, páginas legales y privacidad

**BE-FR-59 — Landings básicas.**
- **Marca paraguas (`/`)**: qué es la Cuenta Mardomingo (una cuenta y un saldo para todas las apps), lista de apps, "Crear cuenta", "Iniciar sesión" y enlace a precios.
- **Por app (`/apps/<slug>`)**, generada a partir del registro de apps: qué hace, cómo empezar (cuenta + saldo de bienvenida), botón de descarga o acceso y "Crear cuenta" con `?app=<slug>`. Una app puede declarar una landing externa en su lugar.
- **Perfil `secretario`**: junto al botón de descarga (enlace permanente), una breve explicación con captura de cómo continuar ante el aviso de Windows SmartScreen ("Más información" → "Ejecutar de todas formas"), porque el instalador no está firmado.
- Serán sustituidas por landings definitivas más adelante sin cambiar rutas de la API.

**BE-FR-60 — Requisitos legales técnicos.**
- Páginas `/terminos`, `/privacidad`, `/cookies` y `/uso-aceptable`, con contenido versionado (la versión vigente se registra en cada aceptación; nuevas versiones según BE-FR-70).
- Solo **cookies técnicas** (sesión y preferencias estrictamente necesarias); **sin analítica de terceros**, de modo que no se requiere banner de consentimiento.
- Servidor y base de datos **en la UE**.
- La política de privacidad debe declarar: que no se almacena contenido, qué metadatos se guardan y durante cuánto tiempo (BE-FR-83), las apps de la plataforma, los proveedores que procesan el contenido (Mistral en la UE; OpenRouter y sus proveedores, fuera de la UE) y la base legal de esas transferencias.
- La redacción de términos, privacidad, cookies y uso aceptable la realiza un profesional y es **requisito previo al lanzamiento público**.

**BE-FR-82 — Política de uso aceptable.** Documento legal versionado que prohíbe los usos ilícitos o abusivos de la IA. No hay moderación propia (el contenido no se guarda ni se inspecciona); se aplica así:
- Se confía en la moderación de los proveedores. Cuando un proveedor rechaza una petición por moderación, la operación se registra con `flagged = true` (sin contenido) y el cliente recibe `PROVIDER_ERROR` con un mensaje genérico.
- Si un usuario acumula `flagged_ops_alert_per_day` operaciones marcadas en un día, se avisa al administrador, que puede bloquear la cuenta (BE-FR-50).

**BE-FR-83 — Retención de datos y encargados del tratamiento.** Plazos por defecto (a confirmar por el profesional legal y la gestoría; 12, decisión 15):

| Dato | Plazo |
|---|---|
| Cuentas sin verificar | `unverified_account_ttl_days` (7 días) |
| Cuentas inactivas sin compras reales | `inactive_account_years` (3 años) + aviso de `inactive_account_notice_days` (30 días); BE-FR-86 |
| Sesiones caducadas o revocadas (con IP y equipo) | 30 días tras caducar |
| IP de registro y de aceptaciones legales | Mientras exista la cuenta y después durante el plazo de prescripción aplicable (prueba del consentimiento) |
| `ai_operations` ligadas al usuario | 24 meses; después se anonimizan (se conservan agregadas para estadísticas) |
| Logs de OpenObserve | 30 días |
| Ledger, pagos y facturas | Plazo legal mercantil y fiscal (orientativo: 6 años) |
| Datos sincronizados y datos fiscales | Mientras exista la cuenta |
| Backups (Litestream) | 30 días |

- Una tarea diaria aplica los plazos.
- Antes del lanzamiento se firman o aceptan los **contratos de encargo de tratamiento** (DPA) con Mistral, OpenRouter, Resend, Backblaze, Cloudflare (Turnstile) y el proveedor del servidor, y se documenta el **registro de actividades de tratamiento**.

### 5.15 Soporte y comunicación

**BE-FR-84 — Soporte.** Un email de soporte global (`support_email`), sobrescribible por app. Se publica en `/app/status`, en el panel, en las landings y en el pie de los emails. Los mensajes de las apps que dicen "Contacta con soporte" enlazan a él. En la v4 no hay sistema de tickets.

**BE-FR-85 — Anuncios.** El administrador crea anuncios con: app (o todas), texto, nivel (`info` / `warning` / `critical`), ventana de validez, enlace opcional y rango de versiones de la app al que va dirigido.
- CA1: `/app/status` devuelve los anuncios activos que aplican a la app y versión de la petición. El panel de usuario muestra los anuncios activos dirigidos a todas las apps y los de las apps que la cuenta ha usado (registradas en `user_app_activity`), sin filtrar por versión e indicando a qué app se refiere cada uno.
- CA2: Cada anuncio tiene un `id` estable para que el cliente recuerde localmente cuáles ha cerrado el usuario.

---

## 6. Modelo de datos

Tablas principales (las de Better Auth — `user`, `session`, `account`, `verification` — se extienden con los campos indicados). Tipos orientativos; el detalle lo fija la fase de plan.

| Tabla | Campos principales |
|---|---|
| `apps` | `id`, `slug` (único), `name`, `description`, `client_types`, `status` (`active`/`disabled`), `links` (JSON), `min_app_version`, `recommended_app_version`, `enforce_version`, `maintenance_active`, `maintenance_message`, `post_verify_text` (texto opcional de pasos tras verificar, BE-FR-64 CA2), `allowed_origins`, `settings_overrides` (JSON), `sync_schema` (JSON), `support_email`, `created_at`, `updated_at` |
| `app_operations` | `id`, `app_id`, `key`, `name`, `kind` (`chat`/`transcription`/`image`), `mode` (`libre`/`plantilla`), `model`, `fallback_models` (JSON), `preferred_provider`, `margin_override`, `temperature`, `max_output_tokens`, `max_cost_µc`, `estimated_max_cost_µusd`, `timeout_ms`, `capabilities` (JSON), `limits` (JSON), `transcription_config` (JSON), `group`, `active`, `updated_at` — único (`app_id`, `key`) |
| `prompt_templates` | `id`, `operation_id`, `version`, `messages` (JSON), `variables` (JSON), `response_format` (JSON), `tools` (JSON), `created_at` — **inmutable** por versión |
| `user` (Better Auth) | `id`, `email`, `email_verified`, `role` (lista separada por comas: `user`, `tester`, `admin`, como admite el plugin `admin`), `banned`, `ban_reason`, **`email_normalized`** (con índice, **no único**; BE-FR-11.5), **`signup_app_id`**, **`signup_ip`** (BE-FR-83), **`last_activity_at`** (BE-FR-86), **`deleted_at`**, `created_at`. Estado derivado sin campos duplicados: sin verificar = `email_verified = false`; bloqueada = `banned`; borrada = `deleted_at` no nulo |
| `session` (Better Auth) | `id`, `user_id`, `token`, `expires_at`, `ip_address`, `user_agent`, **`app_id`** (nulo en la web de la cuenta), **`device_name`**, **`app_version`**, **`last_used_at`** |
| `login_attempts` | `email_normalized_hash` (HMAC-SHA256 con `EMAIL_HASH_KEY`, como en `welcome_grants`), `failures`, `window_start`, `locked_until` |
| `user_app_activity` | `user_id`, `app_id`, `first_login_at`, `last_used_at` — clave (`user_id`, `app_id`); dueña: `accounts`. Alimenta el embudo de alta (primer login desde la app, BE-FR-54) y los anuncios del panel (apps usadas, BE-FR-85 CA1) |
| `auth_rate_limits` | `key` (acción e IP), `count`, `window_start` — contadores de los límites de autenticación por IP (BE-FR-45); dueña: `accounts`. Sustituye a la tabla del *rate limit* de Better Auth, que no se usa |
| `legal_documents` | `id`, `document` (`terms`/`privacy`/`cookies`/`aup`/`withdrawal_waiver`), `version`, `content` (texto versionado), `published_at`, `requires_reacceptance`, `content_hash` |
| `terms_acceptances` | `id`, `user_id`, `document` (los de `legal_documents` + `age_declaration`), `version`, `accepted_at`, `ip`, `app_id` (desde dónde se aceptó) |
| `welcome_grants` | `email_normalized_hash` (único; HMAC-SHA256 con `EMAIL_HASH_KEY`), `granted_at` — sobrevive al borrado de cuentas |
| `credit_buckets` | `id`, `user_id`, `kind` (`free`/`paid`), `initial_µc`, `remaining_µc`, `expires_at` (nulo en `paid`), `source` (`welcome`/`purchase`/`adjustment`), `payment_id`, `simulated`, `created_at` |
| `user_balances` | `user_id`, `debt_µc`, **`has_real_purchase`**, **`low_balance_threshold_µc`**, **`low_balance_notified`**, `updated_at` (saldo materializado = Σ `remaining_µc` − `debt_µc`). Los tres campos en negrita pasaron de `user` a esta tabla (2.4) para que los gestione `credits` sin depender de `accounts` |
| `credit_holds` | `id`, `user_id`, `app_id`, `operation_id`, `amount_µc`, `created_at`, `expires_at`, `released_at` |
| `credit_movements` | `id`, `user_id`, `type`, `amount_µc` (con signo), `bucket_id`, `operation_id`, `app_id` (informativo), `payment_id`, `admin_reason`, `created_at` — **inmutable** |
| `ai_operations` | `id`, `user_id`, `app_id`, `session_id`, `operation`, `template_version`, `provider`, `model`, `used_fallback`, `status` (`in_progress`/`ok`/`provider_error`/`cancelled`/`undelivered`/`interrupted`/`rejected`), `idempotency_key`, `input_tokens`, `output_tokens`, `audio_seconds`, `cost_µusd`, `cost_estimated`, `hold_µc`, `charged_µc`, `absorbed_µc`, `truncated`, `flagged`, `duration_ms`, `app_version`, `error_code`, `provider_generation_id`, `created_at` — **sin contenido**; índice único parcial sobre (`user_id`, `idempotency_key`) solo para `status = in_progress` (BE-FR-81); en las `cancelled`, `cost_µusd` guarda el coste del proveedor si se conoce (BE-FR-37 CA1) |
| `packs` | `id`, `name`, `price_eur_cents`, `bonus_pct`, `active`, `sort_order` |
| `payments` | `id`, `user_id`, `pack_id`, `provider`, `provider_ref` (único), `status` (`pending`/`completed`/`refunded`/`partially_refunded`/`chargeback`), `amount_eur_cents`, `base_eur_cents`, `vat_eur_cents`, `vat_rate`, `country`, `credits_µc`, `wants_full_invoice`, `simulated`, `created_at`, `completed_at` |
| `billing_profiles` | `user_id`, `kind` (`individual`/`business`), `legal_name`, `tax_id`, `address`, `postal_code`, `city`, `country`, `updated_at` |
| `invoices` | `id`, `payment_id`, `kind` (`simplified`/`full`/`corrective`), `series`, `number`, `billing_snapshot` (JSON), `amount_eur_cents`, `corrects_invoice_id`, `provider`, `provider_ref`, `pdf_ref`, `issued_at` — **inmutable** |
| `sync_documents` | `user_id`, `app_id`, `revision`, `data` (JSON), `updated_at` — clave (`user_id`, `app_id`) |
| `app_defaults` | `app_id` (clave), `data` (JSON), `updated_at` |
| `settings` | `key`, `value` (JSON), `updated_at` — parámetros globales de la sección 9 |
| `model_cache` | `model_id`, `pricing` (JSON), `modalities` (JSON), `supported_parameters` (JSON), `fetched_at` |
| `price_references` | `app_id`, `operation`, `typical_µc`, `sample_size`, `source` (`auto`/`manual`), `computed_at` |
| `fx_rates` | `id`, `usd_eur_ppm`, `source` (`ecb`/`manual`), `ecb_rate_ppm`, `buffer_ppm`, `effective_from`, `created_at` — histórico del tipo de cambio aplicado (BE-FR-87 CA1) |
| `announcements` | `id`, `app_id` (nulo = todas), `level`, `message`, `link`, `starts_at`, `ends_at`, `min_version`, `max_version`, `active` |
| `admin_audit` | `id`, `admin_id`, `action`, `entity`, `entity_id`, `before`, `after`, `reason`, `created_at` — **inmutable** |
| `alerts_state` | `key`, `active`, `last_sent_at` — evita emails repetidos por el mismo cruce de umbral |
| `disposable_domains` | `domain` |
| `protection_state` | `key`, `value` (JSON), `updated_at` — estado del freno global del día y su liberación manual (BE-FR-46) |
| `release_downloads` | `app_id`, `day`, `downloads`, `fetched_at` — descargas diarias del instalador desde GitHub Releases (BE-FR-54, embudo de alta) |

Toda escritura que afecte a saldo o reservas (reserva, cobro, compra, ajuste, caducidad, reembolso, anulación al borrar la cuenta) se ejecuta en **una única transacción** que actualiza bolsas, deuda, reservas y ledger a la vez.

---

## 7. Contrato de la API `/api/v1`

### 7.1 Convenciones

- Base: `https://api.mardomingo.com/api/v1`.
- **Contrato OpenAPI 3.1** publicado en `GET /api/v1/openapi.json` (público), generado a partir de los esquemas de validación. Es la referencia para los clientes y para generar clientes tipados; los tests comprueban que las respuestas lo cumplen.
- Autenticación: `Authorization: Bearer <token de sesión>` (salvo los endpoints marcados como públicos).
- Cabeceras enviadas por las apps en **todas** las peticiones: `X-App-Id: <slug>`, `X-App-Version: x.y.z` y, en escritorio y móvil, `X-Device-Name: <nombre del equipo>`.
- Cabecera `Idempotency-Key: <uuid>` recomendada en `/ai/*` (BE-FR-81).
- Importes de crédito en la API: **enteros en microcréditos** (`…Micro`); la app los formatea.
- Formato de error:

```json
{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "Texto en español apto para mostrar", "details": { } } }
```

### 7.2 Códigos de error

| HTTP | `code` | Significado |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Petición mal formada, operación desconocida o inactiva, variables incorrectas (`details.field`) |
| 400 | `UNKNOWN_APP` | `X-App-Id` ausente o desconocido |
| 401 | `UNAUTHENTICATED` | Sin token, token caducado o revocado, o token de otra app |
| 401 | `INVALID_CREDENTIALS` | Login incorrecto |
| 402 | `INSUFFICIENT_BALANCE` | Saldo disponible < mínimo, deuda pendiente o la reserva no cabe (`details.requiredMicro`, `details.availableMicro`) |
| 402 | `DAILY_FREE_LIMIT_REACHED` | Tope diario de cuentas sin compras |
| 403 | `EMAIL_NOT_VERIFIED` | Cuenta sin verificar |
| 403 | `ACCOUNT_BLOCKED` | Cuenta bloqueada |
| 403 | `TERMS_ACCEPTANCE_REQUIRED` | Hay documentos legales pendientes de aceptar (`details.pending`) |
| 403 | `ORIGIN_NOT_ALLOWED` | La cabecera `Origin` no figura entre los orígenes de la app de `X-App-Id` (BE-FR-65 CA2) |
| 404 | `NOT_FOUND` | Ruta inexistente en la API |
| 405 | `METHOD_NOT_ALLOWED` | Método HTTP no admitido por el endpoint |
| 409 | `REQUEST_IN_PROGRESS` | Ya hay una operación en curso con esa `Idempotency-Key` |
| 409 | `DUPLICATE_REQUEST` | La operación con esa `Idempotency-Key` ya se completó y entregó (`details.operationId`) |
| 412 | `SYNC_CONFLICT` | La revisión del documento ha cambiado |
| 413 | `PAYLOAD_TOO_LARGE` | Audio, texto o imagen demasiado grandes |
| 413 | `AUDIO_TOO_LONG` | Audio de duración superior a `max_audio_seconds` (`details.maxSeconds`) |
| 413 | `OPERATION_TOO_EXPENSIVE` | El coste máximo estimado supera el tope de la operación (`details.estimatedMicro`, `details.maxMicro`) |
| 426 | `UPGRADE_REQUIRED` | Versión de la app por debajo de la mínima |
| 429 | `RATE_LIMITED` | Demasiadas peticiones (con `Retry-After`) |
| 429 | `LOGIN_TEMPORARILY_LOCKED` | Demasiados intentos fallidos para ese email (con `Retry-After`) |
| 500 | `INTERNAL_ERROR` | Error inesperado del servidor (mensaje genérico, sin detalles internos) |
| 502 | `PROVIDER_ERROR` | El proveedor de IA ha fallado o ha rechazado el contenido (chat / imagen) |
| 502 | `TRANSCRIPTION_FAILED` | Han fallado Voxtral y el backup (`details.primaryError`, `details.backupError`) |
| 503 | `MAINTENANCE` | Mantenimiento global o de la app (`message` = texto del administrador) |
| 503 | `SERVICE_LIMITED` | Freno global de gasto activo |
| 503 | `APP_DISABLED` | La app está desactivada |
| 504 | `PROVIDER_TIMEOUT` | *Timeout* del proveedor |

### 7.3 Endpoints

#### `GET /app/status` *(público; requiere `X-App-Id`)*

No exige la versión mínima (BE-FR-48 CA1) y sigue funcionando en mantenimiento.

```json
{
  "app": { "id": "secretario", "name": "Secretario AI" },
  "minAppVersion": "4.0.0",
  "recommendedAppVersion": "4.0.0",
  "maintenance": { "active": false, "message": "" },
  "limits": { "maxAudioSeconds": 300 },
  "operations": {
    "fix": { "timeoutMs": 45000 },
    "image-transcription": { "timeoutMs": 60000 },
    "transcription": { "timeoutMs": 254000 },
    "image-generation": { "timeoutMs": 60000 }
  },
  "links": {
    "register": "https://cuenta.mardomingo.com/registro?app=secretario",
    "forgotPassword": "https://cuenta.mardomingo.com/recuperar",
    "panel": "https://cuenta.mardomingo.com/panel",
    "buyCredits": "https://cuenta.mardomingo.com/panel/comprar",
    "prices": "https://cuenta.mardomingo.com/precios",
    "terms": "https://cuenta.mardomingo.com/terminos",
    "privacy": "https://cuenta.mardomingo.com/privacidad",
    "acceptableUse": "https://cuenta.mardomingo.com/uso-aceptable"
  },
  "supportEmail": "soporte@mardomingo.com",
  "announcements": [
    { "id": "ann_…", "level": "info", "message": "…", "link": null, "endsAt": "ISO" }
  ]
}
```

#### `POST /auth/login` *(público)*

Petición: `{ "email": "...", "password": "..." }` (+ cabeceras de 7.1).
Respuesta 200: `{ "token": "<sesión>", "expiresAt": "ISO", "user": { "email": "...", "roles": ["user"] }, "pendingAcceptances": [] }`.
Errores: `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_BLOCKED`, `RATE_LIMITED`, `LOGIN_TEMPORARILY_LOCKED`.

#### `POST /auth/resend-verification` *(público)*

Petición: `{ "email": "..." }`. Respuesta siempre `202` (anti-enumeración), salvo `429 RATE_LIMITED` (con `Retry-After`) al superar el límite por IP (BE-FR-45).

#### `POST /auth/logout`

Revoca la sesión del token. Respuesta `204`. No exige la versión mínima (BE-FR-48 CA1).

#### `GET /me`

```json
{
  "email": "usuario@ejemplo.com",
  "roles": ["user"],
  "balance": {
    "totalMicro": 482350000,
    "reservedMicro": 0,
    "availableMicro": 482350000,
    "freeMicro": 82350000,
    "paidMicro": 400000000,
    "debtMicro": 0,
    "nextFreeExpiry": { "amountMicro": 82350000, "expiresAt": "2026-11-05T00:00:00Z" }
  },
  "lowBalanceThresholdMicro": 50000000,
  "hasRealPurchase": true,
  "pendingAcceptances": [
    { "document": "terms", "version": "2026-11-01", "url": "https://cuenta.mardomingo.com/terminos" }
  ]
}
```

#### `POST /me/accept-terms`

Petición: `{ "documents": [ { "document": "terms", "version": "2026-11-01" } ] }`. Respuesta `204`. Una versión que no sea la vigente → `VALIDATION_ERROR`.

#### `POST /ai/chat`

Operación libre:

```json
{
  "operation": "fix",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

Operación con plantilla: `{ "operation": "resumen", "variables": { "texto": "..." } }`.

Opcionales si la operación lo permite (BE-FR-79): `response_format`, `tools`, `tool_choice`. En `image-transcription`, `content` puede ser un array de partes `{ "type": "text", "text": "..." }` / `{ "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }`.

Respuesta 200:

```json
{
  "text": "Texto resultante",
  "json": null,
  "structuredValid": null,
  "toolCalls": null,
  "truncated": false,
  "operationId": "op_…",
  "chargedMicro": 776480,
  "balance": { "totalMicro": 481573520, "reservedMicro": 0, "availableMicro": 481573520, "debtMicro": 0 }
}
```

El `balance` de todas las respuestas de `/ai/*` tiene esta forma (total, reservado, disponible y deuda; BE-FR-71 CA2).

#### `POST /ai/transcribe`

`multipart/form-data`: `operation` (p. ej. `transcription`) y `file` (audio WebM/Opus).
Respuesta 200: `{ "text": "...", "providerUsed": "primary" | "backup", "audioSeconds": 118, "operationId": "...", "chargedMicro": 3680000, "balance": { ... } }`.
Error 502 `TRANSCRIPTION_FAILED`: `details: { "primaryError": "...", "backupError": "..." }`.

#### `POST /ai/image`

Petición: `{ "operation": "image-generation", "prompt": "..." }` (o `variables` si es con plantilla).
Respuesta 200: `{ "imageDataUrl": "data:image/png;base64,...", "operationId": "...", "chargedMicro": ..., "balance": { ... } }`.

#### `GET /sync`

Documento de la app de `X-App-Id`. El primer `GET` de una cuenta en esa app siembra el documento con los predeterminados y `revision = 1` (BE-FR-40). Ejemplo con el perfil `secretario`:

```json
{
  "revision": 42,
  "data": {
    "customReplacements": {
      "items": [ { "from": "confi ui", "to": "ComfyUI", "updatedAt": 1759737600000 } ],
      "tombstones": [ { "from": "viejo", "deletedAt": 1759737600000 } ]
    },
    "coreReplacements": { "value": { }, "updatedAt": 0 },
    "quickTexts": { "value": [ ], "updatedAt": 0 },
    "prompts": { "value": [ ], "updatedAt": 0 },
    "preferences": {
      "themePreference": { "value": "dark", "updatedAt": 1759737600000 },
      "fixAuto": { "value": false, "updatedAt": 0 }
    }
  }
}
```

#### `PUT /sync`

Cabecera `If-Match: 42` (obligatoria). Cuerpo: `{ "data": { ... } }` (mismo formato). Respuesta 200: `{ "revision": 43 }`. Errores: `SYNC_CONFLICT` (412), `PAYLOAD_TOO_LARGE`, `VALIDATION_ERROR` (también sin `If-Match`, con `details.field = "If-Match"`).

#### `GET /defaults`

`{ "data": { ... } }` con el mismo formato que `/sync` de la app (sin `revision`). No se bloquea por mantenimiento ni por documentos legales pendientes (BE-FR-42 CA2).

#### `GET /health` *(público)*

`{ "status": "ok" }` si la base de datos responde; si no responde, `503`. Lo usan Coolify y la monitorización.

#### `GET /openapi.json` *(público)*

Contrato OpenAPI 3.1 de la API (7.1).

### 7.4 Comportamiento ante desconexión del cliente

En `/ai/*`, si la conexión del cliente se cierra antes de responder, el servidor aborta la llamada al proveedor y aplica BE-FR-37 y BE-FR-81.

---

## 8. Reglas de cobro: flujo de una operación

1. Resolver la app (`X-App-Id`) → autenticar la sesión y comprobar que pertenece a esa app → comprobar `X-App-Version` (si la app lo exige) → comprobar mantenimiento (global y de la app), app activa, freno global y documentos legales pendientes.
2. Comprobar `Idempotency-Key` (BE-FR-81).
3. Validar operación, variables o mensajes, capacidades y tamaños; medir la duración del audio si es una transcripción.
4. Comprobar límites de frecuencia y concurrencia.
5. Estimar el coste máximo y comprobar el tope de la operación (BE-FR-72).
6. **En una transacción**: comprobar saldo disponible, deuda y tope diario de cuentas sin compras, y crear la reserva (BE-FR-71).
7. Llamar al proveedor (con reintentos, *fallback* en transcripción y modelos de respaldo).
8. Obtener el coste real (BE-FR-20) y calcular el cobro (BE-FR-19).
9. **En una transacción**: consumir bolsas (BE-FR-14), generar deuda si procede (BE-FR-17), liberar la reserva, escribir el ledger y `ai_operations`.
10. Responder con resultado, cobro y saldo. Si la conexión ya está cerrada, marcar la operación como `undelivered`.
11. Tras responder: comprobar el umbral de saldo bajo (email, BE-FR-49.7).

Si el proceso falla entre los pasos 6 y 9, la reserva se libera por caducidad o al reiniciar (BE-FR-71) y no se cobra.

---

## 9. Configuración del administrador

**BE-FR-61 — Todos los parámetros son editables desde el panel.** Cada parámetro de la tabla siguiente (y los paquetes, apps, operaciones, plantillas y modelos) se puede modificar desde `/admin` sin redesplegar.
- CA1: Los cambios se aplican a la siguiente operación o petición, salvo que el parámetro indique lo contrario (p. ej. `welcome_credits` y `free_credits_expiry_days` solo afectan a las bolsas creadas después del cambio).
- CA2: Cada campo se valida antes de guardar (tipos, rangos, coherencias; p. ej. el margen no puede ser < 1, ni `min_balance_to_operate` negativo).
- CA3: Cada cambio queda en la auditoría (BE-FR-55) con el valor anterior y el nuevo.
- CA4: El panel muestra junto a cada parámetro su valor por defecto y una breve explicación de su efecto.
- CA5: Los parámetros marcados como **por app** se pueden sobrescribir en cada app; el panel muestra el valor efectivo y su origen (global o app).

Solo las variables de entorno listadas al final de esta sección (secretos e infraestructura) no se editan desde el panel.

| Parámetro | Por defecto (sugerido) | Ámbito | Descripción |
|---|---|---|---|
| `credits_per_eur_purchase` | 1.000 | Global | Créditos por euro al **comprar** |
| `credits_per_eur_usage` | 1.000 | Global | Créditos por euro de **precio** de consumo |
| `fx_usd_eur` | Calculado a diario (BE-FR-87); 0,92 hasta la primera consulta | Global | Tipo de cambio USD → EUR (con valor manual opcional que lo sustituye) |
| `fx_buffer_pct` | 3 % | Global | Colchón sobre el tipo del BCE |
| `fx_stale_alert_days` | 3 | Global | Días sin poder actualizar el cambio antes de avisar |
| `margin_global` | 2,0 | Global (y por operación) | Multiplicador sobre el coste real |
| `provider_fee_pct_openrouter` | 5,5 % | Global | Comisión indirecta de OpenRouter (recarga de saldo) |
| `provider_fee_pct_mistral` | 0 % | Global | Comisión indirecta de Mistral |
| `voxtral_price_per_minute_usd` | Tarifa vigente de Mistral | Global | Coste por minuto de Voxtral |
| `welcome_credits` | 1.000 (= 1 €) | Global | Saldo de bienvenida (≈ 9 h de dictado; coste real máximo ≈ 0,50 € por usuario con margen ×2,0) |
| `free_credits_expiry_days` | 30 | Global | Caducidad de las bolsas gratuitas |
| `free_expiry_warning_days` | 7 | Global | Aviso previo a la caducidad |
| `min_balance_to_operate` | 5 créditos | Global | Saldo disponible mínimo para lanzar operaciones |
| `max_debt` | 200 créditos (0,20 €) | Global | Deuda máxima tolerada (margen para costes que superan la estimación) |
| `hold_ttl_seconds` | 600 | Global | Caducidad de una reserva huérfana |
| `chars_per_token_estimate` | 3 | Global | Caracteres por token para estimar la entrada (conservador) |
| `image_input_token_estimate` | 1.500 | Global | Tokens estimados por imagen de entrada |
| `idempotency_window_minutes` | 10 | Global | Ventana de `Idempotency-Key` |
| `daily_cap_no_purchase` | 400 créditos | Global | Tope diario para cuentas sin compras reales (suma de todas las apps) |
| `registrations_per_ip_24h` | 3 | Global | Altas por IP y día |
| `login_max_failures` | 10 | Global | Intentos fallidos por email en 15 min antes del bloqueo temporal |
| `login_lock_minutes` | 15 | Global | Duración del bloqueo temporal de login |
| `unverified_account_ttl_days` | 7 | Global | Borrado de cuentas sin verificar |
| `min_age` | 18 | Global | Edad mínima declarada en el registro (a confirmar) |
| `inactive_account_years` | 3 | Global | Inactividad tras la que se avisa a una cuenta sin compras reales (BE-FR-86) |
| `inactive_account_notice_days` | 30 | Global | Plazo entre el aviso y el borrado por inactividad |
| `ai_requests_per_minute` | 30 | Global / por app | Peticiones de IA por usuario y minuto |
| `max_concurrent_transcriptions` | 2 | Global / por app | Transcripciones simultáneas por usuario |
| `max_audio_seconds` | 300 (5 min) | Por app (Secretario) | Duración máxima de una grabación; se publica en `/app/status` |
| `audio_duration_tolerance_seconds` | 10 | Por app | Tolerancia sobre la duración máxima |
| `max_audio_mb` | 10 | Por app | Tamaño máximo del audio |
| `max_text_chars` | 200 000 | Global / por app / por operación | Tamaño máximo del texto de una petición |
| `max_image_mb` | 10 | Global / por app / por operación | Tamaño máximo de imagen de entrada |
| `max_sync_doc_kb` | 1024 | Por app | Tamaño máximo del documento sincronizado |
| `global_daily_free_cost_brake_eur` | 5 € | Global | Freno global de gasto (coste real diario de cuentas sin compras; ≈ 25 cuentas gratuitas a tope) |
| `maintenance` | desactivado + mensaje | Global y por app | Modo mantenimiento |
| `min_app_version` / `recommended_app_version` / `enforce_version` | 4.0.0 / 4.0.0 / sí (Secretario) | Por app | Control de versiones |
| `openrouter_balance_alert_usd` | 10 USD | Global | Alerta de saldo de OpenRouter |
| `model_price_change_alert_pct` | 20 % | Global | Alerta de cambio de precio de un modelo asignado |
| `price_reference_window_days` / `price_reference_min_samples` | 30 / 50 | Global | Cálculo de precios orientativos |
| `flagged_ops_alert_per_day` | 3 | Global | Operaciones marcadas por moderación que disparan alerta |
| `support_email` | `soporte@mardomingo.com` | Global / por app | Email de soporte |
| Paquetes | 5 € → 5.000 (+0 %), 10 € → 10.500 (+5 %), 25 € → 27.500 (+10 %) | Global | BE-FR-23 |
| Operaciones (modelo, respaldos, `max_output_tokens`, `max_cost_credits`, *timeout*…) | Equivalentes a los sugeridos hoy por el asistente de Secretario | Por operación | BE-FR-77 |
| Transcripción | Voxtral activo, backup configurable | Por operación | BE-FR-35 |

Variables de entorno (no editables desde el panel): `ADMIN_EMAIL` (la cuenta que se registra y verifica con ese email recibe el rol `admin`; nunca hay dos), `APP_ENV` (`development`/`test`/`staging`/`production`), `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `PAYMENTS_PROVIDER`, `INVOICING_PROVIDER`, `DATABASE_PATH`, `BETTER_AUTH_SECRET`, `OPENROUTER_API_KEY`, `OPENROUTER_MANAGEMENT_KEY` (opcional; clave de gestión de OpenRouter usada solo para leer el saldo cada hora; sin ella, la alerta de saldo queda desactivada, BE-FR-56), `MISTRAL_API_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET`, `EMAIL_HASH_KEY` (clave secreta del HMAC del email normalizado de `welcome_grants` y `login_attempts`, BE-FR-11.5; **nunca se rota**, porque los hashes guardados dejarían de coincidir), `BODY_SIZE_LIMIT`, credenciales S3 de Litestream y, en la fase Stripe, sus claves y las del proveedor de facturación.

---

## 10. Seguridad, privacidad y calidad

1. **HTTPS obligatorio** (proxy de Coolify). Cookies `Secure`, `HttpOnly`, `SameSite=Lax` (solo en la web de la cuenta). **Protección CSRF propia, solo en el host web** (`cuenta.`): un *hook* `handle` exige que todo `POST`/`PUT`/`PATCH`/`DELETE` con tipo de contenido de formulario traiga una cabecera `Origin` igual al origen de `PUBLIC_WEB_URL`; si no, `403`. La comprobación de origen propia de SvelteKit se desactiva, porque rechaza los `POST` `multipart/form-data` sin `Origin` y las apps de escritorio no lo envían al subir audio (BE-FR-35). El host de la API usa solo Bearer, sin cookies, así que CSRF no aplica allí. **CORS** de la API restringido a los orígenes declarados por cada app (BE-FR-65).
2. **Contraseñas** con el algoritmo de hash de Better Auth; nunca se registran en logs.
3. **Secretos** (claves de proveedores, Resend, Turnstile, Litestream, pagos, facturación) solo en variables de entorno de Coolify; nunca en el repositorio. Claves distintas por entorno.
4. **Tests obligatorios** (Vitest) de: fórmula de cobro (con comisión del proveedor) y redondeo, orden de consumo de bolsas, **reservas con peticiones simultáneas**, estimación del coste máximo, deuda y su liquidación, caducidad, idempotencia de pagos y de `/ai/*`, reconstrucción del saldo desde el ledger, concurrencia de cobros, conflicto de sincronización, validación del documento de sincronización por esquema, aislamiento entre apps (sesión, sincronización y operaciones) y cumplimiento del contrato OpenAPI.
5. **Logs** (stdout + Log Gateway → OpenObserve; constitución, principio XI; solo stdout hasta recibir el contrato de ingesta del Gateway, 11) con identificador de petición, app, usuario (id, no email), operación, estado y duración. **Prohibido** registrar cuerpos de petición o respuesta de `/ai/*` y `/sync`.
6. **Sin contenido persistido** (BE-FR-38).
7. **Proveedores**: `data_collection: "deny"` en OpenRouter (BE-FR-33).
8. **Retención y encargados del tratamiento**: BE-FR-83.
9. **Uso aceptable**: BE-FR-82.

---

## 11. Despliegue y operación

- **Coolify**: una aplicación (contenedor Node con `adapter-node` y **ffmpeg/ffprobe** en la imagen) con volumen persistente para el fichero SQLite; dominios `api.mardomingo.com` y `cuenta.mardomingo.com` con TLS, servidos por la misma instancia.
- **Entornos**:
  - `production`: dominios anteriores.
  - `staging`: en el **mismo servidor** que producción (otra aplicación de Coolify, en otro puerto), con `api-staging.mardomingo.com` y `cuenta-staging.mardomingo.com`, con su propia base de datos, su propio bucket de backups, claves de proveedores de IA propias con **límite de gasto** (clave de OpenRouter con tope de crédito), claves de prueba de Turnstile y pago simulado para todos (`APP_ENV = staging`). Nunca se copian datos de producción a staging.
  - Las apps de escritorio apuntan a staging con su mecanismo de desarrollo (en Secretario, `SECRETARIO_BACKEND_URL`, `v4-app-spec.md` APP-FR-10).
- **Una sola instancia por entorno** (requisito de SQLite). El despliegue debe evitar dos contenedores simultáneos escribiendo en el mismo fichero (despliegue con parada previa o estrategia equivalente). Al arrancar se liberan las reservas abiertas (BE-FR-71).
- **Backups**: Litestream replica en continuo el SQLite a Backblaze B2 (región UE, API compatible con S3) con retención mínima de 30 días. Procedimiento de **restauración documentado y probado** antes del lanzamiento público (requisito: el dinero de los usuarios depende de él).
- **Migraciones** Drizzle aplicadas automáticamente al arrancar, con backup previo. Se prueban primero en staging.
- **Tareas programadas** (dentro del proceso):
  - Cada hora: saldo de OpenRouter (solo si existe `OPENROUTER_MANAGEMENT_KEY`, BE-FR-56).
  - Diarias:
    - caducidad de bolsas y avisos;
    - comprobación del ledger;
    - caché de modelos y vigilancia de modelos asignados (BE-FR-80);
    - precios orientativos (BE-FR-73);
    - limpieza de marcas de borrado de sincronización con más de 30 días;
    - borrado de cuentas sin verificar (BE-FR-68);
    - aplicación de plazos de retención (BE-FR-83);
    - limpieza de reservas caducadas;
    - tipo de cambio del BCE (BE-FR-87);
    - aviso y borrado de cuentas inactivas (BE-FR-86);
    - contador de descargas de GitHub Releases para el embudo de alta (BE-FR-54).
  - Semanal: actualización de la lista de dominios desechables.
- **Monitorización**: `/health`, logs y errores en OpenObserve (a través del Log Gateway), alertas por email (5.13).
- **Log Gateway**: el envío se implementa como un adaptador con interfaz propia. Hasta que el propietario entregue el contrato de ingesta (URL, autenticación, formato del lote, tamaños, códigos de respuesta y `Retry-After`), que es una entrada de L01, los logs solo se escriben en stdout.

---

## 12. Decisiones abiertas

Las decisiones se agrupan por estado. Los números se mantienen porque el resto del documento los cita.

- **Resueltas**: ya forman parte de la especificación.
- **Pendientes con profesionales**: las gestiona el propietario con su gestoría y su abogado. **No bloquean la implementación de la v4** (pagos simulados y sin facturas), pero **sí el lanzamiento público con cobros reales** (fase Stripe).
- **Aplazadas**: no hay que decidirlas ahora; se indica la situación que obliga a decidirlas.

#### Resueltas

| # | Decisión | Resolución |
|---|---|---|
| 1 | Proveedor S3 para Litestream | Backblaze B2, región UE. |
| 5 | Valores numéricos de la sección 9 | Valores por defecto acordados el 2026-10-07 (sección 9). Todos son editables desde el panel (BE-FR-61) y se revisarán con los costes reales medidos en pruebas. |
| 6 | Nombre del repositorio | `mardomingo-backoffice` (2026-10-10). |
| 7 | Fuente del tipo de cambio USD/EUR | Automática desde el BCE con colchón configurable y valor manual opcional (BE-FR-87; 2026-10-10). |
| 8 | Marca paraguas y dominios | «Cuenta Mardomingo», `api.mardomingo.com` y `cuenta.mardomingo.com` (2026-10-10). |
| 10 | Cuentas inactivas | Solo se cierran las cuentas sin compras reales, tras 3 años de inactividad y con aviso previo; las que tienen compras nunca se cierran de forma automática (BE-FR-86; 2026-10-10). |

#### Pendientes con profesionales (las gestiona el propietario)

Vendedor: **autónomo ya dado de alta** (2026-10-10).

| # | Decisión | Qué hay que preguntar |
|---|---|---|
| 2 | Fiscalidad y **proveedor de facturación** (gestoría) | ¿La actividad dada de alta cubre la venta de un servicio digital por créditos prepagados o hay que añadir epígrafe? ¿Cuándo se devenga el IVA: en la compra de créditos o en su consumo? ¿Hay que darse de alta en la ventanilla única (OSS) para clientes de otros países de la UE, y desde qué volumen? ¿Qué proveedor de facturación compatible con Verifactu se recomienda, o sirve Stripe Invoicing? ¿Cómo se pasa una factura simplificada a completa? ¿Hay que comprobar en VIES los NIF-IVA intracomunitarios? ¿Cómo se contabilizan los créditos vendidos y aún no consumidos, y los gratuitos? |
| 3 | Precios con IVA incluido y créditos fijos por paquete con independencia del país (gestoría) | ¿Es válido un precio único con IVA incluido para toda la UE, aunque el tipo de IVA varíe por país y cambie el neto? |
| 4 | Textos legales (abogado) | Términos, privacidad, cookies y uso aceptable para una plataforma de varias apps que revende IA con proveedores fuera de la UE (OpenRouter). Base legal de las transferencias internacionales. Validez de la renuncia al desistimiento (BE-FR-26) y de la pérdida del saldo al borrar la cuenta (BE-FR-07). |
| 14 | Edad mínima (abogado) | Propuesta: 18 años, porque hay pagos. ¿Se puede bajar a 14 años (edad de consentimiento en España) si no se compra? |
| 15 | Plazos de conservación de BE-FR-83 (abogado y gestoría) | Validar cada plazo de la tabla, en especial el de las IP y el de los metadatos de uso. |

#### Aplazadas

| # | Decisión | Cuándo hay que decidirla |
|---|---|---|
| 9 | Compras en apps móviles | Antes de publicar la primera app móvil. Las tiendas de Apple y Google exigen, con matices según la región, su propio sistema de pago para bienes digitales que se consumen en la app: compra in-app como otro proveedor de pagos, o compra solo en la web, según lo que permita cada tienda. |
| 11 | Firma del instalador de Secretario | **Tras la beta**, con el embudo de alta (BE-FR-54): si una parte importante de las descargas no llega a la primera sesión, se firma. Hasta entonces se distribuye sin firma, con la explicación de SmartScreen en la landing. Antes de decidir se comparan las opciones y precios vigentes para un autónomo en España (servicio de firma en la nube de Microsoft, certificado OV o publicación en Microsoft Store). |
| 12 | Login en el navegador con retorno a la app (OAuth con PKCE, loopback o *deep link*) | Al añadir "Entrar con Google" o la primera app móvil. Se añadirá **además** del login con contraseña en la app, sin cambiar los endpoints existentes. |
| 13 | *Streaming* de respuestas | Cuando una operación supere un 2 % de `PROVIDER_TIMEOUT` durante una semana, o cuando una app nueva lo necesite. |

---

## 13. Trazabilidad de decisiones

Resumen de las decisiones tomadas con el propietario del producto durante el diseño (2026-10-06, ampliado el 2026-10-10):

| Tema | Decisión |
|---|---|
| Modo BYOK | Se mantiene en la app como "modo avanzado"; no usa el backend |
| Transcripción | Por el backend: Voxtral principal + backup de OpenRouter, configurable por el administrador |
| Modelos | Los decide solo el administrador, por operación |
| Plataforma | Secretario: solo Windows; idioma solo español, preparado para traducir |
| Registro | Email + contraseña con verificación; solo en la web; Google en fase 2 |
| Sesión | Deslizante de 30 días; sesiones opacas de Better Auth como Bearer |
| Dispositivos | Ilimitados, con gestión de sesiones |
| Antiabuso | Capas 1–5 + tope diario para cuentas sin compras |
| Unidad | Créditos; la conversión de compra solo afecta a compras futuras |
| Tarificación | Coste real × margen (`usage.cost` de OpenRouter) |
| Saldo insuficiente | Mínimo para operar + deuda tolerada con tope |
| Caducidad | Gratuitos sí, comprados no; se gastan primero los gratuitos |
| Compra | Paquetes fijos configurables |
| Pagos | Stripe + Stripe Tax como destino; la v4 usa pago simulado (en producción, solo testers) |
| Reembolsos | Solo manuales; contracargo bloquea la cuenta; el saldo se pierde al borrar la cuenta |
| Contenido | Nunca se guarda; `data_collection: deny` |
| Sincronización | Por cuenta, automática; Firebase se elimina |
| Predeterminados | Plantilla copiada al empezar a usar la app; cambios posteriores no afectan; restauración manual por sección |
| Stack | SvelteKit + Better Auth + Drizzle + SQLite + Litestream (Backblaze B2, UE); Coolify; Resend |
| Administrador | Solo contraseña, sin segundo factor |
| Predeterminados (copia) | Botón "Copiar mis datos actuales como predeterminados" con vista previa y selección por elemento |
| Conversiones | Dos parámetros: créditos por euro de compra y de consumo |
| Contracargos | Deuda sin tope y bloqueo de la cuenta |
| Valores económicos por defecto | 1 € = 1.000 créditos; margen ×2,0; bienvenida 1.000 créditos que caducan a los 30 días; mínimo para operar 5 y deuda máxima 200; tope diario sin compras 400; paquetes 5/10/25 €; freno global 5 €/día; todos editables desde el panel |
| Duración de audio | Máximo 5 minutos por grabación (configurable) |
| API de IA | Operación + mensajes desde el cliente; el backend elige el modelo |
| Protecciones | Límites por usuario, de tamaño y de autenticación; freno global; mantenimiento; versiones mínima y recomendada |
| Paneles | Usuario con gráficas, aviso de saldo bajo y CSV; administrador único con alerta de saldo de OpenRouter |
| **Alcance (2026-10-10)** | **Plataforma multi-app desde el primer día**; Secretario es la primera app |
| **Cuentas entre apps (2026-10-10)** | Una cuenta y un saldo compartidos por todas las apps |
| **Tipos de cliente (2026-10-10)** | Escritorio, web y móvil (solo se construye Secretario, escritorio) |
| **Capacidades de IA (2026-10-10)** | Se añaden salida estructurada en JSON y *tool calling*; sin *streaming*, *embeddings* ni TTS |
| **Control de coste (2026-10-10)** | Reserva de saldo previa a cada operación + `max_output_tokens` y coste máximo por operación |
| **Prompts (2026-10-10)** | Mixto: operaciones libres (cliente) o con plantilla versionada (servidor); Secretario, todas libres |
| **Moderación (2026-10-10)** | Política de uso aceptable + moderación de los proveedores + bloqueo; sin moderación propia |
| **Facturación (2026-10-10)** | Particulares y empresas: datos fiscales opcionales, factura simplificada o completa, rectificativas y exportación contable; emisión delegada en un proveedor externo |
| **Login (2026-10-10)** | Email y contraseña dentro de la app; el login en el navegador queda para la fase 2 |
| **Unidad visible (2026-10-10)** | Créditos + página pública de precios orientativos |
| **Marca (2026-10-10)** | Marca paraguas «Cuenta Mardomingo»; `api.` y `cuenta.mardomingo.com` |
| **Repositorio (2026-10-10)** | `mardomingo-backoffice` |
| **Vendedor (2026-10-10)** | Autónomo ya dado de alta; el propietario gestiona las consultas con la gestoría y el abogado |
| **Tipo de cambio (2026-10-10)** | Automático desde el BCE + colchón, con valor manual opcional |
| ***Timeouts* (2026-10-10)** | El backend publica el tiempo máximo de cada operación en `/app/status` y las apps lo usan |
| **Cuentas inactivas (2026-10-10)** | Solo se cierran las que no tienen compras reales (3 años + aviso) |
| **Firma del instalador (2026-10-10)** | Se decide tras la beta con el embudo de alta |
| **Añadidos por defecto (2026-10-10)** | `Idempotency-Key`; comisión del proveedor en la fórmula; *timeouts* por operación; ffprobe para la duración del audio; modelos de respaldo y vigilancia; cambio de email; bloqueo por intentos fallidos; limpieza de cuentas sin verificar; edad mínima; retención y DPA; email de soporte; anuncios; staging; OpenAPI; roles como lista; estado de la cuenta sin campos duplicados; aceptación de nuevas versiones legales |
| **Sistema de diseño (2026-10-10)** | Se recicla el de NetworkBench como base estructural, con identidad propia «Aurora Salvia»; `Design/` es la fuente canónica (16.2) |
| **Cristal (2026-10-10)** | Selectivo (navegación, superposiciones y tarjetas de resumen); contenido y datos siempre opacos; ajuste propio «Reducir transparencia y movimiento» (16.3, 16.4) |
| **Temas (2026-10-10)** | Claro y oscuro; selector Sistema / Claro / Oscuro con Sistema inicial, sin JavaScript y sin destello (16.4) |
| **Adaptación (2026-10-10)** | Mobile-first en toda la web, también en el panel de administración; objetivos táctiles de 44 × 44 px (16.5) |
| **Usabilidad (2026-10-10)** | Prueba ligera con 3–5 personas antes del lanzamiento público con cobros reales (16.10) |
| **Arquitectura (2026-10-10)** | Monolito modular por funcionalidades con API pública, dueño único de cada tabla y fronteras comprobadas por ESLint y un test de arquitectura (constitución v2.0.0, `ARCHITECTURE.md`, ADR 0005) |
| **Logging (2026-10-10)** | pino en el servidor y loglevel en el navegador; stdout + Log Gateway → OpenObserve; sin IP ni contenido; catálogo de eventos por funcionalidad (constitución XI) |
| **Validación (2026-10-10)** | Zod 4 en todas las fronteras, estricto en las entradas y tolerante en layouts y proveedores, `z.input` para lo que llega y sin aserciones de tipo (constitución XII) |
| **Entorno (2026-10-10)** | `$env/dynamic/private` y `$env/dynamic/public` leídos solo en `env.ts`, validados en `init` con `building`; `APP_ENV=test` para las pruebas |
| **Revisión cruzada (2026-10-10)** | `privacy` como funcionalidad propia; compra real y saldo bajo en `user_balances` (`credits`); `$lib/shared/` y `$lib/server/api/`; tests de integración junto a su funcionalidad; cobertura del 80 % sobre `src/lib`; tokens canónicos en el código desde L01 (constitución v2.1.0, ADR 0007) |
| **Aclaraciones de la especificación 001 (2026-10-10)** | Los ajustes positivos del administrador también liquidan la deuda; límites por usuario a la suma de apps más un límite opcional por app; anuncios del panel: generales y de las apps que la cuenta usa; pasos tras verificar: texto genérico o propio de la app |
| **Saldo de OpenRouter (2026-10-10)** | Clave de gestión propia `OPENROUTER_MANAGEMENT_KEY`, usada solo para leer el saldo cada hora; si falta (p. ej. en staging), la alerta queda desactivada y se registra un evento al arrancar (BE-FR-56) |
| **Cancelaciones (2026-10-10)** | La operación cancelada no se cobra al usuario; el coste del proveedor, cuando se conoce, se guarda y cuenta como «pérdida por cancelación» (BE-FR-37, BE-FR-54) |
| **Ajuste negativo (2026-10-10)** | No puede superar el saldo disponible: se rechaza con un error de validación y el administrador no crea deuda por ajuste (BE-FR-18) |
| **Email normalizado (2026-10-10)** | Con índice, no único; la bienvenida se controla con `welcome_grants` y un hash HMAC-SHA256 con la clave propia `EMAIL_HASH_KEY`, que nunca se rota (BE-FR-11.5) |
| **CSRF (2026-10-10)** | Protección propia en `handle` solo para el host web (`Origin` igual al de `PUBLIC_WEB_URL` en los envíos de formulario); se desactiva la de SvelteKit porque rechaza la subida de audio sin `Origin` de las apps de escritorio; la API usa solo Bearer (10.1) |
| **Captcha y límites de autenticación (2026-10-10)** | Turnstile (adaptador `CaptchaVerifier`) y límites por IP (tabla `auth_rate_limits`) implementados en `accounts`, porque los plugins `captcha` y `rateLimit` de Better Auth no actúan con `auth.api`; de Better Auth se usan `bearer` y `admin` (4.1, BE-FR-45) |

---

## 14. Impacto en la app Secretario (`v4-app-spec.md`)

Cambios que este documento exige en la especificación de la app. **Incorporados** en `secretario2/docs/v4-app-spec.md` versión 1.1 (2026-10-10): APP-FR-04, 09, 10, 12, 13, 16, 17, 18, 19, 29 y los nuevos APP-FR-48 (idempotencia), 49 (aceptación legal), 50 (anuncios) y 51 (soporte).

| Tema | Cambio en la app |
|---|---|
| URL del backend | `https://api.mardomingo.com` (APP-FR-10); enlaces web tomados de `/app/status`. |
| Cabeceras | Añadir `X-App-Id: secretario` a todas las peticiones (APP-FR-09). |
| Idempotencia | Generar `Idempotency-Key` por acción del usuario y reutilizarla en **Reintentar** (APP-FR-13, APP-FR-17); tratar `REQUEST_IN_PROGRESS` y `DUPLICATE_REQUEST`. |
| Peticiones | Enviar `operation` también en `/ai/transcribe` (`transcription`) y `/ai/image` (`image-generation`). |
| Nuevos errores | `TERMS_ACCEPTANCE_REQUIRED` (diálogo con enlaces y aceptación vía `POST /me/accept-terms`), `OPERATION_TOO_EXPENSIVE`, `LOGIN_TEMPORARILY_LOCKED`, `APP_DISABLED`; `INSUFFICIENT_BALANCE` con `requiredMicro`. |
| Saldo | Mostrar el saldo disponible (`availableMicro`) y, si lo hay, el reservado. |
| Respuestas | Tratar `truncated: true` (aviso de que el resultado puede estar incompleto). |
| Soporte | "Contacta con soporte" abre `supportEmail` de `/app/status`. |
| Anuncios | Mostrar los anuncios de `/app/status` y recordar localmente los cerrados. |
| Precios | Enlace a `links.prices` en Configuración → Cuenta. |
| *Timeouts* | El *timeout* de cada operación se toma de `operations.<key>.timeoutMs` en `/app/status` más un margen (APP-FR-16). |

---

## 15. Estrategia integral de testing para SvelteKit

> Esta sección indica a `/speckit-plan`, `/speckit-tasks` y `/speckit-implement` **cómo** probar el backend. Las reglas innegociables (cobertura, TDD en el dominio, prohibiciones) están en la constitución (`.specify/memory/constitution.md`, principio V y «Flujo de desarrollo»); si hay contradicción, prevalece la constitución. Las versiones de las herramientas son las de la tabla «Stack tecnológico y versiones» de la constitución: **se comprueban otra vez en el momento de instalarlas**.
>
> Estado (2026-10-10): **no existe código, plan ni CI**. Todo lo que sigue son requisitos e instrucciones; ninguna prueba se ha creado ni ejecutado.

### 15.1 Clasificación del proyecto

**Aplicación full-stack SvelteKit híbrida SSR/CSR con backend propio**, en una sola instancia de Node (adapter-node) con SQLite:

- **API JSON** (`/api/v1/*`, dominio `api.`) consumida por clientes externos (Secretario, Electron/Windows). Sin interfaz.
- **Web SSR con mejora progresiva** (dominio `cuenta.`): landings, legales, precios, registro, panel de usuario y panel de administración. Después de la hidratación, la navegación es CSR.
- **Sin prerenderizado** en la v4 (`prerender = false`): no hay pruebas de prerender, solo un test de arquitectura que lo garantiza.
- **Tareas programadas** dentro del proceso (croner).

**Flujos críticos** (dinero, seguridad o privacidad): reserva y cobro de operaciones de IA, compra simulada, ajustes y reembolsos del administrador, caducidad y deuda, registro y verificación (antiabuso del saldo de bienvenida), sesiones y autorización, sincronización sin pérdida de escrituras y no persistencia de contenido.

### 15.2 Inventario de código y nivel de prueba

| Zona | Ubicación | Runtime | Nivel principal | Necesita |
|---|---|---|---|---|
| Dominio puro (tarificación, bolsas, reservas, deuda, estimación, normalización, validación de sincronización, idempotencia, fechas) y núcleos comunes | `src/lib/server/features/*/domain/`, `src/lib/shared/`, `src/lib/server/shared/` | Node | Unit + property-based + mutation | Nada (funciones puras) |
| Servicios (casos de uso, transacciones) | `src/lib/server/features/*/service.ts` | Node | Integración | SQLite temporal, *fakes* de adaptadores, `Clock` y `Logger` falsos |
| Repositorios y esquema | `src/lib/server/features/*/{repository,schema}.ts`, `src/lib/server/db/` (cliente, transacción, migraciones) | Node | Integración | SQLite temporal con migraciones reales |
| Adaptadores (OpenRouter, Mistral, Resend, BCE, Turnstile, GitHub, pagos, facturación) y sus `fake.ts` | `src/lib/server/adapters/` | Node | Integración de adaptador | Servidor HTTP simulado local |
| Utilidades de la API (errores 7.1, cabeceras comunes, OpenAPI) | `src/lib/server/api/` | Node | Unit + N3 HTTP | Datos conocidos |
| Configuración y entorno | `src/lib/server/config/` | Node | Unit | Objetos de entorno de prueba |
| Logging (servidor) | `src/lib/server/logging/` | Node | Unit + emisión real | Registrador falso; stdout capturado |
| Presenters, composición de modelos de vista, helper de formularios, guards | `src/lib/server/features/*/presenters.ts`, `src/routes/**/*.data.server.ts`, `src/lib/server/forms/`, guards de `accounts` | Node | Unit (claves exactas con `toStrictEqual`) | Datos conocidos |
| Reglas de arquitectura (fronteras, dueños de tablas, estado de módulo, lector del entorno, eventos) | `tests/architecture/` | Node | Test de arquitectura | Nada (lee el código) |
| Tema, efectos y componentes del marco | `src/lib/design-system/`, `src/lib/components/{ui,layout}/` | Navegador | N2 + E2E (16.11) | jsdom / build |
| Formato compartido (importes BE-FR-22, fechas) | `src/lib/format/` | Node y navegador | Unit | Nada |
| Esquemas compartidos | `src/lib/schemas/` | Node y navegador | Unit | Nada |
| Form actions | `src/routes/**/+page.server.ts` | Node | Integración (llamada directa con evento falso) | SQLite temporal |
| `load` | `src/routes/**/+page.server.ts` | — | **No se llaman**: se prueban los servicios y presenters que componen | — |
| Hooks (`handle`, `handleError`, `init`) | `src/hooks.server.ts` | Servidor real | HTTP contra el build | Build + `node build` + servidores simulados |
| Endpoints `+server.ts` (API, webhooks, descargas, `/client-errors`) | `src/routes/api/v1/**` y otros | Servidor real | HTTP contra el build + contrato OpenAPI | Ídem |
| Componentes | `src/lib/components/**` | jsdom | Componente | Testing Library |
| Logging del navegador | `src/lib/logging/client.ts` | jsdom | Unit | `fetch` simulado |
| Páginas y flujos | `src/routes/(web)/**` | Navegador | E2E (Playwright) | Aplicación completa en modo test |
| Tareas programadas | Servicios invocados por croner | Node | Integración (se invoca el servicio, no el cron) | `Clock` falso |

### 15.3 Herramientas

| Necesidad | Herramienta | Estado | Clasificación |
|---|---|---|---|
| Tipos, Svelte, lint, formato | `svelte-check`, ESLint, Prettier | Fijadas en la constitución | Necesaria |
| Unit, integración, componente, HTTP | Vitest + `@vitest/coverage-v8` | Fijada | Necesaria |
| Componentes | `@testing-library/svelte` + `jsdom` | Fijada | Necesaria |
| E2E, cross-browser, visual, responsive | Playwright | Fijada | Necesaria |
| Accesibilidad automática | `@axe-core/playwright` | Fijada | Necesaria |
| Property-based | `fast-check` + `@fast-check/vitest` (comprobado: 4.10.2 / 0.5.0, compatibles con Vitest 5) | Nueva (enmienda de la constitución) | Condicional: solo dominio, normalización y fechas |
| Mutation testing | StrykerJS (`@stryker-mutator/core` + `vitest-runner`; comprobado: 10.0.0, admite Vitest ≥ 2; no admite Browser Mode, que no usamos) | Nueva (enmienda) | Condicional: piloto sobre el dominio |
| Servidores HTTP simulados | `node:http` nativo | Sin dependencia | Necesaria |
| Prueba de carga | Script propio con `fetch` | Sin dependencia | Necesaria: obligatoria desde L12 (L12, L16 y cada release) |

No se añaden MSW, Cucumber, Vitest Browser Mode ni herramientas visuales externas: lo cubren Playwright y los servidores simulados nativos.

### 15.4 Pirámide de testing

| Nivel | Qué demuestra | Herramienta y entorno | Frecuencia | Bloquea |
|---|---|---|---|---|
| **N0 Estático** | Tipos, Svelte, lint, imports prohibidos, build, tests de arquitectura | `pnpm check`, `pnpm lint` / `lint:changed`, `pnpm build` | Edición y lote | Lote, PR |
| **N1 Unit** | Reglas puras, cálculos, validadores, formateadores | Vitest (Node) | Edición y lote | Lote, PR |
| **N2 Componente** | Estados, interacción y contrato accesible de componentes | Vitest + jsdom + Testing Library | Lote | PR |
| **N3 Integración** | Servicios + BD real, actions, adaptadores contra simuladores, hooks y API sobre el build | Vitest (Node), SQLite temporal, `node build` | Lote | Lote, PR |
| **N4 Aceptación** | Criterios `CA` de `Historias.md` | Tests etiquetados en el nivel más barato posible (N1–N5) | Lote / historia | Historia |
| **N5 E2E** | Flujos críticos con navegador real, también sin JavaScript | Playwright contra el build en modo test | Historia / PR (críticos), `main` (todos) | PR, release |
| **N6 Transversal** | Accesibilidad, responsive, cross-browser, visual, rendimiento, seguridad verificable | Playwright, axe, script de carga | Según 15.24 | Release |
| **Mutation** (aparte) | Calidad de los tests del dominio | Stryker | Programada y PR que toquen el dominio | Release (umbral de línea base) |

Las comprobaciones de N0 **no sustituyen** a ningún test. La cobertura es una señal, no una prueba de calidad.

### 15.5 Implementación por lotes y checkpoints

**Modelo predeterminado** (para cada historia):

1. Analizar la historia y sus `CA`.
2. Identificar los comportamientos observables que se probarán.
3. Clasificar el nivel de test más barato para cada uno.
4. Dividir la implementación en lotes funcionales coherentes (orientativo: 3–8 tareas).
5. Implementar el lote.
6. Estabilizar sus contratos públicos (esquemas, firmas de servicio, rutas).
7. Crear o completar los tests del lote.
8. Ejecutar solo las suites afectadas (15.24).
9. Corregir los fallos.
10. Cerrar el checkpoint.

**Tests antes o inmediatamente después** de implementar (no al final del lote): todo el dominio de dinero (TDD obligatorio por la constitución), autenticación y autorización, concurrencia, idempotencia, privacidad (no persistir contenido), migraciones, contratos ambiguos y cualquier bug (primero el test de regresión que lo reproduce).

**Lotes más pequeños** en dinero, autenticación, autorización, seguridad, migraciones, concurrencia e integraciones con proveedores. **Más grandes** en componentes presentacionales, páginas de solo lectura y adaptadores simples.

**Deuda de tests:** solo puede existir dentro del lote activo. PROHIBIDO acumular lotes sin tests, cerrar historias con tests obligatorios pendientes, dejar todos los E2E para el final o dar una pantalla por terminada porque «funciona a mano».

**Plan previo de cada lote** (bloque obligatorio en `plan.md`, por lote):

```markdown
#### Lote L0X — <nombre>
- Historia / requisitos: BE-FR-…
- Objetivo y funcionalidad:
- Funcionalidades afectadas y aristas nuevas entre ellas (ARCHITECTURE.md):
- Rutas / componentes / código servidor / código cliente:
- Comportamientos observables, estados, interacciones:
- Reglas, errores, casos límite, riesgos:
- Tests previstos: unit · componente · integración · aceptación (CA) · E2E · responsive · a11y · visual
- Datos, fixtures, builders, fakes y dependencias sustituidas:
- Entorno de los tests (variables mínimas, servidores simulados):
- UX (si hay interfaz): estados de 16.6, criterios UX-xx y combinaciones de la matriz de 16.11:
- Eventos de log del catálogo (principio XI):
- Suite de cierre y criterios del checkpoint:
```

### 15.6 Lotes funcionales orientativos de la v4

El plan los refina; aquí se fijan el orden y los tests clave.

| Lote | Contenido (requisitos) | Riesgo | Tests clave | Suite de cierre |
|---|---|---|---|---|
| L01 | Esqueleto: proyecto, entorno, logging (adaptador del Log Gateway según el contrato de ingesta que entrega el propietario al empezar el lote; hasta entonces, solo stdout), hooks (requestId, separación por host, CSRF propio del host web, preferencias, CSP), `/health`, OpenAPI vacío, punto de composición, CI, smoke; base visual (16.12: tokens, tema y efectos, marco) | Medio | Arquitectura, entorno inválido, HTTP de hooks (incluido CSRF), smoke E2E, a11y en ambos temas | N0 + N3 HTTP + smoke + a11y |
| L02 | Esquema, migraciones, seed (app `secretario`, settings, paquetes), servicio de configuración (BE-FR-61, 62) | Alto | Migraciones sobre BD vacía, herencia global → app → operación, validación y auditoría de settings | N1 + N3 |
| L03 | Registro, verificación, login web, sesiones, recuperación, bloqueo, edad (BE-FR-01–06, 64, 67, 69, 11.1–11.5). De BE-FR-02 CA1 se prueba la verificación; la concesión de la bolsa de bienvenida llega en L05 | Alto | Antienumeración, normalización de email, bloqueo, sesión deslizante, E2E de registro | N1 + N3 + E2E crítico |
| L04 | Login de apps con Bearer, sesión por app, CORS, versión, mantenimiento, `/app/status`, anuncios, soporte (BE-FR-03, 47, 48, 62, 65, 84, 85) | Alto | Matriz de cabeceras, app y sesión; 426, 503, 400, 401 | N3 HTTP |
| L05 | Bolsas, ledger, reservas, deuda, caducidad, ajustes (BE-FR-12–18, 71); concesión de la bolsa de bienvenida al verificar (BE-FR-02 CA1) y su test | **Crítico** | TDD, property-based, concurrencia, reconstrucción del ledger, ajuste negativo limitado al saldo disponible | N1 + PBT + N3 |
| L06 | Tarificación, coste máximo, tipo de cambio, redondeo (BE-FR-19–22, 72, 87) | **Crítico** | Ejemplos de BE-FR-22 como fixtures exactos, PBT, BCE simulado | N1 + PBT + N3 + piloto de mutation (tras cerrar L05 y L06, 15.20) |
| L07 | Pasarela de chat, catálogo, plantillas, salida estructurada, idempotencia, cancelación, registro sin contenido (BE-FR-30–34, 37, 38, 77–81) | **Crítico** | Flujo de la sección 8 con proveedor simulado, estados de idempotencia, marcador de privacidad | N3 + N3 HTTP |
| L08 | Transcripción con *fallback* y ffprobe, imagen (BE-FR-35, 36, 44) | Alto | Escenarios Voxtral/backup, reintentos con reloj falso, duración medida, temporales borrados | N3 |
| L09 | Protecciones: tope diario, freno global y límites (BE-FR-11.6, 43, 45, 46); las altas por IP (BE-FR-11.4) van en L03 con el antiabuso | Alto | Límites por usuario y globales, IP real del proxy | N3 + N3 HTTP |
| L10 | Paquetes, compra simulada, testers, contracargos, reembolsos, datos fiscales, interfaces de facturación (BE-FR-23–28, 74–76) | **Crítico** | Idempotencia de la acreditación, liquidación de deuda, `simulated` excluido, CSV contable | N1 + N3 + E2E de compra |
| L11 | Sincronización y predeterminados (BE-FR-39–42) | Alto | Validación por estrategia, 412 concurrente, siembra con `updatedAt = 0`, copia con vista previa | N1 + PBT + N3 |
| L12 | Panel de usuario y privacidad (BE-FR-07, 08, 49, 66, 70) | Medio | Presenters sin campos internos, CSV, gráficas con tabla, sin JS, **primera prueba de carga** y Web Vitals de laboratorio | N2 + N3 + E2E + carga |
| L13 | Panel de administración (BE-FR-18, 27, 50–57) | Alto | Guards de admin, auditoría inmutable, ajustes con motivo | N3 + E2E de admin |
| L14 | Emails y tareas programadas (BE-FR-16, 54, 56, 58, 68, 73, 80, 83, 86) | Medio | Reloj falso (cambios de día en Madrid), umbrales sin repetición (`alerts_state`) | N3 |
| L15 | Landings, legales, precios (BE-FR-59, 60, 73) | Bajo | axe, responsive, visual | Smoke E2E + a11y |
| L16 | Endurecimiento previo a la beta: auditoría manual de accesibilidad, matriz de navegadores, línea base visual y de mutation, repetición de la prueba de carga y de las Web Vitals, simulacro de restauración | Alto | 15.18 y 15.20 | Nivel 4 completo |

### 15.7 Unit testing (N1)

**Qué cubre:** funciones puras del dominio y utilidades compartidas. Se ejecuta en Node, sin BD ni servidor.

Casos obligatorios (con datos conocidos, sin fecha real ni aleatoriedad):

- **Fórmula de cobro** (BE-FR-19): los cuatro ejemplos de BE-FR-22 como fixtures **exactos** en µc; `ceil` solo al final; comisión por proveedor; `credits_per_eur_usage` distinto de `credits_per_eur_purchase`; aritmética `BigInt` sin pérdida.
- **Redondeo de presentación** (BE-FR-22): límites 10 y 0,1 (≥ 10 sin decimales, 0,1–10 con un decimal, > 0 y < 0,1 → «< 0,1»), 0, negativos (deuda) y formato es-ES.
- **Orden de consumo** de bolsas (BE-FR-14), generación y liquidación de deuda (BE-FR-17), condición de reserva `reserva ≤ disponible + (max_debt − deuda)` (BE-FR-71).
- **Estimación del coste máximo** (BE-FR-72): chat (caracteres por token, imágenes, el precio más caro entre principal y respaldos), transcripción e imagen; tope `max_cost_credits`.
- **Normalización de email** (BE-FR-11.5), incluido el CA1 (`juan+2@gmail.com` frente a `j.uan@gmail.com`) y `googlemail.com`.
- **Tipo de cambio** (BE-FR-87): `(1 / BCE) × (1 + colchón)` en ppm.
- **Validación del documento de sincronización** por estrategia (`items`, `block`, `keyed`) y de las variables de plantilla (BE-FR-39, 78).
- **Máquina de estados de idempotencia** (BE-FR-81): en curso → 409; entregada → 409 duplicado; `undelivered` → repetir sin cobro; fallida o cancelada → repetir.
- **Comparación de versiones** semver (BE-FR-48) y rangos de versión de los anuncios (BE-FR-85).
- **Fechas** (`EpochMs`, `CivilDate`): cortes diarios en Europe/Madrid, **incluidos los cambios de hora** (último domingo de marzo y de octubre), caducidades de 30 días, 24 h y 1 h, y plazos de retención.
- **Helper de formularios** (campos repetidos, cadena vacía, casillas, importes decimales en español: `"1.000"`, `"1,5"`, `""`), validación de `redirectTo` (solo rutas internas) y esquema del entorno (coherencia entre variables).
- **Presenters**: el modelo de vista no contiene campos internos (modelo, coste real, hashes, tokens).

### 15.8 Property-based testing

Solo donde hay invariantes generales. Semillas fijas en CI; la semilla y el caso mínimo de cada fallo se guardan en un test de regresión.

| Propiedad | Módulo | Lote |
|---|---|---|
| Para cualquier secuencia de operaciones (bienvenida, reserva, cobro, liberación, caducidad, compra, reembolso, ajuste), el saldo materializado coincide con la reconstrucción desde el ledger; `remaining_µc ≥ 0`; la deuda ≤ `max_debt` salvo contracargo | Dominio de créditos | L05 |
| La exposición (reservas activas) nunca supera `saldo + max_debt − deuda` | Reservas | L05 |
| El cobro es monótono respecto al coste, entero seguro y ≥ que el valor exacto (por el `ceil`) | Tarificación | L06 |
| `normalize(normalize(x)) = normalize(x)` | Email | L03 |
| La conversión `EpochMs` ↔ `CivilDate` es coherente en cualquier instante, incluidos los cambios de hora | Fechas | L02 |
| El validador acepta todo documento válido generado para un esquema y rechaza las categorías no declaradas | Sincronización | L11 |

No se usa en componentes ni en código visual.

### 15.9 Component testing (N2)

Entorno: Vitest + jsdom + Testing Library. Se simulan `$app/forms` (`vi.mock('$app/forms', () => ({ enhance: () => undefined }))`) y `$app/state` cuando el componente los usa.

Se prueban **solo** los componentes reutilizables, con estados o críticos para la accesibilidad:

- Primitivas `ui/`: diálogo (atrapa y devuelve el foco, Escape, título accesible), campo de formulario (label, error asociado con `aria-describedby`, indicador de obligatorio), botón (estado `aria-busy` y deshabilitado), tabla (caption, cabeceras con `scope`) y aviso (`aria-live`).
- Tarjeta de saldo: total, reservado, deuda, próxima caducidad y formato de BE-FR-22.
- Resumen de errores de formulario: recibe el foco y enlaza cada error con su campo.
- Gráficas: renderizan su **tabla equivalente** con los mismos datos.
- Selector de tema y cierre de anuncios.

Los nombres accesibles pueden incluir el indicador de obligatorio («Email *»): se busca con expresiones (`name: /Email/`). No se prueban clases de Tailwind, el orden irrelevante del DOM ni el número de actualizaciones reactivas. No se repite en la interfaz la lógica que ya cubren los unit tests.

### 15.10 Integration testing (N3)

**Base de datos:**

- Un `globalSetup` crea una BD **plantilla** con todas las migraciones y el seed base. Cada fichero de test trabaja sobre una **copia** propia en el directorio temporal del sistema (WAL, `foreign_keys=ON`). Nada se comparte entre ficheros, así que se pueden ejecutar en paralelo.
- PROHIBIDO simular la BD. Nunca se conecta a staging ni a producción.
- Los datos de prueba se crean con **builders** que llaman a los servicios (no con SQL suelto) y usan los ids sembrados (`seededAppId`, `seededAdminId`) cuando hay claves foráneas.

**Servicios:** BD real + *fakes* de adaptadores + `Clock` falso + `Logger` falso (que acumula eventos para las aserciones de 15.19).

**Concurrencia** (obligatoria; `better-sqlite3` es síncrono y la concurrencia real ocurre **entre** `await`):

- El proveedor simulado devuelve promesas diferidas para que las operaciones se intercalen entre la reserva y el cobro.
- BE-FR-71 CA1: 20 operaciones a la vez con saldo para 3 → solo se lanzan las que caben y el resto recibe `INSUFFICIENT_BALANCE`; la exposición nunca supera `saldo + max_debt`.
- BE-FR-41 CA1: dos `PUT /sync` con la misma revisión → uno 200 y otro 412.
- BE-FR-24 CA1 y BE-FR-75 CA2: un webhook o una emisión repetidos no acreditan ni facturan dos veces.
- BE-FR-81: misma `Idempotency-Key` en curso, entregada y no entregada.
- Reinicio con reservas abiertas → reservas liberadas y operaciones `interrupted` (BE-FR-71).

**Adaptadores contra servidores simulados** (`node:http` en un puerto libre; la URL base se inyecta):

- OpenRouter: `usage.cost` presente; ausente → consulta a `/generation`; ausente también → estimación con `cost_estimated = true`; la petición incluye `provider.data_collection = "deny"` y las cabeceras de BE-FR-33; `require_parameters` con salida estructurada; 5xx, *timeout*, JSON inválido o con campos extra; rechazo por moderación → `flagged`.
- Mistral: reintentos a los 2, 4 y 8 s **con temporizador falso**, *timeout* de 45 s por intento, *fallback* al backup, errores 401/402/429 de facturación (alerta).
- BCE (formato que decida el plan), Turnstile, Resend, GitHub Releases y saldo de OpenRouter: éxito, error, respuesta inválida y servicio caído.

**Form actions** (llamada directa con un evento falso **completo y tipado**, creado por una fábrica de `RequestEvent` en `tests/builders/` sin aserciones de tipo: `request` con `FormData`, `locals` con usuario y rol, `params`, `cookies` y logger):

- Lo que se **devuelve** (`fail(...)`) se comprueba con `toMatchObject({ status: 400 })`.
- Lo que se **lanza** (`redirect`, `error`) se comprueba con `rejects.toSatisfy((e) => isRedirect(e))` o `isHttpError(e) && e.status === 403`.
- El resultado se estrecha con una función propia (`unwrapActionFailure`), sin `as`. Se usan literales completos con `toMatchObject`, no `expect.any` ni `objectContaining`, que rompen el lint tipado.
- `toMatchObject` exige arrays de la misma longitud: si no se controlan todas las filas, se localiza la que importa con `find`.

**HTTP contra el build** (suite `http`, un solo *worker*): un `globalSetup` ejecuta `vite build` una vez, arranca `node build` en un puerto libre con `APP_ENV=test` y apunta los adaptadores a los servidores simulados. Cubre:

- Separación por host (combinaciones cruzadas → 404; `/api/v1/health` con cualquier `Host`).
- `X-App-Id` ausente o desconocido (400), app desactivada (503), sesión de otra app (401), Bearer en la web y cookie en la API rechazados.
- CORS por app (*preflight* con el origen de cualquier app activa; petición real con un origen ajeno a la app de `X-App-Id` → 403 `ORIGIN_NOT_ALLOWED`), versión mínima (426, salvo logout y `/app/status`), mantenimiento (503), freno global (503).
- CSRF propio del host web (10.1): un envío de formulario sin `Origin` o con otro origen → 403; en el host de la API, una subida `multipart/form-data` sin `Origin` con Bearer se acepta (la comprobación de SvelteKit está desactivada).
- Cabeceras de seguridad (CSP, HSTS), `X-Request-Id` y `BODY_SIZE_LIMIT`.
- **Formato de error y conformidad con el OpenAPI** de todas las respuestas: un test parametrizado por tabla de casos, no un test por endpoint.
- IP del cliente desde `X-Forwarded-For` con `XFF_DEPTH=1` (un valor falsificado más a la izquierda se ignora).

### 15.11 Testing específico de SvelteKit

| Artefacto | Cómo se prueba |
|---|---|
| `load` de página y layout | No se llama directamente: su evento no se puede fabricar sin aserciones de tipo. Si compone varios servicios, la composición vive en un módulo `*.data.server.ts` (o en `presenters.ts`) que se prueba en N3 comparando las claves exactas (`toStrictEqual`). Las restricciones de query (`strictObject` en la página, `object` en el layout) se prueban con E2E que abren cada página **con** parámetros |
| Actions | N3, llamada directa (15.10) |
| `+server.ts` | N3 HTTP contra el build |
| Hooks | N3 HTTP contra el build; las funciones puras que usan (resolución de host, guards), en N1 |
| Cookies y sesiones | N3 HTTP (atributos `Secure`, `HttpOnly`, `SameSite=Lax`, solo en la web) y E2E |
| Redirecciones y errores esperados | N3 (se lanzan) y E2E (páginas `+error.svelte` accesibles con «Código de referencia») |
| Parámetros de ruta | N1 de los *param matchers* |
| Código solo de servidor | Test de arquitectura: nada fuera de `$lib/server` o `*.server.ts` importa la BD, los adaptadores ni la configuración |
| SSR | E2E con JavaScript desactivado: el contenido esencial aparece en el HTML inicial |
| Hidratación | Smoke: sin errores de hidratación en consola y la página es interactiva |
| CSR | Smoke: navegación cliente entre el panel y sus subpáginas sin recarga completa |
| Código solo de navegador | Uso de `window` o `document` protegido con `browser` u `onMount` (lint + SSR sin errores) |
| Prerender | Test de arquitectura: ninguna ruta exporta `prerender = true` |

Los grupos y parámetros de ruta (`(web)`, `[slug]`) cuentan como niveles en las importaciones relativas de los tests: se prefieren alias (`$lib`, `$tests`).

### 15.12 Formularios y actions

Para cada formulario crítico (registro, login, recuperación, cambio de contraseña y de email, datos fiscales, compra, aceptación legal, borrado, ajustes y configuración del administrador):

| Caso | Nivel más barato |
|---|---|
| Datos válidos → servicio llamado y `303` o `success` | N3 action |
| Obligatorios, inválidos y límites (contraseña de 8–128, NIF, importes) | N1 esquema + N3 action (un caso representativo) |
| Valores reenviados sin contraseñas ni campos sensibles | N3 action |
| Rechazo de negocio → `fail(4xx, { formError })` | N3 action |
| Sin sesión, sin verificar, bloqueado o rol incorrecto | N3 action (cada action protegida) |
| Fallo de persistencia → error genérico sin detalles | N3 action con un repositorio que falla |
| Estado pendiente (`aria-busy`), foco en el primer error y anuncio | N2 componente + E2E en un formulario representativo |
| Funciona sin JavaScript | E2E con `javaScriptEnabled: false` |
| Doble envío | E2E en la compra (ver 15.27, pregunta 1) y en los ajustes de saldo |

### 15.13 APIs y endpoints

Para cada grupo de `/api/v1` (auth, me, ai, sync, defaults, app/status) se cubre con tablas de casos parametrizadas:

- Método (no admitido → 405 `METHOD_NOT_ALLOWED`; ruta inexistente → 404 `NOT_FOUND`; error inesperado → 500 `INTERNAL_ERROR` sin detalles internos).
- Body válido e inválido (`strictObject`: una clave desconocida da 400).
- Subida `multipart/form-data` sin `Origin` (como la envían las apps de escritorio): aceptada.
- Autenticación y autorización.
- Código HTTP y formato de error de 7.2.
- Serialización (enteros `…Micro`, fechas ISO UTC).
- Cabeceras (`Retry-After`, `X-Request-Id`).
- Límites (413).
- Dependencias caídas (502/504).

Los servicios externos están siempre simulados.

### 15.14 Persistencia

- Todas las migraciones se aplican sobre una BD vacía y el esquema resultante coincide con Drizzle (`drizzle-kit check` en CI).
- A partir de la primera release: test de migración desde una copia sintética del esquema anterior.
- Las restricciones `UNIQUE`, `FOREIGN KEY` y `CHECK` se prueban en integración.
- **Inmutabilidad** de `credit_movements`, `admin_audit`, `invoices` y `prompt_templates`: test de arquitectura (sin `UPDATE`/`DELETE` en el código) y, si el plan lo decide, *triggers* de SQLite que lo impidan (15.27, pregunta 3).
- Anonimización (BE-FR-07, 83): el borrado elimina los datos personales de `user`, del perfil, de los datos fiscales y de los sincronizados; pone a cero las bolsas con `forfeit`; no modifica las tablas inmutables (solo guardan el `user_id` opaco y sus *triggers* siguen activos); conserva íntegras las facturas; libera el email y conserva el hash de `welcome_grants`.

### 15.15 Autenticación, autorización, cookies y sesiones

Matriz mínima (N3, una tabla parametrizada por recurso protegido): **anónimo, sin verificar, usuario, tester, admin y bloqueado**, contra panel, administración, actions, endpoints y API.

Además:

- Sesión deslizante: renovación solo si han pasado más de 24 h y caducidad a los 30 días sin uso (reloj falso).
- Revocación inmediata, logout, cambio de contraseña (revoca las demás sesiones), cambio de email (revoca las demás) y bloqueo (revoca todas).
- Bloqueo por intentos fallidos (10 fallos en 15 min, exista o no el email) y desbloqueo tras un login correcto o una recuperación.
- Antienumeración: la misma respuesta para un email existente o inexistente en registro, login, reenvío, recuperación y cambio de email.
- Datos manipulados: cookie alterada, token de otra app, `X-App-Id` cambiado con la misma sesión.
- CSRF (10.1, N3 HTTP): en el host web, `handle` rechaza con 403 un envío de formulario sin `Origin` o de otro origen; en la API no hay cookies, así que una cookie de sesión enviada a la API no autentica.
- Captcha y límites de autenticación en `accounts`: captcha inválido o servicio caído (adaptador `CaptchaVerifier` falso) y contadores por IP de `auth_rate_limits` (429 con `Retry-After`; `resend-verification` responde 202 salvo al superar el límite).
- `ADMIN_EMAIL`: promoción al verificar y nunca dos administradores.

Nunca se usan contraseñas, tokens ni proveedores reales.

### 15.16 Tests funcionales derivados de historias de usuario

**Trazabilidad:** cada test que demuestra un criterio lleva su identificador en el nombre (`[BE-FR-71/CA1]`) o, en Playwright, como etiqueta (`@BE-FR-71`). Un script `test:trace` cruza los `CA` de `Historias.md` y los criterios de UX de la sección 16 (`UX-TEMA/CAn`, `UX-EFECTOS/CAn`, `UX-01`…`UX-18`, etiqueta `@UX-05`) con los nombres de los tests y lista los criterios sin test. Se agrupan los comportamientos relacionados; no se crea un test por frase. Se puede usar el formato Given/When/Then en el nombre o en un comentario, sin Cucumber.

| Requisito / CA | Comportamiento | Nivel | Lote | E2E | Prioridad |
|---|---|---|---|---|---|
| BE-FR-01 CA1–CA5 | Registro: contraseña de 8–128, aceptaciones versionadas, captcha obligatorio, cuenta sin verificar, respuesta antienumeración | N1 + N3 + E2E (camino feliz) | L03 | Sí | Alta |
| BE-FR-02 CA1–CA3 | La verificación crea la bolsa de bienvenida; login sin verificar → `EMAIL_NOT_VERIFIED`; reenvío con límite | N3 + E2E (enlace del email) | L03 (verificación, CA2, CA3) / L05 (concesión de la bolsa de CA1) | Sí | Alta |
| BE-FR-03, 04, 06 | Login web y de app, sesión deslizante, revocación, logout | N3 + N3 HTTP + E2E (login web) | L03 / L04 | Sí | Alta |
| BE-FR-05, 66, 67 | Recuperación (1 h, un solo uso), cambio de contraseña y de email, bloqueo por intentos | N3 + E2E (recuperación) | L03 (BE-FR-05, 67) / L12 (BE-FR-66, necesita el perfil) | Sí | Alta |
| BE-FR-07, 08 | Borrado con anonimización (sin tocar las tablas inmutables), bolsas a cero con `forfeit` y exportación RGPD | N3 + E2E (borrado) | L12 | Sí | Alta |
| BE-FR-09 | El modelo `account` permite añadir OAuth sin migrar datos | Revisión del esquema en el plan | L02 | No | Baja |
| BE-FR-11 CA1–CA2 | La normalización impide un segundo saldo; las compras simuladas no cuentan para el tope | N1 + N3 | L03 / L09 | No | Alta |
| BE-FR-12–16 | Bolsa de bienvenida, tipos, orden de consumo, ledger reconstruible, caducidad y aviso | N1 + PBT + N3 | L05 / L14 | No | Crítica |
| BE-FR-17, 71 CA1–CA2 | Saldo mínimo, deuda y su tope, liquidación con la siguiente compra, reservas concurrentes, saldo total, reservado y disponible | N1 + N3 de concurrencia | L05 | No | Crítica |
| BE-FR-18, 27, 28 | Ajustes con motivo (el negativo, limitado al saldo disponible), reembolso manual, contracargo con deuda sin tope y bloqueo | N3 + E2E (ajuste de admin) | L05 / L10 / L13 | Sí (ajuste) | Crítica |
| BE-FR-19–22 | Fórmula, origen del coste, qué no se cobra, ejemplos numéricos | N1 + PBT + N3 | L06 / L07 | No | Crítica |
| BE-FR-72 CA1–CA3 | 413 `OPERATION_TOO_EXPENSIVE` sin llamar al proveedor, `truncated`, una operación sin precio no se puede activar | N1 + N3 | L06 / L13 | No | Alta |
| BE-FR-73 CA1–CA2 | Mediana con muestras mínimas o valor manual; página `/precios` | N1 + N3 + smoke E2E | L14 / L15 | Smoke | Media |
| BE-FR-87 CA1–CA3 | Tipo diario del BCE, último valor si falla la consulta, alerta, valor manual auditado | N1 + N3 (BCE simulado) | L06 | No | Alta |
| BE-FR-23–26 | Paquetes calculados al comprar, idempotencia del webhook, compra simulada solo para testers en producción, aceptación previa al pago | N3 + E2E (compra) | L10 | Sí | Crítica |
| BE-FR-74–76 | Datos fiscales (NIF), copia en la factura, interfaz de facturación, CSV contable | N1 + N3 | L10 | No | Media (la v4 no tiene cobros reales) |
| BE-FR-30–34, 77–79 | Operaciones válidas por app, modelo elegido por el servidor, plantillas versionadas, salida estructurada y herramientas | N3 + N3 HTTP | L07 | No | Crítica |
| BE-FR-81, 37 | Idempotencia (estado `in_progress` e índice único parcial) y cancelación, con cobro según el estado y pérdida por cancelación registrada | N3 de concurrencia + N3 HTTP (cierre de conexión) | L07 | No | Crítica |
| BE-FR-38 CA1–CA2 | Sin contenido en BD, logs ni temporales; temporales borrados también en error y cancelación | N3 (marcador en stdout y BD, sistema de ficheros) | L07 / L08 | No | Crítica |
| BE-FR-35, 36, 44 | Escenarios de transcripción, conversión con ffmpeg del audio del respaldo (temporales borrados), error saneado, `providerUsed`, transcripciones simultáneas, duración medida con ffprobe, 413 | N3 (ffprobe real con audios de fixture) | L08 | No | Alta |
| BE-FR-80 CA1 | Respaldos en orden dentro del *timeout* total; el cliente no ve el modelo | N3 | L07 | No | Alta |
| BE-FR-39–42 | Esquema por app, siembra, 412, tamaño, predeterminados con vista previa y auditoría | N1 + PBT + N3 + E2E (copia de predeterminados) | L11 / L13 | Sí (admin) | Alta |
| BE-FR-43, 45, 46 | 429 con `Retry-After`, límites de autenticación, freno global solo para cuentas sin compras | N3 + N3 HTTP | L09 | No | Alta |
| BE-FR-47, 48 | Mantenimiento global y por app; 426; `/app/status` con los tiempos por operación | N3 HTTP + E2E (activar el mantenimiento) | L04 / L13 | Sí (admin) | Alta |
| BE-FR-62–65 | Apps sin redesplegar, saldo compartido, origen del registro con `?app=`, clientes web y móviles, CORS (*preflight* y `ORIGIN_NOT_ALLOWED`) | N3 + N3 HTTP + E2E (registro con `?app=`) | L02 / L04 | Sí | Alta |
| BE-FR-49 | Panel: saldo, compra, movimientos, consumo filtrado, gráficas, CSV, aviso de saldo bajo, sesiones, perfil, facturas, apps, avisos, soporte | N2 + N3 + E2E | L12 | Sí | Media |
| BE-FR-50–57, 61 | Admin: usuarios, economía, apps y modelos, protecciones, estadísticas, auditoría, alerta de OpenRouter (desactivada sin `OPENROUTER_MANAGEMENT_KEY`), pérdida por cancelación y `forfeit` en estadísticas, predeterminados, parámetros editables | N3 + E2E (recorrido de admin) | L13 | Sí | Alta |
| BE-FR-58 | Emails con plantilla, marca y soporte; un email por cruce de umbral | N3 (*outbox* en fichero) | L14 | No | Media |
| BE-FR-59, 60 | Landings, legales versionados, solo cookies técnicas, sin terceros | Smoke E2E + a11y + N3 HTTP (cookies emitidas) | L15 | Smoke | Media |
| BE-FR-68, 70, 83, 86 | Limpieza de cuentas sin verificar, nuevas versiones legales (403 hasta aceptar), retención, inactividad sin borrar cuentas con compras | N3 (reloj falso) + E2E (aceptación) | L12 / L14 | Sí (aceptación) | Alta |
| BE-FR-82, 84, 85 | Moderación marcada sin contenido, email de soporte, anuncios por app y versión | N3 | L07 / L04 | No | Media |

Para cada fila se contemplan, cuando apliquen: camino correcto, validación, vacío, error recuperable y no recuperable, reintento, cancelación, sin sesión, sin permiso, límites, datos incorrectos, viewport y diferencias entre servidor y navegador.

### 15.17 Playwright (N5)

**Entorno:** siempre contra el **build de producción** (`vite build` + `node build`) en `APP_ENV=test`, también en local para los críticos; el servidor de desarrollo solo se usa para depurar. En modo test:

- Los adaptadores apuntan a servidores simulados locales (IA, BCE, GitHub).
- El captcha usa un adaptador falso y el widget de Turnstile **no** se carga, así que no hay red externa.
- Los emails se escriben en un *outbox* en fichero que leen los tests (enlaces de verificación y de recuperación).
- Pagos `simulated` y facturación `none`.
- El esquema del entorno **rechaza todo esto fuera de `APP_ENV=test`** (enmienda de la constitución).

**Datos y aislamiento:** una BD de test por ejecución. Cada test crea sus propios datos con *fixtures* que usan los servicios (emails únicos `e2e-<worker>-<uuid>@example.test`). Ningún test depende de otro: todos se pueden ejecutar solos, en cualquier orden y en paralelo.

**Autenticación:** un proyecto `setup` inicia sesión por la interfaz una vez por rol (`anonymous`, `user`, `tester`, `admin`, `blocked`) y guarda el `storageState`. Los E2E de login, registro y recuperación prueban el proceso; los demás reutilizan el estado guardado.

**Smoke** (`@smoke`, Chromium, en cada PR):

- La app arranca y `/` responde con el contenido principal visible (no en blanco).
- El layout aparece y los estilos están cargados (`getComputedStyle` del fondo y de una variable del tema).
- Funciona la navegación cliente básica.
- Sin excepciones de página, `console.error` ni errores de hidratación (lista de excepciones vacía, y documentada si alguna vez hace falta).
- El login y el panel son accesibles con la sesión de `user`.

**E2E críticos** (`@critical`):

1. Registro (con `?app=secretario`) → email → verificación → panel con el saldo de bienvenida y los siguientes pasos de la app.
2. Login, logout y cierre de otra sesión desde el panel.
3. Recuperación de contraseña.
4. Compra simulada como tester (aceptación del desistimiento, factura completa opcional): el saldo se actualiza y un doble clic no acredita dos veces.
5. Consumo: una operación de la API (con el `request` de Playwright y un Bearer) aparece en el panel con su nombre amigable y sin el modelo.
6. Cambio de email y borrado de la cuenta.
7. Nueva versión legal que exige aceptación: aviso en el panel y aceptación.
8. Admin: ajuste de saldo con motivo y su entrada en la auditoría; activar el mantenimiento de la app → la API responde 503.
9. Admin: copia de predeterminados con vista previa y exclusión de elementos.
10. **Sin JavaScript**: login, compra, datos fiscales, aceptación legal, una action de administración, el selector de tema y de efectos, y un filtro con paginación (formulario GET). El registro comprueba solo el aviso de `<noscript>` (excepción del captcha).

**Errores del navegador:** en todos los E2E se escuchan `pageerror`, `console.error`, `requestfailed` y las respuestas 5xx, distinguiendo errores funcionales, de infraestructura y del simulador. No hay recursos externos opcionales: cualquier petición a un dominio externo es un fallo.

**Selectores:** `getByRole` → `getByLabel` → `getByText` estable → `getByTestId` solo si no hay alternativa, con nombres de dominio (`balance-card`, `primary-action`, `theme-toggle`, `error-summary`). Prohibidos el CSS profundo, las clases de Tailwind, los `nth()` innecesarios y los ids generados.

**Esperas:** solo localizadores, `expect` *web-first*, URL y respuestas observables. PROHIBIDOS `waitForTimeout`, `sleep` y los bucles de espera. No se suben *timeouts* para tapar condiciones de carrera.

**Simulaciones:** cada spec declara si usa el backend real de test con la BD de test (lo normal) o intercepta peticiones (solo para estados del navegador difíciles de provocar, p. ej. el fallo de `/client-errors`). No se mezclan ambas estrategias en un mismo flujo.

**Artefactos:** captura y *trace* solo en los fallos (`retain-on-failure`); vídeo solo en la ejecución nocturna. En CI se suben como artefacto.

### 15.18 Validaciones transversales (N6)

**Accesibilidad:**

- Una spec `a11y` recorre **todas** las páginas (lista de rutas generada desde `src/routes`) con axe en tema claro y oscuro: cero violaciones `serious` o `critical`.
- Tests de teclado para los componentes personalizados (diálogo, menús, pestañas): Tab, Mayús+Tab, Escape, foco visible y foco devuelto.
- Reflujo a 320 px y zoom al 200 % en las páginas clave.
- **Auditoría manual** antes del lanzamiento público (NVDA en Windows y VoiceOver en iOS), con una lista de comprobación de WCAG 2.2 AA. Lo automático no sustituye a la auditoría.

**Responsive:** móvil 390×844 y escritorio 1366×768 en los E2E críticos del panel y de la compra. Los menús, diálogos y tablas (con desplazamiento o reorganización) deben poder usarse en móvil.

**Cross-browser:**

| Momento | Navegadores |
|---|---|
| Desarrollo y lote | Chromium, tests afectados |
| PR | Chromium. Además Firefox y WebKit si la PR toca formularios, foco, descargas, subida de ficheros o CSS global |
| `main` | Chromium completo |
| Nocturna y release | Chromium, Firefox y WebKit (incluido WebKit móvil) |

**Regresión visual** (nocturna, Chromium): landing, login, saldo del panel, compra y una pantalla de administración, en móvil y escritorio y en tema claro y oscuro (unas 8–10 capturas). Se controlan los datos (sembrados y fijos), el reloj (`page.clock`), el locale (`es-ES`), las fuentes (propias), las animaciones (desactivadas) y `reducedMotion`. Solo se enmascaran regiones legítimamente dinámicas. **Las capturas se generan solo en el contenedor oficial de Playwright** de la misma versión que el paquete, nunca en Windows, porque el renderizado de fuentes es distinto. Solo se actualizan si el cambio es intencionado, se ha revisado y va en el mismo PR.

**Rendimiento** (obligatorio por primera vez en **L12** y repetido en L16 y en cada release): `perf:seed` (siembra con los servicios y semilla fija) y `perf:load` (script propio con `fetch`), en cuanto existan el panel y `/ai/chat` con un proveedor simulado con latencia.

- El script es repetible: credenciales sembradas, login real y las peticiones de la web con `Accept: text/html` (para recibir el `303` de las actions). Se ejecuta con Node y un resolutor de `$lib` (`node --import`), contra el build.
- **Web Vitals de laboratorio** (16.8): LCP, INP y CLS con perfil móvil limitado en las páginas de 16.8, comparando la versión con cristal y la de efectos reducidos.

- Se mide una sola sesión (tiempo de servicio) y 20 sesiones con pausas de unos 5 s con *jitter* y arranque escalonado.
- Se comprueba que las reservas siguen siendo correctas bajo carga y se mide el volumen de logs por petición.
- Siempre contra el build. Se publican los dos números junto con el objetivo.

**Seguridad verificable:** ya está incluida en N3 HTTP (host, CORS, CSRF propio del host web y subida `multipart/form-data` sin `Origin` en la API, cabeceras, redirecciones abiertas, límites, IP real) y en el marcador de privacidad de los logs.

### 15.19 Logging en los tests

- Cada rechazo de negocio relevante (saldo, tope diario, límite, conflicto de sincronización, login bloqueado) tiene un test con el **registrador falso**: comprueba `event` y `reason`, y que `JSON.stringify(eventos)` no contiene el email, el importe ni la fecha de la operación.
- Un dato corrupto que se rechaza al leerlo registra su propio evento, sin copiar el contenido.
- `console.log` puede no aparecer en el informe de Vitest: para inspeccionar un valor, se fuerza un `expect` que falle con el dato dentro de la comparación.

**Reglas de logging y validación → mecanismo → evidencia:**

| Regla | Mecanismo | Evidencia |
|---|---|---|
| Cada evento solo lleva sus campos permitidos | Firma tipada por evento | `check` + test del catálogo |
| Los códigos de evento son únicos y llevan el prefijo de su funcionalidad | Test de arquitectura | `tests/architecture/` |
| El `message` de los errores de bibliotecas no llega al log | Serializador propio | Test unitario del serializador |
| Datos sensibles redactados | `redact` de pino | Test con el registrador real sobre stdout |
| `/client-errors`: máximo 4 KB y `204` sin log al superar el límite | Esquema estricto + límite | Test HTTP |
| El error de entorno no incluye valores | `env-schema.ts` | Test unitario con valores secretos de prueba |
| Proveedor caído → `PROVIDER_ERROR` + evento con `operationId` | Adaptador + servicio | Test de integración con el servidor simulado |
| Discrepancia del ledger → evento `error` y email | Tarea de verificación | Test de integración con datos corruptos |
| Ningún log contiene contenido del usuario | Marcador de privacidad | E2E y tests HTTP (15.16) |

### 15.20 Mutation testing

- **Piloto** tras cerrar L05 y L06, sobre `src/lib/server/features/*/domain/**` y los módulos de dinero y fecha de `src/lib/shared/**` (tarificación, bolsas, reservas, deuda, estimación, normalización, idempotencia, fechas). Se excluyen la interfaz, el CSS, la configuración, los adaptadores simples, el logging y el código generado.
- Se registran los mutantes, *killed*, *survived*, sin cobertura, *timeouts*, errores y tiempo total. Cada superviviente se clasifica (aserción insuficiente, caso límite ausente, mutación equivalente, código muerto o comportamiento no observable) y se corrige o se documenta.
- **Sin umbral fijo de partida**: se crea una línea base y el umbral que bloquea la release se fija después (nunca un 100 % automático).
- Ejecución semanal programada y en las PR que modifiquen el dominio (modo incremental). Nunca en el bucle de desarrollo ni sobre suites inestables.

### 15.21 Cobertura

Se aplican los umbrales de la constitución (100 % de líneas, ramas, funciones y sentencias en `features/*/domain/**` y en los dos `shared/`, y 80 % en `src/lib/**`), medidos con `@vitest/coverage-v8` sobre las suites de Vitest. Las rutas, los *hooks* y los `+server.ts` quedan fuera de ese denominador porque se ejecutan en el proceso del build; los cubren los tests HTTP, los E2E y `test:trace`. Atención especial a las ramas de validación, errores, permisos, límites y reglas. No se escriben tests sin valor para subirla, y una cobertura alta no sustituye a los tests de aceptación, los E2E ni el mutation testing. El informe se publica en cada PR para ver los cambios.

### 15.22 Determinismo

- **Tiempo:** solo a través del adaptador `Clock` (fijo en los tests), con temporizadores falsos para reintentos y esperas; en Playwright, `page.clock`.
- **Aleatoriedad e ids:** generador inyectable con semilla y UUID conocidos en los fixtures.
- **Zona horaria:** el ejecutor corre con `TZ=UTC`; los tests de Europe/Madrid fijan la zona en el propio cálculo, nunca en la del sistema.
- **Locale:** `es-ES` explícito en todo formateo.
- **Entorno de los tests:** los tests unitarios y de integración no leen el entorno (reciben la configuración por parámetro). Solo los tests HTTP y Playwright arrancan el build con un conjunto mínimo documentado (`APP_ENV=test`, `DATABASE_PATH` temporal, dos hosts distintos para la API y la web, y secretos aleatorios generados al arrancar la suite), pasado por `webServer.env` o por el proceso que lanza el `globalSetup`, sin sintaxis de shell (Windows). No se crea un `.env` para los tests, y `APP_ENV=test` no exige las variables de producción.

### 15.23 Servicios externos

| Servicio | Sustituto en unit e integración | Sustituto en E2E | Escenarios obligatorios |
|---|---|---|---|
| OpenRouter (chat, imagen, audio, modelos, saldo, generación) | *Fake* del puerto `AiGateway` + servidor simulado para el adaptador | Servidor simulado | Éxito, coste ausente, 5xx, *timeout*, JSON inválido, moderación, respaldo, saldo bajo, sin `OPENROUTER_MANAGEMENT_KEY` (alerta desactivada), coste conocido de una operación cancelada |
| Mistral (Voxtral) | Servidor simulado | Servidor simulado | Éxito, reintentos a 2/4/8 s, *timeout*, 401/402/429 de facturación, *fallback* |
| Resend | *Fake* de `EmailSender` (en memoria) | *Outbox* en fichero (`.outbox/`, ignorado por Git) | Éxito, error (log `warn`, sin reintento infinito) |
| Turnstile | *Fake* del adaptador `CaptchaVerifier` de `accounts` + servidor simulado para el adaptador real | *Fake* de `CaptchaVerifier` (sin widget) | Válido, inválido, servicio caído |
| BCE | Servidor simulado | Valor fijo | Éxito, error, días sin actualizar (alerta) |
| GitHub Releases | Servidor simulado | — | Éxito, error |
| Pagos | `simulated` | `simulated` | Completado, webhook repetido, reembolso, contracargo |
| Facturación | `none` + *fake* para la interfaz | — | Emisión idempotente (con el *fake*) |
| Log Gateway | Servidor simulado | Desactivado (solo stdout) | Lotes, error, caída sin bloqueo |
| ffprobe y ffmpeg | Reales (binarios de la imagen) con audios de fixture pequeños | — | Duración, audio ilegible, exceso de duración; conversión del audio del respaldo y temporales borrados |

### 15.24 Ejecución escalonada y selección de tests afectados

| Nivel | Cuándo | Qué se ejecuta | Coste orientativo |
|---|---|---|---|
| 0 Edición | Cambios pequeños | `check` del área, `lint:changed`, test individual | Segundos |
| 1 Ultrarrápida | Durante el lote | `vitest related <ficheros>` o el fichero de test | Segundos |
| 2 Lote (checkpoint) | Cierre de lote | Unit, componente e integración del área (`vitest --changed`), aceptación del lote, `lint:changed`, `check` | Segundos a pocos minutos |
| 3 Historia / PR | Antes de integrar | Puertas del CI (constitución) + smoke + E2E `@critical` afectados en Chromium + navegadores según el riesgo | Minutos |
| 4 Completa | Nocturna y release | Todo: E2E en los tres navegadores, visual, a11y completa, cobertura, build de la imagen, mutation (semanal), carga (release) | Mayor |

**Se amplía la selección** cuando cambia `$lib/shared` o `$lib/server/shared`, el `index.ts` de una funcionalidad (se ejecutan los tests de sus consumidores), un componente `ui/` o `layout/` muy usado, un layout, los hooks, la autenticación o las sesiones, el esquema o las migraciones, la serialización o el OpenAPI, el tema o el CSS global, `svelte.config.*`, `vite.config.*`, el adaptador o una dependencia principal. En esos casos se ejecuta el nivel 3 completo.

El **test de arquitectura** se ejecuta siempre en el nivel 2: `vitest related` no lo selecciona porque no importa el código que comprueba.

Los tiempos no se fijan de antemano: se miden (T-TEST-001) y se registran antes y después de cada optimización.

### 15.25 Estructura y comandos

```text
src/lib/**/X.test.ts            unit y componente (junto al código)
src/lib/server/features/<f>/*.int.test.ts
                                integración de la funcionalidad (servicios, repositorios)
src/lib/server/adapters/<p>/    fake.ts e integración del adaptador
src/routes/**/*.int.test.ts     actions y composición de modelos de vista
tests/
  http/                         hooks y API contra el build
  architecture/                 fronteras y reglas estáticas
  fixtures/  builders/  mock-servers/
e2e/
  setup/                        storageState por rol
  smoke.spec.ts
  <funcionalidad>.spec.ts
  a11y.spec.ts
  visual.spec.ts
  fixtures/
scripts/
  lint-changed.*  test-trace.*  perf-seed.*  perf-load.*
```

Vitest se organiza en **proyectos** (`test.projects`): `unit` (Node, incluye `tests/architecture`), `component` (jsdom), `integration` (Node, ficheros `*.int.test.ts`, una BD por fichero) y `http` (Node, build compartido, un *worker*). Playwright, en los proyectos `setup`, `chromium`, `firefox`, `webkit`, `mobile-webkit` y `visual`.

Scripts propuestos (pnpm; se crean en L01 y se documentan en `CLAUDE.md`):

| Script | Propósito |
|---|---|
| `test` | Vitest: unit + componente + integración (sin `http`) |
| `test:unit` / `test:component` / `test:int` / `test:http` | Un proyecto de Vitest |
| `test:related` | `vitest related` sobre los ficheros indicados |
| `test:coverage` | Vitest con cobertura y umbrales |
| `test:trace` | Lista los `CA` y los criterios `UX-xx` sin test |
| `test:e2e` | Playwright, Chromium, todo |
| `test:e2e:smoke` / `test:e2e:critical` | Por etiqueta |
| `test:e2e:a11y` / `test:e2e:visual` | Accesibilidad / capturas |
| `test:e2e:cross-browser` | Los tres navegadores |
| `test:e2e:ui` / `test:e2e:headed` / `test:e2e:debug` | Depuración |
| `test:mutation` | Stryker (incremental por defecto) |
| `lint:changed` | ESLint solo sobre los ficheros cambiados respecto al último commit (más los nuevos), con `--concurrency auto` y reintento en un hilo; si cambia la configuración de ESLint o un `tsconfig`, lint completo |
| `perf:seed` / `perf:load` | Prueba de carga (L12, L16 y release) |
| `lint:tokens` | Sin colores literales fuera de los tokens (puerta 10) |

### 15.26 CI, tests inestables y optimización

**CI (GitHub Actions):**

- **PR**: puertas de la constitución (incluida la spec a11y de todas las páginas en ambos temas) + `test:e2e:smoke` + `test:e2e:critical` (Chromium) + Firefox y WebKit si la PR toca las áreas de riesgo (15.18) + Stryker incremental si toca el dominio.
- **`main`**: E2E completos en Chromium.
- **Nocturna**: matriz de tres navegadores, regresión visual, matriz completa de UX (16.11) y vídeo de los fallos.
- **Semanal**: mutation completo sobre el dominio.
- **Release**: nivel 4 contra la **imagen Docker** que se va a desplegar + prueba de carga.

Cachés de pnpm y de los navegadores de Playwright. *Sharding* solo si la suite E2E lo necesita, según lo medido.

**Tests inestables:** son un defecto. Se investiga la causa: estado compartido, carreras, esperas, datos, orden, temporizadores, red o paralelismo. Los reintentos en CI (máximo 1) sirven para capturar el *trace* y **marcar** el test como inestable, no para ocultarlo. Ningún test crítico se ignora sin una tarea abierta y justificada.

**Optimización y verificación en Windows** (equipo de desarrollo):

- Antes de recortar nada, se mide: coste fijo del lint con un solo fichero, número de ficheros del programa de TypeScript, perfil de CPU y latencia de `stat`.
- Las librerías con índices enormes (p. ej. de iconos) se importan por ruta individual.
- `Design/` (documentación y código archivado del sistema de diseño, ADR 0007) se excluye de Prettier, ESLint y `tsconfig`.
- Si el antivirus en tiempo real domina, se excluyen la carpeta del proyecto y las cachés de pnpm (script en `scripts/` con opción de deshacerlo; requiere administrador).
- Las suites no se ejecutan en paralelo entre sí, porque compiten por disco y CPU: se encadenan. `testTimeout` global de 30 s en Vitest para absorber la carga de la suite completa.
- `eslint --cache` falla con configuraciones que contienen funciones (typescript-eslint): no se usa; en su lugar, `lint:changed`. El lint completo se parte en dos pasadas (`src tests` con `--concurrency auto` y el resto en serie). Un lint completo que pasa de 10 minutos se interrumpe y se sustituye por el parcial.

### 15.27 Preguntas abiertas sobre testing

Mientras no se resuelvan se aplican suposiciones conservadoras, y cada una genera una tarea de confirmación en el plan.

1. ~~**Doble envío de la compra simulada.**~~ **Resuelta (2026-10-10):** identificador de intento de un solo uso (BE-FR-25 CA4); lo comprueba el E2E 4.
2. ~~**Formato del BCE.**~~ **Resuelta (2026-10-10):** API SDMX del BCE (`data-api.ecb.europa.eu`) en formato CSV; el simulador reproduce ese formato.
3. ~~**Inmutabilidad en la BD.**~~ **Resuelta (2026-10-10):** además del test de arquitectura, *triggers* de SQLite impiden `UPDATE` y `DELETE` en `credit_movements`, `admin_audit`, `invoices` y `prompt_templates`. La anonimización no necesita ninguna vía que los desactive: las tablas inmutables solo guardan el `user_id` opaco y los datos personales se borran de `user` y de las tablas no inmutables (BE-FR-07 CA2).
4. ~~**Versiones de navegador soportadas.**~~ **Resuelta (2026-10-10):** las dos últimas versiones estables de Chrome, Edge, Firefox y Safari (incluido iOS).
5. **Duración máxima aceptable de una PR.** *Suposición:* se mide en L01–L03 y se fija como objetivo.
6. ~~**Smoke después de cada despliegue a staging.**~~ **Resuelta (2026-10-10):** sí, `test:e2e:smoke` contra `cuenta-staging` con una cuenta de prueba dedicada (sin datos de producción), más la verificación de proxy de la constitución.
7. **Pruebas de la app Secretario** (cliente): quedan fuera de este documento; corresponden a `v4-app-spec.md`.
8. **Hosts en modo test.** *Suposición:* dos nombres de host distintos (p. ej. `localhost` para la web y `127.0.0.1` para la API) para que la separación por host también se ejerza en los E2E; lo confirma el plan de L01.

### 15.28 Integración con Spec Kit

- **`/speckit-specify`**: cada especificación cita los `BE-FR` y sus `CA`, y añade los estados, errores, límites, permisos y riesgos que falten para que sean verificables.
- **`/speckit-plan`** decide y documenta: los lotes de la funcionalidad con su **plan previo de tests** (15.5), el catálogo de eventos (principio XI), los fixtures, builders y fakes necesarios, las suites de cierre, los E2E afectados, los navegadores y viewports, si aplica property-based o mutation testing, y los riesgos de SSR e hidratación.
- **`/speckit-tasks`** agrupa por lote: cada lote termina con una **tarea de checkpoint** que incluye sus tests y la suite de cierre. Los prefijos (`T-UNIT`, `T-INT`, `T-E2E`, `T-A11Y`, `T-VIS`, `T-MUT`, `T-QUAL`, `T-PLAY`, `T-TEST`) se usan como etiquetas dentro de las tareas. **No** se genera «implementar función A / test A / función B / test B» ni una tarea por test.
- **`/speckit-implement`** sigue el modelo de 15.5, ejecuta solo las suites del nivel que corresponde (15.24) e informa de qué se ha ejecutado realmente.
- **`/speckit-analyze`** comprueba que cada `CA` tiene un test previsto y que ningún lote se cierra con tests pendientes.

**Tareas transversales sugeridas** (en L01 salvo que se indique otra cosa; se adaptan, no se crean todas automáticamente):

```text
T-TEST-001 Inventario de arquitectura y runtimes (15.2) y medición inicial de tiempos.
T-TEST-002 Proyectos de Vitest, globalSetup de la BD plantilla y build compartido para http.
T-TEST-003 Clock, generador de ids, Logger falso, fábrica tipada de RequestEvent, builders y fakes base.
T-TEST-004 Servidores simulados (IA, BCE, Turnstile, Resend, GitHub, Log Gateway).
T-TEST-005 Modo APP_ENV=test (adaptadores falsos, outbox en fichero), rechazado fuera de test.
T-TEST-006 Scripts (15.25), lint:changed, test:trace y documentación en CLAUDE.md.
T-TEST-007 Velocidad de verificación: medir el programa de TypeScript (tsc --listFilesOnly),
           eslint --concurrency, testTimeout global y tiempos de cada comprobación.
T-TEST-008 Script de exclusiones de Windows Defender (con -Remove) para la carpeta del
           proyecto y las cachés de pnpm. Lo ejecuta una persona administradora, nunca el agente.
T-ARCH-001 Reglas de ESLint de pureza del dominio y test de arquitectura de fronteras entre
           funcionalidades (ARCHITECTURE.md, sección 9).
T-PLAY-001 Configuración de Playwright contra el build, proyectos, artefactos y storageState por rol.
T-PLAY-002 Smoke con detección de errores de página, consola e hidratación.
T-A11Y-001 Spec a11y que recorre todas las rutas en ambos temas.
T-QUAL-001 Cobertura con umbrales y publicación del informe en la PR.
T-VIS-001  Capturas visuales en el contenedor de Playwright (L15 / L16).
T-MUT-001  Piloto de Stryker sobre el dominio y línea base (tras L05–L06).
T-QUAL-002 Prueba de carga (perf:seed / perf:load) y registro de resultados (L12, L16 y release).
T-QUAL-004 Web Vitals de laboratorio (16.8) con y sin efectos (L12 y L16).
```

### 15.29 Definition of Checkpoint (cierre de lote)

Un lote se cierra cuando:

- La implementación prevista está completa.
- `check`, `lint:changed` y el build son correctos, y pasa el test de arquitectura.
- Están creados los tests obligatorios del lote, incluidos los que se escriben antes o inmediatamente después (15.5).
- Pasan los tests afectados y la aceptación del lote.
- Existen los fixtures y fakes necesarios.
- No hay errores críticos ni tests pendientes sin justificar.
- Si el lote tiene interfaz: sus estados de 16.6 y sus criterios UX-xx tienen test, y se han hecho las comprobaciones de UX de la definición de terminado de la constitución.
- Si el lote añade dependencias: se vuelve a medir el número de ficheros del programa de TypeScript (T-TEST-007).
- **No queda deuda de tests del lote.**

No hace falta ejecutar en cada checkpoint todos los E2E, navegadores, viewports, capturas, mutation testing ni suites no afectadas.

### 15.30 Definition of Done (historia)

Una historia está terminada cuando:

- Todos sus lotes están cerrados.
- Sus `CA` son trazables (`test:trace` sin huecos para la historia).
- Están cubiertos las reglas, los errores, los límites y los estados principales.
- Las dependencias externas están simuladas.
- Los tests son deterministas, sin esperas arbitrarias ni tests ignorados sin justificar.
- Las puertas del CI están en verde.
- Los E2E críticos afectados pasan en Chromium y en los navegadores que exija el riesgo.
- Se ha verificado el responsive mínimo y, si tiene interfaz, las comprobaciones de UX de la constitución (temas, efectos reducidos, 320 px, teclado y sin JavaScript), con su estado declarado.
- Las capturas coinciden o se han actualizado intencionadamente.
- No hay errores inesperados de consola ni de página.
- La cobertura no empeora sin justificación.
- Los comandos están documentados y los tests, integrados en CI.

El mutation testing solo es obligatorio si el plan lo establece para código crítico.

**Si la historia requiere Playwright**, además:

- Pasan los smoke y los E2E obligatorios.
- No hay errores inesperados de consola, de JavaScript ni de página.
- El flujo se ha verificado en el navegador y el viewport mínimos requeridos.
- Los datos son reproducibles y los fixtures y simulaciones están documentados.
- No hay `waitForTimeout`.
- Los tests son independientes.
- Los artefactos de diagnóstico están configurados.

### 15.31 Requisitos de calidad de los tests

Los tests tienen un propósito claro, son legibles, independientes y repetibles, fallan por una razón comprensible, usan datos claros y aserciones significativas, limpian sus recursos, no acceden a producción, no contienen secretos, no modifican entornos compartidos y permiten refactorizar.

PROHIBIDOS: tests sin aserción o que solo comprueban que no hay excepción, aserciones genéricas, reimplementar el algoritmo esperado dentro del test, dependencia del orden y acoplamiento a detalles internos.

---

## 16. Experiencia de usuario y diseño

Requisitos transversales de UX para todas las historias con interfaz: la web de la cuenta (landings, páginas legales, registro y login, panel de usuario, panel de administración) y los emails. Desarrollan los principios IX y XIII de la constitución. Cada `/speckit-specify` los concreta en requisitos verificables de su funcionalidad. Decisiones tomadas con el propietario el 2026-10-10.

Esta sección **no añade funcionalidades**, salvo dos aprobadas expresamente: el **selector de tema** (Sistema / Claro / Oscuro) y el ajuste **«Reducir transparencia y movimiento»** (16.4).

### 16.1 Personas y tareas

Todo lo que sigue son **hipótesis del propietario**: no hay investigación con usuarios. Se contrastan con la prueba de 16.10.

| Persona | Contexto | Tareas prioritarias | Sabe que ha terminado cuando… | Riesgos principales |
|---|---|---|---|---|
| **Visitante que llega desde una app** | Viene de la landing de la app o de un enlace de la propia app (`?app=<slug>`); quiere usar la app, no «abrir una cuenta» | Entender qué es la Cuenta y por qué la necesita; registrarse; verificar el email | La cuenta está verificada, ve su saldo de bienvenida y el siguiente paso de su app (BE-FR-64 CA2) | Confundir la cuenta con la app; abandonar en la verificación; el email no llega o va a spam |
| **Usuario ocasional** | Entra pocas veces, normalmente desde un aviso de la app («saldo bajo», «contacta con soporte») o desde un email; en móvil o escritorio | Consultar el saldo; comprar créditos; ver en qué se ha gastado; descargar facturas | Ve el saldo actualizado, la compra confirmada o el consumo que buscaba | No entender créditos frente a euros, saldo reservado, deuda ni caducidad |
| **Usuario atento a su privacidad y seguridad** | Reacciona a un aviso de seguridad o quiere ejercer sus derechos | Cerrar sesiones; cambiar la contraseña o el email; exportar sus datos; borrar la cuenta | Ve las sesiones cerradas, el cambio confirmado, el JSON descargado o la cuenta borrada | Cerrar por error la sesión actual; borrar la cuenta sin entender que pierde el saldo en todas las apps |
| **Administrador** | Una sola persona, experta en el dominio; uso frecuente, en escritorio y a veces en móvil | Revisar alertas y estadísticas; buscar un usuario; ajustar saldo, bloquear o reembolsar con motivo; configurar economía, modelos y protecciones | Ve el cambio aplicado y su entrada en la auditoría | Errores con consecuencias económicas o de acceso (parámetros, ajustes, reembolsos, freno global) |

### 16.2 Sistema de diseño

- **Fuente canónica:** la carpeta `Design/`, con la identidad visual **«Aurora Salvia»**: azul noche, acento verde salvia y luz ambiental violeta, en tema claro y oscuro. Procede del sistema de diseño de **NetworkBench** (otra app del propietario, de escritorio con Tauri), reciclado con paleta propia el 2026-10-10. Para conocer los valores implementados manda `Design/src/lib/design-system/tokens.css` sobre las tablas de `DESIGN_TOKENS.md`. **Desde L01** la fuente canónica pasa al código de la app (`src/lib/design-system/` y `src/lib/components/{ui,layout}/`), y `Design/` queda como documentación de la identidad (ADR 0007).
- **Se reutiliza:**
  - la estructura de tokens por rol con su pareja clara y oscura;
  - los tres materiales de cristal (`glass-chrome`, `glass-card`, `glass-overlay`), cada uno con su respaldo opaco;
  - la regla de «ningún color literal fuera de los tokens» y su script `verify-tokens`;
  - adaptados, los componentes `Button`, `Card`, `Dialog`, `TextField`, `Toast`, `Tooltip`, `StatusPill`, `ProgressBar`, `Icon`, `Sidebar` (navegación del panel de administración) y `ThemeToggle`.
- **No se aplica** lo propio de NetworkBench: `AVISOS.md`, `FLUJOS.md`, `PANTALLAS-H1.md`, `maqueta-navegable.html` y los componentes `TitleBar`, `DeviceCard`, `ExecutionLink`, `ChecklistItem`, `HomeScreenExample` y `VerificationCode`, ni los tramos de escritorio de `RESPONSIVE-I18N.md` (1000 y 1400 px), porque la web es mobile-first (16.5). Quedan como referencia hasta que se archiven.

**Adaptaciones pendientes** (contradicciones con esta especificación o con la constitución; se resuelven en el sistema de diseño, de forma centralizada, no con estilos locales):

| ID | Adaptación | Motivo | Cuándo |
|---|---|---|---|
| DS-01 | Renombrar a Cuenta Mardomingo: títulos, clave `networkbench.theme` y documentos de NetworkBench archivados o reescritos | Es la identidad de otro producto | Antes de L01, en `Design/` (encargo en paralelo); lo que no esté hecho al empezar L01 entra en L01 |
| DS-02 | Que el modo **Sistema** funcione sin JavaScript: sin elección explícita, los tokens siguen `prefers-color-scheme` en CSS; `data-theme` solo se usa para Claro u Oscuro elegidos, y el servidor lo pinta desde la cookie | Hoy `:root` es el tema oscuro, así que con SSR y sin JS un usuario con el sistema en claro vería el oscuro o un destello | Antes de L01, en `Design/` (encargo en paralelo); lo que no esté hecho al empezar L01 entra en L01 |
| DS-03 | El controlador de tema guarda la preferencia en una **cookie técnica** (no en `localStorage`) y vive en el contexto del árbol de componentes, sin estado mutable a nivel de módulo | Constitución, «Estado y componentes»; el servidor necesita la preferencia para la primera pintura. `ThemeToggle` pasa a ser un formulario que funciona sin JavaScript (16.4) | L01 |
| DS-04 | Tipografía para la web: tamaños en `rem` (no `px`); tamaño de cuerpo adecuado a la lectura web (el plan fija el valor; los 14 px de escritorio se revisan); pila de fuentes multiplataforma o fuentes propias autoalojadas, con licencia y peso medidos | Respetar la ampliación de texto del navegador; Segoe UI Variable y Cascadia Mono solo existen en Windows; las capturas visuales de 15.18 necesitan fuentes deterministas | Antes de L01, en `Design/` (encargo en paralelo); lo que no esté hecho al empezar L01 entra en L01 |
| DS-05 | Tratar `prefers-reduced-transparency`, `prefers-reduced-motion`, `prefers-contrast` y `forced-colors`, y un atributo para el ajuste propio de efectos (p. ej. `data-effects="reduced"`) que retira el *blur* y el movimiento no esencial | Hoy solo existe el respaldo `@supports not (backdrop-filter)` | Antes de L01, en `Design/` (encargo en paralelo); lo que no esté hecho al empezar L01 entra en L01 |
| DS-06 | Componentes propios de esta web: tabla de datos (encabezados, orden, desplazamiento local), paginación, grupos de casillas y de opciones, selector, aviso o *banner* (anuncios y documentos pendientes), estado vacío, contenedor de gráfica con tabla equivalente, cabecera y pie con navegación, y menú de cuenta. Cada componente documenta sus estados, teclado, temas y efectos reducidos | No existen en el sistema de NetworkBench | El marco (`components/layout/`) en L01; el resto, en el lote que lo necesite por primera vez |
| DS-07 | Nombres de token por rol: `--color-lavender` (ahora verde salvia) y `--color-mauve` (ahora violeta) | Los nombres heredados inducen a error | Antes de L01, en `Design/` (encargo en paralelo); lo que no esté hecho al empezar L01 entra en L01 |
| DS-08 | Integración con Tailwind 4: los tokens se exponen a Tailwind sin duplicar valores; `verify-tokens` se adapta a la estructura del repositorio y pasa a ser la puerta 10 del CI (`lint:tokens`); la paleta por defecto de Tailwind se desactiva y se rechazan los colores arbitrarios (`bg-[#fff]`) | Constitución: componentes propios sobre Tailwind, solo con tokens | L01 |
| DS-09 | Medir el contraste sobre la composición real (cristal sobre el fondo ambiental, en los dos temas y con efectos reducidos), no solo entre pares de tokens | Hoy el contraste está verificado por cálculo entre tokens | Antes de L01, en `Design/` (encargo en paralelo); lo que no esté hecho al empezar L01 entra en L01; después, en cada lote con interfaz |
| DS-10 | Semántica web de los componentes heredados: `Button` con `href` (enlace) y con `name`/`value`/`formaction` y `aria-busy`; `Sidebar` con `<a>` y `aria-current`; `ThemeToggle` como formulario; `Card` sin `div role="button"`; `Dialog` con alternativa sin JavaScript; `TextField` sin altura fija; textos de Paraglide; *snippets* en lugar de `<slot />`; y retirar las reglas de «aspecto nativo» (enlaces sin subrayar, `cursor: default`, `user-select: none`, prohibición del `<select>` nativo) | Contradicen los principios IX y XIII y la mejora progresiva | L01 (`Button`, `TextField`, `ThemeToggle`, marco); `Sidebar` en el lote de la administración |

### 16.3 Lenguaje visual: cristal selectivo

El cristal tiene una función concreta (separar la navegación del contenido o dar continuidad), nunca decorativa.

| Zona | Tratamiento |
|---|---|
| Cabecera, pie y navegación lateral del panel de administración | `glass-chrome` cuando hay contenido debajo, con protección de borde |
| Diálogos, *toasts* y menús desplegables | `glass-overlay` (casi opaco: es para leer) |
| Tarjetas de resumen destacadas: saldo del panel y bloque principal de las landings | `glass-card` |
| Tablas, formularios, listas, gráficas, paso de compra, textos legales y todas las pantallas de datos de la administración | **Siempre opaco** |
| Emails | Sin cristal |

- No se anidan superficies de cristal ni se aplica cristal por fila o por icono.
- La alternativa opaca conserva las mismas acciones, información, jerarquía y foco.
- El material nunca sustituye a la semántica, al nombre accesible, al foco ni a los estados.

### 16.4 Tema y efectos

**UX-TEMA — Selector de tema.**
- CA1: Sin preferencia guardada, el tema es **Sistema**: sigue la apariencia del sistema operativo desde la primera pintura, también sin JavaScript y sin destello del otro tema.
- CA2: Con Sistema seleccionado, si cambia la apariencia del sistema durante la sesión, la página se actualiza sin recargar y sin perder lo escrito, el foco ni la posición.
- CA3: Claro u Oscuro elegidos se guardan en una cookie técnica y el servidor pinta la página ya con ese tema. Se mantienen hasta que el usuario vuelva a elegir Sistema.
- CA4: El selector es un grupo de tres opciones con nombre accesible y la opción actual indicada. Está disponible en todas las páginas, también sin sesión, y funciona sin JavaScript (formulario).
- CA5: El tema oscuro está diseñado expresamente (no es una inversión del claro), incluidos los estados, el foco, las gráficas y las imágenes.

**UX-EFECTOS — Reducir transparencia y movimiento.**
- CA1: Junto al selector de tema hay un ajuste «Reducir transparencia y movimiento», guardado en una cookie técnica, que funciona sin JavaScript.
- CA2: Activado, todas las superficies de cristal pasan a su versión opaca y se retira el movimiento no esencial, sin perder acciones, contenido, foco ni estados.
- CA3: Las preferencias del sistema se respetan siempre, con el ajuste propio activado o no:
  - transparencia reducida → superficies opacas;
  - movimiento reducido → sin desplazamientos, rebotes ni *parallax*;
  - más contraste → texto, bordes, foco y estados reforzados;
  - colores forzados → colores del sistema, con bordes y foco visibles sin depender de sombras.
- CA4: El ajuste propio solo puede **reducir** efectos; nunca reactiva lo que el sistema pide reducir.

Las dos cookies son de preferencias estrictamente necesarias y se declaran en la política de cookies (BE-FR-60).

### 16.5 Adaptación

- **Mobile-first en toda la web, incluido el panel de administración** (decisión del 2026-10-10). Los objetivos táctiles miden **al menos 44 × 44 px CSS**. Es una política propia, por encima del mínimo de 24 × 24 de WCAG 2.2 AA.
- A 320 px de ancho no hay desplazamiento horizontal de la página. Las tablas pueden desplazarse dentro de su contenedor, con el encabezado identificable, o pasar a una vista de detalle; nunca se ocultan columnas necesarias sin otra forma de verlas.
- Funciona con zoom al 200 % y con el espaciado de texto de WCAG (interlineado 1,5; párrafos 2; letras 0,12; palabras 0,16).
- El campo con el foco, su ayuda y la acción necesaria siguen visibles con el teclado virtual abierto y bajo las barras fijas.
- Interfaz solo en español, con textos de Paraglide y formatos `es-ES`, sin concatenar textos que impidan traducir.
- **Orientación:** cada página tiene un `<title>` propio que coincide con su `h1` y con el texto del enlace que lleva a ella; la ubicación actual en la navegación se marca con `aria-current="page"` además de la señal visual.

### 16.6 Estados por área

Cada especificación define los estados que apliquen a su área y justifica las exclusiones relevantes. No hay modo sin conexión: un fallo de red se explica y protege lo escrito.

| Área | Estados que hay que definir |
|---|---|
| **Landings** (BE-FR-59) | App con landing externa; app desactivada; descarga no disponible; ninguna app activa (vacío legítimo) |
| **Registro, verificación, login, recuperación y cambio de email** (BE-FR-01–06, 64, 66, 67, 69) | Envío pendiente (botón con texto de progreso, sin doble envío); errores por campo con resumen enlazado y foco en él; captcha que no carga o falla, con reintento; mensaje neutro antienumeración que dice qué hacer si el email no llega (spam, reenviar con su límite y cuándo se puede volver a intentar); enlace caducado o ya usado, con forma de pedir otro; cuenta sin verificar; cuenta bloqueada (con el email de soporte); bloqueo temporal con el tiempo restante; sesión caducada que, tras iniciar sesión, vuelve a la página pedida |
| **Saldo, movimientos y consumo** (BE-FR-49.1–49.6, 11 CA1) | Primer uso (solo la bienvenida, explicando créditos y caducidad); cuenta sin saldo de bienvenida por email ya usado, explicado; saldo reservado; deuda; saldo bajo; vacío legítimo; sin coincidencias con el filtro visible; error de carga |
| **Compra** (BE-FR-23–26) | Compra no disponible («Próximamente», explicado en texto visible); casilla de desistimiento sin marcar (error asociado); pendiente; éxito (créditos acreditados y saldo nuevo); repetición por doble clic, reenvío o «atrás» (muestra la misma compra: «Esta compra ya se completó»); error del proveedor (qué se conserva y que no se ha cobrado); resultado incierto (fase Stripe: «Comprobando el pago») |
| **Perfil, sesiones, exportación y borrado** (BE-FR-07, 08, 49.8–49.9, 66, 74) | Cambio aplicado indicando qué sesiones se han cerrado; sesión actual identificada; exportación en curso, descargada o fallida; borrado con su confirmación (UX-07) |
| **Avisos** (BE-FR-70, 85) | Documentos pendientes de aceptar (qué deja de funcionar en las apps hasta aceptarlos); anuncios por nivel, distinguidos con icono y texto además del color |
| **Gráficas** (BE-FR-49.5, 54) | Sin datos en el periodo (vacío, no cero); periodo, unidad y vigencia visibles; tabla equivalente |
| **Administración** (BE-FR-18, 27, 50–57, 76) | Búsqueda sin resultados con la consulta visible; usuario borrado o anonimizado; motivo obligatorio; confirmación con alcance e importe; vista previa del valor anterior y el nuevo; freno global activo visible en todas sus páginas; éxito con enlace a la auditoría |
| **Errores globales** | 404, 403 y 500 con «Código de referencia» y una salida conocida (inicio o panel) |

### 16.7 Contenido y lenguaje

- **Vocabulario visible:** la especificación del panel fija los términos para el usuario (créditos, saldo, saldo reservado, deuda, créditos gratuitos o comprados con su caducidad) y evita los internos (ledger, reserva, bolsa) donde no ayuden.
- Botones con su resultado concreto: «Comprar 10 € de créditos», «Borrar mi cuenta», «Cerrar las demás sesiones». Se evitan «OK» y «Aceptar» cuando dejen dudas.
- Importes en créditos con su equivalencia en euros, con el formato y el redondeo de BE-FR-22. Las tablas usan cifras tabulares.
- La ayuda imprescindible nunca vive solo en un *tooltip*.
- Los mensajes de error dicen qué ha fallado, dónde, cómo corregirlo y qué se ha conservado. Los errores inesperados muestran el «Código de referencia».
- **Sin patrones manipulativos:**
  - ningún paquete preseleccionado y sin urgencia falsa;
  - borrar la cuenta no exige más que lo que pide BE-FR-07;
  - desactivar el aviso de saldo bajo es tan fácil como activarlo;
  - las casillas legales nunca vienen marcadas.

### 16.8 Rendimiento percibido

- **Objetivos:** LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1, medidos **en laboratorio** sobre el build de producción con perfil móvil limitado. Páginas: landing, login, saldo del panel, compra y estadísticas de la administración.
- No hay datos de campo: no se usa analítica de terceros (BE-FR-60) y recoger métricas propias queda fuera de la v4. Los resultados se presentan como lo que son: medidas de laboratorio.
- **Presupuesto del cristal:** se compara con la versión de efectos reducidos al desplazar, abrir un diálogo y redimensionar, en perfil móvil. Si supera los objetivos o perjudica la lectura, se simplifica o se retira.
- Se reserva el espacio de imágenes y datos que llegan después, no se vacía la vista para actualizar un dato y los envíos dan respuesta inmediata.
- **Cuándo se mide:** primera medida al existir el panel (L12) y medida completa en L16 (15.18). La herramienta la decide el plan.

### 16.9 Criterios de UX por historia

| ID | Historia | Criterio observable |
|---|---|---|
| UX-01 | BE-FR-01 | Las etiquetas son visibles y persistentes. La regla real de la contraseña (8–128 caracteres) se ve antes de escribir. Se puede pegar y usar gestores de contraseñas (`autocomplete="new-password"`). El botón para mostrar la contraseña tiene nombre y estado. Si falla, se conserva todo salvo la contraseña y el foco va al resumen de errores |
| UX-02 | BE-FR-01 CA4–CA5, BE-FR-02 CA3 | Tras registrarse, la pantalla dice a qué dirección se ha enviado el email, qué hacer si no llega y permite reenviarlo, indicando cuándo se puede volver a intentar |
| UX-03 | BE-FR-02, BE-FR-64 CA2, BE-FR-11 CA1 | La confirmación de la verificación muestra el saldo de bienvenida concedido (o por qué no se concede) y el siguiente paso de la app de origen |
| UX-04 | BE-FR-03, BE-FR-67 | Error de credenciales genérico; el bloqueo temporal dice cuándo se puede reintentar; tras iniciar sesión se vuelve a la página pedida (solo destinos internos) |
| UX-05 | BE-FR-25 CA4, BE-FR-26 | El paso de compra muestra el paquete, el precio con IVA y los créditos resultantes, la casilla obligatoria y la opción de factura completa. Un doble envío muestra la misma compra. El resultado muestra el saldo nuevo |
| UX-06 | BE-FR-25 CA2 | Cuando no se puede comprar, el texto «Próximamente» y su explicación son visibles y accesibles (no basta con un botón desactivado, que no recibe el foco) |
| UX-07 | BE-FR-07 | La confirmación del borrado muestra el saldo que se pierde (en créditos y euros) y las apps afectadas, y pide la contraseña. La acción se llama «Borrar mi cuenta» y el foco inicial no está en ella. Al terminar, la sesión está cerrada y se confirma el borrado |
| UX-08 | BE-FR-49.5 | Las gráficas tienen título, periodo y unidad, y tabla equivalente. «Sin datos» no se dibuja como cero. El selector de 30/90 días es un formulario GET (funciona sin JS y la URL se puede compartir) |
| UX-09 | BE-FR-49.3, 49.4, 49.6 | Filtros, orden y paginación son un formulario GET con botón visible y enlaces de página (funcionan sin JavaScript; aplicar al cambiar es solo una mejora). Las listas conservan los filtros y la página en la URL, y al volver se restauran. La exportación CSV indica el rango y los filtros aplicados |
| UX-10 | BE-FR-49.8, BE-FR-06 | La sesión actual se identifica («Esta sesión»). El texto de «cerrar todas» dice si la actual se mantiene |
| UX-11 | BE-FR-70 CA2–CA3 | El aviso de documentos pendientes enlaza a cada documento, permite aceptarlos y explica qué deja de funcionar en las apps hasta hacerlo |
| UX-12 | BE-FR-85 CA1 | Los anuncios del panel muestran su nivel con icono y texto además del color |
| UX-13 | BE-FR-18, 27, 50 | Antes de confirmar un ajuste de saldo, un reembolso, un bloqueo o un cierre de sesiones, se ven el usuario, el importe y el efecto (saldo antes → después), y el motivo es obligatorio. Al guardar, se enlaza la entrada de auditoría |
| UX-14 | BE-FR-51, 53 | Los cambios de parámetros económicos y de protecciones muestran el valor anterior, el nuevo y su alcance (global o por app) antes de guardar |
| UX-15 | BE-FR-50 | La búsqueda de usuarios por email es un formulario GET con estados inicial, sin resultados y error, y conserva la consulta |
| UX-16 | BE-FR-59 | La explicación de SmartScreen de la landing de Secretario tiene los pasos en texto; la captura es un apoyo, con texto alternativo |
| UX-17 | BE-FR-58 | Los emails se leen bien en clientes con modo oscuro, tienen versión en texto plano, muestran el enlace del botón también como URL y no dependen de imágenes |
| UX-18 | BE-FR-05, 66 | Tras cambiar la contraseña o el email, la confirmación indica que las demás sesiones se han cerrado |

### 16.10 Prueba de usabilidad previa al lanzamiento

- **Cuándo:** antes del lanzamiento público con cobros reales, junto a la auditoría manual de accesibilidad (15.18). No bloquea el desarrollo de la v4.
- **Quién:** de 3 a 5 personas cercanas que no hayan participado en el proyecto, con perfiles variados (si es posible, alguna que use lector de pantalla o solo teclado).
- **Tareas**, como escenarios con un objetivo y sin nombrar botones:
  1. registrarse desde la landing de Secretario y verificar la cuenta;
  2. comprar créditos (simulado, en staging);
  3. averiguar en qué se gastaron créditos el último mes;
  4. cambiar la contraseña;
  5. borrar una cuenta de prueba.
- **Condiciones:** staging con datos sembrados, consentimiento previo, sin grabar si no se consiente y con los datos mínimos.
- **Registro:**
  - por tarea, si se completó sin ayuda, con ayuda o no se completó;
  - dónde se atascó la persona y qué términos no entendió.
  Los hallazgos se priorizan por consecuencia, frecuencia y recuperación. Se corrigen y se repite el recorrido afectado.
- No se sacan porcentajes ni conclusiones generales de una muestra tan pequeña.

### 16.11 Verificación de UX

Complementa 15.18.

- **Matriz proporcional:**
  - en las páginas clave: tema claro y oscuro × efectos normales y reducidos × anchos de 320, 390 y 1366 px;
  - además: `forced-colors`, `reducedMotion` y `contrast` emulados en Playwright; `prefers-reduced-transparency`, por el protocolo de Chromium o marcado como «no verificable» si no se puede emular;
  - frecuencia: la spec a11y (todas las páginas, ambos temas) en cada PR; la matriz completa, en la ejecución nocturna;
  - el cambio de apariencia del sistema con Sistema seleccionado (`emulateMedia`) actualiza la página sin recargar y sin perder lo escrito.
- **Sin JavaScript:** los flujos críticos, el selector de tema y de efectos, y los filtros y la paginación funcionan con JavaScript desactivado.
- **axe sobre cristal:** cuando axe no puede calcular el contraste (resultado `incomplete`) en una superficie de cristal, cuenta como pendiente y se mide a mano (DS-09), no como aprobado. La excepción del captcha del registro está en la constitución, «Mejora progresiva».
- **Regresión visual:** una de las capturas de 15.18 se toma con efectos reducidos.
- **Estado de cada comprobación:** comprobado, pendiente, no verificable en este entorno o no aplica (con el motivo). La ausencia de errores automáticos no demuestra accesibilidad ni usabilidad.

### 16.12 Traslado a Spec Kit

- **`/speckit-specify`:** concreta 16.4–16.9 en la funcionalidad: estados, criterios UX-xx y textos visibles.
- **`/speckit-plan`:** decide lo siguiente:
  - qué tokens y componentes se crean o adaptan (DS-xx);
  - la técnica de tema sin destello y los nombres de las cookies;
  - la herramienta de medición del rendimiento y la matriz de pruebas.
- **`/speckit-tasks`:** los estados, la accesibilidad, los temas y la adaptación **no** se dejan para el final como «pulido».
- **L01** incluye la base visual:
  - DS-03, DS-08 y DS-10 (componentes del marco), migrando los tokens y componentes de `Design/` al código (ADR 0007). DS-01, 02, 04, 05, 07 y 09 se resuelven en `Design/` antes de L01 (encargo en paralelo); lo que no esté hecho al empezar L01 entra en L01;
  - el marco (`components/layout/`, parte de DS-06) con el selector de tema y el ajuste de efectos.
  Así el smoke y la spec de accesibilidad prueban los dos temas desde el principio. El resto de DS-06 y la medición de DS-09 se resuelven en cada lote con interfaz.
