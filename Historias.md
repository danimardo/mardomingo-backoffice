# Backend de IA multi-app — Especificación (primera app: Secretario AI v4)

| Campo | Valor |
|---|---|
| Estado | Diseño en revisión (v2: plataforma multi-app) |
| Fecha | 2026-10-10 |
| Versión del documento | 2.0 (sustituye a la 1.0 del 2026-10-06) |
| Copias | `secretario-backend/Historias.md` (original) y `secretario2/docs/v4-backend-spec.md` (copia literal para la app). Se editan en el original y se vuelven a copiar. |
| Primera app cliente | Secretario AI — cambios en la app: `secretario2/docs/v4-app-spec.md` |
| Repositorio del backend | Privado, `mardomingo-backoffice` (carpeta local actual: `secretario-backend`) |
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
| Framework | **SvelteKit** (`adapter-node`) | Un único proyecto para landing, panel de usuario, panel de administración y API (`+server.js`). Sirve los dos dominios (API y web) desde la misma instancia. |
| Base de datos | **SQLite** en modo **WAL** | Un fichero en volumen persistente. Las escrituras se serializan, lo que garantiza que dos peticiones simultáneas no gasten ni reserven el mismo crédito. |
| ORM | **Drizzle** (`sv add drizzle`) | Migraciones versionadas en el repositorio. |
| Autenticación | **Better Auth** (`sv add better-auth`) con adaptador Drizzle | Plugins: `bearer`, `admin`, `captcha` (Turnstile); *rate limit* integrado con almacenamiento en base de datos; cambio de email con verificación. |
| Validación y contrato | Esquemas de validación (p. ej. **Zod**) | De ellos se genera el **OpenAPI** de la API (ver 7.1). |
| Audio | **ffprobe** (ffmpeg) en la imagen del contenedor | Para medir en el servidor la duración del audio (ver BE-FR-44). |
| Internacionalización | **Paraglide** (`sv add paraglide`) | Solo `es` en la v4. |
| Estilos | **Tailwind CSS** | |
| Tests | **Vitest** | Obligatorios para la lógica de créditos, reservas y tarificación (ver 10.4). |
| Emails | **Resend** | Tras una interfaz de envío propia (ver 5.13). |
| Backups | **Litestream** → **Backblaze B2** (región UE, EU Central) | Bucket privado dedicado; clave de aplicación limitada a ese bucket. |
| Despliegue | **Coolify** | Una sola instancia por entorno (requisito de SQLite); entornos `production` y `staging`. |
| Logs y monitorización | **OpenObserve** | |

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
- Orígenes permitidos para CORS (solo apps web).
- Sobrescrituras de límites y parámetros globales (sección 9, los marcados como "por app").
- Esquema del documento de sincronización (BE-FR-39) y predeterminados (BE-FR-42).
- Catálogo de operaciones (BE-FR-77).
- Email de soporte propio opcional (BE-FR-84).
- CA1: Toda petición a `/api/v1` (salvo `/health` y `/openapi.json`) lleva `X-App-Id`. Ausente o desconocido → `400 UNKNOWN_APP`; app `disabled` → `503 APP_DISABLED`.
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
- CA2: Tras verificar el email, la página de confirmación muestra los siguientes pasos de esa app (p. ej. "Descarga Secretario AI e inicia sesión").
- CA3: Los emails que se refieren a una app concreta la mencionan por su nombre visible.

**BE-FR-65 — Clientes web y móviles.**
- CA1: Todas las apps se autentican con **token Bearer** (BE-FR-03); la cookie de sesión es exclusiva de la web de la cuenta.
- CA2: Las peticiones con cabecera `Origin` solo se aceptan si el origen figura en la lista de la app indicada en `X-App-Id` (CORS por app). Las apps de escritorio y móviles no envían `Origin`.
- CA3: La sesión queda **ligada a la app** con la que se inició; una petición con otro `X-App-Id` → `401 UNAUTHENTICATED`.

### 5.2 Cuentas y autenticación

**BE-FR-01 — Registro web.** El registro se hace **solo en la web** (`/registro`), con email, contraseña, aceptación de los términos, la política de privacidad y la política de uso aceptable vigentes, declaración de edad mínima (BE-FR-69) y captcha Turnstile.
- CA1: La contraseña tiene entre 8 y 128 caracteres.
- CA2: Se registra la versión de cada documento aceptado y la fecha (`terms_acceptances`).
- CA3: Sin captcha válido, el registro se rechaza.
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

**BE-FR-86 — Cuentas inactivas.** Una cuenta verificada **sin ninguna compra real** y sin actividad (ni login, ni uso de la API, ni acceso al panel) durante `inactive_account_years` años recibe un email de aviso. Si no hay actividad en los `inactive_account_notice_days` días siguientes, se borra según BE-FR-07.
- CA1: Las cuentas con alguna compra real **nunca** se cierran de forma automática, tengan o no saldo, para no quedarse con dinero del usuario.
- CA2: Cualquier actividad durante el plazo de aviso cancela el borrado.
- CA3: Los créditos gratuitos restantes se pierden con el borrado (ya caducan antes por BE-FR-16).

