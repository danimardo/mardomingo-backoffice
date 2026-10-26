# Manual de Cuenta Mardomingo: la API, el panel de usuario y la administración

**Para quién es**: para cualquier persona a partir de 14 años, sepa o no programar.

| Parte | De qué trata                                                          | Para quién                             |
| ----- | --------------------------------------------------------------------- | -------------------------------------- |
| **1** | Qué es la API y para qué sirve, sin código                            | Quien decide, compra o quiere entender |
| **2** | Guía práctica de la API con ejemplos                                  | Quien conecta una aplicación           |
| **3** | El panel de la persona usuaria (`/panel`): saldo, compras, datos      | Quien usa las apps y quien da soporte  |
| **4** | El panel de administración (`/admin`): precios, apps, avisos, control | Quien administra la plataforma         |

**Versión del manual**: 1.0, 19 de octubre de 2026. Describe la API `v1` y las pantallas web actuales.

> **Una nota de honestidad antes de empezar.** Hoy la plataforma funciona con un sistema de pago **simulado**: las compras de
> créditos son de prueba y no hay cobros reales con tarjeta todavía. Este manual cuenta cómo funciona todo, pero no promete cobros
> reales que aún no existen. Las cifras exactas (cuántos créditos cuesta algo, límites por minuto, etc.) **no** están aquí: cambian y
> las fija quien administra la plataforma. Las cifras orientativas están siempre en la página `/precios` de la web.

---

# Parte 1 · Entender la API sin saber programar

## 1. ¿Qué es una API?

Imagina que vas a un restaurante. Tú te sientas a la mesa, y en la cocina hay cocineros que saben preparar la comida. Tú no
entras a la cocina: le dices lo que quieres a un **camarero**, el camarero lleva tu pedido, y vuelve con el plato.

Una **API** es ese camarero, pero entre dos programas:

- **Tu aplicación** es el cliente que está en la mesa.
- **La plataforma Cuenta Mardomingo** es la cocina.
- **La API** es el camarero: define cómo hay que pedir las cosas y cómo llegan las respuestas.

La gran ventaja es que tu aplicación no necesita saber cocinar. Solo tiene que saber **pedir bien**.

## 2. ¿Qué es Cuenta Mardomingo?

Es un servicio con dos caras:

1. **Una web** (`cuenta.mardomingo.com`) donde las personas crean su cuenta, compran créditos, miran su saldo y gestionan sus datos.
2. **Una API** (`api.mardomingo.com`) que las aplicaciones usan para trabajar con esa cuenta y con la inteligencia artificial.

La idea central es muy sencilla: **una sola cuenta y un solo saldo que sirven para todas las aplicaciones de Mardomingo.** La
primera aplicación es **Secretario AI**, que ayuda a escribir, corregir y traducir textos y a transcribir audio.

## 3. ¿Qué problemas soluciona?

Piensa en alguien que quiere hacer una aplicación con inteligencia artificial. Tendría que resolver, por su cuenta, todo esto:

| Problema                                                           | Cómo lo soluciona Cuenta Mardomingo                                                                                           |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Conseguir y pagar el acceso a modelos de inteligencia artificial   | La plataforma habla con los proveedores. La app solo hace una petición.                                                       |
| Que cada persona tenga cuenta, contraseña y verificación de email  | La plataforma lo gestiona, con límites contra el abuso y bloqueo ante intentos repetidos.                                     |
| Cobrar a cada persona lo que consume, de forma justa               | Un sistema de **créditos** con reserva previa y cobro del coste real. Si algo falla, no se cobra.                             |
| Que el usuario no tenga una cuenta y un saldo distintos por app    | **Una cuenta y un saldo para todas las apps.**                                                                                |
| Guardar los ajustes del usuario y que le sigan a otro ordenador    | Sincronización de datos entre dispositivos, con protección contra pisarse los cambios.                                        |
| Proteger la privacidad                                             | La plataforma **no guarda el contenido** de tus textos, audios ni imágenes. Solo guarda datos mínimos de uso (ver sección 9). |
| Evitar sustos de gasto                                             | Límites por minuto, tope diario para cuentas sin compras y un «freno de emergencia» global.                                   |
| Avisar a todas las apps de un mantenimiento o de una versión vieja | Una pantalla de estado que cualquier app consulta antes de empezar.                                                           |

## 4. ¿Quién gana qué?

- **La persona que usa las apps** tiene una sola cuenta, un solo saldo, ve cuánto gasta y puede borrar todo cuando quiera.
- **Quien crea una app** no tiene que montar cuentas, cobros, límites ni conexión con la inteligencia artificial: se centra en
  su idea.
- **Quien administra la plataforma** controla precios, límites, apps y avisos desde un panel.

## 5. Las ideas que tienes que conocer

Son pocas. Si las entiendes, entiendes toda la API.

### 5.1 Cuenta, app y sesión

- La **cuenta** es de la persona: su email y su contraseña.
- La **app** es el programa que se conecta (por ejemplo, `secretario`). Se identifica con un nombre corto llamado **slug**.
- La **sesión** es el «ya estás dentro». Cuando una persona inicia sesión desde una app, la API le entrega un **token**: una
  especie de pulsera de festival. Mientras la lleve puesta, no tiene que enseñar su contraseña otra vez. Caduca si pasan 30 días sin
  usarla, y se puede anular cerrando sesión.

Una pulsera es **de una sola app**: la de Secretario no abre la puerta de otra aplicación.

### 5.2 Créditos: el dinero de la plataforma

Los créditos son como las fichas de una feria. Se compran en la web y se gastan al usar la inteligencia artificial. Hay dos clases:

- **Gratuitos**: los de bienvenida o los que concede el administrador. **Caducan.** La plataforma avisa por email unos días antes.
- **De pago**: los que se compran. No caducan.

Al gastar, se usan primero los que antes caducan. Además, el saldo tiene tres números distintos:

| Palabra        | Qué significa                                                 |
| -------------- | ------------------------------------------------------------- |
| **Total**      | Todo lo que tienes.                                           |
| **Reservado**  | Lo que está «apartado» ahora mismo para operaciones en curso. |
| **Disponible** | Lo que puedes usar ahora: total menos reservado.              |

### 5.3 Reserva y cobro justo

Aquí está lo más importante para entender cómo se cobra. Imagina que vas a una gasolinera y dices «ponme lo que quepa, como máximo
50 euros». Primero el gasolinero **aparta** esos 50 de tu tarjeta; luego echa gasolina; y al final **cobra solo lo que echó**.

La API hace lo mismo con cada petición de inteligencia artificial:

1. **Reserva** el máximo que podría costar esa operación.
2. Hace el trabajo.
3. **Cobra el coste real** y libera el resto de la reserva.

Y la regla de oro: **si la operación falla, si el proveedor rechaza el contenido o si cancelas antes de que responda, no se cobra.**

### 5.4 Pequeñas deudas

A veces el coste real supera un poco lo reservado. En ese caso se puede quedar una **pequeña deuda**, con un límite. Mientras haya
deuda no se pueden hacer operaciones nuevas, y al comprar créditos se salda primero.

### 5.5 Repetir sin que se cobre dos veces: la idempotencia

La palabra asusta, pero la idea es de sentido común. Imagina que pulsas «pagar» y se corta el wifi. ¿Has pagado o no? Sin cuidado,
podrías pagar dos veces.

La solución es ponerle a cada petición una **etiqueta única** (una `Idempotency-Key`). Si la repites con la misma etiqueta, la
plataforma lo entiende:

- Si la primera todavía está en marcha → te dice «espera, ya lo estoy haciendo».
- Si la primera ya terminó y te llegó → te dice «esto ya lo hiciste».
- Si la primera terminó pero **la respuesta no llegó a ti** → la repite y **no te la cobra**.

### 5.6 Límites

Para que nadie sature la plataforma, hay topes por minuto, por tamaño y por duración. Cuando se superan, la API no se rompe: te
responde con un mensaje claro y, si procede, te dice cuántos segundos esperar.

### 5.7 Estado de la app

Antes de empezar, una app puede preguntar a la plataforma: «¿hay mantenimiento?», «¿mi versión es demasiado vieja?», «¿hay algún
aviso para mostrar?». Así evita sorpresas y puede explicarle al usuario lo que pasa.

## 6. Todo lo que puede hacer la API

Esta es la lista completa. Son catorce funciones:

| Qué quieres hacer                       | Función                 | Necesita sesión |
| --------------------------------------- | ----------------------- | --------------- |
| Saber cómo está la app (mantenimiento…) | Estado de la app        | No              |
| Entrar con email y contraseña           | Iniciar sesión          | No              |
| Pedir otro email de verificación        | Reenviar verificación   | No              |
| Salir                                   | Cerrar sesión           | Sí              |
| Ver mi saldo y mis datos básicos        | Mi cuenta               | Sí              |
| Aceptar documentos legales nuevos       | Aceptar términos        | Sí              |
| Conversar o transformar texto con IA    | Chat                    | Sí              |
| Convertir un audio en texto             | Transcripción           | Sí              |
| Crear una imagen a partir de una idea   | Imagen                  | Sí              |
| Leer mis ajustes guardados              | Leer sincronización     | Sí              |
| Guardar mis ajustes                     | Escribir sincronización | Sí              |
| Recuperar los valores originales        | Valores por defecto     | Sí              |
| Saber si la plataforma está viva        | Salud                   | No              |
| Obtener la descripción técnica completa | Documento OpenAPI       | Sí              |

## 7. Un día en la vida de una app

