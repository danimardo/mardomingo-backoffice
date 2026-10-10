# Contrato de las rutas de la web `cuenta.`

**Funcionalidad**: `001-cuenta-mardomingo-v4` · **Fase**: 1 de `/speckit-plan` · **Fecha**: 2026-10-10

**Fuentes**: `Historias.md` v2.6, 5.11–5.15, 15.17 y 16 (UX); `spec.md` (FR-077–FR-132 y aclaraciones del
2026-10-10); constitución v2.1.2, «Arquitectura idiomática de SvelteKit» y principios III, IX, XI y XII;
`ARCHITECTURE.md` §2, §6 y §7; decisiones de la revisión del plan (D-01…D-22 de `plan.md`).

Referencias cruzadas: API de las apps en [api-v1.md](./api-v1.md); eventos en
[log-events.md](./log-events.md); tablas en [data-model.md](../data-model.md); validación de extremo a
extremo en [quickstart.md](../quickstart.md).

**Qué fija `Historias.md` y qué propone este documento.** `Historias.md` solo fija las URL `/`,
`/apps/<slug>`, `/precios`, `/registro?app=<slug>`, `/login`, `/recuperar`, `/panel`, `/panel/comprar`,
`/admin`, `/terminos`, `/privacidad`, `/cookies` y `/uso-aceptable` (4.2, 7.3 `links`). El resto de URL,
los nombres de las _actions_, los nombres de los parámetros de consulta y los nombres de las cookies son
**[Propuesta]** de esta fase: el plan los confirma y, una vez implementados, `resolve()` de `$app/paths`
los tipa. Las URL visibles están en español; los identificadores de código, en inglés.

---

## 1. Convenciones comunes

### 1.1 Grupos de rutas

| Grupo (`src/routes/…`) | Contenido                                                                                                    | Host      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| `(web)/(public)/`      | Landings, precios, legales, registro, verificación, login, recuperación, confirmación de email, preferencias | `cuenta.` |
| `(web)/panel/`         | Panel de usuario                                                                                             | `cuenta.` |
| `(web)/admin/`         | Panel de administración                                                                                      | `cuenta.` |
| `client-errors/`       | Errores del navegador (`+server.ts`)                                                                         | `cuenta.` |
| `api/v1/`              | API de las apps (ver [api-v1.md](./api-v1.md))                                                               | `api.`    |

La separación por host se aplica en `handle`: en el host de la web, `/api/v1/*` responde `404` (salvo
`/api/v1/health`), y viceversa.

### 1.2 _Guards_ (exportados por `accounts`)

Cada `load`, cada _action_ y cada `+server.ts` protegido llama a su _guard_. El `load` de un _layout_
**no** es una barrera de seguridad.

| _Guard_               | Exige                                                      | Sin cumplirlo, en un `load` o descarga GET                                 | Sin cumplirlo, en una _action_                                                                                              |
| --------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Público               | —                                                          | —                                                                          | —                                                                                                                           |
| `requireUser`         | Sesión web válida (cookie), cuenta no bloqueada ni borrada | `redirect(303, "/login?redirectTo=<ruta+query>")`                          | `fail(401, { formError: "SESSION_EXPIRED", values })` (sin contraseñas), con enlace a `/login?redirectTo=…` **[Propuesta]** |
| `requireVerifiedUser` | `requireUser` + email verificado                           | Como `requireUser`; sin verificar → `redirect(303, "/verificar/reenviar")` | Como `requireUser`                                                                                                          |
| `requireAdmin`        | `requireVerifiedUser` + rol `admin`                        | Anónimo → como `requireUser`; usuario sin rol → `error(403)`               | `fail(403, { formError: "FORBIDDEN" })`                                                                                     |

- `redirectTo` solo admite rutas internas relativas: `^/(?!/)[^\\\s]*$`, ≤ 2048 caracteres; cualquier otro
  valor se sustituye por `/panel` (sin redirecciones abiertas).
- La web solo acepta la cookie de sesión (`Secure`, `HttpOnly`, `SameSite=Lax`); un `Authorization: Bearer`
  se rechaza.
- Las páginas autenticadas responden con `cache-control: private, no-store`.

### 1.3 Datos (`load`)

- Solo `+page.server.ts` y `+layout.server.ts`. Sin `load` universales.
- Devuelven **modelos de vista** de los `presenters.ts` de cada funcionalidad: importes como enteros
  `…Micro` y céntimos (`…Cents`) ya calculados en el servidor, que los componentes formatean con
  `$lib/format` (BE-FR-22, `es-ES`); fechas como ISO UTC o `YYYY-MM-DD`. **Nunca** filas de la BD, objetos
  de Better Auth, nombres de modelo, costes reales, hashes, tokens ni `has_real_purchase` de otros usuarios.
- Validación de la query: `z.strictObject` en el `load` de la página dueña de sus parámetros (clave
  desconocida o valor inválido → `error(400)` con «Código de referencia»); `z.object` en los _layouts_.
- Cargas independientes en paralelo; las gráficas pueden llegar como promesa en _streaming_ con
  `aria-busy`.

### 1.4 Mutaciones (_actions_ con nombre)

- Todas son `<form method="POST" action="?/<nombre>">` con `use:enhance`. Sin `fetch` manual, sin
  `+server.ts` para mutar, sin _remote functions_.
- Pasos: _guard_ → helper de formularios (`$lib/server/forms/`, Zod con `z.strictObject`) → **un**
  servicio por `index.ts` → resultado.
- Resultados:
  - Éxito: `redirect(303, …)` (POST-redirect-GET) o `{ success: true, messageKey }`.
  - Validación: `fail(400, { values, errors })` (errores por campo con mensajes de Paraglide; `values` sin
    contraseñas ni campos sensibles).
  - Rechazo de negocio: `fail(4xx, { formError: "<CÓDIGO>" })`.
  - Los códigos propios de la web de este documento (`WRONG_PASSWORD`, `SESSION_EXPIRED`,
    `SESSION_NOT_FOUND`, `PACK_INACTIVE`, `LEGAL_VERSION_CHANGED`, `NOTHING_SELECTED`, `SLUG_TAKEN`…)
    forman parte del **catálogo único de errores tipados** (`$lib/server/shared/errors.ts`) que usan el
    formateador de `$lib/server/api` y el helper de formularios (I6); no se escriben como literales sueltos en las
    _actions_. Los que no son de 7.2 no aparecen nunca en las respuestas de la API.
- **Mensajes tras PRG**: el destino recibe `?aviso=<clave>` con un enumerado validado por Zod (nunca texto
  libre ni datos personales en la URL) **[Propuesta]**.
- **Confirmaciones** (borrado, ajustes, reembolsos, bloqueos, cierre de sesiones, parámetros; UX-07,
  UX-13, UX-14): patrón en dos pasos, ambos POST, sin `window.confirm`:
  1. `?/previsualizar<Acción>` valida y devuelve `{ preview }` (objeto, alcance, importe, valor anterior →
     nuevo) **sin modificar nada**; la página pinta el paso de confirmación con su propio `<form>`.
  2. `?/<acción>` con los mismos campos ocultos y `confirmado=true` ejecuta.
     El foco inicial de la confirmación no está en la acción destructiva. Los textos libres (motivo) **nunca**
     viajan por GET.