**BE-FR-69 — Edad mínima.** El registro exige marcar "Declaro tener al menos `min_age` años". La declaración se guarda en `terms_acceptances` (`document = age_declaration`). El valor por defecto (18) lo confirma el profesional legal (12, decisión 14).

**BE-FR-70 — Nuevas versiones de documentos legales.** El administrador publica versiones nuevas de términos, privacidad, cookies y uso aceptable indicando si **requieren nueva aceptación** o son **solo informativas**.
- CA1: Con una versión que requiere aceptación pendiente, `GET /me` y la respuesta de login la incluyen en `pendingAcceptances`, y las operaciones de IA y de sincronización responden `403 TERMS_ACCEPTANCE_REQUIRED`. Login, `/me`, `/app/status` y la aceptación siguen funcionando.
- CA2: La app muestra los documentos (enlaces) y acepta con `POST /api/v1/me/accept-terms`; la web muestra el mismo aviso al entrar en el panel.
- CA3: Las versiones solo informativas se notifican por email y en el panel, sin bloquear.

**BE-FR-07 — Borrado de cuenta.** Desde el panel, con confirmación de contraseña y aviso explícito de que **el saldo restante se pierde sin reembolso** y de que afecta a **todas las apps**.
- CA1: Se revocan todas las sesiones y se eliminan el email, el perfil, los datos fiscales y los datos sincronizados de todas las apps. La cuenta queda marcada con `deleted_at`.
- CA2: Los movimientos de créditos, las operaciones y los pagos se **conservan anonimizados** (sin email ni datos personales) por obligaciones contables y estadísticas. Las facturas emitidas se conservan íntegras durante el plazo legal (BE-FR-83), porque la normativa lo exige.
- CA3: El email queda libre para un registro nuevo, pero **no** recibe de nuevo el saldo de bienvenida si su forma normalizada ya lo recibió (se conserva un hash del email normalizado).

**BE-FR-08 — Exportación de datos (RGPD).** El panel permite descargar un JSON con perfil, datos fiscales, datos sincronizados de cada app, movimientos, operaciones (metadatos), pagos, facturas y aceptaciones legales del usuario.

**BE-FR-09 — Preparado para Google OAuth.** El modelo de cuentas de Better Auth (tabla `account` separada de `user`) se mantiene tal cual para poder añadir Google en fase 2 sin migraciones de datos. Como Google exige iniciar sesión en el navegador, la fase 2 añadirá un login en el navegador con retorno a la app (12, decisión 12) **además** de `POST /auth/login`, sin cambiar los endpoints existentes.

**BE-FR-10 — Seguridad de la cuenta de administrador.** La cuenta `admin` se protege solo con contraseña (decisión expresa: **sin segundo factor** en la v4). Se recomienda una contraseña larga y única, no reutilizada en otros servicios.

### 5.3 Antiabuso del saldo de bienvenida

**BE-FR-11 — Capas antiabuso.**
1. Verificación de email obligatoria antes de recibir créditos (BE-FR-02).
2. Bloqueo de **dominios de email desechables** mediante una lista mantenida y actualizable sin redesplegar.
3. **Turnstile** en el registro (BE-FR-01).
4. **Límite de altas por IP**: máximo `registrations_per_ip_24h` registros por IP en 24 h.
5. **Normalización del email** para la concesión del saldo de bienvenida: minúsculas, eliminación del sufijo `+etiqueta` en cualquier dominio y eliminación de puntos en `gmail.com`/`googlemail.com`. Se guarda `email_normalized` (único) y su hash para cuentas borradas.
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

**BE-FR-15 — Libro de movimientos (ledger).** Todo cambio de saldo genera un movimiento inmutable en `credit_movements`: `welcome`, `purchase`, `usage`, `adjustment`, `expiry`, `refund`, `chargeback`, `debt_settlement`. El saldo visible es siempre la suma de bolsas menos la deuda, y debe poder **reconstruirse** a partir del ledger. Las reservas (BE-FR-71) **no** son movimientos: no cambian el saldo, solo el saldo disponible.
- CA1: Existe una comprobación (tarea programada diaria y test) de que, para cada usuario, saldo materializado = reconstrucción desde el ledger; una discrepancia genera alerta al administrador.

**BE-FR-16 — Caducidad.** Una tarea diaria pone a cero las bolsas `free` caducadas y registra movimientos `expiry`. Siete días antes (`free_expiry_warning_days`) se envía un único email de aviso si la bolsa conserva saldo.

**BE-FR-17 — Saldo mínimo y deuda.**
- Para **lanzar** una operación hace falta `saldo disponible ≥ min_balance_to_operate` y que la reserva de la operación quepa (BE-FR-71); si no, `INSUFFICIENT_BALANCE` y **no se llama al proveedor**.
- Si el coste final supera el saldo (porque superó la estimación), se cobra igualmente: el exceso pasa a deuda, hasta `max_debt`. El exceso por encima de `max_debt` lo absorbe el administrador (se registra en estadísticas como pérdida).
- Con deuda > 0 no se pueden lanzar operaciones.
- La siguiente entrada de créditos `paid` **liquida primero la deuda** (movimiento `debt_settlement`).