Así encaja todo. Imagina a Lucía, que usa Secretario AI:

1. **Lucía abre la app.** La app pregunta el **estado**: no hay mantenimiento y su versión es correcta.
2. **Lucía inicia sesión.** La app envía su email y contraseña; la plataforma devuelve su **token**.
3. **La app pide su saldo** y se lo enseña.
4. **Lucía dicta una nota de voz.** La app envía el audio y lo recibe convertido en texto. Se reserva, se hace y se cobra lo justo.
5. **Lucía pide corregir el texto** con el chat de IA. Su conexión se corta a mitad; al reintentar, la etiqueta única evita
   cobrarle dos veces.
6. **Lucía guarda sus preferencias.** Al abrir la app en otro ordenador, ahí están.
7. **Lucía cierra sesión.** La pulsera deja de valer.

## 8. Cuando algo sale mal

La API nunca responde con un silencio ni con un error incomprensible. Siempre dice **qué pasó** con un código y un texto en
español. Algunos ejemplos de lo que puede pasar:

- «No tienes saldo suficiente» → hay que comprar créditos.
- «Has superado el límite por minuto» → espera unos segundos.
- «La aplicación está en mantenimiento» → vuelve más tarde (el mensaje lo escribe el administrador).
- «Tu versión es demasiado antigua» → hay que actualizar la app.
- «Hay documentos legales pendientes» → la persona debe aceptarlos.

La lista completa con sus soluciones está en la sección 17.

## 9. Privacidad: qué guarda y qué no

Esto es importante y se explica sin letra pequeña:

- **No se guarda el contenido.** Lo que escribes, el audio que envías o la imagen que pides se usan para dar la respuesta y no se
  almacenan. Tampoco se escriben en los registros del sistema.
- **Sí se guardan datos mínimos de uso**: qué operación se hizo, cuándo, cuánto costó y cuántos créditos se cobraron. Sirven para
  cobrar bien y para que la persona vea su consumo.
- **Los datos sincronizados** (como tus ajustes) se guardan mientras exista la cuenta.
- **La persona manda.** Puede descargar sus datos y puede borrar su cuenta desde la web. Al borrarla, desaparecen sus datos
  personales, y el saldo que quede se pierde.
- **Cuentas olvidadas.** Una cuenta que no se ha verificado se borra a la semana, y una cuenta que nunca ha comprado y lleva años
  sin usarse se avisa por email antes de borrarse. Nunca se borra una cuenta que haya hecho una compra real.
- **El modelo y el proveedor de IA no se revelan** en las respuestas: la app recibe resultados, no datos internos.

## 10. Lo que la API no hace

Para no crear falsas expectativas:

- **No guarda tus conversaciones** ni tus archivos.
- **No emite respuestas en streaming** (palabra a palabra): la respuesta llega entera cuando está lista.
- **No es una pasarela de pagos real todavía**: hoy los pagos son simulados.
- **No usa cookies**: solo entiende el token que le envías.
- **No mezcla apps**: una pulsera de una app no sirve en otra.

---

# Parte 2 · Guía práctica para conectar una app

> Para esta parte conviene saber qué es una petición HTTP y qué es JSON. Si no lo sabes, aquí va el resumen:
> **HTTP** es el idioma con el que los programas se piden cosas por internet, y **JSON** es una forma de escribir datos en texto
> (`{"nombre": "Lucía", "edad": 15}`).

## 11. Antes de empezar

### Lo que necesitas

1. Que **el administrador registre tu app** y te dé su **slug** (por ejemplo, `secretario`) y las operaciones que tiene activas.
2. Si tu app es una **web en un navegador**: que tu dirección figure entre los **orígenes permitidos** de tu app (se llama CORS).
   Las apps de escritorio y móviles no necesitan esto.
3. Una cuenta de prueba **verificada** (con el enlace que llega por email).

### Dónde está la API

| Entorno    | Dirección base                              |
| ---------- | ------------------------------------------- |
| Producción | `https://api.mardomingo.com/api/v1`         |
| Pruebas    | `https://api-staging.mardomingo.com/api/v1` |

El «versionado» va en la dirección (`/v1`): si algún día cambia algo de forma incompatible, existirá una `/v2` y la `/v1`
seguirá funcionando durante un tiempo.

### Las cabeceras

Las **cabeceras** son pequeños datos que acompañan a cada petición, como el remite de una carta.

| Cabecera          | Para qué sirve                                                                            | Cuándo                                              |
| ----------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `X-App-Id`        | Dice qué app eres (el slug). **Identifica, pero no autentica.**                           | Siempre, salvo en Salud                             |
| `X-App-Version`   | Tu versión, como `1.2.0`. Permite avisarte de que está obsoleta y filtrar anuncios.       | Siempre que puedas (obligatoria si lo exige la app) |
| `X-Device-Name`   | Nombre del equipo (por ejemplo, «Portátil de Lucía»). Se muestra en su lista de sesiones. | En escritorio y móvil, al iniciar sesión            |
| `Authorization`   | `Bearer` y el token, para demostrar que ya iniciaste sesión.                              | En las funciones que piden sesión                   |
| `Idempotency-Key` | La etiqueta única para no cobrar dos veces (un UUID).                                     | Muy recomendada en IA                               |
| `If-Match`        | La revisión que crees que tiene el documento, para no pisar cambios.                      | Al escribir la sincronización                       |
| `Content-Type`    | `application/json`, salvo en transcripción (`multipart/form-data`).                       | Cuando envías un cuerpo                             |

### Cómo se escriben los importes

Los créditos viajan como **números enteros llamados microcréditos**, nunca como decimales. Un crédito son un millón de
microcréditos. Los campos terminan en `Micro`.

¿Por qué? Porque los ordenadores se confunden con los decimales (`0,1 + 0,2` no da exactamente `0,3`) y con dinero eso es
inaceptable. Con enteros no hay errores.

Para **mostrarlos**, tu app los divide entre un millón y los redondea así: de 10 créditos en adelante, sin decimales; entre 0,1 y
10, con un decimal; y si es menos de 0,1, se escribe «< 0,1». Por ejemplo, `776480` microcréditos se muestra como **0,8**.

### Las fechas

Siempre en formato internacional UTC: `2026-11-05T00:00:00Z`.

## 12. Primeros pasos con `curl`

`curl` es un programa que viene en la mayoría de ordenadores y permite lanzar peticiones desde la terminal. Los ejemplos de este
manual lo usan, y después verás el equivalente en JavaScript.

### Paso 1 · Comprobar que la API responde

```bash
curl https://api.mardomingo.com/api/v1/health
```

Respuesta:

```json
{ "status": "ok" }
```

### Paso 2 · Preguntar por el estado de tu app

```bash
curl https://api.mardomingo.com/api/v1/app/status \
  -H "X-App-Id: secretario" \
  -H "X-App-Version: 1.0.0"
```

La respuesta incluye, entre otras cosas, si hay mantenimiento, la versión mínima y la recomendada, los enlaces útiles de la web
(registro, precios, recuperar contraseña…), el email de soporte y los anuncios activos.

### Paso 3 · Iniciar sesión

```bash
curl -X POST https://api.mardomingo.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-App-Id: secretario" \
  -H "X-App-Version: 1.0.0" \
  -H "X-Device-Name: Portatil de Lucia" \
  -d '{"email": "lucia@ejemplo.es", "password": "mi-contraseña-segura"}'
```

Respuesta correcta:

```json
{
	"token": "abc123...",
	"expiresAt": "2026-11-18T10:00:00Z",
	"user": { "email": "lucia@ejemplo.es", "roles": ["user"] },
	"pendingAcceptances": []
}
```

**Guarda el token en un sitio seguro.** Es tan valioso como la contraseña mientras dure.

### Paso 4 · Ver el saldo

```bash
curl https://api.mardomingo.com/api/v1/me \
  -H "X-App-Id: secretario" \
  -H "X-App-Version: 1.0.0" \
  -H "Authorization: Bearer abc123..."
```

### Paso 5 · Pedir algo a la inteligencia artificial

```bash
curl -X POST https://api.mardomingo.com/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "X-App-Id: secretario" \
  -H "X-App-Version: 1.0.0" \
  -H "Authorization: Bearer abc123..." \
  -H "Idempotency-Key: 3f2b8c1e-9a4d-4e6b-8f10-2c7d5a9e1b34" \
  -d '{"operation": "fix", "messages": [{"role": "user", "content": "ola, como estas?"}]}'
```

Y ya está: has conectado una app.

## 13. El mismo recorrido en JavaScript

```js
const API = 'https://api.mardomingo.com/api/v1';
const APP = { 'X-App-Id': 'secretario', 'X-App-Version': '1.0.0' };

// Pequeña función que hace todas las peticiones y entiende los errores.
async function pedir(ruta, { token, metodo = 'GET', cuerpo, extra = {} } = {}) {
	const respuesta = await fetch(API + ruta, {
		method: metodo,
		headers: {
			...APP,
			...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...extra
		},
		body: cuerpo ? JSON.stringify(cuerpo) : undefined
	});
	if (respuesta.status === 204) return null;
	const datos = await respuesta.json();
	if (!respuesta.ok) {
		// Todos los errores de la API tienen la misma forma: { error: { code, message, details } }.
		const { code, message, details } = datos.error;
		throw Object.assign(new Error(message), { code, details, estado: respuesta.status });
	}
	return datos;
}

// 1. Iniciar sesión.
const sesion = await pedir('/auth/login', {
	metodo: 'POST',
	cuerpo: { email: 'lucia@ejemplo.es', password: 'mi-contraseña-segura' },
	extra: { 'X-Device-Name': 'Portatil de Lucia' }
});

// 2. Ver el saldo.
const yo = await pedir('/me', { token: sesion.token });
console.log('Disponible (microcréditos):', yo.balance.availableMicro);

// 3. Usar la IA con etiqueta única, para poder reintentar sin que se cobre dos veces.
const clave = crypto.randomUUID();
const resultado = await pedir('/ai/chat', {
	token: sesion.token,
	metodo: 'POST',
	cuerpo: { operation: 'fix', messages: [{ role: 'user', content: 'ola, como estas?' }] },
	extra: { 'Idempotency-Key': clave }
});
console.log(resultado.text, 'Cobrado:', resultado.chargedMicro);
```