- Con JavaScript: botón desactivado con `aria-busy="true"` durante el envío; ante un fallo, foco al resumen
  de errores o al primer campo inválido y anuncio con `aria-live`.
- **Comprobación de origen (D-01)**: la comprobación CSRF propia de SvelteKit está desactivada (rechazaría
  el `multipart` sin `Origin` de las apps en la API; R01) y `handle` aplica una equivalente **solo en el host
  web**: todo POST/PUT/PATCH/DELETE con tipo de contenido de formulario (`application/x-www-form-urlencoded`,
  `multipart/form-data`, `text/plain`) debe traer `Origin` igual al origen de `PUBLIC_WEB_URL`. Si falta o no
  coincide → `403` (página de error con «Código de referencia») sin ejecutar la _action_, y
  `http.origin.rejected`. Autorizada por la constitución (enmienda PATCH v2.1.1, principio III; vigente
  v2.1.2); se prueba en N3 HTTP.

### 1.5 Filtros, orden y paginación (UX-08, UX-09, UX-15)

`<form method="GET">` con botón visible y enlaces de página; la URL guarda el estado; aplicar al cambiar es
solo una mejora (sin formularios ocultos con `requestSubmit()`). Parámetros comunes **[Propuesta]**:

| Parámetro        | Esquema                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `desde`, `hasta` | `dd/mm/aaaa` o ISO `YYYY-MM-DD` → `CivilDate` (Europe/Madrid); `desde ≤ hasta` |
| `app`            | Slug de app o vacío (todas)                                                    |
| `pagina`         | Texto de dígitos → entero ≥ 1 (sin `z.coerce.number()`)                        |
| `periodo`        | `30` \| `90`                                                                   |
| `q`              | Texto 1–254 (búsqueda de usuarios por email, solo administración)              |

### 1.6 Sin JavaScript

Todo funciona sin JavaScript (FR-112, SC-012), salvo:

- **Captcha del registro** (única excepción): sin JavaScript, `<noscript>` visible explica que el captcha lo
  necesita; el formulario sigue siendo nativo y no hay camino sin captcha.
- **Gráficas**: siempre con tabla equivalente, que es el contenido sin JavaScript.

### 1.7 Captcha y límites de autenticación (D-02)

- Las _actions_ llaman a Better Auth con su API de servidor (`auth.api`), por la que no actúan su plugin
  `captcha` ni su `rateLimit`; no se usan (solo los plugins `bearer` y `admin`).
- **Turnstile** lo verifica `accounts` con el adaptador `CaptchaVerifier` (real y `fake.ts`), solo en el
  registro (W08), con el campo `cf-turnstile-response` y la IP de `event.getClientAddress()`.
- **Límites por IP** (BE-FR-45): login (W11), registro (W08), reenvío de verificación (W10), recuperación
  (W12) y cambio de email (W27) los cuenta `accounts` en su tabla `auth_rate_limits`; superarlos →
  `429 RATE_LIMITED` con el tiempo de espera visible y `accounts.rate_limit.exceeded`. Las altas por IP en
  24 h (`429 REGISTRATION_IP_LIMIT`) se cuentan sobre `user.signup_ip`.

### 1.8 Errores globales

`+error.svelte` accesible para `404`, `403` y `500` con el «Código de referencia» (`requestId`) y una salida
conocida (inicio o panel). Los errores inesperados los registra `handleError` una vez
(`http.request.failed`) y devuelve `{ message, requestId }` genérico.

### 1.9 Layouts

| Layout                                    | Guard           | Datos del `load` (modelo de vista)                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raíz `src/routes/+layout.server.ts` (L01) | Público         | Tema y efectos: `appearance: { theme: "system"\|"light"\|"dark", effects: "normal"\|"reduced" }` (de `event.locals`); nivel de log del cliente `clientLogLevel` (`CLIENT_LOG_LEVEL`); variables públicas (`PUBLIC_…`, p. ej. `publicWebUrl`); `supportEmail` global; `account: { signedIn, isAdmin }`. Pinta `data-theme` (solo si es claro u oscuro) y `data-effects` desde el servidor |
| `(web)/panel/+layout.server.ts`           | (no es barrera) | Navegación del panel con `aria-current`, `pendingAcceptancesCount`, `activeAnnouncementsCount`                                                                                                                                                                                                                                                                                           |
| `(web)/admin/+layout.server.ts`           | (no es barrera) | Navegación lateral, `globalBrake: { active }` (visible en todas las páginas de administración, 16.6), `alertsActiveCount`                                                                                                                                                                                                                                                                |

- **Un solo layout raíz con datos** (I3): tema, efectos, nivel de log del cliente, variables públicas y
  `supportEmail` se cargan **solo** en `src/routes/+layout.server.ts`; no hay un `(web)/+layout.server.ts`
  que los repita. Los `+server.ts` (API, descargas, `client-errors`) no ejecutan layouts.
- **Los layouts del panel y de la administración no son barrera** (D4): no llaman a `requireVerifiedUser`
  ni a `requireAdmin` (un `load` de layout no protege las _actions_ ni se vuelve a ejecutar en cada
  navegación). Leen `event.locals.user` si existe para la navegación y los contadores, y devuelven valores
  vacíos si no. El _guard_ va en el `load` de cada `+page.server.ts` y en **cada** _action_ (1.2). El layout
  del panel lo crea L03 (mínimo) y lo amplía L10 con la navegación del panel (sin _guard_); L12 lo completa.

---

## 2. Rutas públicas — `(web)/(public)`

### W01 · `/` — Landing de la marca paraguas (BE-FR-59, FR-100)

- **Guard**: público.
- **`load`**: `apps: [{ slug, name, description, landing: { kind: "internal"|"external", url } }]` (solo
  activas), `supportEmail`.
- **Actions**: ninguna (tema y efectos en W16).
- **Estados 16.6**: ninguna app activa (vacío legítimo); app con landing externa.
- **Sin JS**: completo.

### W02 · `/apps/[slug=appSlug]` — Landing de app (BE-FR-59, FR-100, FR-101, UX-16)

- **Guard**: público. _Param matcher_ `appSlug` en `src/params/`.
- **`load`**: `app: { slug, name, description, clientTypes, download: { url, available } | null,
access: { url } | null, externalLanding: url | null, smartScreenHelp: boolean }`, `registerHref`
  (`/registro?app=<slug>`), `supportEmail`. App inexistente → `error(404)`.
- **Estados 16.6**: app desactivada (mensaje, sin descarga ni «Crear cuenta»); descarga no disponible; app con
  landing externa (enlace visible a la externa, sin redirección automática **[Propuesta]**).