**BE-FR-71 — Reservas de saldo.** Antes de llamar al proveedor, el backend calcula el **coste máximo estimado** de la operación (BE-FR-72) y, en una transacción, crea una **reserva** por ese importe.
- La operación solo se lanza si `reserva ≤ saldo disponible + (max_debt − deuda actual)` y `saldo disponible ≥ min_balance_to_operate`. Si no, `402 INSUFFICIENT_BALANCE` con `details.requiredMicro` y `details.availableMicro`.
- Al terminar, en la misma transacción del cobro (sección 8): se cobra el **coste real** y se libera la reserva. Si la operación no se cobra (BE-FR-21), la reserva se libera sin movimiento.
- Las reservas caducan a los `hold_ttl_seconds`. Al arrancar el servidor, todas las reservas abiertas se liberan y sus operaciones se marcan como `interrupted` (sin cobro).
- CA1: Un usuario con saldo para 3 operaciones que lanza 20 a la vez obtiene, como máximo, las que caben; el resto recibe `INSUFFICIENT_BALANCE`. La exposición total de una cuenta nunca supera `saldo + max_debt`, salvo que el coste real supere la estimación.
- CA2: El saldo que devuelve la API distingue total, reservado y disponible.
- *Compromiso conocido:* una operación con `max_output_tokens` alto exige más saldo disponible para lanzarse, aunque su coste real sea pequeño. El administrador lo ajusta por operación (BE-FR-77).

**BE-FR-18 — Ajustes manuales.** El administrador puede sumar o restar créditos a un usuario indicando tipo de bolsa, caducidad (si es `free`) y **motivo obligatorio**. Queda en el ledger y en la auditoría (BE-FR-55).

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
| OpenRouter (texto, imagen, audio de respaldo) | Campo `usage.cost` de la respuesta. Se envía `usage: { include: true }` por compatibilidad. Si falta, se consulta `GET /api/v1/generation?id=<id>`. Si tampoco está disponible, se estima con los precios por token del modelo y se marca la operación como `cost_estimated = true`. |
| Mistral (Voxtral) | `segundos de audio × voxtral_price_per_minute_usd / 60`. Los segundos se toman del `usage` de la respuesta si lo incluye; si no, de la duración medida en el servidor (BE-FR-44). **Nunca** se confía en una duración enviada por el cliente. |

**BE-FR-21 — Qué no se cobra.**
- Operaciones rechazadas antes de llamar al proveedor (validación, saldo, límites, mantenimiento, coste máximo).
- Operaciones en las que **todos** los proveedores fallan.
- Operaciones **canceladas** por el cliente antes de que el proveedor respondiera. Si el proveedor ya había respondido (coste conocido), se cobra, salvo en el caso de reintento de BE-FR-81.
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
| Fix de un párrafo (OpenRouter) | 0,00040 USD | 0,0004 × 1,055 × 0,92 × 2,0 × 1.000 | 0,776 créditos → se muestra "0,8" |
| Transcripción de 2 min (Voxtral a 0,001 USD/min) | 0,002 USD | 0,002 × 1,0 × 0,92 × 2,0 × 1.000 | 3,68 créditos → "3,7" |
| Prompt Directo largo con modelo PRO | 0,03 USD | 0,03 × 1,055 × 0,92 × 2,0 × 1.000 | 58,2 créditos → "58" |
| Saldo 55; reserva estimada 50; coste final 58,2 (supera la estimación) | — | 55 de bolsas + 3,2 a deuda (≤ `max_debt`) | Saldo −3,2 |

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
- Voxtral (`voxtral-mini-latest`, `POST https://api.mistral.ai/v1/audio/transcriptions`) con reintentos automáticos a los 2 s, 4 s y 8 s y *timeout* de 45 s por intento; si fallan, backup de OpenRouter (`input_audio` WebM en base64, *timeout* de 60 s).
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
- Si la operación anterior **sigue en curso** → `409 REQUEST_IN_PROGRESS` (sin llamar al proveedor).
- Si terminó y su respuesta **se entregó** → `409 DUPLICATE_REQUEST` con `details.operationId` (sin llamar ni cobrar de nuevo). Protege frente a dobles clics y reintentos automáticos.
- Si terminó pero **no se entregó** (el cliente cerró la conexión después de que el proveedor respondiera; estado `undelivered`) → se ejecuta de nuevo y esa repetición **no se cobra** (el coste se registra como absorbido).
- Si falló o se canceló antes de que el proveedor respondiera → se ejecuta de nuevo con normalidad.
- CA1: El contenido **no** se guarda para volver a entregarlo (BE-FR-38); por eso se repite la llamada.
- CA2: Sin cabecera, cada petición es independiente.