## 14. Las funciones, una a una

Cada función se explica igual: **para qué sirve**, **qué problema resuelve**, **qué envías**, **qué recibes** y **qué puede salir mal**.

### 14.1 Estado de la app · `GET /app/status`

- **Para qué sirve**: preguntar cómo está la app antes de usarla.
- **Qué problema resuelve**: evita que el usuario se encuentre un error sin explicación cuando hay mantenimiento, cuando su versión
  es demasiado antigua o cuando hay un aviso importante.
- **Qué envías**: solo `X-App-Id` (y `X-App-Version` si quieres que los anuncios se filtren por versión). No hace falta sesión.
- **Qué recibes**: el nombre de la app, la versión mínima y la recomendada, si hay mantenimiento y su mensaje, el límite de
  duración del audio, el tiempo máximo de cada operación, los enlaces de la web, el email de soporte y los anuncios activos (con
  nivel `info`, `warning` o `critical`).
- **Cuándo usarlo**: al abrir la app, y de vez en cuando mientras está abierta.
- **Ojo**: esta función **nunca** devuelve errores de mantenimiento ni de versión: precisamente es la forma de conocerlos.

### 14.2 Iniciar sesión · `POST /auth/login`

- **Para qué sirve**: entrar con email y contraseña y conseguir el token.
- **Qué problema resuelve**: la app nunca guarda la contraseña después del primer momento, solo el token.
- **Qué envías**: `email` y `password`, más las cabeceras de la app. Si pasas `X-Device-Name`, el equipo aparecerá en la lista de
  sesiones del usuario.
- **Qué recibes**: `token`, `expiresAt`, el `user` (email y roles) y `pendingAcceptances` (documentos legales que debe aceptar).
- **Qué puede salir mal**:
  - `INVALID_CREDENTIALS`: email o contraseña incorrectos. **Nunca dice cuál de los dos**, para no ayudar a quien intente adivinar.
  - `EMAIL_NOT_VERIFIED`: la persona no ha pulsado el enlace del email. Puedes ofrecerle reenviarlo.
  - `ACCOUNT_BLOCKED`: la cuenta está bloqueada.
  - `LOGIN_TEMPORARILY_LOCKED`: demasiados intentos fallidos con ese email. Hay que esperar (`Retry-After` dice cuántos segundos).
  - `RATE_LIMITED`: demasiados intentos desde la misma conexión.
- **Seguridad**: la plataforma cuenta los fallos **exista o no** la cuenta, y así no se puede averiguar qué emails están registrados.
- **Detalle útil**: puede iniciar sesión con mantenimiento activo y con documentos pendientes.

### 14.3 Reenviar la verificación · `POST /auth/resend-verification`

- **Para qué sirve**: volver a enviar el email para confirmar la cuenta.
- **Qué problema resuelve**: el email se pierde, caduca o cae en la carpeta de spam.
- **Qué envías**: `{ "email": "..." }`.
- **Qué recibes**: siempre `202`, sin cuerpo. **Aunque el email no exista.** Es a propósito: así nadie puede usar esta función para
  descubrir quién tiene cuenta.
- **Qué puede salir mal**: solo un límite por conexión (`RATE_LIMITED`).

### 14.4 Cerrar sesión · `POST /auth/logout`

- **Para qué sirve**: invalidar el token.
- **Qué problema resuelve**: en un ordenador compartido, nadie podrá usar la cuenta después.
- **Qué envías**: nada en el cuerpo, solo el token en `Authorization`.
- **Qué recibes**: `204`, sin contenido. El efecto es inmediato.
- **Ojo**: siempre se puede cerrar sesión, aunque la versión de la app sea demasiado antigua.

### 14.5 Mi cuenta · `GET /me`

- **Para qué sirve**: saber quién es el usuario y cuánto saldo tiene.
- **Qué problema resuelve**: la app puede mostrar el saldo y avisar antes de que se agote.
- **Qué recibes**:
  - `email` y `roles`.
  - `balance`, con `totalMicro`, `reservedMicro`, `availableMicro`, `freeMicro`, `paidMicro`, `debtMicro` y `nextFreeExpiry` (qué
    parte gratuita caduca antes y cuándo).
  - `lowBalanceThresholdMicro`: el umbral con el que la persona quiere que se le avise de saldo bajo (o `null` si lo desactivó).
  - `hasRealPurchase`: si alguna vez ha hecho una compra real.
  - `pendingAcceptances`: documentos pendientes.
- **Funciona** aunque haya mantenimiento o documentos pendientes.

### 14.6 Aceptar documentos legales · `POST /me/accept-terms`

- **Para qué sirve**: registrar que la persona acepta una versión nueva de términos, privacidad, cookies o uso aceptable.
- **Qué problema resuelve**: si se publica una versión que exige aceptación nueva, las funciones de IA y de sincronización se
  bloquean hasta que la persona acepte. Esta función es el desbloqueo.
- **Qué envías**: `{ "documents": [ { "document": "terms", "version": "2026-10-11" } ] }`. Las versiones se leen de
  `pendingAcceptances`.
- **Qué recibes**: `204`.
- **Qué puede salir mal**: `VALIDATION_ERROR` si la versión ya no es la vigente (entonces hay que volver a leer los documentos).
- **Buena práctica**: muestra siempre al usuario los **enlaces** a los documentos antes de que acepte. Nunca los aceptes por él.

### 14.7 Chat con IA · `POST /ai/chat`

- **Para qué sirve**: pedirle a la inteligencia artificial que escriba, corrija, traduzca, resuma o responda.
- **Qué problema resuelve**: tu app no necesita saber qué modelo usar ni cómo pagarlo. Pide una **operación** y la plataforma se
  encarga.
- **Operaciones**: una operación es una «receta» preparada por el administrador (por ejemplo, `fix` corrige, `translate`
  traduce). Tu app solo dice el nombre. Hay dos tipos:
  - **Libres**: tú envías los mensajes (`messages`) tal cual.
  - **Con plantilla**: el administrador escribió la receta con huecos, y tú solo rellenas las `variables`. Es más seguro porque el
    texto de la receta no sale de la plataforma.
- **Qué envías**:

```json
{
	"operation": "fix",
	"messages": [{ "role": "user", "content": "ola, como estas?" }]
}
```

- Con plantilla:

```json
{ "operation": "translate", "variables": { "text": "Buenos días", "language": "inglés" } }
```

- Opciones avanzadas (solo si la operación las permite): `response_format` para pedir la respuesta en un formato JSON concreto y
  `tools`/`tool_choice` para que la IA pueda pedir ejecutar funciones de tu app.
- **Qué recibes**:

```json
{
	"text": "Hola, ¿cómo estás?",
	"json": null,
	"structuredValid": null,
	"toolCalls": null,
	"truncated": false,
	"operationId": "aio_...",
	"chargedMicro": 776480,
	"balance": {
		"totalMicro": 999223520,
		"reservedMicro": 0,
		"availableMicro": 999223520,
		"debtMicro": 0
	}
}
```

- `truncated: true` significa que la respuesta se cortó por llegar al máximo de longitud. Se cobra lo generado.
- `structuredValid: false` significa que pediste JSON y la IA no devolvió uno válido. **Se cobra igualmente**, porque el trabajo se hizo.
- **Qué puede salir mal**: `VALIDATION_ERROR` (operación desconocida o datos mal formados), `PAYLOAD_TOO_LARGE` (texto demasiado
  largo), `OPERATION_TOO_EXPENSIVE` (su coste máximo estimado supera el tope de la operación), `INSUFFICIENT_BALANCE`,
  `DAILY_FREE_LIMIT_REACHED`, `RATE_LIMITED`, `PROVIDER_ERROR` (el proveedor falló: no se cobra), `PROVIDER_TIMEOUT` (tardó
  demasiado: no se cobra) y los comunes (mantenimiento, versión, documentos…).
- **Importante**: envía siempre una `Idempotency-Key` distinta por cada acción del usuario.

### 14.8 Transcripción de audio · `POST /ai/transcribe`

- **Para qué sirve**: convertir un audio en texto.
- **Qué problema resuelve**: dictar en vez de escribir, o pasar a texto una reunión grabada.
- **Qué envías**: es la única función que no usa JSON, sino un formulario con un archivo (`multipart/form-data`):
  - `operation`: la clave de la operación de transcripción.
  - `file`: el audio (WebM/Opus).

```bash
curl -X POST https://api.mardomingo.com/api/v1/ai/transcribe \
  -H "X-App-Id: secretario" \
  -H "X-App-Version: 1.0.0" \
  -H "Authorization: Bearer abc123..." \
  -H "Idempotency-Key: 6c1f0d52-2e8a-4b91-9a47-5d3e8c2b7f10" \
  -F "operation=transcription" \
  -F "file=@nota-de-voz.webm"
```