- **Secretario**: pasos de SmartScreen en texto («Más información» → «Ejecutar de todas formas») y captura con
  texto alternativo (UX-16).
- **Sin JS**: completo.

### W03 · `/precios` — Precios orientativos (BE-FR-73, FR-037)

- **Guard**: público.
- **`load`**: `groups: [{ appName, operations: [{ name, typicalMicro, source: "auto"|"manual" }] }]`,
  ejemplos legibles ya calculados (`dictationMinuteMicro`, `hoursPerPack5EurTenths`…), `computedOn`. Nunca
  el modelo ni el coste real.
- **Estados**: sin precios para una app (vacío explicado).
- **Sin JS**: completo.

### W04–W07 · `/terminos`, `/privacidad`, `/cookies`, `/uso-aceptable` — Documentos legales (BE-FR-60, BE-FR-82)

- **Guard**: público.
- **`load`**: `document: { kind, version, publishedOn, contentHtml }` (versión vigente), generado desde
  `legal_documents.content` (texto versionado, D-14; [data-model.md](../data-model.md)).
- `/cookies` declara la cookie de sesión y las dos de preferencias (W16).
- **Sin JS**: completo.

### W08 · `/registro` — Registro (BE-FR-01, 11, 64, 69; UX-01, UX-02; FR-007, FR-115, FR-116)

- **Guard**: público; con sesión → `redirect(303, "/panel")`.
- **Query**: `app` (slug opcional; desconocido o inactivo → se ignora y se registra sin origen).
- **`load`**: `originApp: { slug, name } | null`, `legal: [{ kind, version, url }]` (términos, privacidad,
  uso aceptable vigentes), `minAge`, `passwordRule: { min: 8, max: 128 }`, `turnstileSiteKey`.
- **Actions**:

| Action        | Entrada                                                                                                                                                                               | Validación                                                                                          | Éxito                                                                                                                                                          | Errores (`fail`)                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `?/registrar` | `email`, `password`, `acceptTerms`, `acceptPrivacy`, `acceptAup`, `ageDeclaration`, `cf-turnstile-response`, `app` (oculto), `versionTerms`, `versionPrivacy`, `versionAup` (ocultos) | `z.email()`; contraseña 8–128; las cuatro casillas `true` (nunca premarcadas); versiones = vigentes | `{ success: true, sentTo }` (misma respuesta exista o no el email, BE-FR-01 CA5); muestra a qué dirección se envió, qué hacer si no llega y el reenvío (UX-02) | `400` validación (`values` sin contraseña; foco al resumen); `400 CAPTCHA_INVALID` (con reintento); `400 DISPOSABLE_DOMAIN`; `429 REGISTRATION_IP_LIMIT`; `429 RATE_LIMITED` (IP); `409 LEGAL_VERSION_CHANGED` (vuelve a mostrar los documentos) |

- **Estados 16.6**: envío pendiente sin doble envío; errores por campo con resumen enlazado; captcha que no
  carga o falla con reintento; mensaje neutro antienumeración.
- **Captcha** (1.7, D-02): lo verifica `CaptchaVerifier` en `accounts` antes de llamar a `auth.api`; un
  verificador caído → `CAPTCHA_INVALID` con reintento y `accounts.captcha.unavailable`.
- **Sin JS**: aviso `<noscript>` del captcha (excepción); sin token de captcha el servidor responde
  `CAPTCHA_INVALID`.
- **Eventos**: `accounts.signup.completed`, `accounts.signup.rejected`, `accounts.captcha.unavailable`,
  `notifications.email.sent`.

### W09 · `/verificar` — Verificación del email (BE-FR-02, 12, 64 CA2; UX-03; FR-008, FR-117)

- **Guard**: público.
- **Query**: `token` (texto opaco). El enlace del email abre una página con un botón; la verificación ocurre
  por POST, no al abrir el enlace (evita que los escáneres de correo consuman el token y respeta «toda
  mutación es una action») **[Propuesta]**.
- **`load`**: `tokenState: "valid"|"expired"|"used"|"invalid"` (sin consumirlo).
- **Actions**:

| Action        | Entrada          | Éxito                                                                                                                                                                                                 | Errores                                                               |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `?/verificar` | `token` (oculto) | Verifica, crea la bolsa de bienvenida (o la deniega por email normalizado ya usado), aplica `ADMIN_EMAIL` si corresponde, inicia la sesión web **[Propuesta]** y `redirect(303, "/panel/bienvenida")` | `400 TOKEN_EXPIRED` / `TOKEN_USED` / `TOKEN_INVALID` con enlace a W10 |

- **Estados 16.6**: enlace caducado o ya usado con forma de pedir otro.
- **Eventos**: `accounts.email.verified`, `accounts.verification.rejected`, `credits.bucket.granted`,
  `credits.welcome.denied`, `accounts.admin.promoted`, `accounts.admin.promotion_refused`.

### W10 · `/verificar/reenviar` — Reenvío de la verificación (BE-FR-02 CA3, UX-02)

- **Guard**: público.
- **`load`**: `retryAfterSeconds` si hay límite activo para esta sesión de navegador **[Propuesta]**.
- **Actions**: `?/reenviar` — `email` (`z.email()`) → `{ success: true, messageKey: "verification_resent" }`
  (siempre neutro); `429 RATE_LIMITED` con el tiempo de espera visible.
- **Eventos**: `accounts.verification.resend_requested`.

### W11 · `/login` — Inicio de sesión web (BE-FR-03, 04, 67; UX-04; FR-009, FR-014, FR-118)

- **Guard**: público; con sesión → `redirect(303, redirectTo ?? "/panel")`.
- **Query**: `redirectTo` (interna), `aviso` (`password_reset` \| `email_changed` \| `session_expired` \|
  `logged_out`).
- **`load`**: `redirectTo` saneado, `notice`.
- **Actions**:

| Action     | Entrada                                    | Éxito                                                                                                            | Errores                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?/entrar` | `email`, `password`, `redirectTo` (oculto) | Sesión web (cookie, `session.app_id = null`), contador de fallos a cero, `redirect(303, redirectTo ?? "/panel")` | `400` validación; `401 INVALID_CREDENTIALS` (genérico); `403 EMAIL_NOT_VERIFIED` (con enlace a W10); `403 ACCOUNT_BLOCKED` (con el email de soporte); `429 LOGIN_TEMPORARILY_LOCKED` (`retryAfterMinutes` visible); `429 RATE_LIMITED` |

- **Estados 16.6**: cuenta sin verificar; bloqueada; bloqueo temporal con tiempo restante; sesión caducada
  que vuelve a la página pedida.
- **Eventos**: `accounts.login.succeeded`, `accounts.login.failed`, `accounts.login.locked`,
  `accounts.rate_limit.exceeded`.

### W12 · `/recuperar` — Solicitud de recuperación (BE-FR-05, FR-011)

- **Guard**: público.
- **Actions**: `?/solicitar` — `email` → `{ success: true, messageKey: "reset_requested" }` (neutro, con qué
  hacer si no llega); `429 RATE_LIMITED`.
- **Eventos**: `accounts.password.reset_requested`, `notifications.email.sent`.

### W13 · `/recuperar/nueva` — Nueva contraseña (BE-FR-05, BE-FR-67 CA2)

- **Guard**: público.
- **Query**: `token`. **`load`**: `tokenState` (sin consumirlo), `passwordRule`.
- **Actions**: `?/restablecer` — `token` (oculto), `password` (8–128) → cambia la contraseña, consume el
  token (1 h, un solo uso), pone a cero el contador de fallos, envía el aviso de seguridad y
  `redirect(303, "/login?aviso=password_reset")`. Errores: `400` validación, `400 TOKEN_EXPIRED` /
  `TOKEN_USED` / `TOKEN_INVALID` (con enlace a W12).
- **Eventos**: `accounts.password.reset_completed`, `notifications.email.sent`.

### W14 · `/email/confirmar` — Confirmación del cambio de email (BE-FR-66 CA1, CA4, CA5; UX-18)

- **Guard**: público (el enlace puede abrirse en otro dispositivo).
- **Query**: `token`. **`load`**: `tokenState`.
- **Actions**: `?/confirmar` — `token` (oculto) → aplica el cambio, recalcula `email_normalized`, revoca
  todas las sesiones salvo la actual (si la hay) y redirige a `/panel/perfil?aviso=email_changed` (con
  sesión) o `/login?aviso=email_changed` (sin ella). Errores: `400 TOKEN_*`.
- **Eventos**: `accounts.email_change.applied`, `accounts.session.revoked`.

### W15 · `/logout` — Cerrar la sesión actual (BE-FR-06)

- **Guard**: `requireUser`.
- **`load`**: página de confirmación con el botón (sin JS también).
- **Actions**: `?/salir` → revoca la sesión actual, borra la cookie y `redirect(303, "/login?aviso=logged_out")`.
- **Eventos**: `accounts.session.revoked`.

### W16 · `/preferencias` — Tema y efectos (UX-TEMA, UX-EFECTOS; FR-108, FR-109; DS-02, DS-03)

- **Guard**: público (todas las páginas incluyen el selector como formulario que apunta aquí).
- **Query**: `redirectTo` (interna).
- **`load`**: `appearance` actual y `redirectTo`; la página muestra el selector completo (también sirve de
  página propia sin JS).
- **Actions**:

| Action      | Entrada                          | Validación                        | Éxito                                                                                                                                                                               |
| ----------- | -------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?/tema`    | `theme`, `redirectTo` (oculto)   | `theme ∈ { system, light, dark }` | `light`/`dark` → cookie `mdm_theme`; `system` → borra la cookie. `redirect(303, redirectTo ?? "/")`. Con JS, se aplica sin recargar y sin perder lo escrito, el foco ni la posición |
| `?/efectos` | `effects`, `redirectTo` (oculto) | `effects ∈ { normal, reduced }`   | `reduced` → cookie `mdm_effects`; `normal` → la borra. Mismo redirect                                                                                                               |

- **Cookies** **[Propuesta]** (nombres y técnica sin destello los fija el plan, 16.12): `mdm_theme`
  (`light`\|`dark`) y `mdm_effects` (`reduced`); `Path=/`, `SameSite=Lax`, `Secure`, `HttpOnly`,
  `Max-Age` de un año; validadas con Zod en `handle` (valor inválido → se ignora = Sistema/normal). Son
  preferencias estrictamente necesarias (se declaran en `/cookies`).
- **Sin destello**: sin cookie, el HTML no lleva `data-theme` y los tokens siguen `prefers-color-scheme` en
  CSS (DS-02); con cookie, el servidor pinta `data-theme`. El ajuste de efectos solo reduce (nunca reactiva
  lo que pide el sistema).
- **Sin JS**: completo (formulario + redirect).

### W17 · `/cuenta-borrada` — Confirmación del borrado (UX-07)

- **Guard**: público (la sesión ya no existe). Contenido estático con enlace al inicio.

---

## 3. Panel de usuario — `(web)/panel`

Todas las páginas: `requireVerifiedUser` en el `load` de cada página y en cada _action_ (nunca solo en el
_layout_, D4), `cache-control: private, no-store`, vocabulario de 16.7 (créditos,
saldo, saldo reservado, deuda, créditos gratuitos o comprados), importes en créditos con su equivalencia en
euros y cifras tabulares.

### W18 · `/panel` — Resumen: saldo y avisos (BE-FR-49.1, 49.12, 49.13, 70, 85; UX-11, UX-12; FR-077, FR-087, FR-125, FR-126)

- **`load`**:
  - `balance: { totalMicro, reservedMicro, availableMicro, debtMicro, eurEquivalentCents, buckets: [{ kind: "free"|"paid", source: "welcome"|"purchase"|"adjustment", remainingMicro, expiresOn: YYYY-MM-DD|null, simulated }] }`
  - `welcome: { status: "granted"|"denied_email_used"|"none" }`
  - `lowBalance: { thresholdMicro: entero|null, isBelow }`
  - `announcements: [{ id, level, message, link, appName: texto|null }]` (activos para todas las apps y para
    las apps que la cuenta ha usado —sesión actual o pasada, o documento sincronizado—, sin filtrar por
    versión; aclaración 2026-10-10). Composición en el `load` (C2): une `accounts.appsUsedBy(userId)`
    (solo `user_app_activity`, D-13) y `sync.syncedAppIds(userId)` (apps con documento sincronizado), sin
    repetidos, y llama a `notifications.listForPanel(appIds)`; ninguna funcionalidad importa a la otra
    (`accounts` no importa `sync`).
  - `pendingAcceptances: [{ document, title, version, url }]`, `supportEmail`.
- **Actions**: `?/aceptarDocumentos` — `documents` (lista repetida `kind:version`) → `legal` registra la
  aceptación (IP de `event.getClientAddress()`, `app_id = null`) → `redirect(303, "/panel?aviso=terms_accepted")`.
  Errores: `400` validación, `409 LEGAL_VERSION_CHANGED`.
- **Estados 16.6**: primer uso (solo bienvenida, con explicación de créditos y caducidad); sin bienvenida por
  email ya usado (explicado); saldo reservado; deuda; saldo bajo; documentos pendientes (qué deja de
  funcionar en las apps); anuncios por nivel con icono y texto; error de carga.
- **Eventos**: `legal.acceptance.recorded`, `legal.acceptance.rejected`.

### W19 · `/panel/bienvenida` — Tras verificar (BE-FR-64 CA2, BE-FR-11 CA1; UX-03; FR-005, FR-117)

- **`load`**: `welcome: { status, grantedMicro: entero|null, expiresOn }`, `nextSteps: { appName,
customText: texto|null, download: url|null, access: url|null }` (`customText` = `apps.post_verify_text`,
  D-14: texto propio de la app si existe; si no,
  el genérico con nombre, botón de descarga o acceso e «inicia sesión con tu email»; aclaración 2026-10-10),
  `balance` resumido.