**BE-FR-37 — Cancelación.** Si el cliente cierra la conexión, el backend aborta la llamada al proveedor en curso (`AbortSignal`), detiene los reintentos y registra la operación como `cancelled` (o `undelivered` si el proveedor ya había respondido). Cobro según BE-FR-21 y BE-FR-81.

**BE-FR-38 — Registro de operaciones sin contenido.** Cada operación genera un registro en `ai_operations` con: usuario, app, sesión, operación, versión de plantilla, proveedor (`mistral`/`openrouter`), modelo, estado, tokens de entrada/salida, segundos de audio, coste real, reserva, cobro, duración, versión de la app, código de error, `Idempotency-Key` y si el proveedor marcó el contenido por moderación. **Nunca** se guardan audios, textos, prompts, variables, imágenes ni resultados: ni en base de datos, ni en logs, ni en ficheros temporales más allá de la vida de la petición.
- CA1: Una búsqueda en los logs de OpenObserve de un texto enviado en una operación no devuelve resultados.
- CA2: El audio recibido se procesa en memoria o en un temporal que se elimina al terminar la petición, también en caso de error o cancelación.

### 5.9 Datos de usuario, sincronización y predeterminados

**BE-FR-39 — Documento de sincronización por app.** Cada cuenta tiene **un documento por app**. Cada app declara su esquema: la lista de **categorías** y, para cada una, su estrategia de fusión: `items` (elementos con clave, `updatedAt` y marcas de borrado), `block` (bloque completo con `updatedAt`) o `keyed` (por clave, cada una con su `updatedAt`). **La fusión la hace el cliente**; el servidor valida que el documento solo contiene las categorías declaradas, con la forma de su estrategia, y que no supera `max_sync_doc_kb`.

**Perfil de la app `secretario`** (se almacena por cuenta y en ningún caso por dispositivo):

| Categoría | Clave en la app (v3) | Estrategia |
|---|---|---|
| Sustituciones personalizadas | `customReplacements` + `customReplacementsTombstones` | `items` (clave `from`; marcas de borrado que caducan a los 30 días). Lógica actual de `specs.md` 2.6. |
| Sustituciones core | `coreReplacements` | `block` |
| Textos rápidos | `defaultTexts` | `block` |
| Prompts de IA | `defaultPrompts` | `block` |
| Preferencias de uso | `communicationStyle`, `messageType`, `language`, `targetPersons`, `processWithLLM`, `autoCopy`, `fixAuto`, `markdownMode`, `translationTargetLanguage`, `themePreference` | `keyed` |

No se sincronizan (quedan en cada equipo): tamaño y posición de la ventana, modo compacto, tamaños del editor y de la transcripción, paneles plegados, **atajos de teclado globales**, variables locales persistentes, historial de copias y todo lo relativo al modo BYOK.

**BE-FR-40 — Siembra de predeterminados.** La **primera vez** que una cuenta usa una app (primer `GET /sync` con ese `X-App-Id`), se crea su documento copiando los **predeterminados vigentes** de esa app, con todos los `updatedAt = 0` (época). Así, en la primera sincronización, cualquier dato local con fecha real del usuario **gana** (lo local prevalece, decisión 38).

**BE-FR-41 — Lectura y escritura del documento.**
- `GET /api/v1/sync` devuelve el documento de la app y su `revision` (entero creciente).
- `PUT /api/v1/sync` con cabecera `If-Match: <revision>` sustituye el documento. Si la revisión no coincide → `412 SYNC_CONFLICT`; el cliente vuelve a leer, fusiona localmente y reintenta.
- Tamaño máximo del documento: `max_sync_doc_kb` (por defecto 1024 KB; sobrescribible por app).
- CA1: Dos `PUT` concurrentes con la misma revisión: uno tiene éxito y el otro recibe `412`. Nunca se pierde una escritura silenciosamente.
- CA2: Un documento con categorías no declaradas o con forma incorrecta → `VALIDATION_ERROR`.

**BE-FR-42 — Predeterminados del administrador.** El administrador edita los predeterminados de cada app (mismas categorías que su esquema) desde el panel. Además dispone de la acción **"Copiar mis datos actuales como predeterminados"**, que toma el documento sincronizado de su propia cuenta para esa app, para no tener que editar prompts largos en formularios web.
- CA1: Cambiar los predeterminados **no modifica** ninguna cuenta existente.
- CA2: `GET /api/v1/defaults` devuelve los predeterminados vigentes de la app (Secretario lo usa para "Restaurar valores predeterminados").
- CA3: Antes de copiar, se muestra una **vista previa** por categorías con casillas por elemento para excluir lo que no deba copiarse (p. ej. datos personales). Solo se sustituyen las categorías con algún elemento seleccionado.
- CA4: La copia queda registrada en la auditoría (BE-FR-55).

### 5.10 Protecciones