- **Qué recibes**: `text` (lo dicho), `providerUsed` (`primary` o `backup`, según qué servicio acabó haciendo el trabajo; nunca el
  nombre del modelo), `audioSeconds` (la duración medida), `operationId`, `chargedMicro` y `balance`.
- **Cómo funciona por dentro (explicado sencillo)**: hay un servicio principal de transcripción. Si falla, se reintenta varias
  veces y, si sigue sin funcionar, la plataforma usa un servicio de respaldo. Tu app no tiene que hacer nada: solo recibe el texto.
- **La duración la mide el servidor.** Aunque tu app diga que el audio dura cinco segundos, la plataforma lo comprueba por su
  cuenta. Así nadie paga ni cobra por una duración falsa.
- **Qué puede salir mal**: `AUDIO_TOO_LONG` (supera el máximo, que se puede leer en `limits.maxAudioSeconds` del estado de la
  app), `PAYLOAD_TOO_LARGE` (el archivo pesa demasiado), `VALIDATION_ERROR` (el audio no se puede leer),
  `TRANSCRIPTION_FAILED` (fallaron el principal y el respaldo: no se cobra) y los demás comunes de IA.
- **Límite de simultáneas**: hay un máximo de transcripciones a la vez por persona; si lo superas recibes `RATE_LIMITED`.
- **Privacidad**: el audio no se guarda. Se procesa y se borra, incluso si hay un error o cancelas.

### 14.9 Imagen · `POST /ai/image`

- **Para qué sirve**: crear una imagen a partir de una descripción.
- **Qué envías**: `{ "operation": "image-generation", "prompt": "un gato astronauta" }`, o `variables` si la operación tiene
  plantilla.
- **Qué recibes**: `imageDataUrl` (la imagen incrustada en el propio texto, lista para mostrar), `operationId`, `chargedMicro` y
  `balance`.
- **Privacidad**: la imagen no se guarda en la plataforma. Si no la guardas tú, se pierde.

### 14.10 Leer la sincronización · `GET /sync`

- **Para qué sirve**: recuperar los ajustes y datos que la persona guardó.
- **Qué problema resuelve**: la persona abre la app en un ordenador nuevo y encuentra sus preferencias, sus textos rápidos y sus
  reemplazos como los dejó.
- **Cómo es el documento**: cada app declara sus **categorías**, y cada categoría tiene una **estrategia** que dice cómo se
  combina:
  - `items`: una lista de elementos con clave, donde los borrados dejan una «marca de borrado».
  - `block`: un bloque entero que se guarda como un todo, con su fecha de modificación.
  - `keyed`: un conjunto de valores con nombre, cada uno con su fecha.
- **Qué recibes**: `{ "revision": 3, "data": { ... } }`. La **revisión** es un número que sube cada vez que se guarda.
- **La primera vez**: se crea con los valores por defecto de la app, con la revisión 1.

### 14.11 Escribir la sincronización · `PUT /sync`

- **Para qué sirve**: guardar el documento completo.
- **Qué problema resuelve**: si la persona usa dos ordenadores a la vez, **ninguno pisa los cambios del otro sin enterarse**.
  Funciona como un candado de versión: tú dices «guardo encima de la revisión 3»; si alguien ya la cambió, la plataforma te
  avisa en vez de sobrescribir.
- **Qué envías**: la cabecera `If-Match: 3` (la revisión que leíste) y el cuerpo `{ "data": { ... } }` con el documento entero.
- **Qué recibes**: `{ "revision": 4 }`.
- **Qué puede salir mal**:
  - `SYNC_CONFLICT` (412): alguien guardó antes. **No es un fallo grave**: vuelve a leer con `GET /sync`, **combina** los cambios y
    guarda otra vez. La combinación la hace tu app.
  - `VALIDATION_ERROR`: el documento tiene categorías que la app no declaró o mal formadas.
  - `PAYLOAD_TOO_LARGE`: el documento es demasiado grande.
- **Dos guardados a la vez** con la misma revisión: uno funciona y el otro recibe el conflicto. Nunca se pierde una escritura.

### 14.12 Valores por defecto · `GET /defaults`

- **Para qué sirve**: obtener los valores originales de la app.
- **Qué problema resuelve**: el botón «Restaurar valores predeterminados» y el punto de partida de cada cuenta nueva.
- **Qué recibes**: `{ "data": { ... } }`, con la misma forma que la sincronización pero sin revisión.
- **Detalle útil**: sigue funcionando aunque haya mantenimiento o documentos pendientes.

### 14.13 Salud · `GET /health`

- **Para qué sirve**: saber si la plataforma está viva (lo usan las herramientas de supervisión).
- **Qué recibes**: `{ "status": "ok" }`, o un `503` con `{ "status": "unavailable" }` si la base de datos no responde.
- **No necesita** `X-App-Id` ni sesión.

### 14.14 Documento OpenAPI · `GET /openapi.json`

- **Para qué sirve**: una descripción técnica y completa de la API, en un formato estándar (OpenAPI 3.1).
- **Qué problema resuelve**: otros programas pueden leerla para generar automáticamente código de conexión o documentación. Es la
  fuente más precisa si este manual y la API alguna vez no coincidieran.
- **No es público**: necesita `X-App-Id` y haber iniciado sesión (el token de la cabecera `Authorization`). Sin sesión responde
  `UNAUTHENTICATED`. Así la descripción técnica de la plataforma solo la ve quien ya tiene acceso.
- **Qué recibes**: el documento completo en JSON (OpenAPI 3.1). No se bloquea por versión antigua ni por mantenimiento.

## 15. Buenas prácticas

1. **Consulta el estado al abrir** y, con la versión mínima, ofrece actualizar antes de que falle algo.
2. **Usa una `Idempotency-Key` nueva por acción**, y **la misma** si reintentas esa acción.
3. **Muestra el saldo** y avisa antes de que se agote; compra créditos en `links.buyCredits`.
4. **No guardes la contraseña**; guarda solo el token, en un lugar seguro del sistema.
5. **Respeta `Retry-After`**: si te pide esperar 20 segundos, espera.
6. **Si el token da `UNAUTHENTICATED`, vuelve a pedir inicio de sesión.** Puede haber caducado o haberse cerrado desde la web.
7. **No muestres errores técnicos al usuario**: el campo `message` ya viene en español y apto para mostrar.
8. **Anota el `X-Request-Id`** de la respuesta cuando haya un problema: es el «código de referencia» que soporte necesita.
9. **No reintentes sin parar.** Si algo falla varias veces, para y avisa.
10. **Nunca incluyas datos personales** de otras personas en lo que envías sin su permiso.

## 16. Si tu app es una web en un navegador (CORS)

Los navegadores son más estrictos. Antes de dejar que una página hable con la API, el navegador pregunta si esa página tiene
permiso. Por eso:

- El administrador debe registrar la dirección exacta de tu web (por ejemplo, `https://miapp.ejemplo.com`) como **origen
  permitido** de tu app.
- Si tu dirección no está en la lista, recibirás `ORIGIN_NOT_ALLOWED`.
- La API nunca permite «cualquier origen»: cada app solo habla desde sus direcciones.
- Las apps de escritorio y móviles no envían ese dato y no necesitan este paso.

## 17. Guía de errores

Todos los errores tienen la misma forma:

```json
{
	"error": {
		"code": "INSUFFICIENT_BALANCE",
		"message": "Texto en español apto para mostrar",
		"details": { "requiredMicro": 50000000, "availableMicro": 12000000 }
	}
}
```

### Errores de la petición (400)

| Código             | Qué significa                                          | Qué hacer                                               |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| `VALIDATION_ERROR` | Algo está mal formado; `details.field` dice qué campo. | Corrige ese campo. Revisa también que no sobren campos. |
| `UNKNOWN_APP`      | Falta `X-App-Id` o no es una app conocida.             | Revisa el slug de tu app.                               |

### Errores de acceso (401, 403)

| Código                      | Qué significa                                      | Qué hacer                                       |
| --------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `UNAUTHENTICATED`           | No hay token, caducó, se cerró o es de otra app.   | Pide al usuario que inicie sesión.              |
| `INVALID_CREDENTIALS`       | Email o contraseña incorrectos.                    | Dile que lo revise.                             |
| `EMAIL_NOT_VERIFIED`        | La cuenta no se ha verificado.                     | Ofrece reenviar el email de verificación.       |
| `ACCOUNT_BLOCKED`           | La cuenta está bloqueada.                          | Remite a soporte.                               |
| `TERMS_ACCEPTANCE_REQUIRED` | Hay documentos legales pendientes de aceptar.      | Muestra los enlaces y llama a aceptar términos. |
| `ORIGIN_NOT_ALLOWED`        | Tu web no está en la lista de orígenes permitidos. | Pide al administrador que la añada.             |

### Errores de dinero (402)

| Código                     | Qué significa                                                       | Qué hacer                                               |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| `INSUFFICIENT_BALANCE`     | No hay saldo suficiente para reservar el coste máximo, o hay deuda. | Ofrece comprar créditos. `details` indica lo que falta. |
| `DAILY_FREE_LIMIT_REACHED` | Una cuenta sin compras ha llegado al tope de gasto de hoy.          | Vuelve mañana o compra créditos.                        |

### Errores de tamaño (413)