- **Sin JS**: completo.

### W20 · `/panel/comprar` — Compra de créditos (BE-FR-23–26, 49.2, 74; UX-05, UX-06; FR-038–FR-042, FR-078, FR-119, FR-120)

- **Query**: `paquete` (id de paquete activo; opcional). Sin él, lista de paquetes; con él, paso de
  confirmación.
- **`load`**:
  - `packs: [{ id, name, priceCents, bonusPct, creditsMicro }]` (créditos calculados con
    `credits_per_eur_purchase` vigente), ninguno preseleccionado
  - `availability: { canPurchase, reason: "coming_soon"|null }` (en producción sin rol `tester`/`admin` →
    «Próximamente» con explicación visible y accesible, UX-06)
  - Con `paquete`: `selected`, `intentId` (identificador de intento de un solo uso, BE-FR-25 CA4),
    `waiverText: { version }`, `billingProfile: { complete: boolean, values? }`, `pricesHref: "/precios"`.
- **Actions**:

| Action      | Entrada                                                                                                                                                                                                                        | Validación                                                                                                                                                   | Éxito                                                                                                                                                                                                                           | Errores                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?/comprar` | `packId`, `intentId` (oculto), `waiverAccepted`, `waiverVersion` (oculto), `wantsFullInvoice`, y si pide factura completa sin perfil completo: `billingKind`, `legalName`, `taxId`, `address`, `postalCode`, `city`, `country` | Casilla de desistimiento `true` (nunca premarcada); `intentId` UUID; NIF/NIE/CIF con formato español válido; si `wantsFullInvoice`, datos fiscales completos | `redirect(303, "/panel/comprar/<paymentId>")`. **Repetición** (doble clic, reenvío, «atrás»): el mismo `intentId` lleva a la misma compra sin acreditar de nuevo: `redirect(303, "/panel/comprar/<paymentId>?estado=repetida")` | `400` validación (casilla sin marcar con error junto a ella); `403 PURCHASE_NOT_AVAILABLE`; `409 PACK_INACTIVE`; `502 PAYMENT_PROVIDER_ERROR` (qué se conserva y que no se ha cobrado) |

- **Estados 16.6**: no disponible («Próximamente»); casilla sin marcar; pendiente; éxito; repetición; error del
  proveedor; resultado incierto (solo fase Stripe).
- **Sin JS**: completo (E2E crítico 4 y 10).
- **Eventos**: `payments.purchase.completed`, `payments.purchase.duplicate`, `payments.purchase.rejected`,
  `payments.purchase.failed`, `credits.bucket.granted`, `credits.debt.settled`,
  `invoicing.billing_profile.updated`, `invoicing.invoice.skipped`.

### W21 · `/panel/comprar/[paymentId]` — Resultado de la compra

- **Guard**: `requireVerifiedUser` + propiedad del pago (ajeno → `error(404)`).
- **Query**: `estado` (`repetida` opcional).
- **`load`**: `purchase: { packName, priceCents, vatCents, creditsMicro, simulated, status, completedAt }`
  (en la v4, IVA español del 21 % incluido y país `ES`, D-17),
  `balance` nuevo, `repeated` («Esta compra ya se completó»).

### W22 · `/panel/movimientos` — Movimientos (BE-FR-49.3, 49.6; UX-09; FR-079, FR-081)

- **GET**: `desde`, `hasta`, `app`, `pagina`.
- **`load`**: `rows: [{ createdAt, type: "welcome"|"purchase"|"usage"|"adjustment"|"expiry"|"refund"|"chargeback"|"debt_settlement", amountMicro, appName|null, operationName|null }]`,
  `pagination: { page, hasPrevious, hasNext }`, `filters` (eco), `exportHref` con los mismos filtros. Sin
  motivos internos del administrador ni ids de bolsa.
- **Estados**: vacío legítimo; sin coincidencias con el filtro visible; error de carga.
- **Sin JS**: completo.

### W23 · `GET /panel/movimientos/exportar` — CSV de movimientos (`+server.ts`)

- **Guard**: `requireVerifiedUser`. **Query**: `desde`, `hasta`, `app` (los de W22).
- **Respuesta**: `text/csv; charset=utf-8`, `Content-Disposition: attachment;
filename="movimientos-<desde>_<hasta>.csv"`, separador `;` y coma decimal **[Propuesta]**; columnas:
  fecha, tipo, créditos, app, operación. Solo las filas del usuario y del filtro.
- **Eventos**: `http.request.completed`.

### W24 · `/panel/consumo` — Consumo y gráficas (BE-FR-49.4, 49.5, 63 CA2; UX-08, UX-09; FR-079, FR-080, FR-122)

- **GET**: `desde`, `hasta`, `app`, `pagina` (lista) y `periodo` (`30`\|`90`, gráficas).
- **`load`**:
  - `rows: [{ createdAt, appName, operationName, status: "ok"|"failed"|"cancelled"|"undelivered"|"interrupted", chargedMicro }]`
    (nombre amigable; **nunca** modelo ni coste real)
  - `pagination`, `filters`, `exportHref`
  - `charts` (promesa en _streaming_): `byDay`, `byOperation`, `byApp`, cada una con `title`, `period`,
    `unit: "créditos"`, `points` y su tabla equivalente; días sin datos marcados como «sin datos» (no cero).
- **Estados**: vacío; sin coincidencias; gráfica sin datos en el periodo; error de carga.
- **Sin JS**: lista, filtros, paginación, selector 30/90 y tablas de las gráficas.

### W25 · `GET /panel/consumo/exportar` — CSV de consumo (`+server.ts`)

- Como W23, con columnas: fecha, app, operación, estado, créditos cobrados.

### W26 · `/panel/sesiones` — Sesiones activas (BE-FR-06, 49.8; UX-10; FR-083, FR-124)

- **`load`**: `sessions: [{ id, isCurrent, appName|null ("Web"), deviceName|null, appVersion|null,
lastUsedAt, approxIp }]`. «IP aproximada» (D-19): IPv4 truncada a /24 (`203.0.113.x`) e IPv6 a /48; la
  IP completa nunca llega al modelo de vista.
- **Actions**:

| Action           | Entrada     | Éxito                                                                                                                            | Errores                                      |
| ---------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `?/cerrarSesion` | `sessionId` | Revoca esa sesión (propia); `redirect(303, "/panel/sesiones?aviso=session_closed")`. Si es la actual → `/login?aviso=logged_out` | `404 SESSION_NOT_FOUND` (ajena o ya cerrada) |
| `?/cerrarDemas`  | —           | Revoca todas salvo la actual («Cerrar las demás sesiones»; el texto dice que esta se mantiene) → `?aviso=others_closed`          | —                                            |

- **Estados**: sesión actual identificada («Esta sesión»).
- **Eventos**: `accounts.session.revoked`.

### W27 · `/panel/perfil` — Perfil (BE-FR-05, 49.7, 49.9, 66, 74; UX-18; FR-011, FR-013, FR-046, FR-082, FR-084, FR-132)

- **`load`**: `email`, `billingProfile: { kind, legalName, taxId, address, postalCode, city, country } | null`,
  `lowBalance: { thresholdMicro|null }`, `notice`.
- **Actions**:

| Action                   | Entrada                                                                                                                 | Validación                                                                                                            | Éxito                                                                                                                                              | Errores                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `?/cambiarEmail`         | `newEmail`, `password`                                                                                                  | `z.email()`; contraseña requerida                                                                                     | `{ success: true, messageKey: "email_change_requested" }` («Si la dirección es válida, recibirás un email»; también si pertenece a otra cuenta)    | `400`; `401 WRONG_PASSWORD`; `429 RATE_LIMITED` |
| `?/cambiarPassword`      | `currentPassword`, `newPassword`                                                                                        | 8–128                                                                                                                 | Revoca las demás sesiones, aviso de seguridad; `redirect(303, "/panel/perfil?aviso=password_changed")` (indica que se cerraron las demás sesiones) | `400`; `401 WRONG_PASSWORD`                     |
| `?/guardarDatosFiscales` | `kind` (`individual`\|`business`), `legalName`, `taxId`, `address`, `postalCode`, `city`, `country` (ISO 3166-1 alfa-2) | Formato del identificador fiscal español (NIF/NIE/CIF); NIF-IVA intracomunitario: solo formato (VIES pendiente, 12-2) | `?aviso=billing_saved`                                                                                                                             | `400` (error junto al campo)                    |
| `?/guardarAvisoSaldo`    | `enabled`, `thresholdCredits`                                                                                           | `thresholdCredits` con el esquema de decimal español a entero escalado (µc), ≥ 0; obligatorio si `enabled`            | `?aviso=low_balance_saved`; desactivar es tan fácil como activar                                                                                   | `400`                                           |

- **Enlaces**: exportar datos (W28) y borrar la cuenta (W29).
- **Estados 16.6**: cambio aplicado indicando qué sesiones se han cerrado; exportación en curso, descargada o
  fallida.
- **Eventos**: `accounts.email_change.requested`, `accounts.email_change.rejected`,
  `accounts.password.changed`, `accounts.password.change_rejected`, `invoicing.billing_profile.updated`,
  `invoicing.billing_profile.rejected`.

### W28 · `GET /panel/perfil/exportar` — Exportación RGPD (`+server.ts`) (BE-FR-08, FR-105)

- **Guard**: `requireVerifiedUser`.
- **Respuesta**: `application/json`, `Content-Disposition: attachment;
filename="cuenta-mardomingo-datos-<YYYY-MM-DD>.json"`, `no-store`. Contiene perfil, datos fiscales,
  documentos sincronizados de cada app, movimientos, metadatos de operaciones (sin modelo ni coste real
  **[Propuesta]**), pagos, facturas y aceptaciones legales. No se registra su contenido.
- **Eventos**: `privacy.export.generated` (o `http.request.failed`).

### W29 · `/panel/perfil/borrar` — Borrado de cuenta (BE-FR-07; UX-07; FR-104, FR-121)

- **`load`**: `loss: { totalMicro, eurEquivalentCents }`, `affectedApps: [{ name }]` (todas las de la
  plataforma usadas por la cuenta), aviso de que el saldo se pierde sin reembolso en todas las apps.
- **Actions**:

| Action           | Entrada                                               | Éxito                                                                                                                                                                                                                                                                                           | Errores                               |
| ---------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `?/borrarCuenta` | `password`, `confirmLoss` (casilla, nunca premarcada) | Revoca todas las sesiones, pone a cero las bolsas restantes con movimientos `forfeit` (cuentan en estadísticas, D-15), elimina datos personales y sincronizados, anonimiza la cuenta sin tocar las tablas inmutables (D-18), conserva el hash de bienvenida; `redirect(303, "/cuenta-borrada")` | `400` (casilla); `401 WRONG_PASSWORD` |

- La acción se llama «Borrar mi cuenta» y el foco inicial no está en ella; no pide nada más que BE-FR-07.
- **Eventos**: `privacy.account.deleted`, `privacy.account.deletion_rejected`, `credits.balance.forfeited`,
  `accounts.session.revoked`.

### W30 · `/panel/facturas` — Facturas (BE-FR-49.10, 75; FR-085)

- **`load`**: `invoices: [{ id, number, kind: "simplified"|"full"|"corrective", issuedOn, amountCents,
pdfHref, canRequestFull }]`. En la v4 (proveedor `none`) la lista está vacía con su explicación.
- **Actions**: `?/solicitarFacturaCompleta` — `invoiceId` → exige perfil fiscal completo; `?aviso=full_invoice_requested`.
  Errores: `400 BILLING_PROFILE_INCOMPLETE` (enlace a W27), `404`.
- **Estados**: vacío legítimo.
- **Eventos**: `invoicing.full_invoice.requested`.

### W31 · `GET /panel/facturas/[invoiceId]/pdf` — PDF de factura (`+server.ts`)

- **Guard**: `requireVerifiedUser` + propiedad (ajena → `404`). **Respuesta**: `application/pdf`,
  `Content-Disposition: attachment; filename="factura-<serie>-<número>.pdf"`, obtenido del proveedor de
  facturación por su adaptador.

### W32 · `/panel/apps` — Mis apps (BE-FR-49.11, FR-086)

- **`load`**: `apps: [{ name, description, download: url|null, access: url|null, used: boolean }]` (Secretario:
  instalador de la última versión publicada).
- **Estados**: descarga no disponible.

---

## 4. Panel de administración — `(web)/admin`

Todas las páginas y _actions_: `requireAdmin` en el `load` de cada página y en cada _action_ (el _layout_ no
es barrera, D4). Toda _action_ que modifica datos se audita (BE-FR-55) y, al
guardar, redirige con `?aviso=saved&auditoria=<entryId>` para mostrar el enlace a la entrada de auditoría
(UX-13). Los modelos de vista de administración **sí** pueden mostrar modelos y costes reales.

### W33 · `/admin` — Resumen

- **`load`**: alertas activas (`alerts_state`), estado del freno global, avisos de modelos retirados o con
  cambio de precio, contadores del día.
- **Estados**: freno global activo visible (en todas las páginas, vía _layout_).

### W34 · `/admin/usuarios` — Búsqueda (BE-FR-50; UX-15; FR-088, FR-129)

- **GET**: `q` (email o parte), `pagina`.
- **`load`**: `query` (eco), `results: [{ userId, email|null, status: "active"|"unverified"|"blocked"|"deleted", roles, createdOn }]`.
- **Estados**: inicial, sin resultados con la consulta visible, error; usuario borrado o anonimizado.

### W35 · `/admin/usuarios/[userId]` — Detalle (BE-FR-50, BE-FR-04 CA4; UX-13; FR-088, FR-127)

- **`load`**: saldo, reservas, bolsas, movimientos, consumo por app, sesiones, pagos, facturas, datos fiscales,
  operaciones marcadas por moderación (sin contenido), roles y estado.
- **Actions** (todas con el patrón de confirmación 1.4 y `reason` obligatorio salvo indicación):

| Action                                               | Entrada                                                     | Efecto                              | Errores                               |
| ---------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------- | ------------------------------------- |
| `?/previsualizarBloqueo` / `?/bloquear`              | `reason`, `confirmado`                                      | Bloquea y revoca todas sus sesiones | `400` (motivo); `409 ALREADY_BLOCKED` |
| `?/previsualizarDesbloqueo` / `?/desbloquear`        | `reason`, `confirmado`                                      | Desbloquea                          | `409`                                 |
| `?/marcarTester` / `?/desmarcarTester`               | `reason`                                                    | Cambia el rol `tester`              | `409`                                 |
| `?/previsualizarCierreSesiones` / `?/cerrarSesiones` | `reason`, `confirmado`, `sessionId` (opcional: una o todas) | Revoca                              | `404`                                 |

- **Eventos**: `accounts.user.blocked`, `accounts.user.unblocked`, `accounts.role.changed`,
  `accounts.session.revoked`, `audit.entry.recorded`.

### W36 · `/admin/usuarios/[userId]/ajuste` — Ajuste de saldo (BE-FR-17, 18; UX-13; FR-027, FR-029)

- **`load`**: usuario (email o «cuenta anonimizada»), saldo actual, deuda.
- **Actions**:

| Action                  | Entrada                                                                                                            | Validación                                                                                                                                        | Éxito                                                                                                                                             | Errores                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `?/previsualizarAjuste` | `direction` (`add`\|`subtract`), `amountCredits`, `bucketKind` (`free`\|`paid`), `expiresOn` (si `free`), `reason` | Importe con decimal español → µc > 0; `expiresOn` (`dd/mm/aaaa`) futura si `free`; motivo 1–500; si `subtract`, importe ≤ saldo disponible (D-16) | `{ preview: { balanceBeforeMicro, balanceAfterMicro, debtSettledMicro } }` (una entrada positiva liquida primero la deuda; aclaración 2026-10-10) | `400`                                                                                                                                   |
| `?/ajustarSaldo`        | Los mismos + `confirmado`                                                                                          | Igual                                                                                                                                             | Movimiento `adjustment` (y `debt_settlement` si procede) y auditoría; `redirect(303, "/admin/usuarios/<id>?aviso=saved&auditoria=<entryId>")`     | `400` (validación; una resta mayor que el saldo disponible se rechaza junto al campo `amountCredits`: el ajuste nunca crea deuda, D-16) |

- **Sin JS**: completo; doble envío protegido (E2E crítico 8 y 15.12).
- **Eventos**: `credits.adjustment.applied`, `credits.adjustment.rejected`, `credits.debt.settled`,
  `audit.entry.recorded`.

### W37 · `/admin/usuarios/[userId]/pagos/[paymentId]/reembolso` — Reembolso manual (BE-FR-27; UX-13; FR-043)

- **`load`**: pago, saldo no consumido de su bolsa.
- **Actions**: `?/previsualizarReembolso` / `?/reembolsar` — `creditsToRemove` (decimal español → µc, ≤ no
  consumido), `amountEur` (solo con proveedor real; ≤ pagado), `reason`, `confirmado` → movimiento `refund`,
  devolución por el proveedor (si es real) y rectificativa. Errores: `400`, `409 PAYMENT_NOT_REFUNDABLE`.
- **Eventos**: `payments.refund.applied`, `invoicing.invoice.issued`, `audit.entry.recorded`.

### W38 · `/admin/economia` — Economía (BE-FR-51, 61, 73, 87; UX-14; FR-089, FR-096, FR-128)

- **`load`**: parámetros económicos de §9 con valor efectivo, valor por defecto, explicación y origen
  (global/app); paquetes; tipo de cambio vigente con origen (`ecb`/`manual`) e histórico; precios
  orientativos con su fuente.
- **Actions**: `?/previsualizarParametros` / `?/guardarParametros` (claves y valores; validación de tipos,
  rangos y coherencia: margen ≥ 1, `min_balance_to_operate` ≥ 0…; muestra anterior → nuevo y alcance);
  `?/crearPaquete`, `?/guardarPaquete` (nombre, precio con IVA, bonificación, activo, orden);
  `?/fijarTipoCambioManual` (`usdEur` decimal español), `?/quitarTipoCambioManual`;
  `?/guardarPrecioOrientativo` (app, operación, valor manual).
- **Eventos**: `apps.settings.updated`, `apps.settings.rejected`, `payments.pack.updated`,
  `pricing.fx.manual_set`, `audit.entry.recorded`.

### W39 · `/admin/apps` — Registro de apps (BE-FR-62, FR-001)

- **`load`**: lista de apps con estado. **Actions**: `?/crearApp` (slug, nombre, descripción, tipos de
  cliente). Errores: `409 SLUG_TAKEN`.

### W40 · `/admin/apps/[slug=appSlug]` — Edición de una app (BE-FR-47, 48, 52, 53, 62, 84; FR-001, FR-091)

Todas las rutas de administración de una app (W40–W43) usan el _param matcher_ `appSlug` en el segmento
`[slug=appSlug]` (I2); un slug que no cumple el formato no llega al `load` (404) y uno válido pero
inexistente responde `error(404)` desde el `load`.

- **`load`**: datos de la app, sobrescrituras con valor efectivo y origen, operaciones (lista), avisos de
  modelos.
- **Actions**: `?/guardarApp` (nombre, descripción, tipos, estado, enlaces, orígenes CORS, email de soporte,
  texto de pasos siguientes `post_verify_text`, esquema de sincronización); `?/previsualizarMantenimiento` /
  `?/guardarMantenimiento` (activo, mensaje); `?/guardarVersiones` (`min`, `recommended`, `enforce`);
  `?/previsualizarSobrescrituras` / `?/guardarSobrescrituras` (límites por app, no mayores que el global;
  aclaración 2026-10-10); `?/crearOperacion` (clave, nombre, tipo, modo).
- **Eventos**: `apps.settings.updated`, `apps.settings.rejected`, `audit.entry.recorded`.

### W41 · `/admin/apps/[slug=appSlug]/operaciones/[key=operationKey]` — Operación (BE-FR-32, 35, 72, 77, 78, 80; FR-050, FR-051)

- **`load`**: configuración completa (modelo, respaldos, proveedor preferido, margen, temperatura,
  `max_output_tokens`, `max_cost_credits`, `estimated_max_cost_usd`, _timeout_, capacidades, límites,
  grupo, escenario de transcripción), modelos compatibles de la caché, versiones de la plantilla,
  `timeoutMs` total calculado.
- **Actions**: `?/guardarOperacion`; `?/activar` (rechaza sin modelo, con modelo incapaz o sin precio ni
  coste máximo estimado); `?/desactivar`; `?/aplicarAlGrupo` (modelo para todas las del grupo);
  `?/guardarPlantilla` (crea una versión nueva inmutable).
- **Eventos**: `apps.operation.activation_rejected`, `apps.template.versioned`, `apps.settings.updated`,
  `audit.entry.recorded`.

### W42 · `/admin/apps/[slug=appSlug]/predeterminados` — Predeterminados (BE-FR-42, 57; FR-067)

- **`load`**: predeterminados vigentes por categoría. **Actions**: `?/guardarPredeterminados` (validados con
  el esquema de sincronización de la app). No modifica ninguna cuenta.
- **Eventos**: `sync.defaults.updated`, `audit.entry.recorded`.

### W43 · `/admin/apps/[slug=appSlug]/predeterminados/copiar` — Copiar mis datos (BE-FR-42 CA3–CA4)

- **`load`**: vista previa del documento sincronizado del propio administrador para esa app, por categorías,
  con una casilla por elemento (ninguna decisión por defecto que favorezca copiar datos personales).
- **Actions**: `?/copiar` — `items` (lista repetida `categoría:clave`) → solo sustituye las categorías con algún
  elemento seleccionado. Errores: `400 NOTHING_SELECTED`.
- **Eventos**: `sync.defaults.copied`, `audit.entry.recorded`.

### W44 · `/admin/protecciones` — Protecciones (BE-FR-43, 46, 47, 53; UX-14; FR-091)

- **`load`**: límites globales (y por app con su origen), estado del freno del día, mantenimiento global.
- **Actions**: `?/previsualizarLimites` / `?/guardarLimites`; `?/previsualizarLiberacionFreno` /
  `?/liberarFreno` (motivo); `?/previsualizarMantenimientoGlobal` / `?/guardarMantenimientoGlobal`.
- **Eventos**: `apps.settings.updated`, `protections.brake.released`, `audit.entry.recorded`.

### W45 · `/admin/estadisticas` — Estadísticas y embudo (BE-FR-54; UX-08; FR-092, FR-093)

- **GET**: `desde`, `hasta`, `app`, `operacion`, `agrupacion` (`dia`\|`app`\|`operacion`\|`usuario`),
  `embudo` (`semanal`\|`acumulado`).
- **`load`**: métricas de BE-FR-54 (coste real USD/EUR, cobrado, margen bruto, pérdidas por deuda absorbida,
  por repeticiones no cobradas y por cancelación —coste del proveedor de operaciones canceladas sin cobro,
  D-05—, saldo perdido por borrado de cuentas —movimientos `forfeit`, D-15—, fallidas, canceladas,
  interrumpidas, truncadas, respaldos, activos, altas por app, compras reales e ingresos) y embudo por app
  (primer login desde la app según `user_app_activity`, D-13); gráficas con tabla equivalente.
- **Estados**: sin datos en el periodo.

### W46 · `/admin/auditoria` — Auditoría (BE-FR-55, FR-094)

- **GET**: `entidad`, `accion`, `desde`, `hasta`, `pagina`. **`load`**: entradas (fecha, acción, entidad,
  anterior → nuevo, motivo). Sin _actions_: no se puede editar ni borrar.

### W47 · `/admin/auditoria/[entryId]` — Entrada de auditoría

- **`load`**: detalle completo de la entrada (destino de los enlaces de UX-13).

### W48 · `/admin/legal` — Documentos legales (BE-FR-70, FR-103)

- **`load`**: documentos y versiones publicadas.
- **Actions**: `?/previsualizarPublicacion` / `?/publicarVersion` (`document`, `version`,
  `requiresReacceptance`, contenido). Una versión que exige aceptación bloquea IA y sincronización hasta
  aceptarla; las informativas se notifican por email y en el panel.
- **Eventos**: `legal.document.published`, `audit.entry.recorded`.

### W49 · `/admin/anuncios` — Anuncios (BE-FR-85, FR-076)

- **`load`**: anuncios. **Actions**: `?/crearAnuncio`, `?/guardarAnuncio` (app o todas, texto, nivel,
  ventana, enlace, rango de versiones), `?/desactivarAnuncio`.
- **Eventos**: `audit.entry.recorded`.

### W50 · `/admin/facturacion` — Facturación y exportación contable (BE-FR-76, FR-048)

- **GET**: formulario `tipo` (`ventas`\|`costes-ia`\|`resumen-mensual`), `desde`, `hasta` que apunta a W51.

### W51 · `GET /admin/facturacion/exportar` — CSV contable (`+server.ts`)

- **Guard**: `requireAdmin`. **Respuesta**: CSV del tipo y periodo; compras simuladas excluidas de los
  ingresos. **Eventos**: `invoicing.export.generated`.

---

## 5. Errores del navegador — `client-errors`

### W52 · `POST /client-errors` (`+server.ts`)

- **Host**: solo `cuenta.`. **Guard**: público, con límite de frecuencia en memoria por sesión o visitante y
  uno global.
- **Entrada** (`z.strictObject`, ≤ 4 KB): `name` (≤ 100), `fingerprint` (hash hexadecimal), `frames`
  (≤ 20 líneas de la pila del propio _bundle_, sin query), `routeId`, `version`, `count` (entero ≥ 1). El
  mensaje del error **no** se envía.
- **Respuesta**: siempre `204`. Superado el límite: `204` sin registrar nada.
- **Eventos**: `client.error.reported` (`warn`).

---

## 6. Resumen

| Grupo            | Rutas        | Con _actions_                | Descargas GET (`+server.ts`) |
| ---------------- | ------------ | ---------------------------- | ---------------------------- |
| `(web)/(public)` | 17 (W01–W17) | W08–W16                      | —                            |
| `(web)/panel`    | 15 (W18–W32) | W18, W20, W26, W27, W29, W30 | W23, W25, W28, W31           |
| `(web)/admin`    | 19 (W33–W51) | W35–W44, W48, W49            | W51                          |
| `client-errors`  | 1 (W52)      | —                            | —                            |
| **Total**        | **52**       |                              | 5                            |

Los _webhooks_ de pagos (`+server.ts` permitido por la constitución) no existen en la v4: el proveedor
`simulated` no los usa y Stripe queda fuera de alcance (BE-FR-29).

## 7. Huecos detectados en `Historias.md` para la web

La «IP aproximada» (D-19) y el contenido versionado de los legales (`legal_documents.content`, D-14) ya están
resueltos. Siguen abiertos:

1. Solo 13 URL están fijadas; verificación, recuperación, confirmación de email y subpáginas del panel y de
   la administración no tienen URL en `Historias.md` (aquí se proponen).
2. No se indica si la verificación inicia sesión: el E2E crítico 1 (15.17) termina «en el panel», lo que lo
   implica; se propone iniciar sesión al verificar.
3. Nombres de las cookies de tema y efectos: los decide el plan (16.12); aquí se proponen `mdm_theme` y
   `mdm_effects`.