**BE-FR-43 — Límites por usuario.** Máximo `ai_requests_per_minute` peticiones de IA por minuto (sumando todas las apps) y `max_concurrent_transcriptions` transcripciones simultáneas. Excederlos → `429 RATE_LIMITED` con cabecera `Retry-After`.

**BE-FR-44 — Límites de tamaño y duración.** Audio ≤ `max_audio_mb` y de duración ≤ `max_audio_seconds`, texto total de mensajes o variables ≤ `max_text_chars`, imagen ≤ `max_image_mb`.
- La duración del audio se **mide en el servidor con ffprobe**, porque el WebM que genera `MediaRecorder` no incluye la duración en la cabecera y hay que leer el flujo completo. Se admite una tolerancia de `audio_duration_tolerance_seconds` para absorber el desfase de la parada automática de la app. Un audio que ffprobe no puede leer → `VALIDATION_ERROR`.
- Exceso de tamaño → `413 PAYLOAD_TOO_LARGE`; exceso de duración → `413 AUDIO_TOO_LONG`. En ambos casos, sin llamar al proveedor y sin cobrar.
- La configuración de `adapter-node` (`BODY_SIZE_LIMIT`) debe ser coherente con el mayor `max_audio_mb` configurado en cualquier app.

**BE-FR-45 — Límites de autenticación.** *Rate limit* por IP en login, registro, reenvío de verificación, recuperación de contraseña y cambio de email (Better Auth, con almacenamiento en base de datos), más el límite de altas por IP (BE-FR-11) y el bloqueo por email (BE-FR-67).

**BE-FR-46 — Freno global de gasto.** Si el **coste real acumulado del día** (Europe/Madrid) de las operaciones de cuentas **sin compras reales**, más las reservas en curso de esas cuentas, supera `global_daily_free_cost_brake_eur`, el backend rechaza nuevas operaciones de esas cuentas con `503 SERVICE_LIMITED` hasta el día siguiente o hasta que el administrador lo libere. Se envía un email al administrador al activarse.
- CA1: Las cuentas con compras reales no se ven afectadas.

**BE-FR-47 — Modo mantenimiento.** Interruptor **global** y uno **por app** en el panel, cada uno con mensaje personalizable. Activo: las operaciones de IA y la sincronización (de todas las apps o de esa app) responden `503 MAINTENANCE` con el mensaje; el login, `/me` y `/app/status` siguen funcionando.

**BE-FR-48 — Control de versiones de la app.** Las apps envían `X-App-Version` en cada petición. El administrador configura, por app, `min_app_version`, `recommended_app_version` y si se exige (`enforce_version`).
- CA1: Petición autenticada de una app con `enforce_version` y versión < mínima (o sin cabecera) → `426 UPGRADE_REQUIRED`.
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
8. **Sesiones activas**: app, equipo, versión de la app, último uso, IP aproximada; cerrar una o todas.
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

**BE-FR-54 — Estadísticas.** Por día, app, operación y usuario: coste real (USD y EUR), cobrado (créditos y su equivalente en EUR al valor de consumo), margen bruto, pérdidas por deuda absorbida y por repeticiones no cobradas (BE-FR-81), operaciones fallidas, canceladas, interrumpidas o truncadas, uso de modelos de respaldo, usuarios activos, altas (por app de origen), compras reales (excluidas las simuladas) e ingresos.
- **Embudo de alta por app** (semanal y acumulado): descargas del instalador, registros con `?app=<slug>`, cuentas verificadas, primer login desde la app y primera operación de IA. Las descargas se obtienen a diario del contador de la API de GitHub Releases cuando el enlace de descarga de la app apunta a GitHub. Este embudo es el criterio para decidir la firma del instalador de Secretario (12, decisión 11).

**BE-FR-55 — Auditoría.** Toda acción del administrador que modifique datos (ajustes de saldo, bloqueos, cambios de configuración, apps, operaciones, plantillas, modelos, paquetes, predeterminados, anuncios, documentos legales, reembolsos) se registra en `admin_audit` con fecha, acción, entidad, valores anterior/nuevo y motivo. El registro no se puede editar ni borrar desde el panel.

**BE-FR-56 — Alerta de saldo de proveedores.** Cada hora se consulta el saldo de OpenRouter (`GET https://openrouter.ai/api/v1/credits`); si baja de `openrouter_balance_alert_usd`, se envía un email al administrador (uno por cruce de umbral). Para Mistral, que no expone saldo equivalente, se alerta cuando sus llamadas devuelvan errores de pago o cuota (HTTP 401/402/429 de facturación).

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
- CA1: `/app/status` devuelve los anuncios activos que aplican a la app y versión de la petición; el panel de usuario los muestra también.
- CA2: Cada anuncio tiene un `id` estable para que el cliente recuerde localmente cuáles ha cerrado el usuario.

---

## 6. Modelo de datos

Tablas principales (las de Better Auth — `user`, `session`, `account`, `verification` — se extienden con los campos indicados). Tipos orientativos; el detalle lo fija la fase de plan.