| Código                    | Qué significa                                            | Qué hacer              |
| ------------------------- | -------------------------------------------------------- | ---------------------- |
| `PAYLOAD_TOO_LARGE`       | Texto, imagen, audio o documento demasiado grande.       | Reduce el tamaño.      |
| `AUDIO_TOO_LONG`          | El audio dura más del máximo (`details.maxSeconds`).     | Divídelo en trozos.    |
| `OPERATION_TOO_EXPENSIVE` | El coste máximo estimado supera el tope de la operación. | Envía menos contenido. |

### Errores de repetición y concurrencia (409, 412)

| Código                | Qué significa                                                        | Qué hacer                                                           |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `REQUEST_IN_PROGRESS` | Esa misma acción (misma `Idempotency-Key`) todavía se está haciendo. | Espera unos segundos.                                               |
| `DUPLICATE_REQUEST`   | Esa acción ya se completó y se entregó.                              | No repitas; usa el resultado que ya tienes (`details.operationId`). |
| `SYNC_CONFLICT`       | Otro dispositivo guardó antes.                                       | Lee, combina y vuelve a guardar.                                    |

### Errores de versión y límites (426, 429)

| Código                     | Qué significa                               | Qué hacer                                      |
| -------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `UPGRADE_REQUIRED`         | La versión de la app es demasiado antigua.  | Pide actualizar; consulta el estado de la app. |
| `RATE_LIMITED`             | Demasiadas peticiones seguidas.             | Espera lo que indique `Retry-After`.           |
| `LOGIN_TEMPORARILY_LOCKED` | Demasiados intentos fallidos con ese email. | Espera lo que indique `Retry-After`.           |

### Errores del proveedor y del servicio (500–504)

| Código                 | Qué significa                                                                       | Qué hacer                                                 |
| ---------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `PROVIDER_ERROR`       | El servicio de IA ha fallado o ha rechazado el contenido. **No se cobra.**          | Reintenta más tarde.                                      |
| `PROVIDER_TIMEOUT`     | El servicio de IA ha tardado demasiado. **No se cobra.**                            | Reintenta.                                                |
| `TRANSCRIPTION_FAILED` | Han fallado la transcripción principal y la de respaldo. **No se cobra.**           | Reintenta más tarde.                                      |
| `MAINTENANCE`          | La app o la plataforma están en mantenimiento. El `message` lo escribe una persona. | Muestra el mensaje y vuelve más tarde.                    |
| `SERVICE_LIMITED`      | La plataforma limita temporalmente a las cuentas sin compras (freno de gasto).      | Espera al día siguiente o compra créditos.                |
| `APP_DISABLED`         | La app está desactivada.                                                            | Remite a soporte.                                         |
| `INTERNAL_ERROR`       | Fallo inesperado de la plataforma.                                                  | Reintenta y, si persiste, da el `X-Request-Id` a soporte. |

## 18. Preguntas frecuentes

**¿Cuántos créditos me regalan al empezar?** Una cuenta nueva recibe un saldo de bienvenida. La cantidad la fija la
administración y puede cambiar. Los créditos de bienvenida caducan.

**¿Por qué me cobran ahora menos de lo que reservó?** Porque primero se aparta el máximo posible y después se cobra solo el coste
real. Lo que sobra vuelve al saldo disponible.

**Mi conexión se cortó a mitad de una petición. ¿Me han cobrado?** Si se cortó antes de que el servicio de IA respondiera, no. Si
ya había respondido, se cobra, pero reintentar con la **misma** `Idempotency-Key` no se cobra otra vez.

**¿Puedo usar el mismo token en varias apps?** No. Cada token pertenece a la app desde la que se inició sesión.

**¿Cuántas sesiones puede tener una persona?** No hay límite. Puede ver y cerrar cada una desde la web.

**¿Puedo ver qué modelo de IA se usó?** No: la API no revela ni modelos ni proveedores. Ese dato interno no forma parte de las
respuestas.

**¿Se guarda lo que escribo?** No. Ni textos, ni audios, ni imágenes. Solo datos de uso mínimos.

**¿Cómo se cuánto cuesta cada cosa?** En la página `/precios` de la web hay costes orientativos por operación y ejemplos. Son
orientativos: el cobro real depende del tamaño del texto o del audio.

**Algo no funciona y no sé por qué.** Mira el `code` del error en la sección 17 y apunta el `X-Request-Id` para soporte.

## 19. Glosario

| Palabra            | Significado sencillo                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| **API**            | El «camarero» que permite que dos programas se pidan cosas siguiendo unas reglas.                   |
| **App**            | El programa que se conecta a la plataforma (por ejemplo, Secretario AI).                            |
| **Slug**           | El nombre corto de una app, en minúsculas y sin espacios (`secretario`).                            |
| **Token**          | La «pulsera» que demuestra que ya iniciaste sesión.                                                 |
| **Bearer**         | La forma de enviar el token en la cabecera `Authorization`.                                         |
| **Cabecera**       | Un dato pequeño que acompaña a una petición, como el remite de una carta.                           |
| **Endpoint**       | Cada «puerta» de la API; una dirección que hace una cosa concreta.                                  |
| **JSON**           | Una forma de escribir datos en texto, con llaves y comillas.                                        |
| **HTTP**           | El idioma con el que los programas se piden cosas por internet.                                     |
| **Crédito**        | La «ficha» que se gasta al usar la IA. Un crédito son un millón de microcréditos.                   |
| **Microcrédito**   | La unidad mínima, siempre un número entero, para no cometer errores con decimales.                  |
| **Reserva**        | Apartar el coste máximo antes de hacer una operación.                                               |
| **Idempotencia**   | Poder repetir una petición sin que se haga ni se cobre dos veces.                                   |
| **Operación**      | Una «receta» de IA preparada por el administrador (corregir, traducir, transcribir…).               |
| **Plantilla**      | Una operación con huecos (`variables`) que tu app rellena.                                          |
| **Sincronización** | Guardar los datos del usuario para que le acompañen a otros dispositivos.                           |
| **Revisión**       | Un número que sube con cada guardado y evita pisar cambios ajenos.                                  |
| **CORS**           | La norma de los navegadores que solo deja a una web hablar con la API si ella lo permite.           |
| **Rate limit**     | El tope de peticiones por minuto.                                                                   |
| **Mantenimiento**  | Un periodo en que la IA y la sincronización se pausan, pero se puede entrar y consultar el saldo.   |
| **Freno global**   | Un «botón de emergencia» que limita a las cuentas sin compras si el gasto total del día se dispara. |
| **OpenAPI**        | Un formato estándar para describir una API de forma que las máquinas puedan leerla.                 |

---

# Parte 3 · El panel de la persona usuaria (`/panel`)

Hasta aquí hemos hablado de la API, que es lo que usan los **programas**. Pero las **personas** también necesitan un sitio donde
mirar su dinero, comprar créditos y mandar sobre sus datos. Ese sitio es el **panel**, dentro de la web
`cuenta.mardomingo.com`. Es la «recepción» de la plataforma: aquí no se programa nada, se gestiona la cuenta.

> **Nota**: el panel usa la **misma cuenta y el mismo saldo** que la API. Lo que una persona compra aquí es lo que gasta su app
> allí.

## 20. Cómo se entra y qué se ve

1. La persona se **registra** en `/registro`: email, contraseña, aceptar los documentos legales (términos, privacidad y uso
   aceptable) y declarar que tiene la edad mínima. Un sistema anti-robots (Turnstile) comprueba que es una persona.
2. Le llega un **email de verificación**. Hasta que pulse el enlace, la cuenta no está activa. Si no lo confirma en una semana, la
   cuenta se borra sola.
3. Al verificar, recibe su **saldo de bienvenida** (créditos gratuitos que caducan) y ve la página de **bienvenida**, que le explica
   los siguientes pasos: descargar la app, iniciar sesión con el mismo email.
4. Entra al panel (`/panel`) con su email y contraseña. Si se le olvida la contraseña, puede pedir un enlace de recuperación.

**Seguridad que no se ve, pero está:** tras varios intentos fallidos con una contraseña, el acceso se bloquea unos minutos (exista o
no la cuenta, para que nadie pueda averiguar quién está registrado), y hay límites de registros por conexión.

## 21. Resumen · `/panel`

La portada del panel. Muestra:

- **El saldo**, con sus tres números: **total**, **reservado** (apartado para operaciones en curso) y **disponible**, además de su
  equivalente aproximado en euros. Si hay **deuda**, también la enseña.
- **Las «bolsas»**: cada paquete de créditos por separado, con su tipo (gratuito o de pago), cuánto queda y **cuándo caduca**.
  Los créditos de pruebas simuladas se marcan como tales.
- **Avisos**: saldo por debajo del umbral que la persona eligió, **anuncios** del administrador (con su nivel: información, aviso
  o crítico, con icono y texto, no solo color) y **documentos legales pendientes de aceptar**, con una explicación de qué
  funciones dejan de funcionar hasta aceptarlos.
- **El soporte**: el email al que escribir.

**Qué problema resuelve:** la persona nunca se pregunta «¿cuánto me queda?» ni «¿por qué me falla la app?». Lo ve todo en un sitio.

## 22. Comprar créditos · `/panel/comprar`

- **Para qué sirve**: añadir saldo.
- **Cómo funciona**:
  1. Se elige un **paquete** (por ejemplo, uno pequeño, uno mediano y uno grande; los más grandes pueden llevar una
     **bonificación** de créditos extra). Ninguno viene preseleccionado.
  2. Se muestra el resumen: precio con IVA incluido y créditos que se obtienen.
  3. La persona **marca una casilla de renuncia al derecho de desistimiento** (porque los créditos se pueden gastar al instante).
     La casilla nunca viene marcada de antemano.
  4. Opcionalmente puede pedir **factura completa**, rellenando sus datos fiscales (NIF, dirección…).
  5. Pulsa «Comprar».
- **Protección contra el doble clic**: cada intento de compra lleva un identificador de un solo uso. Si la persona pulsa dos veces o
  recarga la página, la compra **no se hace dos veces** (es la misma idea de la «etiqueta única» de la API).
- **Lo que ocurre hoy (importante)**: el sistema de pago es **simulado**. En la web de producción, salvo para cuentas de prueba
  (rol _tester_) y administración, el botón muestra «**Próximamente**» con su explicación. No hay cobros reales todavía.
- **Pantalla de resultado** (`/panel/comprar/…`): resumen de lo comprado (paquete, importe, IVA, créditos) y el saldo nuevo. Si se
  repite una compra ya hecha, lo dice.
- **Enlace a precios**: desde aquí se llega a `/precios`, que explica el coste orientativo de cada operación.

## 23. Movimientos · `/panel/movimientos`

- **Para qué sirve**: ver **cada vez que cambió el saldo**, como el extracto de un banco.
- **Qué muestra**: fecha, tipo (bienvenida, compra, uso, ajuste, caducidad, reembolso, contracargo, liquidación de deuda), créditos
  y, si aplica, app y operación. Es una lista paginada con **filtros** por fechas y por app.
- **Exportar CSV**: un botón descarga la lista filtrada en un fichero que se abre con una hoja de cálculo.
- **Qué NO enseña**: los motivos internos de ajustes del administrador ni identificadores técnicos.
- **Qué problema resuelve**: la confianza. La persona puede comprobar que cada cobro corresponde a algo que hizo.

## 24. Consumo · `/panel/consumo`

- **Para qué sirve**: entender **en qué se han gastado los créditos**.
- **Qué muestra**: una lista de operaciones (fecha, app, nombre amigable de la operación, estado y créditos cobrados) con filtros y
  exportación CSV, y **gráficas** de los últimos 30 o 90 días: por día, por operación y por app. Cada gráfica tiene siempre su
  **tabla equivalente**, para quien no puede ver un gráfico, y los días sin datos se marcan como «sin datos», no como cero.
- **Estados de una operación**: correcta, fallida, cancelada, no entregada o interrumpida. Las que fallaron o se cancelaron no
  cuestan.
- **Qué NO enseña**: nunca el modelo de IA ni el coste real para la plataforma.

## 25. Sesiones activas · `/panel/sesiones`

- **Para qué sirve**: ver **en qué dispositivos y apps** está la cuenta abierta.
- **Qué muestra**: cada sesión con su app (o «Web»), el nombre del equipo, la versión de la app, cuándo se usó por última vez y una
  **IP aproximada** (la IP se recorta a propósito, por privacidad). La sesión actual se marca como «Esta sesión».
- **Qué se puede hacer**: cerrar una sesión concreta o **cerrar todas las demás** (la actual se mantiene).
- **Qué problema resuelve**: si alguien se dejó la cuenta abierta en un ordenador ajeno o sospecha de un acceso raro, la cierra desde
  aquí, y en la API esa pulsera deja de valer **al instante**.

## 26. Perfil · `/panel/perfil`

- **Cambiar el email**: hay que escribir la contraseña actual. Se manda un enlace a la dirección **nueva** (caduca a las 24 horas); al
  confirmarlo se cierran **todas** las sesiones y se avisa a la dirección **anterior**. La respuesta es siempre la misma exista o no
  la dirección, para no revelar datos de otras personas.
- **Cambiar la contraseña**: pide la actual y la nueva (entre 8 y 128 caracteres). Se cierran las **demás** sesiones y llega un
  aviso de seguridad por email.
- **Datos fiscales**: tipo (persona o empresa), nombre o razón social, NIF/NIE/CIF, dirección, código postal, ciudad y país. Se
  validan con el formato español. Sirven para las facturas completas.
- **Aviso de saldo bajo**: la persona elige un umbral. Cuando el saldo baja de ese número, recibe **un** email, y el aviso se rearma
  cuando vuelve a superarlo. Se puede desactivar tan fácilmente como se activa. **Las apps usan ese mismo umbral** (llega en la
  respuesta de `GET /me`).
- **Descargar mis datos** y **borrar mi cuenta** (secciones siguientes).

## 27. Descargar mis datos · `/panel/perfil/exportar`

- **Para qué sirve**: cumplir el derecho de las personas a llevarse sus datos (el famoso RGPD).
- **Qué hace**: descarga un fichero con **todo** lo que la plataforma guarda de la cuenta: perfil, datos fiscales, lo sincronizado de
  cada app, movimientos, historial de operaciones (sin modelo ni coste real), pagos, facturas y aceptaciones legales.
- **Privacidad**: el contenido de la descarga no se registra en ninguna parte.

## 28. Borrar mi cuenta · `/panel/perfil/borrar`

- **Para qué sirve**: marcharse, borrando los datos personales.
- **Qué se ve antes**: **lo que se va a perder** (el saldo, expresado en créditos y euros) y qué apps se verán afectadas. El saldo **se
  pierde sin reembolso**, en todas las apps.
- **Qué hay que hacer**: escribir la contraseña y marcar una casilla de confirmación (nunca premarcada). El botón se llama «Borrar mi
  cuenta» y el cursor no empieza sobre él, para evitar pulsaciones por error.
- **Qué ocurre**: se cierran todas las sesiones, se anula el saldo (queda anotado en el libro de movimientos), se borran los datos
  personales, los datos fiscales y lo sincronizado, y la cuenta se anonimiza. Se conservan, **sin datos personales**, los registros
  contables obligatorios (movimientos, pagos y facturas).
- **Después**: la persona puede volver a registrarse con el mismo email, pero **no recibirá otra vez el saldo de bienvenida**.
- **Importante**: la deuda, si la hubiera, **no se perdona** con el borrado.

## 29. Facturas · `/panel/facturas`

- **Para qué sirve**: consultar y descargar las facturas de las compras (en PDF) y pedir una **factura completa** de una compra que
  se hizo como simplificada.
- **Hoy**: como no hay cobros reales, **la lista está vacía** y la pantalla lo explica. Para pedir una factura completa hace falta
  tener los datos fiscales completos; si faltan, se enlaza al perfil.

## 30. Mis apps · `/panel/apps`

- **Para qué sirve**: una pequeña tienda con las apps disponibles: qué hace cada una, su **descarga** (para escritorio) o su
  **acceso** (para web) y si la persona ya la ha usado.
- Si la descarga no está disponible, lo dice.

## 31. Aceptar documentos legales nuevos

Cuando el administrador publica una versión de un documento legal que **exige aceptación nueva**, el panel lo muestra en la portada
con casillas **sin marcar** y un enlace para leer cada documento. Mientras no se acepten, **las operaciones de IA y la sincronización
se pausan** (en la API es `TERMS_ACCEPTANCE_REQUIRED`); el resto sigue funcionando. Las versiones solo informativas se avisan por
email y en el panel, pero no bloquean nada.

## 32. Todo funciona sin JavaScript

Una decisión de diseño importante: el panel está pensado para que **todas las acciones críticas funcionen aunque el navegador tenga
JavaScript desactivado**. Los botones son formularios normales. Solo el sistema anti-robots del registro lo necesita. Esto lo hace
más robusto y más accesible (lectores de pantalla, navegación con teclado).

---

# Parte 4 · El panel de administración (`/admin`)

Esta parte es para quien **administra la plataforma**. Aquí se decide cuánto cuesta cada cosa, qué apps existen, qué se muestra a
los usuarios y qué pasa cuando algo va mal. Es el **«cuadro de mandos»** de la plataforma, y todo lo que se configure aquí es
justo lo que la API aplica después.

## 33. Antes de tocar nada

### Quién entra

Solo la persona con el rol de **administrador**, y **solo hay una**. Se designa con el email que se configura en el servidor
(`ADMIN_EMAIL`): cuando esa cuenta verifica su email, pasa a ser administradora. Cualquier otra persona que intente abrir `/admin`
recibe una página de acceso denegado.

### Reglas que se aplican en todas las pantallas

Estas reglas existen para proteger a la plataforma **de los propios errores del administrador**:

1. **Todo cambio queda en la auditoría.** Se anota qué se cambió, el valor anterior y el nuevo, quién y cuándo. La auditoría **no se
   puede editar ni borrar** desde el panel.
2. **El motivo es obligatorio** en las acciones que afectan a una cuenta o a dinero. Una frase corta basta, pero no puede ir vacía.
3. **Vista previa antes de confirmar.** Las acciones delicadas funcionan en dos pasos: primero «Vista previa» (que muestra _antes →
   después_ y no cambia nada) y luego un segundo paso con la casilla «Confirmo esta acción».
4. **Tras guardar, se enlaza a su entrada de auditoría**, para comprobar que quedó registrado lo que se quería.
5. **Doble envío protegido**: pulsar dos veces no aplica dos veces un ajuste de dinero.
6. **Todo funciona sin JavaScript.**
7. **Aquí sí se ven los modelos de IA y los costes reales**, a diferencia del panel de usuario y de la API.

### El aviso rojo

En todas las páginas de administración, si el **freno global de gasto** está activo, aparece un aviso visible arriba. También se
indica cuántas alertas activas hay.

## 34. Resumen · `/admin`