| Tabla | Campos principales |
|---|---|
| `apps` | `id`, `slug` (único), `name`, `description`, `client_types`, `status` (`active`/`disabled`), `links` (JSON), `min_app_version`, `recommended_app_version`, `enforce_version`, `maintenance_active`, `maintenance_message`, `allowed_origins`, `settings_overrides` (JSON), `sync_schema` (JSON), `support_email`, `created_at`, `updated_at` |
| `app_operations` | `id`, `app_id`, `key`, `name`, `kind` (`chat`/`transcription`/`image`), `mode` (`libre`/`plantilla`), `model`, `fallback_models` (JSON), `preferred_provider`, `margin_override`, `temperature`, `max_output_tokens`, `max_cost_µc`, `estimated_max_cost_µusd`, `timeout_ms`, `capabilities` (JSON), `limits` (JSON), `transcription_config` (JSON), `group`, `active`, `updated_at` — único (`app_id`, `key`) |
| `prompt_templates` | `id`, `operation_id`, `version`, `messages` (JSON), `variables` (JSON), `response_format` (JSON), `tools` (JSON), `created_at` — **inmutable** por versión |
| `user` (Better Auth) | `id`, `email`, `email_verified`, `role` (lista separada por comas: `user`, `tester`, `admin`, como admite el plugin `admin`), `banned`, `ban_reason`, **`email_normalized`** (único), **`signup_app_id`**, **`has_real_purchase`**, **`low_balance_threshold_µc`**, **`low_balance_notified`**, **`deleted_at`**, `created_at`. Estado derivado sin campos duplicados: sin verificar = `email_verified = false`; bloqueada = `banned`; borrada = `deleted_at` no nulo |
| `session` (Better Auth) | `id`, `user_id`, `token`, `expires_at`, `ip_address`, `user_agent`, **`app_id`** (nulo en la web de la cuenta), **`device_name`**, **`app_version`**, **`last_used_at`** |
| `login_attempts` | `email_normalized_hash`, `failures`, `window_start`, `locked_until` |
| `legal_documents` | `id`, `document` (`terms`/`privacy`/`cookies`/`aup`/`withdrawal_waiver`), `version`, `published_at`, `requires_reacceptance`, `content_hash` |
| `terms_acceptances` | `id`, `user_id`, `document` (los de `legal_documents` + `age_declaration`), `version`, `accepted_at`, `ip`, `app_id` (desde dónde se aceptó) |
| `welcome_grants` | `email_normalized_hash` (único), `granted_at` — sobrevive al borrado de cuentas |
| `credit_buckets` | `id`, `user_id`, `kind` (`free`/`paid`), `initial_µc`, `remaining_µc`, `expires_at` (nulo en `paid`), `source` (`welcome`/`purchase`/`adjustment`), `payment_id`, `simulated`, `created_at` |
| `user_balances` | `user_id`, `debt_µc`, `updated_at` (saldo materializado = Σ `remaining_µc` − `debt_µc`) |
| `credit_holds` | `id`, `user_id`, `operation_id`, `amount_µc`, `created_at`, `expires_at`, `released_at` |
| `credit_movements` | `id`, `user_id`, `type`, `amount_µc` (con signo), `bucket_id`, `operation_id`, `app_id` (informativo), `payment_id`, `admin_reason`, `created_at` — **inmutable** |
| `ai_operations` | `id`, `user_id`, `app_id`, `session_id`, `operation`, `template_version`, `provider`, `model`, `used_fallback`, `status` (`ok`/`provider_error`/`cancelled`/`undelivered`/`interrupted`/`rejected`), `idempotency_key`, `input_tokens`, `output_tokens`, `audio_seconds`, `cost_µusd`, `cost_estimated`, `hold_µc`, `charged_µc`, `absorbed_µc`, `truncated`, `flagged`, `duration_ms`, `app_version`, `error_code`, `provider_generation_id`, `created_at` — **sin contenido**; único (`user_id`, `idempotency_key`) cuando la clave existe |
| `packs` | `id`, `name`, `price_eur_cents`, `bonus_pct`, `active`, `sort_order` |
| `payments` | `id`, `user_id`, `pack_id`, `provider`, `provider_ref` (único), `status` (`pending`/`completed`/`refunded`/`partially_refunded`/`chargeback`), `amount_eur_cents`, `base_eur_cents`, `vat_eur_cents`, `vat_rate`, `country`, `credits_µc`, `wants_full_invoice`, `simulated`, `created_at`, `completed_at` |
| `billing_profiles` | `user_id`, `kind` (`individual`/`business`), `legal_name`, `tax_id`, `address`, `postal_code`, `city`, `country`, `updated_at` |
| `invoices` | `id`, `payment_id`, `kind` (`simplified`/`full`/`corrective`), `series`, `number`, `billing_snapshot` (JSON), `amount_eur_cents`, `corrects_invoice_id`, `provider`, `provider_ref`, `pdf_ref`, `issued_at` — **inmutable** |
| `sync_documents` | `user_id`, `app_id`, `revision`, `data` (JSON), `updated_at` — clave (`user_id`, `app_id`) |
| `app_defaults` | `app_id` (clave), `data` (JSON), `updated_at` |
| `settings` | `key`, `value` (JSON), `updated_at` — parámetros globales de la sección 9 |
| `model_cache` | `model_id`, `pricing` (JSON), `modalities` (JSON), `supported_parameters` (JSON), `fetched_at` |
| `price_references` | `app_id`, `operation`, `typical_µc`, `sample_size`, `source` (`auto`/`manual`), `computed_at` |
| `announcements` | `id`, `app_id` (nulo = todas), `level`, `message`, `link`, `starts_at`, `ends_at`, `min_version`, `max_version`, `active` |
| `admin_audit` | `id`, `admin_id`, `action`, `entity`, `entity_id`, `before`, `after`, `reason`, `created_at` — **inmutable** |
| `alerts_state` | `key`, `active`, `last_sent_at` — evita emails repetidos por el mismo cruce de umbral |
| `disposable_domains` | `domain` |