- **Para qué sirve**: lo primero que se mira al entrar.
- **Qué muestra**: las **alertas activas** (por ejemplo, el tipo de cambio no se ha actualizado, un modelo de IA ha desaparecido, hay
  discrepancia contable…), el estado del **freno de gasto**, y recuentos como el número de cuentas registradas.
- **Qué problema resuelve**: que ningún problema pase desapercibido.

### Alertas por email

La plataforma escribe al administrador **una sola vez** cuando una condición aparece (no cada hora mientras dura), y vuelve a avisar
si la condición se normaliza y reaparece. Las alertas son:

| Alerta                                  | Qué significa                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Tipo de cambio sin actualizar           | El BCE lleva varios días laborables sin publicar un valor nuevo. Se mantiene el último.                            |
| Modelo retirado o con cambio de precio  | Un modelo de IA que usa una operación ya no existe o ha subido de precio mucho. _(Prevista; todavía no se emite.)_ |
| Operaciones marcadas por moderación     | Una cuenta ha superado el umbral de contenidos rechazados en un día.                                               |
| Freno global de gasto                   | El gasto de las cuentas sin compras ha superado el límite del día.                                                 |
| Discrepancia en el libro de movimientos | El saldo de alguna cuenta no cuadra con sus movimientos (se comprueba cada madrugada).                             |

## 35. Usuarios · `/admin/usuarios`

### Búsqueda

Se busca por email (o parte) o por identificador. Cada resultado muestra su estado (activa, sin verificar, bloqueada o borrada), sus
roles y cuándo se creó. Las cuentas borradas aparecen sin email («cuenta anonimizada»).

### Ficha de una cuenta · `/admin/usuarios/…`

Muestra la información de la cuenta: **saldo y movimientos**, y desde aquí se ejecutan las acciones sobre ella. _(La versión actual
de la ficha muestra el saldo y los movimientos; las bolsas, las reservas, el consumo por app, los pagos y los datos fiscales están
previstos pero todavía no aparecen en esta pantalla.)_

| Acción                       | Qué hace                                                                                 | Cuándo usarla                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Bloquear**                 | Impide el acceso y **cierra todas sus sesiones** al instante.                            | Abuso, fraude o contracargo.                                        |
| **Desbloquear**              | Devuelve el acceso.                                                                      | Cuando se resuelve el motivo.                                       |
| **Marcar / quitar _tester_** | Concede o retira el rol de prueba, que permite comprar con el sistema de pagos simulado. | Para personas que prueban la compra antes de que haya pagos reales. |
| **Cerrar sesiones**          | Cierra todas las sesiones abiertas de la cuenta.                                         | Si se sospecha de un acceso indebido.                               |

Todas piden **motivo** y confirmación, y quedan en la auditoría. Un bloqueo por **contracargo** (cuando alguien le pide a su banco la
devolución de una compra) lo aplica la plataforma sola.

### Ajuste de saldo · `/admin/usuarios/…/ajuste`

- **Para qué sirve**: sumar o restar créditos a mano, como compensación por un fallo, un regalo o una corrección.
- **Cómo funciona**: se elige **sumar o restar**, el **importe**, el **tipo de bolsa** (gratuita, con fecha de caducidad futura, o de
  pago) y el **motivo**. Primero se ve la **vista previa** (_saldo antes → saldo después_) y luego se confirma.
- **Límites sensatos**: no se puede restar más de lo que la persona tiene disponible (restar nunca crea deuda). Si la persona tenía
  deuda, un ajuste positivo la salda primero.
- **Es la acción más delicada**, porque mueve dinero. Por eso lleva doble confirmación y deja un movimiento permanente en el libro.

### Reembolso manual · `/admin/usuarios/…/pagos/…/reembolso`

- **Para qué sirve**: devolver una compra, total o parcialmente.
- **Cómo funciona**: se ve el pago y **cuánto saldo de esa compra no se ha consumido todavía**. Se indican los créditos a retirar (no
  más de lo no consumido), el motivo, y se confirma. Se anota un movimiento de reembolso y, cuando exista facturación real, se emite
  una **factura rectificativa**.
- **Cuándo no se puede**: si los créditos ya se gastaron, la plataforma lo rechaza («pago no reembolsable»).

## 36. Economía · `/admin/economia`

Aquí se fija **cuánto cuestan las cosas**. Todo cambio pasa por **vista previa** (valor anterior → nuevo, con su alcance) y confirma.

- **Parámetros económicos**: la lista de valores que gobiernan la plataforma (créditos que cuesta un euro al comprar y al consumir,
  margen, comisiones de proveedores, saldo mínimo para operar, deuda máxima permitida, tope diario para cuentas sin compras,
  créditos de bienvenida, días de aviso antes de que caduquen…). Cada parámetro muestra su valor actual, su valor **por defecto**, una
  **explicación** y su **origen** (global o de una app). Hay una **validación de coherencia**: por ejemplo, el margen no puede
  ser menor que 1.
- **Tipo de cambio dólar-euro**: normalmente se actualiza solo cada día desde el Banco Central Europeo (con un pequeño colchón de
  seguridad). Aquí se ve el valor vigente y su origen, y se puede **fijar uno manual** (por ejemplo, si el BCE falla) o **quitar el
  manual** para volver al automático. Mientras haya un manual, el refresco diario no lo pisa.
- **Precios orientativos**: lo que se publica en `/precios`. Normalmente se calcula solo con la **mediana de lo cobrado** los últimos
  30 días (si hay suficientes casos). Si no hay datos, se puede introducir un valor manual.
- **Paquetes de créditos**: _(en la versión actual los paquetes se ven pero la edición está pendiente; se definen en la
  configuración inicial.)_

> **Por qué importa**: cambiar un parámetro cambia lo que la API cobra **desde ese momento** a todas las personas. Por eso la
> pantalla enseña el antes y el después.

## 37. Apps · `/admin/apps`

### Registro de apps

Lista de las apps con su estado (**activa** o **desactivada**). Desde aquí se **crea** una app nueva con su _slug_ (nombre corto único,
solo minúsculas, números y guiones), su nombre, su descripción y sus tipos de cliente (escritorio, web, móvil). Un slug repetido se
rechaza.

### Edición de una app · `/admin/apps/…`

Cada app guarda: su descripción, sus enlaces (landing, descarga), los **orígenes CORS permitidos** (necesarios si es una app web), el
email de soporte, el texto de «pasos siguientes» tras verificar, la **versión mínima y recomendada**, y el **mantenimiento propio**.

_(En la versión actual, esta pantalla permite editar los **límites propios de la app** —peticiones por minuto, transcripciones
simultáneas, etc.— que nunca pueden superar el límite global. El resto de ajustes, como los enlaces, los orígenes, el mantenimiento y
las versiones, están previstos pero todavía no se editan desde aquí.)_

### Operaciones de IA · `/admin/apps/…/operaciones/…`

Una **operación** es la «receta» que una app puede pedir a la IA (en la API es el campo `operation`). Aquí se configura cada una:

- **Qué modelo usa** y sus **modelos de respaldo** si falla, el proveedor preferido, la temperatura (creatividad) y la longitud máxima
  de la respuesta.
- **Su coste**: un margen propio opcional, el **tope máximo de coste** (si el coste máximo estimado de una petición lo supera, se
  rechaza con `OPERATION_TOO_EXPENSIVE`) y el tiempo máximo.
- **Sus capacidades**: si admite imágenes, salida estructurada o herramientas.
- **Su plantilla** (si es una operación «con plantilla»): el texto de la receta con huecos. **Cada cambio crea una versión nueva e
  inmutable**: nunca se edita una anterior.
- **Si es de transcripción**: el servicio principal y el de respaldo, y si el principal está activado.
- **Activar / desactivar**: la plataforma **no deja activar** una operación sin modelo, con un modelo que no admite lo que se
  pretende, o sin un precio o coste máximo estimado conocido. Es una red de seguridad contra operaciones mal configuradas.
- **Aplicar al grupo**: cambiar el modelo de todas las operaciones de un mismo grupo de una vez.

> **Relación con la API**: una operación activa aquí es una operación que la app puede pedir. Una desactivada responde con error de
> validación. Y nunca se le dice a la app qué modelo se usa.

### Valores predeterminados · `/admin/apps/…/predeterminados`

Son los datos iniciales que recibe una cuenta nueva en `GET /defaults` y `GET /sync` (por ejemplo, los reemplazos de texto o los
ajustes por defecto de Secretario). Se validan con el esquema de sincronización de la app. **Cambiarlos no modifica ninguna cuenta ya
existente**, solo las futuras y el botón «restaurar valores predeterminados».

### Copiar mis datos como predeterminados · `/admin/apps/…/predeterminados/copiar`

Una comodidad para el administrador: toma los datos que **él mismo** tiene sincronizados en esa app y deja **elegir elemento a
elemento** cuáles pasan a ser los predeterminados. **No hay nada marcado de antemano**, para no copiar datos personales por error.

## 38. Protecciones · `/admin/protecciones`

Los «frenos» de la plataforma:

- **Límites**: las peticiones de IA por minuto y las transcripciones simultáneas, globales y (cuando existen) por app, con su
  origen. Se editan con vista previa y motivo.
- **Freno global de gasto**: si el coste real del día de las cuentas **sin compras** supera un límite, la plataforma **rechaza sus
  nuevas operaciones** (`SERVICE_LIMITED`) hasta el día siguiente. Las cuentas con compra real **nunca** se ven afectadas. Al
  activarse llega un email. Desde aquí el administrador puede **liberarlo a mano** (con motivo).
- **Mantenimiento**: pausa la IA y la sincronización de una app o de toda la plataforma, mostrando un mensaje (`MAINTENANCE`).
  Login, saldo, estado y valores por defecto siguen funcionando. _(En la versión actual el mantenimiento global todavía no se activa
  desde esta pantalla.)_

## 39. Estadísticas · `/admin/estadisticas`

- **Para qué sirve**: saber si el negocio funciona y cuánto cuesta.
- **Filtros**: hoy, el **periodo** (desde y hasta). Están previstos también filtrar por app y operación y elegir cómo agrupar (por día, app, operación o usuario).
- **Qué se mide**:
  - **Coste real** para la plataforma (en dólares y euros), lo **cobrado** (en créditos y su equivalente en euros) y el **margen
    bruto**.
  - **Pérdidas**: por deuda absorbida, por repeticiones que no se cobraron y por cancelaciones (lo que el proveedor facturó aunque
    la persona canceló).
  - **Saldo perdido** por cuentas borradas.
  - Operaciones fallidas, canceladas, interrumpidas o cortadas; uso de modelos de respaldo.
  - Usuarios activos, altas por app, **compras reales** (las simuladas no cuentan) e ingresos.
- **Embudo de alta por app**: de las personas que descargan la app, ¿cuántas se registran, verifican, entran desde la app y hacen
  su primera operación? Sirve para saber dónde se pierde gente (y para decidir, por ejemplo, si merece la pena firmar el
  instalador, que hoy muestra un aviso de Windows).
- Hoy se presenta como **tablas**; las gráficas están previstas y llevarán siempre su tabla equivalente.

## 40. Auditoría · `/admin/auditoria`

- **Para qué sirve**: el **diario inalterable** de todo lo que se ha hecho desde el panel.
- **Qué muestra**: fecha, acción, entidad afectada, valor anterior → nuevo y motivo. Se filtra por entidad, acción y fechas, y cada
  entrada tiene su página de detalle (a la que llevan los enlaces tras guardar).
- **No tiene botones de editar ni de borrar**, a propósito.
- **Privacidad**: no contiene emails ni datos personales; solo identificadores internos.

## 41. Documentos legales · `/admin/legal`

- **Para qué sirve**: publicar nuevas versiones de **términos, privacidad, cookies y uso aceptable**.
- **Cómo funciona**: se elige el documento, se escribe la versión (una fecha) y el contenido en un formato de texto sencillo
  (_Markdown_: títulos, listas, enlaces, negritas), y se indica una decisión **muy importante**:
  - **«Exige que cada persona lo acepte de nuevo»**: bloquea la IA y la sincronización de cada persona **hasta que acepte**.
  - **Solo informativa**: se avisa por **email** a todos y en el panel, pero no bloquea nada.
- **Una versión publicada no se edita**: para corregir, se publica otra. Siempre hay vista previa y confirmación.
- **Aviso**: los textos que trae la plataforma de serie son **provisionales**. Antes de abrirla al público hay que publicar los
  definitivos, revisados por un profesional legal.

## 42. Anuncios · `/admin/anuncios`

- **Para qué sirve**: mostrar un mensaje a los usuarios de una app (o de todas): una novedad, una incidencia, un aviso de
  mantenimiento programado.
- **Qué se configura**: el texto, el **nivel** (información, aviso o crítico), si es de una app o de todas, la **ventana de tiempo**
  en la que se muestra, un enlace opcional y, si se quiere, un **rango de versiones** de la app (para avisar solo a quien tenga una
  versión vieja).
- **Dónde se ven**: las apps los reciben en `GET /app/status`, y las personas los ven también en la portada de su panel.
- **Vista previa**, edición y desactivación disponibles.

## 43. Facturación · `/admin/facturacion`

- **Para qué sirve**: sacar los **informes contables** para la gestoría.
- **Cómo funciona**: se elige el tipo de informe (**ventas**, **costes de IA** o **resumen mensual**), el periodo, y se descarga un
  fichero CSV.
- **Detalle importante**: las **compras simuladas no cuentan** como ingresos.

## 44. Un caso práctico: una app nueva, de principio a fin

Para ver cómo se conectan las dos mitades (administración y API), imagina que quieres añadir una app llamada «Dictado Escolar»:

1. **Administración → Apps → Crear app.** Slug `dictado-escolar`, nombre, descripción, tipo «web».
2. **Editar la app.** Se registran los orígenes permitidos (CORS) y el email de soporte.
3. **Operaciones.** Se crea la operación `transcription` de tipo transcripción: modelo principal, respaldo y tope de coste. Se
   **activa** (la plataforma comprueba que está bien configurada).
4. **Economía.** Se revisa que el precio orientativo y los parámetros son los esperados.
5. **Predeterminados.** Se definen los ajustes iniciales de las cuentas nuevas.
6. **En la API**: ya se puede llamar a `GET /app/status` con `X-App-Id: dictado-escolar`, iniciar sesión y usar `POST
/ai/transcribe` con `operation=transcription`. El gasto aparece en el panel de la persona, en Consumo, y en las estadísticas del
   administrador.
7. **Si algo sale mal**: se publica un **anuncio**, se activa el **mantenimiento** de la app o se **bloquea** una cuenta. Todo queda
   en la **auditoría**.

## 45. Buenas prácticas para quien administra

1. **Escribe siempre un motivo claro**: dentro de un año nadie recordará por qué se hizo un ajuste.
2. **Usa la vista previa**: léela de verdad, es la última oportunidad de arreglar un error.
3. **Cambia los parámetros económicos con calma**: afectan a lo que se cobra desde ya a todo el mundo.
4. **Prueba una operación nueva con una cuenta de prueba** (rol _tester_) antes de dar a conocer la app.
5. **Revisa las alertas del resumen cada día** y la **auditoría** cuando algo no cuadre.
6. **No compartas la cuenta de administración** y usa una contraseña larga y única.
7. **Publica versiones legales solo informativas** cuando el cambio no afecte a derechos de las personas, y reserva las que
   exigen aceptación para lo que realmente lo necesita: bloquean a todo el mundo hasta que acepte.

## 46. Estado actual de las pantallas de administración

Para ser transparentes, hay partes que **todavía no están terminadas**:

| Pantalla                                         | Estado                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Resumen, auditoría, anuncios, legal, facturación | Disponibles.                                                                                                                         |
| Usuarios (búsqueda y acciones)                   | Disponibles. La **ficha** muestra solo saldo y movimientos; faltan bolsas, reservas, consumo, pagos y datos fiscales.                |
| Ajuste de saldo y reembolso                      | Disponibles.                                                                                                                         |
| Economía                                         | Parámetros, tipo de cambio y precios orientativos disponibles. La **edición de paquetes** está pendiente.                            |
| Apps                                             | Alta, límites propios y operaciones disponibles. Faltan enlaces, orígenes CORS, mantenimiento, versiones y soporte de cada app.      |
| Protecciones                                     | Límites y liberación del freno disponibles. El **mantenimiento global** todavía no se activa desde aquí.                             |
| Estadísticas                                     | Disponible en una versión básica: tablas con filtro de fechas. Faltan los filtros por app y operación, la agrupación y las gráficas. |

---

# Glosario de las partes 3 y 4

| Palabra                           | Significado sencillo                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Panel**                         | La zona de la web donde cada persona gestiona su cuenta.                                                            |
| **Bolsa**                         | Un «monedero» dentro del saldo: cada compra, regalo o ajuste crea una, con su propia caducidad.                     |
| **Ledger (libro de movimientos)** | El registro permanente e inalterable de cada cambio de saldo. Con él se puede reconstruir cualquier saldo.          |
| **Auditoría**                     | El registro inalterable de lo que hace el administrador.                                                            |
| **Vista previa**                  | Ver cómo quedaría un cambio _antes_ de aplicarlo.                                                                   |
| **Tester**                        | Un rol de prueba que permite comprar con el sistema de pagos simulado.                                              |
| **Contracargo**                   | Cuando alguien pide a su banco la devolución de una compra ya hecha.                                                |
| **Rectificativa**                 | Una factura que corrige o anula otra anterior.                                                                      |
| **RGPD**                          | La ley europea de protección de datos: da derecho a descargar y a borrar tus datos.                                 |
| **Freno global**                  | El límite de gasto diario de las cuentas sin compras reales.                                                        |
| **Mediana**                       | El valor central de una lista ordenada; se usa para el «coste típico» porque no la distorsionan los casos extremos. |
| **Embudo**                        | El recorrido de una persona desde que descarga la app hasta que la usa; muestra dónde se pierde gente.              |
| **Markdown**                      | Una forma sencilla de escribir texto con formato usando símbolos (`#` para títulos, `-` para listas).               |

---

## Dónde seguir

- **Descripción técnica completa y exacta**: `GET /api/v1/openapi.json` (con sesión iniciada), o `docs/api/openapi-v1.json` en el repositorio.
- **Contrato detallado** (para quien programa la propia plataforma): `docs/api/api-v1.md`.
- **Precios orientativos**: la página `/precios` de la web.
- **Rutas exactas de cada pantalla web** (para quien programa la plataforma): `specs/001-cuenta-mardomingo-v4/contracts/web-routes.md`.
- **Qué está terminado y qué no**: `specs/001-cuenta-mardomingo-v4/tasks.md` y el informe `informe-revision.md`.
- **Soporte**: el email que aparece en el estado de la app (`supportEmail`).