Toda escritura que afecte a saldo o reservas (reserva, cobro, compra, ajuste, caducidad, reembolso) se ejecuta en **una única transacción** que actualiza bolsas, deuda, reservas y ledger a la vez.

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
| 409 | `REQUEST_IN_PROGRESS` | Ya hay una operación en curso con esa `Idempotency-Key` |
| 409 | `DUPLICATE_REQUEST` | La operación con esa `Idempotency-Key` ya se completó y entregó (`details.operationId`) |
| 412 | `SYNC_CONFLICT` | La revisión del documento ha cambiado |
| 413 | `PAYLOAD_TOO_LARGE` | Audio, texto o imagen demasiado grandes |
| 413 | `AUDIO_TOO_LONG` | Audio de duración superior a `max_audio_seconds` (`details.maxSeconds`) |
| 413 | `OPERATION_TOO_EXPENSIVE` | El coste máximo estimado supera el tope de la operación (`details.estimatedMicro`, `details.maxMicro`) |
| 426 | `UPGRADE_REQUIRED` | Versión de la app por debajo de la mínima |
| 429 | `RATE_LIMITED` | Demasiadas peticiones (con `Retry-After`) |
| 429 | `LOGIN_TEMPORARILY_LOCKED` | Demasiados intentos fallidos para ese email (con `Retry-After`) |
| 502 | `PROVIDER_ERROR` | El proveedor de IA ha fallado o ha rechazado el contenido (chat / imagen) |
| 502 | `TRANSCRIPTION_FAILED` | Han fallado Voxtral y el backup (`details.primaryError`, `details.backupError`) |
| 503 | `MAINTENANCE` | Mantenimiento global o de la app (`message` = texto del administrador) |
| 503 | `SERVICE_LIMITED` | Freno global de gasto activo |
| 503 | `APP_DISABLED` | La app está desactivada |
| 504 | `PROVIDER_TIMEOUT` | *Timeout* del proveedor |

### 7.3 Endpoints

#### `GET /app/status` *(público; requiere `X-App-Id`)*

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

Petición: `{ "email": "..." }`. Respuesta siempre `202` (anti-enumeración).

#### `POST /auth/logout`

Revoca la sesión del token. Respuesta `204`.

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
  "chargedMicro": 776000,
  "balance": { "totalMicro": 481574000, "availableMicro": 481574000, "debtMicro": 0 }
}
```

#### `POST /ai/transcribe`

`multipart/form-data`: `operation` (p. ej. `transcription`) y `file` (audio WebM/Opus).
Respuesta 200: `{ "text": "...", "providerUsed": "primary" | "backup", "audioSeconds": 118, "operationId": "...", "chargedMicro": 3680000, "balance": { ... } }`.
Error 502 `TRANSCRIPTION_FAILED`: `details: { "primaryError": "...", "backupError": "..." }`.

#### `POST /ai/image`

Petición: `{ "operation": "image-generation", "prompt": "..." }` (o `variables` si es con plantilla).
Respuesta 200: `{ "imageDataUrl": "data:image/png;base64,...", "operationId": "...", "chargedMicro": ..., "balance": { ... } }`.

#### `GET /sync`

Documento de la app de `X-App-Id`. Ejemplo con el perfil `secretario`:

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

Cabecera `If-Match: 42`. Cuerpo: `{ "data": { ... } }` (mismo formato). Respuesta 200: `{ "revision": 43 }`. Errores: `SYNC_CONFLICT` (412), `PAYLOAD_TOO_LARGE`, `VALIDATION_ERROR`.

#### `GET /defaults`

`{ "data": { ... } }` con el mismo formato que `/sync` de la app (sin `revision`).

#### `GET /health` *(público)*

`{ "status": "ok" }` si la base de datos responde. Lo usan Coolify y la monitorización.

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
| `support_email` | Por definir | Global / por app | Email de soporte |
| Paquetes | 5 € → 5.000 (+0 %), 10 € → 10.500 (+5 %), 25 € → 27.500 (+10 %) | Global | BE-FR-23 |
| Operaciones (modelo, respaldos, `max_output_tokens`, `max_cost_credits`, *timeout*…) | Equivalentes a los sugeridos hoy por el asistente de Secretario | Por operación | BE-FR-77 |
| Transcripción | Voxtral activo, backup configurable | Por operación | BE-FR-35 |

Variables de entorno (no editables desde el panel): `APP_ENV` (`development`/`staging`/`production`), `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `PAYMENTS_PROVIDER`, `INVOICING_PROVIDER`, `DATABASE_PATH`, `BETTER_AUTH_SECRET`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET`, `BODY_SIZE_LIMIT`, credenciales S3 de Litestream y, en la fase Stripe, sus claves y las del proveedor de facturación.

---

## 10. Seguridad, privacidad y calidad

1. **HTTPS obligatorio** (proxy de Coolify). Cookies `Secure`, `HttpOnly`, `SameSite=Lax` (solo en la web de la cuenta). Protección CSRF de SvelteKit (comprobación de origen) en formularios web. **CORS** de la API restringido a los orígenes declarados por cada app (BE-FR-65).
2. **Contraseñas** con el algoritmo de hash de Better Auth; nunca se registran en logs.
3. **Secretos** (claves de proveedores, Resend, Turnstile, Litestream, pagos, facturación) solo en variables de entorno de Coolify; nunca en el repositorio. Claves distintas por entorno.
4. **Tests obligatorios** (Vitest) de: fórmula de cobro (con comisión del proveedor) y redondeo, orden de consumo de bolsas, **reservas con peticiones simultáneas**, estimación del coste máximo, deuda y su liquidación, caducidad, idempotencia de pagos y de `/ai/*`, reconstrucción del saldo desde el ledger, concurrencia de cobros, conflicto de sincronización, validación del documento de sincronización por esquema, aislamiento entre apps (sesión, sincronización y operaciones) y cumplimiento del contrato OpenAPI.
5. **Logs** en OpenObserve con identificador de petición, app, usuario (id, no email), operación, estado y duración. **Prohibido** registrar cuerpos de petición o respuesta de `/ai/*` y `/sync`.
6. **Sin contenido persistido** (BE-FR-38).
7. **Proveedores**: `data_collection: "deny"` en OpenRouter (BE-FR-33).
8. **Retención y encargados del tratamiento**: BE-FR-83.
9. **Uso aceptable**: BE-FR-82.

---

## 11. Despliegue y operación

- **Coolify**: una aplicación (contenedor Node con `adapter-node` y **ffmpeg/ffprobe** en la imagen) con volumen persistente para el fichero SQLite; dominios `api.mardomingo.com` y `cuenta.mardomingo.com` con TLS, servidos por la misma instancia.
- **Entornos**:
  - `production`: dominios anteriores.
  - `staging`: `api-staging.mardomingo.com` y `cuenta-staging.mardomingo.com`, con su propia base de datos, su propio bucket de backups, claves de proveedores de IA propias con **límite de gasto** (clave de OpenRouter con tope de crédito), claves de prueba de Turnstile y pago simulado para todos (`APP_ENV = staging`). Nunca se copian datos de producción a staging.
  - Las apps de escritorio apuntan a staging con su mecanismo de desarrollo (en Secretario, `SECRETARIO_BACKEND_URL`, `v4-app-spec.md` APP-FR-10).
- **Una sola instancia por entorno** (requisito de SQLite). El despliegue debe evitar dos contenedores simultáneos escribiendo en el mismo fichero (despliegue con parada previa o estrategia equivalente). Al arrancar se liberan las reservas abiertas (BE-FR-71).
- **Backups**: Litestream replica en continuo el SQLite a Backblaze B2 (región UE, API compatible con S3) con retención mínima de 30 días. Procedimiento de **restauración documentado y probado** antes del lanzamiento público (requisito: el dinero de los usuarios depende de él).
- **Migraciones** Drizzle aplicadas automáticamente al arrancar, con backup previo. Se prueban primero en staging.
- **Tareas programadas** (dentro del proceso):
  - Cada hora: saldo de OpenRouter.
  - Diarias:
    - caducidad de bolsas y avisos;
    - comprobación del ledger;
    - caché de modelos y vigilancia de modelos asignados (BE-FR-80);
    - precios orientativos (BE-FR-73);
    - limpieza de marcas de borrado de sincronización con más de 30 días;
    - borrado de cuentas sin verificar (BE-FR-68);
    - aplicación de plazos de retención (BE-FR-83);
    - limpieza de reservas caducadas.
    - tipo de cambio del BCE (BE-FR-87);
    - aviso y borrado de cuentas inactivas (BE-FR-86);
    - contador de descargas de GitHub Releases para el embudo de alta (BE-FR-54).
  - Semanal: actualización de la lista de dominios desechables.
- **Monitorización**: `/health`, logs y errores en OpenObserve, alertas por email (5.13).

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
