# Feature Specification: Cuenta Mardomingo v4 (aplicación completa)

**Feature Branch**: `001-cuenta-mardomingo-v4` (directorio de la funcionalidad; no se ha creado rama git)

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "Especificación completa de la aplicación descrita en Historias.md (v2.4): backend multi-app de IA "Cuenta Mardomingo" con la primera app cliente Secretario AI v4."

> **Fuente y trazabilidad.** La descripción funcional completa está en `Historias.md` (versión 2.4 al redactarla; 2.5 tras las aclaraciones del 2026-10-10; 2.6 tras la revisión del plan del mismo día). Cada requisito de esta especificación cita entre paréntesis su origen (`BE-FR-XX`, sus criterios `CA` y los criterios de experiencia de usuario `UX-xx` de la sección 16). Los valores numéricos son **valores por defecto configurables por el administrador** salvo que se diga lo contrario. El «cómo» (tecnologías, estructura del código, herramientas de prueba) pertenece al plan y a la constitución del proyecto, no a este documento. La implementación se hará por lotes L01–L16 (`Historias.md` 15.6).

## Clarifications

### Session 2026-10-10

- Q: ¿Qué pasa con la deuda cuando el administrador añade créditos gratuitos (ajuste) a una cuenta que la tiene? → A: Cualquier entrada positiva del administrador, gratuita o comprada, liquida primero la deuda (movimiento de liquidación) y el resto queda como saldo; la parte que liquida cuenta como pérdida absorbida en las estadísticas.
- Q: ¿Cómo conviven el límite por cuenta (suma de todas las apps) y el valor que se puede fijar por app? → A: Dos límites: el valor global se aplica a la suma de todas las apps de la cuenta; el valor por app, si existe, es un límite adicional solo para las peticiones de esa app, no mayor que el global; se aplica el que se alcance antes.
- Q: ¿Qué anuncios muestra el panel web del usuario? → A: Los anuncios activos dirigidos a todas las apps y los de las apps que la cuenta ha usado (sesión actual o pasada, o documento sincronizado), sin filtrar por versión; cada anuncio indica a qué app se refiere.
- Q: ¿De dónde sale el texto del «paso siguiente» que se muestra tras verificar la cuenta? → A: Por defecto se genera con los datos de la app (nombre, botón de descarga o acceso e «inicia sesión con tu email»); la app puede tener un texto propio opcional de instrucciones, editable en la administración, que sustituye al genérico.
- Q: Si se cancela una operación antes de que responda el proveedor, pero el proveedor la factura igualmente, ¿quién asume ese coste? → A: El usuario no paga nada (la operación queda cancelada sin cobro); cuando se conoce el coste del proveedor (en su respuesta o en una consulta posterior), se guarda en la operación y cuenta en las estadísticas como «pérdida por cancelación».
- Q: ¿Puede un ajuste negativo del administrador dejar la cuenta con deuda? → A: No. Un ajuste negativo no puede superar el saldo disponible; si lo supera, se rechaza con un error de validación (el administrador no crea deuda por ajuste).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear y verificar la cuenta (Priority: P1)

Una persona que quiere usar Secretario AI (u otra app de la plataforma) llega a la web de la Cuenta Mardomingo, normalmente desde la landing de la app o desde un enlace de la propia app. Se registra con email y contraseña, acepta los documentos legales, declara la edad mínima, supera el captcha y verifica su email. Al verificar recibe un saldo de bienvenida gratuito (una sola vez por persona, aunque cambie el formato de su email) y ve el siguiente paso de la app de la que venía. También puede iniciar sesión, recuperar la contraseña y queda protegida frente a intentos de adivinarla.

**Why this priority**: Sin cuenta verificada no hay nada más: ni uso de la IA, ni saldo, ni panel. Además, el saldo de bienvenida es dinero real del propietario, así que el antiabuso forma parte del mínimo viable.

**Independent Test**: Se puede probar por completo registrando una cuenta con `?app=secretario`, abriendo el enlace del email, comprobando el saldo de bienvenida y el siguiente paso de la app, e intentando después un segundo registro con una variante del mismo email (que no recibe bienvenida).

**Acceptance Scenarios**:

1. **Given** un visitante en el registro con origen `secretario`, **When** introduce un email válido, una contraseña de entre 8 y 128 caracteres, marca (sin que vengan marcadas) la aceptación de términos, privacidad y uso aceptable vigentes y la declaración de edad mínima, y supera el captcha, **Then** la cuenta se crea sin verificar, se registra la versión y la fecha de cada documento aceptado, se envía el email de verificación y la pantalla indica a qué dirección se ha enviado, qué hacer si no llega y cuándo puede reenviarlo (BE-FR-01, BE-FR-69, UX-02).
2. **Given** un email que ya tiene cuenta, **When** alguien intenta registrarse con él, **Then** la respuesta es la misma que para un email nuevo («Te hemos enviado un email») y no revela que existía (BE-FR-01 CA5).
3. **Given** un intento de registro sin captcha válido, con un dominio de email desechable o desde una IP que ya ha hecho 3 altas en 24 h, **When** se envía el formulario, **Then** el registro se rechaza con un mensaje que explica qué hacer (BE-FR-01 CA3, BE-FR-11).
4. **Given** una cuenta sin verificar, **When** la persona abre el enlace de verificación dentro de las 24 h, **Then** la cuenta queda verificada, recibe una bolsa gratuita de 1.000 créditos que caduca a los 30 días y la confirmación muestra el saldo concedido y el siguiente paso de Secretario (p. ej. «Descarga Secretario AI e inicia sesión») (BE-FR-02, BE-FR-12, BE-FR-64 CA2, UX-03).
5. **Given** que `j.uan@gmail.com` ya recibió el saldo de bienvenida, **When** se registra y verifica `juan+2@gmail.com`, **Then** la cuenta se crea pero no recibe saldo de bienvenida y el panel explica el motivo (BE-FR-11 CA1).
6. **Given** una cuenta sin verificar, **When** intenta iniciar sesión en la web o en la app, **Then** recibe `EMAIL_NOT_VERIFIED` y puede pedir el reenvío del email, con límite de frecuencia (BE-FR-02 CA2–CA3).
7. **Given** 10 intentos fallidos de login para un mismo email en 15 minutos (exista o no la cuenta), **When** se intenta de nuevo, **Then** se rechaza con `LOGIN_TEMPORARILY_LOCKED` durante 15 minutos indicando cuándo se puede reintentar; un login correcto o una recuperación completada ponen el contador a cero (BE-FR-67, UX-04).
8. **Given** una persona que olvidó la contraseña, **When** la recupera desde la web con un enlace de un solo uso válido durante 1 h, **Then** establece una nueva contraseña, el enlace deja de servir y recibe un aviso de seguridad (BE-FR-05).
9. **Given** credenciales incorrectas, **When** se intenta iniciar sesión, **Then** el error es genérico (`INVALID_CREDENTIALS`) y no distingue entre email inexistente y contraseña errónea (BE-FR-03 CA1).

---

### User Story 2 - Usar la IA desde una app con cobro justo (Priority: P1)

El usuario inicia sesión dentro de Secretario con su email y contraseña y usa sus funciones de IA (corregir, traducir, prompts, transcribir audio, describir imágenes, generar imágenes) sin tener claves de proveedores ni elegir modelos. La plataforma decide el modelo de cada operación, aparta antes el coste máximo posible, llama al proveedor, cobra el coste real más el margen y devuelve el resultado con el saldo actualizado. Nunca cobra dos veces la misma acción, no cobra lo que falla y no guarda nada de lo que el usuario envía.

**Why this priority**: Es el valor central del producto: usar IA sin fricción pagando un precio justo. Es también el flujo con más riesgo de dinero y de privacidad.

**Independent Test**: Con una cuenta verificada con saldo de bienvenida y un proveedor de IA simulado, se puede probar iniciando sesión como app, lanzando operaciones de chat, transcripción e imagen y comprobando resultados, cobros, saldo, rechazos por saldo, idempotencia y ausencia de contenido en cualquier registro.

**Acceptance Scenarios**:

1. **Given** un usuario verificado, **When** inicia sesión desde Secretario, **Then** obtiene una sesión ligada a esa app en la que constan la app, el nombre del equipo y la versión; si esa sesión se usa identificándose como otra app, la petición se rechaza con `UNAUTHENTICATED` (BE-FR-03 CA3, BE-FR-65 CA3).
2. **Given** un usuario con saldo suficiente, **When** solicita la operación activa `fix`, **Then** el sistema elige el modelo configurado, aparta el coste máximo estimado, obtiene el resultado, cobra el coste real con la fórmula de tarificación, libera lo apartado y devuelve el resultado, el importe cobrado y el saldo (total, reservado y disponible), sin revelar el modelo ni el proveedor (BE-FR-19, BE-FR-30, BE-FR-71, BE-FR-80 CA1).
3. **Given** un usuario con saldo para 3 operaciones, **When** lanza 20 a la vez, **Then** como máximo se ejecutan las que caben y el resto recibe `INSUFFICIENT_BALANCE` (con el importe necesario y el disponible) sin que se llame al proveedor (BE-FR-71 CA1).
4. **Given** un saldo de 55 créditos y una operación cuyo coste final (58,236 créditos; se muestra «58») supera la estimación, **When** termina, **Then** se cobra igualmente, el saldo queda en −3,236 (se muestra «−3,2»; deuda dentro del máximo tolerado) y el usuario no puede lanzar nuevas operaciones hasta saldar la deuda (BE-FR-17, BE-FR-22).
5. **Given** una operación cuyo coste máximo estimado supera su tope configurado, **When** se solicita, **Then** se rechaza con `OPERATION_TOO_EXPENSIVE` sin llamar al proveedor ni cobrar (BE-FR-72 CA1).
6. **Given** una transcripción cuyo proveedor principal falla tras sus reintentos, **When** responde el proveedor de respaldo, **Then** se devuelve el texto indicando «respaldo», sin nombrar el modelo, y solo se cobra lo que cada proveedor haya facturado; si fallan ambos, se devuelve `TRANSCRIPTION_FAILED` con el error saneado de cada uno y no se cobra (BE-FR-35, BE-FR-21).
7. **Given** una acción con una clave de idempotencia, **When** la app la reintenta mientras sigue en curso, ya entregada o terminada pero no entregada, **Then** recibe respectivamente `REQUEST_IN_PROGRESS`, `DUPLICATE_REQUEST` (con el identificador de la operación, sin cobrar de nuevo) o una nueva ejecución que no se cobra (BE-FR-81).
8. **Given** una operación en curso, **When** la app cierra la conexión antes de que responda el proveedor, **Then** la llamada se aborta, la operación queda como cancelada y no se cobra al usuario; si el proveedor la factura igualmente, ese coste se guarda en la operación y consta en las estadísticas como «pérdida por cancelación» (BE-FR-37, BE-FR-21, BE-FR-54).
9. **Given** un audio que supera la duración máxima (5 minutos más la tolerancia) medida por el servidor, **When** se envía a transcribir, **Then** se rechaza con `AUDIO_TOO_LONG` sin llamar al proveedor ni cobrar (BE-FR-44).
10. **Given** cualquier operación completada, fallida o cancelada, **When** se buscan en el almacenamiento, en los registros de diagnóstico o en ficheros temporales los textos, audios, imágenes o resultados enviados, **Then** no aparecen; solo constan los metadatos de la operación (BE-FR-38).
11. **Given** una operación desconocida, inactiva o de otra app, **When** se solicita, **Then** se rechaza con `VALIDATION_ERROR` indicando el campo `operation` (BE-FR-31).

---

### User Story 3 - Saldo y créditos (Priority: P1)

El usuario tiene un único saldo en créditos, compartido por todas las apps, formado por bolsas gratuitas (que caducan) y compradas (que no caducan). Se gastan primero las gratuitas que caducan antes. Cada cambio de saldo queda en un historial inmutable del que se puede reconstruir el saldo. Las cuentas que nunca han comprado tienen un tope de gasto diario.

**Why this priority**: El saldo es dinero real del usuario y del propietario. Sus reglas (orden de consumo, caducidad, deuda, historial reconstruible) son la base de cualquier cobro y compra.

**Independent Test**: Se puede probar sobre una cuenta con varias bolsas (bienvenida, ajuste gratuito con otra caducidad, compra simulada), consumiendo, dejando caducar, generando y liquidando deuda, y comprobando que el saldo reconstruido desde el historial coincide siempre.

**Acceptance Scenarios**:

1. **Given** una cuenta con una bolsa gratuita que caduca antes, otra gratuita que caduca después y una comprada, **When** se cobra una operación, **Then** se consume primero la gratuita que caduca antes, después la otra gratuita y por último la comprada más antigua (BE-FR-14).
2. **Given** una bolsa gratuita con saldo a 7 días de caducar, **When** se ejecuta la tarea diaria, **Then** se envía un único email de aviso; **When** llega la fecha de caducidad, **Then** la bolsa se pone a cero con un movimiento de caducidad (BE-FR-16).
3. **Given** una cuenta con deuda, **When** entra una compra, **Then** primero se liquida la deuda (movimiento de liquidación) y el resto queda como saldo comprado (BE-FR-17).
4. **Given** una cuenta sin ninguna compra real que ya ha gastado (cobros del día más reservas activas) el tope diario de 400 créditos sumando todas las apps, **When** lanza otra operación, **Then** recibe `DAILY_FREE_LIMIT_REACHED`; las compras simuladas no la sacan de esa condición (BE-FR-11.6, BE-FR-11 CA2).
5. **Given** cualquier cuenta, **When** se ejecuta la comprobación diaria, **Then** el saldo de cada cuenta coincide con el reconstruido desde su historial de movimientos; si no, el administrador recibe una alerta (BE-FR-15 CA1).
6. **Given** reservas abiertas, **When** el servidor se reinicia, **Then** todas se liberan y sus operaciones se marcan como interrumpidas, sin cobro (BE-FR-71).
7. **Given** un administrador, **When** suma o resta créditos a un usuario indicando tipo de bolsa, caducidad si es gratuita y motivo, **Then** el cambio queda en el historial y en la auditoría; si la cuenta tenía deuda, un ajuste positivo la liquida primero; un ajuste negativo mayor que el saldo disponible se rechaza con un error de validación (el ajuste no crea deuda); sin motivo no se puede guardar (BE-FR-18, BE-FR-17).

---

### User Story 4 - Comprar créditos y facturación (Priority: P2)

El usuario compra paquetes de créditos desde el panel. En la v4 el pago es simulado: en producción solo pueden comprar los testers y el administrador; el resto ve «Próximamente» con su explicación. Antes de comprar acepta el inicio inmediato del servicio y puede pedir factura completa con sus datos fiscales. El administrador puede reembolsar manualmente; un contracargo bloquea la cuenta. La facturación real queda preparada para la fase de cobros reales.

**Why this priority**: Es la vía de ingresos, pero en la v4 no hay cobros reales; el producto es demostrable con el saldo de bienvenida y la compra simulada.

**Independent Test**: Con una cuenta tester en producción (o cualquier cuenta en staging), se puede comprar un paquete, comprobar los créditos acreditados y el saldo nuevo, repetir el envío sin acreditar dos veces y verificar que una cuenta normal en producción ve «Próximamente».

**Acceptance Scenarios**:

1. **Given** un usuario sin rol de tester en producción, **When** abre la compra, **Then** ve los paquetes con el texto «Próximamente» y su explicación visibles y accesibles (no solo un botón desactivado) (BE-FR-25 CA2, UX-06).
2. **Given** un tester, **When** elige el paquete de 10 €, marca la casilla de inicio inmediato y renuncia al desistimiento (que no viene marcada) y confirma, **Then** recibe una bolsa comprada, marcada como simulada, de 10.500 créditos (10 € × 1.000 × 1,05) y ve el saldo nuevo (BE-FR-23, BE-FR-25, BE-FR-26, UX-05).
3. **Given** una compra ya completada, **When** el usuario hace doble clic, reenvía el formulario o vuelve atrás y reenvía, **Then** ve la misma compra («Esta compra ya se completó») y no se acredita de nuevo, también sin JavaScript (BE-FR-25 CA4).
4. **Given** el paso de compra, **When** se envía sin marcar la casilla obligatoria, **Then** se muestra el error junto a la casilla y no se compra nada (BE-FR-26).
5. **Given** una compra simulada, **When** se consultan estadísticas, facturas y el tope diario, **Then** no cuenta como ingreso, no genera factura y no cuenta como compra real (BE-FR-25 CA3).
6. **Given** un usuario que pide factura completa, **When** no tiene datos fiscales, **Then** puede introducirlos en el mismo paso; el formato del identificador fiscal español se valida (BE-FR-74).
7. **Given** una compra, **When** el administrador la reembolsa indicando el saldo no consumido a retirar y el motivo, **Then** se retira ese saldo de la bolsa de esa compra con un movimiento de reembolso y queda en la auditoría (BE-FR-27).
8. **Given** una compra sobre la que se abre un contracargo, **When** se recibe el aviso, **Then** se retira el saldo restante de esa bolsa, lo que falte pasa a deuda sin tope y la cuenta queda bloqueada hasta revisión (BE-FR-28).

---

### User Story 5 - Panel de usuario (Priority: P2)

El usuario consulta en la web su saldo y su desglose, en qué ha gastado los créditos (por app y operación, con gráficas y exportación), configura un aviso de saldo bajo, gestiona sus sesiones y su perfil, descarga facturas, ve sus apps, los avisos pendientes y el email de soporte.

**Why this priority**: Da transparencia sobre el dinero y control sobre la cuenta, pero las apps funcionan sin él.

**Independent Test**: Con una cuenta sembrada con movimientos y operaciones de varias apps, se puede recorrer el panel, filtrar, exportar, configurar el umbral de saldo bajo y cerrar sesiones.

**Acceptance Scenarios**:

1. **Given** una cuenta con bolsas gratuitas y compradas, saldo reservado y deuda, **When** abre el panel, **Then** ve el total, el reservado, el desglose por bolsas con fechas de caducidad, la deuda y la equivalencia en euros, con el redondeo de presentación acordado (BE-FR-49.1, BE-FR-22).
2. **Given** operaciones de varias apps, **When** filtra el consumo por una app, **Then** ve fecha, app, nombre amigable de la operación, estado y créditos cobrados, nunca el modelo ni el coste real; el filtro y la página se conservan en la dirección de la página (BE-FR-49.4, UX-09).
3. **Given** el selector de 30/90 días, **When** elige 90, **Then** ve las gráficas por día, operación y app con título, periodo, unidad y tabla equivalente, y un periodo sin datos se muestra como «sin datos», no como cero (BE-FR-49.5, UX-08).
4. **Given** un umbral de saldo bajo configurado, **When** el saldo cruza el umbral hacia abajo, **Then** recibe un único email; no recibe otro hasta que el saldo vuelva a superar el umbral y lo cruce de nuevo (BE-FR-49.7).
5. **Given** varias sesiones abiertas, **When** pulsa «Cerrar las demás sesiones», **Then** se cierran todas salvo la actual, que aparece identificada como «Esta sesión» (BE-FR-49.8, UX-10).
6. **Given** el perfil, **When** cambia el email (con su contraseña), **Then** el cambio solo se aplica al abrir el enlace enviado a la nueva dirección, la anterior recibe un aviso de seguridad y la confirmación indica que se han cerrado las demás sesiones (BE-FR-66, UX-18).
7. **Given** movimientos en un rango de fechas, **When** exporta en CSV con filtro de fechas y app, **Then** el fichero contiene solo lo filtrado y la pantalla indica el rango y los filtros aplicados (BE-FR-49.6, UX-09).

---

### User Story 6 - Sincronización y predeterminados por app (Priority: P2)

Los datos de configuración de cada app (en Secretario: sustituciones, textos rápidos, prompts y preferencias) se guardan en la cuenta y se sincronizan entre equipos. La primera vez que la cuenta usa una app recibe los valores predeterminados que define el administrador, sin pisar lo que el usuario ya tuviera en local.

**Why this priority**: Aporta continuidad entre equipos y una buena primera experiencia, pero la IA funciona sin ella.

**Independent Test**: Con dos clientes simulados sobre la misma cuenta y app, se puede leer el documento inicial (sembrado), escribirlo, provocar un conflicto de escritura simultánea y restaurar los predeterminados.

**Acceptance Scenarios**:

1. **Given** una cuenta que nunca ha usado Secretario, **When** la app lee por primera vez su documento, **Then** recibe una copia de los predeterminados vigentes con todas las fechas a cero, de modo que cualquier dato local del usuario con fecha real prevalece al fusionar (BE-FR-40).
2. **Given** dos equipos con la misma revisión del documento, **When** ambos escriben a la vez, **Then** uno tiene éxito con una revisión nueva y el otro recibe `SYNC_CONFLICT`, relee, fusiona y reintenta; ninguna escritura se pierde en silencio (BE-FR-41 CA1).
3. **Given** un documento con una categoría no declarada por la app o con forma incorrecta, **When** se escribe, **Then** se rechaza con `VALIDATION_ERROR`; si supera el tamaño máximo, con `PAYLOAD_TOO_LARGE` (BE-FR-41 CA2, BE-FR-39).
4. **Given** que el administrador cambia los predeterminados, **When** se consultan cuentas existentes, **Then** ninguna se ha modificado; la app puede pedir los predeterminados vigentes para «Restaurar valores predeterminados» (BE-FR-42 CA1–CA2).
5. **Given** el administrador con sus datos de Secretario, **When** usa «Copiar mis datos actuales como predeterminados», **Then** ve una vista previa por categorías con casillas por elemento, puede excluir datos personales, solo se sustituyen las categorías con algún elemento seleccionado y la copia queda en la auditoría (BE-FR-42 CA3–CA4).
6. **Given** una cuenta con documentos en dos apps, **When** una app lee o escribe, **Then** solo accede al documento de su propia app (BE-FR-39, BE-FR-65 CA3).

---

### User Story 7 - Administración (Priority: P2)

El único administrador gestiona usuarios (ajustes de saldo con motivo, bloqueos, testers, sesiones, reembolsos), la economía (parámetros y paquetes), las apps con sus operaciones, plantillas y modelos, las protecciones, los predeterminados, los documentos legales, los anuncios, la exportación contable, las estadísticas con el embudo de alta y la auditoría, todo sin redesplegar.

**Why this priority**: Es imprescindible para operar con seguridad, pero el núcleo puede funcionar con los valores sembrados mientras se construye.

**Independent Test**: Con la cuenta de administrador, se puede buscar un usuario, ajustar su saldo con motivo y ver la entrada en la auditoría, cambiar un parámetro económico y comprobar que se aplica a la siguiente operación, y activar el mantenimiento de una app y ver que la API responde `MAINTENANCE`.

**Acceptance Scenarios**:

1. **Given** el panel de administración, **When** busca un usuario por email, **Then** ve su detalle (saldo, reservas, bolsas, movimientos, consumo por app, sesiones, pagos, facturas, datos fiscales y operaciones marcadas por moderación); una búsqueda sin resultados conserva la consulta visible (BE-FR-50, UX-15).
2. **Given** un ajuste de saldo, un reembolso, un bloqueo o un cierre de sesiones, **When** el administrador lo prepara, **Then** antes de confirmar ve el usuario, el importe y el efecto (saldo antes → después), el motivo es obligatorio y, al guardar, se enlaza la entrada de auditoría (UX-13, BE-FR-18).
3. **Given** un parámetro económico, **When** el administrador lo cambia, **Then** ve el valor anterior, el nuevo, su valor por defecto, su explicación y su alcance (global o por app); valores incoherentes (p. ej. margen < 1 o saldo mínimo negativo) se rechazan; el cambio se aplica a la siguiente operación y queda auditado (BE-FR-61, UX-14).
4. **Given** una operación sin modelo, con un modelo que no admite sus capacidades o sin precio conocido ni coste máximo estimado, **When** se intenta activar, **Then** no se permite (BE-FR-77 CA2, BE-FR-72 CA3).
5. **Given** el grupo «Corrector» de Secretario, **When** el administrador cambia el modelo con «aplicar a todo el grupo», **Then** todas las operaciones del grupo usan el nuevo modelo desde la siguiente petición (BE-FR-32, BE-FR-77 CA1).
6. **Given** la auditoría, **When** se intenta editar o borrar una entrada desde el panel, **Then** no es posible (BE-FR-55).
7. **Given** estadísticas de un periodo, **When** se consultan, **Then** se ven coste real, cobrado, margen bruto, pérdidas por deuda absorbida, por repeticiones no cobradas y por cancelación, saldo perdido por borrado de cuentas, operaciones fallidas, canceladas, interrumpidas o truncadas, uso de respaldos, usuarios activos, altas por app de origen, compras reales e ingresos, y el embudo de alta por app (BE-FR-54).

---

### User Story 8 - Protecciones y continuidad del servicio (Priority: P2)

La plataforma se protege de abusos y de gastos descontrolados (límites por usuario, freno global de gasto para cuentas gratuitas, límites de autenticación), puede pararse por mantenimiento global o por app, exige versiones mínimas de las apps y comunica su estado, anuncios y soporte a las apps.

**Why this priority**: Limita el riesgo económico y permite operar sin desplegar, pero no es lo primero que ve el usuario.

**Independent Test**: Se puede probar con peticiones a la API: superar el límite por minuto, activar el freno global, activar el mantenimiento de una app, usar una versión antigua y consultar el estado de la app.

**Acceptance Scenarios**:

1. **Given** un usuario que supera 30 peticiones de IA por minuto (sumando apps) o 2 transcripciones simultáneas, **When** envía otra, **Then** recibe `RATE_LIMITED` con el tiempo de espera; **and given** una app con un límite propio menor, al alcanzarlo se rechazan las peticiones de esa app aunque la suma de la cuenta no haya llegado al global (BE-FR-43, BE-FR-63 CA4).
2. **Given** que el coste real del día más las reservas en curso de las cuentas sin compras reales supera 5 €, **When** una de esas cuentas lanza una operación, **Then** recibe `SERVICE_LIMITED` hasta el día siguiente o hasta que el administrador lo libere; el administrador recibe un email; las cuentas con compras reales no se ven afectadas (BE-FR-46).
3. **Given** el mantenimiento activo (global o de la app), **When** se piden operaciones de IA o sincronización, **Then** reciben `MAINTENANCE` con el mensaje del administrador, mientras el login, los datos de la cuenta y el estado de la app siguen funcionando (BE-FR-47).
4. **Given** una app que exige versión y una petición autenticada con versión inferior a la mínima o sin versión, **When** llega, **Then** recibe `UPGRADE_REQUIRED` (BE-FR-48 CA1).
5. **Given** cualquier app, **When** consulta su estado sin sesión, **Then** obtiene versiones mínima y recomendada, mantenimiento, límites, tiempo máximo de cada operación activa, enlaces, email de soporte y anuncios activos para su versión (BE-FR-48 CA2, BE-FR-77 CA4, BE-FR-84, BE-FR-85).
6. **Given** una app desactivada o desconocida, **When** hace cualquier petición, **Then** recibe `APP_DISABLED` o `UNKNOWN_APP` (BE-FR-62 CA1).

---

### User Story 9 - Apariencia y accesibilidad (Priority: P2)

Cualquier persona puede usar toda la web (landings, legales, registro, panel y administración) en móvil o escritorio, con teclado o lector de pantalla, sin JavaScript en los flujos críticos, con tema claro u oscuro según su sistema o su elección, y reduciendo transparencias y movimiento si lo necesita.

**Why this priority**: Es un requisito transversal (WCAG 2.2 AA) que condiciona cada pantalla desde el primer lote, aunque no aporte una función de negocio por sí mismo.

**Independent Test**: Se puede probar en la landing y el panel cambiando la apariencia del sistema, eligiendo tema, activando «Reducir transparencia y movimiento», recorriendo con teclado a 320 px y repitiendo los flujos críticos con JavaScript desactivado.

**Acceptance Scenarios**:

1. **Given** un visitante sin preferencia guardada y con el sistema en modo claro, **When** abre cualquier página, incluso sin JavaScript, **Then** la ve en tema claro desde la primera pintura, sin destello del oscuro (UX-TEMA CA1).
2. **Given** «Sistema» seleccionado y un formulario a medio escribir, **When** el sistema cambia a oscuro, **Then** la página se actualiza sin recargar y sin perder lo escrito, el foco ni la posición (UX-TEMA CA2).
3. **Given** un usuario que elige «Oscuro», **When** vuelve otro día, **Then** el servidor pinta la página ya en oscuro hasta que vuelva a elegir «Sistema» (UX-TEMA CA3).
4. **Given** «Reducir transparencia y movimiento» activado, **When** navega, **Then** todas las superficies translúcidas son opacas y no hay movimiento no esencial, sin perder acciones, contenido, foco ni estados; si el sistema pide reducir movimiento, se respeta aunque el ajuste propio esté desactivado (UX-EFECTOS).
5. **Given** un ancho de 320 px o zoom al 200 %, **When** recorre cualquier página, **Then** no hay desplazamiento horizontal de la página y todo es operable con teclado y foco visible (Historias 16.5).
6. **Given** JavaScript desactivado, **When** inicia sesión, compra, edita datos fiscales, acepta documentos legales, ejecuta una acción de administración, cambia tema o efectos y filtra o pagina una lista, **Then** todo funciona; el registro muestra un aviso de que el captcha necesita JavaScript (Historias 15.17, 16.11).

---

### User Story 10 - Privacidad y documentos legales (Priority: P3)

El usuario puede exportar sus datos, borrar su cuenta sabiendo lo que pierde, y aceptar nuevas versiones de los documentos legales. La plataforma aplica de forma automática los plazos de conservación, borra las cuentas sin verificar y, con aviso previo, las inactivas que nunca compraron.

**Why this priority**: Es obligatorio antes del lanzamiento público, pero la no persistencia del contenido ya está cubierta en la historia 2; el resto puede llegar después del núcleo.

**Independent Test**: Se puede probar publicando una versión legal que exige aceptación (y viendo cómo se bloquean la IA y la sincronización hasta aceptarla), descargando la exportación y borrando una cuenta de prueba.

**Acceptance Scenarios**:

1. **Given** una nueva versión de los términos que exige aceptación, **When** el usuario usa la IA o la sincronización, **Then** recibe `TERMS_ACCEPTANCE_REQUIRED` con los documentos pendientes; el login, los datos de cuenta, el estado de la app y la propia aceptación siguen funcionando; al aceptar desde la app o el panel, se desbloquea (BE-FR-70 CA1–CA2, UX-11).
2. **Given** una versión solo informativa, **When** se publica, **Then** se notifica por email y en el panel sin bloquear nada (BE-FR-70 CA3).
3. **Given** el perfil, **When** pide la exportación, **Then** descarga un fichero con perfil, datos fiscales, datos sincronizados de cada app, movimientos, metadatos de operaciones, pagos, facturas y aceptaciones legales (BE-FR-08).
4. **Given** una cuenta con saldo, **When** inicia el borrado, **Then** ve el saldo que pierde (en créditos y euros) y las apps afectadas, debe introducir su contraseña, el foco inicial no está en «Borrar mi cuenta» y, al terminar, la sesión está cerrada, sus bolsas restantes puestas a cero con un movimiento de pérdida por borrado, sus datos personales eliminados, el historial contable anonimizado y el email libre, sin derecho a una nueva bienvenida (BE-FR-07, UX-07).
5. **Given** una cuenta verificada sin compras reales ni actividad durante 3 años, **When** se ejecuta la tarea diaria, **Then** recibe un aviso y, si no hay actividad en 30 días, se borra; cualquier actividad cancela el borrado; una cuenta con alguna compra real nunca se borra de forma automática (BE-FR-86).
6. **Given** una cuenta sin verificar con más de 7 días, **When** se ejecuta la tarea diaria, **Then** se elimina por completo y el email queda libre (BE-FR-68).

---

### User Story 11 - Landings, precios orientativos y páginas legales (Priority: P3)

Un visitante entiende qué es la Cuenta Mardomingo (una cuenta y un saldo para todas las apps), qué hace cada app, cuánto cuesta aproximadamente cada operación y cuáles son las condiciones legales, y puede crear su cuenta o descargar la app.

**Why this priority**: La v4 lleva landings básicas que se sustituirán; son necesarias para el lanzamiento, no para validar el núcleo.

**Independent Test**: Se puede probar navegando por la landing principal, la de Secretario, la página de precios y las cuatro páginas legales, comprobando enlaces, textos y que solo se emiten cookies técnicas.

**Acceptance Scenarios**:

1. **Given** la landing principal, **When** se visita, **Then** explica la cuenta común, lista las apps activas y ofrece «Crear cuenta», «Iniciar sesión» y el enlace a precios (BE-FR-59).
2. **Given** la landing de Secretario, **When** se visita, **Then** explica qué hace, cómo empezar, ofrece la descarga permanente, «Crear cuenta» con origen `secretario` y los pasos en texto para continuar ante el aviso de SmartScreen, con la captura como apoyo con texto alternativo (BE-FR-59, UX-16).
3. **Given** la página de precios, **When** hay al menos 50 cobros de una operación en los últimos 30 días, **Then** su coste típico es la mediana de esos cobros; si no, el valor introducido por el administrador; la página explica que el cobro real depende de la longitud y del modelo vigente (BE-FR-73).
4. **Given** cualquier página pública, **When** se visita, **Then** solo se usan cookies técnicas, no hay analítica de terceros ni banner de consentimiento (BE-FR-60).

---

### User Story 12 - Emails y alertas al administrador (Priority: P3)

El usuario recibe emails transaccionales claros con la marca paraguas (verificación, seguridad, saldo bajo, caducidad, documentos legales, inactividad, facturas) y el administrador recibe alertas, una sola vez por incidencia, cuando algo requiere su atención (freno global, saldo del proveedor, modelos retirados o con cambio de precio, moderación, descuadre del historial, tipo de cambio sin actualizar).

**Why this priority**: Los emails críticos de cuenta (verificación, recuperación) ya forman parte de la historia 1; el resto mejora la operación y la comunicación.

**Independent Test**: Con el envío de emails simulado, se puede provocar cada disparador y comprobar destinatario, contenido, marca, versión en texto plano y que una alerta no se repite mientras no se vuelva a cruzar el umbral.

**Acceptance Scenarios**:

1. **Given** cualquier email transaccional, **When** se envía, **Then** está en español, lleva la marca paraguas, nombra la app cuando se refiere a una, incluye el email de soporte en el pie, tiene versión en texto plano, se lee bien en modo oscuro y muestra la dirección de cada botón también como texto (BE-FR-58, UX-17).
2. **Given** que el saldo del proveedor intermediario baja de 10 USD, **When** se comprueba cada hora, **Then** el administrador recibe un único email por cruce del umbral (BE-FR-56).
3. **Given** un modelo asignado que desaparece o cambia de precio más de un 20 %, **When** se ejecuta la vigilancia diaria, **Then** el administrador recibe un email y, si ha desaparecido o ya no sirve, también un aviso en el panel (BE-FR-80).

---

### Edge Cases

- **Peticiones simultáneas sobre el mismo saldo**: varias operaciones a la vez (desde una o varias apps) nunca reservan ni gastan el mismo crédito; la exposición total no supera saldo + deuda máxima salvo que el coste real supere la estimación (BE-FR-71 CA1).
- **El coste real supera la estimación**: se cobra igualmente; el exceso va a deuda hasta el máximo y lo que lo supere lo absorbe el administrador y consta como pérdida en estadísticas (BE-FR-17).
- **Desconexión del cliente** (Historias 7.4): antes de que responda el proveedor → cancelada sin cobro al usuario (si el proveedor la factura igualmente, su coste consta como pérdida por cancelación); después → «no entregada», se cobra, y la repetición con la misma clave no se cobra (BE-FR-37, BE-FR-81).
- **Respuesta perdida sin clave de idempotencia**: cada petición es independiente y se cobra por separado (BE-FR-81 CA2).
- **Proveedor caído o lento**: se prueban los modelos de respaldo en orden dentro del tiempo total; si todo falla, `PROVIDER_ERROR` o `PROVIDER_TIMEOUT` sin cobro (BE-FR-80, BE-FR-21).
- **Rechazo por moderación del proveedor**: la operación se marca sin guardar contenido y el cliente recibe un `PROVIDER_ERROR` genérico (BE-FR-82).
- **Coste real no informado por el proveedor**: se consulta después y, si tampoco está, se estima con los precios por token y la operación queda marcada como estimada (BE-FR-20).
- **Audio ilegible o sin duración en su cabecera**: la duración se mide sobre el audio completo; si no se puede leer, `VALIDATION_ERROR` sin cobro (BE-FR-44).
- **Reinicio del servidor durante una operación**: reservas liberadas y operación interrumpida, sin cobro (BE-FR-71).
- **Emails normalizados**: `juan+2@gmail.com`, `j.uan@googlemail.com` y `JUAN@gmail.com` son la misma persona a efectos de bienvenida, también después de borrar la cuenta (BE-FR-11.5, BE-FR-07 CA3).
- **Cambio de email a una dirección ya registrada**: la respuesta no lo revela y el cambio no se aplica (BE-FR-66 CA3).
- **Contracargo sin saldo suficiente**: la deuda supera el máximo habitual y la cuenta se bloquea (BE-FR-28).
- **Compra con deuda pendiente**: la compra liquida primero la deuda (BE-FR-17).
- **Doble clic, reenvío o «atrás» en la compra**: misma compra, sin acreditar de nuevo (BE-FR-25 CA4); webhook repetido en la fase de cobros reales: sin doble acreditación (BE-FR-24 CA1).
- **Versión mínima**: una app sin cabecera de versión o por debajo de la mínima recibe `UPGRADE_REQUIRED` si la app exige versión; el estado de la app sigue disponible para que el cliente informe (BE-FR-48).
- **Conflicto de sincronización**: dos escrituras con la misma revisión → una gana y la otra recibe `SYNC_CONFLICT` (BE-FR-41).
- **Documentos legales pendientes**: la app sigue pudiendo iniciar sesión, consultar la cuenta y aceptar; solo la IA y la sincronización se bloquean (BE-FR-70 CA1).
- **Captcha sin JavaScript o que no carga**: el registro explica que el captcha necesita JavaScript y permite reintentar; es la única excepción a la mejora progresiva (Historias 16.6, 16.11).
- **Sesión caducada en mitad de una tarea web**: tras iniciar sesión vuelve a la página pedida (solo destinos internos) y lo escrito se conserva salvo contraseñas (UX-04, Historias 16.6).
- **Cambios de hora en Europe/Madrid**: los cortes diarios (tope diario, freno global, estadísticas, caducidades) usan el día civil de Madrid también los días de cambio de hora (Historias 4.3).
- **Cuenta borrada o anonimizada en la administración**: se muestra como tal, sin datos personales (Historias 16.6).
- **Freno global activo**: visible en todas las páginas de administración (Historias 16.6).
- **Ninguna app activa, app con landing externa, app desactivada o descarga no disponible** en las landings (Historias 16.6).
- **Bolsa gratuita añadida por ajuste a una cuenta con deuda**: el ajuste liquida primero la deuda y solo el resto queda como bolsa gratuita; la parte que liquida consta como pérdida absorbida (BE-FR-17, aclaración 2026-10-10).

## Requirements *(mandatory)*

### Functional Requirements

#### Apps cliente y cuenta compartida

- **FR-001** (BE-FR-62, BE-FR-52): El administrador DEBE poder dar de alta y editar apps sin redesplegar. Cada app tiene identificador estable, nombre visible, descripción corta, tipos de cliente (escritorio, web, móvil), estado (activa o desactivada), enlaces (landing interna o externa, descarga, notas de versión), versión mínima y recomendada y si se exige, mantenimiento propio con mensaje, orígenes web permitidos, texto opcional de pasos siguientes tras verificar la cuenta, sobrescrituras de los parámetros «por app», esquema de sincronización, predeterminados, catálogo de operaciones y email de soporte opcional.
- **FR-002** (BE-FR-62 CA1–CA3): Toda petición de una app a la API (salvo la comprobación de salud y el contrato público) DEBE identificar la app. Ausente o desconocida → `UNKNOWN_APP`; app desactivada → `APP_DISABLED`. La identificación de la app no autentica: la seguridad descansa en la sesión del usuario, los límites y las reservas. Dar de alta una app u operación no requiere redesplegar.
- **FR-003** (BE-FR-62 perfil inicial, BE-FR-31): El sistema DEBE arrancar con la app `secretario` (escritorio) dada de alta con sus once operaciones libres (`improve`, `enhance`, `fix`, `beautify`, `translate`, `image-transcription`, `direct-prompt`, `custom-prompt`, `adhoc-prompt`, `transcription`, `image-generation`), su esquema de sincronización y sus parámetros de audio. Lo propio de una app se define como datos configurables, nunca como comportamiento exclusivo del núcleo.
- **FR-004** (BE-FR-63 CA1–CA4): Una cuenta DEBE servir en todas las apps con un único saldo. El saldo de bienvenida se concede una vez por cuenta; cada consumo, reserva y operación registran la app que lo originó; los documentos legales son de la plataforma; los topes por cuenta (tope diario sin compras, deuda máxima, peticiones por minuto) se aplican a la suma de todas las apps.
- **FR-005** (BE-FR-64 CA1–CA3): La web y los emails DEBEN usar la marca paraguas «Cuenta Mardomingo». El registro admite la app de origen, que se guarda en la cuenta con fines estadísticos; tras verificar, la confirmación muestra los siguientes pasos de esa app: por defecto un texto generado con su nombre, su botón de descarga o acceso e «inicia sesión con tu email», o el texto propio de la app si el administrador lo ha definido; los emails que se refieren a una app la nombran por su nombre visible.
- **FR-006** (BE-FR-65 CA1–CA3): Todas las apps DEBEN autenticarse con el token de sesión obtenido en su login (la sesión por cookie es exclusiva de la web de la cuenta). Las peticiones procedentes de un navegador solo se aceptan si su origen figura en la lista de la app. La sesión queda ligada a la app con la que se inició; usarla con otra app → `UNAUTHENTICATED`.

#### Registro, verificación, sesiones y credenciales

- **FR-007** (BE-FR-01 CA1–CA5, BE-FR-69): El registro DEBE hacerse solo en la web, con email, contraseña de 8 a 128 caracteres, aceptación de los términos, la política de privacidad y la de uso aceptable vigentes, declaración de tener la edad mínima (configurable por el administrador, valor por defecto 18) y captcha. Sin captcha válido se rechaza. Se registran la versión y la fecha de cada documento aceptado y la declaración de edad. La cuenta queda sin verificar y la respuesta es siempre «Te hemos enviado un email», exista o no el email.
- **FR-008** (BE-FR-02 CA1–CA3): La cuenta DEBE poder usarse solo tras abrir el enlace de verificación (válido 24 h). Al verificar se crea la bolsa de bienvenida (FR-023). Un login sin verificar → `EMAIL_NOT_VERIFIED`. Existe «Reenviar email de verificación» en la web y en la API, con límite de frecuencia y respuesta neutra: la API responde siempre «aceptado», salvo `RATE_LIMITED` al superar el límite por IP.
- **FR-009** (BE-FR-03 CA1–CA3): El login DEBE ser por email y contraseña, en la web y en las apps. Credenciales erróneas → `INVALID_CREDENTIALS`, sin distinguir email inexistente de contraseña incorrecta; cuenta bloqueada → `ACCOUNT_BLOCKED`. El login desde una app registra la app, el nombre del equipo y la versión enviados por el cliente, y su respuesta incluye los documentos legales pendientes de aceptar.
- **FR-010** (BE-FR-04 CA1–CA6): Las sesiones DEBEN tener caducidad deslizante de 30 días: cada uso con más de 24 h desde la última renovación la extiende a 30 días desde ese momento. Sin uso durante 30 días → `UNAUTHENTICATED`. Revocar una sesión tiene efecto en la siguiente petición. Cambiar la contraseña revoca todas las sesiones salvo la actual; bloquear a un usuario revoca todas. No hay límite de sesiones simultáneas. Las sesiones caducadas se eliminan 30 días después de caducar.
- **FR-011** (BE-FR-05): La recuperación y el cambio de contraseña DEBEN hacerse solo en la web. El enlace de recuperación caduca en 1 h y es de un solo uso; el cambio exige la contraseña actual. Ambos envían un aviso de seguridad.
- **FR-012** (BE-FR-06): El cierre de sesión desde una app DEBE revocar la sesión usada. En el panel se puede cerrar una sesión concreta o todas.
- **FR-013** (BE-FR-66 CA1–CA5): El cambio de email DEBE hacerse solo en la web, desde el perfil y con la contraseña. Se envía un enlace (24 h) a la nueva dirección y el cambio solo se aplica al abrirlo; la dirección anterior recibe un aviso de seguridad con el email de soporte. La nueva dirección no puede pertenecer a otra cuenta, sin revelarlo («Si la dirección es válida, recibirás un email»). Se recalcula la forma normalizada sin conceder nueva bienvenida y, al aplicarse, se revocan todas las sesiones salvo la actual.
- **FR-014** (BE-FR-67 CA1–CA2): Tras un número de intentos fallidos para un mismo email normalizado en 15 minutos (configurable, valor por defecto 10), los logins de ese email DEBEN rechazarse durante un tiempo configurable (valor por defecto 15 minutos) con `LOGIN_TEMPORARILY_LOCKED` y el tiempo de espera. El contador se lleva exista o no la cuenta. Un login correcto o una recuperación completada lo ponen a cero.
- **FR-015** (BE-FR-68): Las cuentas sin verificar con más días de los configurados (valor por defecto 7) DEBEN eliminarse por completo y su email quedar libre.
- **FR-016** (BE-FR-09): El modelo de cuentas DEBE permitir añadir en una fase posterior «Entrar con Google» y un login en el navegador con retorno a la app sin migrar datos ni cambiar el login existente. No se implementan en la v4.
- **FR-017** (BE-FR-10, Historias 15.15): Existe una única cuenta de administrador, protegida solo con contraseña (decisión expresa: sin segundo factor en la v4). La recibe la cuenta que se registra y verifica con el email de administrador configurado en el servidor; si ya existe otra cuenta de administrador, no se promueve ninguna más.
- **FR-018** (Historias 15.15, constitución III): Cada acción, página y operación de la API DEBE comprobar en el servidor el rol (anónimo, sin verificar, usuario, tester, administrador, bloqueado), la propiedad del recurso y la pertenencia de la sesión a la app; la interfaz no es una barrera de seguridad.

#### Antiabuso del saldo de bienvenida

- **FR-019** (BE-FR-11.1–11.3): Los créditos de bienvenida DEBEN concederse solo tras verificar el email. El registro bloquea dominios de email desechables mediante una lista actualizable sin redesplegar (refresco semanal) y exige captcha.
- **FR-020** (BE-FR-11.4): El sistema DEBE limitar las altas por IP a un máximo configurable en 24 h (valor por defecto 3).
- **FR-021** (BE-FR-11.5, BE-FR-11 CA1): El email DEBE normalizarse para conceder la bienvenida (minúsculas, sin sufijo `+etiqueta` en cualquier dominio y sin puntos en `gmail.com`/`googlemail.com`). Una forma normalizada solo recibe la bienvenida una vez, también tras borrar la cuenta. Una cuenta creada con una forma ya usada se crea, pero sin bienvenida, y el panel lo explica.
- **FR-022** (BE-FR-11.6, BE-FR-11 CA2): Una cuenta sin ninguna compra real completada NO DEBE gastar en un día (Europe/Madrid), sumando cobros y reservas activas de todas las apps, más de un tope configurable (valor por defecto 400 créditos); al superarlo → `DAILY_FREE_LIMIT_REACHED`. Las compras simuladas no cuentan como compra.

#### Créditos, bolsas, reservas y deuda

- **FR-023** (BE-FR-12, BE-FR-13, BE-FR-61 CA1): Al verificar se DEBE crear una bolsa gratuita de bienvenida (configurable, valor por defecto 1.000 créditos = 1 €) con caducidad configurable (valor por defecto 30 días). Las bolsas son **gratuitas** (bienvenida o ajuste gratuito; caducan, y el ajuste puede fijar su propia caducidad) o **compradas** (compra real o simulada, o ajuste «como comprado»; nunca caducan). Cambiar la bienvenida o su caducidad solo afecta a bolsas creadas después.
- **FR-024** (BE-FR-14): El consumo DEBE seguir este orden: primero las bolsas gratuitas (la que caduca antes primero), después las compradas (la más antigua primero); lo que falte pasa a deuda (FR-027).
- **FR-025** (BE-FR-15 CA1): Todo cambio de saldo DEBE generar un movimiento inmutable de uno de estos tipos: bienvenida, compra, uso, ajuste, caducidad, reembolso, contracargo, liquidación de deuda o pérdida por borrado de la cuenta. El saldo visible es la suma de las bolsas menos la deuda y DEBE poder reconstruirse desde los movimientos; una comprobación diaria lo verifica para cada cuenta y una discrepancia genera una alerta al administrador. Las reservas no son movimientos.
- **FR-026** (BE-FR-16): Una tarea diaria DEBE poner a cero las bolsas gratuitas caducadas con un movimiento de caducidad y enviar un único aviso por email unos días antes (configurable, valor por defecto 7) si la bolsa conserva saldo.
- **FR-027** (BE-FR-17): Para lanzar una operación DEBE cumplirse que el saldo disponible sea al menos el mínimo para operar (configurable, valor por defecto 5 créditos) y que su reserva quepa (FR-028); si no, `INSUFFICIENT_BALANCE` sin llamar al proveedor. Si el coste final supera el saldo, se cobra y el exceso pasa a deuda hasta la deuda máxima (configurable, valor por defecto 200 créditos); lo que la supere lo absorbe el administrador y consta como pérdida. Con deuda no se pueden lanzar operaciones. La siguiente entrada de créditos comprados, o cualquier ajuste positivo del administrador (gratuito o comprado), liquida primero la deuda (movimiento de liquidación); en el caso del ajuste gratuito, la parte que liquida consta como pérdida absorbida en las estadísticas.
- **FR-028** (BE-FR-71 CA1–CA2): Antes de llamar al proveedor, el sistema DEBE apartar (reservar) el coste máximo estimado de la operación. La operación solo se lanza si la reserva ≤ saldo disponible + (deuda máxima − deuda actual) y se cumple el mínimo para operar; si no, `INSUFFICIENT_BALANCE` con el importe necesario y el disponible. Al terminar, el cobro del coste real y la liberación de la reserva se aplican juntos; si no se cobra, la reserva se libera sin movimiento. Las reservas caducan (configurable, valor por defecto 600 s) y al reiniciar el servidor se liberan todas y sus operaciones quedan interrumpidas sin cobro. El saldo que se informa distingue total, reservado y disponible.
- **FR-029** (BE-FR-18): El administrador DEBE poder sumar o restar créditos a un usuario indicando tipo de bolsa, caducidad (si es gratuita) y motivo obligatorio; queda en los movimientos y en la auditoría. Un ajuste negativo NO DEBE superar el saldo disponible: si lo supera, se rechaza con un error de validación junto al campo del importe (el administrador no crea deuda por ajuste).
- **FR-030** (Historias §6 y §8): Toda escritura que afecte a saldo, bolsas, deuda, reservas o movimientos (reserva, cobro, compra, ajuste, caducidad, reembolso, contracargo) DEBE aplicarse de forma atómica: o se aplica entera o no se aplica.

#### Tarificación

- **FR-031** (BE-FR-19): El cobro de cada operación completada DEBE calcularse como coste real en USD × (1 + comisión del proveedor que respondió) × tipo de cambio USD→EUR × margen (de la operación o, si no tiene, el global) × créditos por euro de consumo, redondeado hacia arriba a la millonésima de crédito solo al final. Valores por defecto configurables: comisión del intermediario 5,5 %, del proveedor de transcripción 0 %, margen 2,0 y 1.000 créditos por euro tanto de consumo como de compra. Los créditos por euro de consumo y de compra son parámetros distintos: cambiar el de compra no altera el precio de las operaciones ni los créditos ya comprados.
- **FR-032** (BE-FR-20): El coste real DEBE tomarse del coste que informa el proveedor intermediario en su respuesta; si falta, de su consulta posterior; si tampoco está, se estima con los precios por token del modelo y la operación se marca como coste estimado. En la transcripción principal, el coste es segundos de audio × precio por minuto configurado / 60, con los segundos informados por el proveedor o, si no, los medidos por el servidor; nunca la duración que declare el cliente.
- **FR-033** (BE-FR-21): NO DEBEN cobrarse: las operaciones rechazadas antes de llamar al proveedor (validación, saldo, límites, mantenimiento, coste máximo); aquellas en que fallan todos los proveedores; las canceladas antes de que el proveedor respondiera; las interrumpidas por un reinicio; ni, en la transcripción con respaldo, más de lo que cada proveedor haya facturado realmente. Una operación cancelada después de que el proveedor respondiera sí se cobra, salvo la repetición de FR-058. Si el proveedor factura una operación cancelada antes de responder, el usuario no paga; el coste del proveedor, cuando se conoce (en su respuesta o en una consulta posterior), se guarda en la operación y cuenta como pérdida por cancelación (FR-092).
- **FR-034** (BE-FR-22): Con los valores por defecto (tipo de cambio 0,92), el sistema DEBE reproducir exactamente los ejemplos de `Historias.md` BE-FR-22: fix de un párrafo → 0,0004 × 1,055 × 0,92 × 2 × 1.000 = 0,77648 créditos (776.480 microcréditos), se muestra «0,8»; transcripción de 2 min → 3,68, «3,7»; prompt largo PRO de 0,03 USD → 58,236 créditos, «58»; saldo 55 con coste 58,236 → saldo −3,236, se muestra «−3,2». Los importes se muestran en la web y en las apps así: ≥ 10 sin decimales; entre 0,1 y 10 con un decimal; > 0 y < 0,1 como «< 0,1», con formato español; internamente se cobra el valor exacto.
- **FR-035** (BE-FR-72 CA1–CA3): Cada operación DEBE tener un máximo de tokens de salida (que se impone al proveedor) y un coste máximo en créditos. El coste máximo se estima con la fórmula de FR-031: en chat, tokens de entrada estimados (caracteres / caracteres por token, valor por defecto 3, + tokens por imagen, valor por defecto 1.500) × precio de entrada + máximo de salida × precio de salida, con el precio más caro entre el modelo principal y sus respaldos; en transcripción, la duración medida × el precio más caro entre principal y respaldo; en imagen, el precio por imagen o el coste máximo estimado configurado. Si la estimación supera el tope → `OPERATION_TOO_EXPENSIVE` con el estimado y el máximo, sin llamar ni cobrar. Una respuesta cortada por el máximo de salida se marca como truncada y se cobra. Una operación sin precio conocido ni coste máximo estimado no se puede activar.
- **FR-036** (BE-FR-87 CA1–CA3): El tipo de cambio DEBE calcularse a diario como (1 / tipo de referencia EUR/USD del Banco Central Europeo) × (1 + colchón configurable, valor por defecto 3 %), con 0,92 hasta la primera consulta. Cada valor aplicado se guarda con su fecha y origen (automático o manual) y cada cobro usa el vigente en ese momento. Si la consulta falla se mantiene el último valor y, tras varios días seguidos (configurable, valor por defecto 3), se avisa al administrador. El administrador puede fijar un valor manual que sustituye al automático hasta que lo desactive, y queda en la auditoría.
- **FR-037** (BE-FR-73 CA1–CA2): La página pública de precios orientativos DEBE mostrar el coste típico de cada operación, agrupado por app, en créditos y con ejemplos legibles («1 minuto de dictado ≈ 1,8 créditos»; «con 5 € puedes dictar unas N horas»). El coste típico es la mediana de los cobros de los últimos días configurados (valor por defecto 30) cuando hay un mínimo de muestras (valor por defecto 50); si no, un valor del administrador. Se recalcula a diario y la página indica que el cobro real depende de la longitud y del modelo vigente. Está enlazada desde la compra del panel.

#### Compras y pagos

- **FR-038** (BE-FR-23): El administrador DEBE poder definir paquetes comunes a todas las apps (nombre, precio en euros con IVA incluido, bonificación porcentual, activo, orden). Los créditos de un paquete = precio × créditos por euro de compra × (1 + bonificación), calculados en el momento de la compra. Por defecto: 5 € (+0 %), 10 € (+5 %) y 25 € (+10 %).
- **FR-039** (BE-FR-24 CA1): Toda compra DEBE pasar por un único proveedor de pagos intercambiable (simulado en la v4), elegido en la configuración del servidor y no desde el panel, que normaliza los eventos de pago completado, reembolsado y contracargo. La acreditación es idempotente por identificador de pago o evento.
- **FR-040** (BE-FR-25 CA1–CA3): Con el proveedor simulado, «Comprar» DEBE completar el pago al instante sin cobrar dinero y acreditar una bolsa comprada marcada como simulada. Fuera de producción cualquier usuario puede simular compras; en producción solo los testers y el administrador, y el resto ve los paquetes con «Próximamente». Las compras simuladas se excluyen de los ingresos, no generan factura y no cuentan como compra real.
- **FR-041** (BE-FR-25 CA4): Al abrir la compra, el sistema DEBE generar un identificador de intento de un solo uso; la compra es idempotente por él, de modo que un doble clic, un reenvío o volver atrás y reenviar muestran la misma compra sin acreditar de nuevo. Funciona sin JavaScript y sirve igual para el futuro proveedor real.
- **FR-042** (BE-FR-26): Antes de comprar, el usuario DEBE marcar una casilla (nunca premarcada) por la que acepta el inicio inmediato del servicio y reconoce la pérdida del derecho de desistimiento sobre el contenido digital; se registra con fecha y versión del texto. En el mismo paso puede pedir factura completa.
- **FR-043** (BE-FR-27): No DEBE haber reembolsos automáticos ni solicitables desde el panel. El administrador puede reembolsar manualmente una compra: retira de su bolsa el saldo no consumido que indique (movimiento de reembolso), con un proveedor real ordena la devolución del importe que indique (≤ importe pagado) y se emite la factura rectificativa.
- **FR-044** (BE-FR-28): Un contracargo DEBE retirar el saldo restante de la bolsa afectada; lo que no alcance pasa a deuda sin el tope de deuda máxima, y la cuenta queda bloqueada hasta revisión del administrador.
- **FR-045** (BE-FR-29): La integración con el proveedor de pagos real (Stripe, con su gestión de impuestos, recibos y avisos de compra, reembolso y disputa) y la facturación real quedan fuera de la v4; el diseño de compra y facturación NO DEBE impedirlas.

#### Facturación

- **FR-046** (BE-FR-74 CA1–CA3): El perfil DEBE admitir datos fiscales opcionales: tipo (particular o empresa), nombre o razón social, NIF/NIE/CIF o NIF-IVA, dirección, código postal, ciudad y país. Son obligatorios para obtener factura completa y se pueden rellenar en el perfil o en el paso de compra. Se valida el formato del identificador fiscal español. Cada factura guarda una copia de los datos del momento de emisión.
- **FR-047** (BE-FR-75 CA1–CA2): Cada compra real completada DEBE generar una factura a través de un proveedor de facturación externo que cumpla la normativa española (sin motor propio; en la v4 el proveedor es «ninguno»): simplificada si no se pidió completa; completa si se pidió y hay datos fiscales; rectificativa en reembolsos y contracargos. Numeración correlativa por serie, facturas inmutables y descargables en PDF desde el panel; el usuario puede pedir después la completa de una simplificada. La emisión es idempotente por pago y las compras simuladas no generan factura.
- **FR-048** (BE-FR-76): El administrador DEBE poder exportar en CSV, por periodo: ventas (fecha, id de usuario, datos fiscales si los hay, país, base, tipo y cuota de IVA, total, número de factura, referencia del pago, reembolsos y contracargos), costes de IA (por proveedor, día y app, en USD y EUR) y un resumen mensual (ingresos, reembolsos, costes y margen bruto).

#### Pasarela de IA

- **FR-049** (BE-FR-30, BE-FR-31): Cada app DEBE tener un catálogo de operaciones. En las operaciones **libres** la app envía los mensajes completos; en las operaciones **con plantilla** el servidor guarda los mensajes y la app solo envía variables. En ambos casos el sistema elige el modelo, aplica las restricciones de privacidad, reserva, llama al proveedor, cobra y devuelve el resultado; el cliente nunca indica modelo ni proveedor. Solo se aceptan operaciones activas de la app identificada; cualquier otra → `VALIDATION_ERROR` (campo `operation`).
- **FR-050** (BE-FR-77 CA1–CA4, BE-FR-32): Por cada operación, el administrador DEBE definir clave, nombre amigable, tipo (chat, transcripción, imagen), modo (libre o plantilla), modelo principal y respaldos ordenados, proveedor preferido, margen propio, temperatura, máximo de tokens de salida, coste máximo, coste máximo estimado si el modelo no publica precio, tiempo máximo por intento, capacidades permitidas (imagen de entrada, salida estructurada, herramientas), límites de tamaño propios, grupo y estado activo. Los cambios se aplican a la siguiente petición sin publicar versión de la app. No se puede activar sin modelo o con un modelo que no admita lo que necesita. La lista de modelos se obtiene del proveedor intermediario filtrada por modalidades y parámetros admitidos. El panel permite «aplicar a todo el grupo». El sistema calcula el tiempo máximo total de cada operación (intentos, esperas, respaldo y modelos de respaldo) y lo publica en el estado de la app para que los clientes fijen su propio tiempo de espera.
- **FR-051** (BE-FR-78 CA1–CA4): Las plantillas DEBEN declarar variables con tipo (texto o imagen), obligatoriedad y longitud o tamaño máximo. Una variable que falta, sobra o excede su límite → `VALIDATION_ERROR`. Cada cambio crea una versión nueva e inmutable y cada operación registra la versión usada. En operaciones con plantilla el cliente no puede enviar mensajes ni alterar el esquema de salida ni las herramientas. Los valores de las variables son contenido del usuario (FR-060).
- **FR-052** (BE-FR-79 CA1): Si la operación lo permite, el cliente DEBE poder pedir salida estructurada según un esquema o herramientas (en las de plantilla los define la plantilla); solo atienden proveedores que los admitan. La respuesta incluye el objeto interpretado y si cumple el esquema, o las llamadas a herramientas. Las herramientas se ejecutan en el cliente y cada vuelta es una operación independiente que se cobra. Un resultado que no cumple el esquema se cobra y se devuelve marcado como no válido junto con el texto bruto.
- **FR-053** (BE-FR-33): Toda llamada al proveedor intermediario DEBE pedir que no se recojan ni retengan los datos, permitir el cambio de proveedor subyacente (respetando el proveedor preferido y, con salida estructurada, solo proveedores que admitan los parámetros), identificar la plataforma y la app, e imponer el máximo de tokens y la temperatura de la operación (valor por defecto 0,7 en chat).
- **FR-054** (BE-FR-34): El chat DEBE recibir la operación y los mensajes (texto, o texto e imágenes) o las variables, y opcionalmente salida estructurada y herramientas; valida tamaños, comprueba saldo, reserva y límites, llama al proveedor con el tiempo máximo de la operación (valores por defecto 45 s; 60 s en `image-transcription`) y devuelve el resultado, el cobro y el saldo.
- **FR-055** (BE-FR-35): La transcripción DEBE recibir la operación y el audio (hasta el tamaño máximo). El administrador elige el escenario: solo principal, principal con respaldo, o solo respaldo (no se permite desactivar el principal sin respaldo). El principal se reintenta a los 2, 4 y 8 s con 45 s por intento; si falla, se usa el respaldo (60 s). Si fallan ambos → `TRANSCRIPTION_FAILED` con el error saneado de cada uno, sin nombres de modelo ni datos internos. La respuesta indica si se usó el principal o el respaldo, sin el modelo. Máximo de transcripciones simultáneas por usuario configurable (valor por defecto 2).
- **FR-056** (BE-FR-36): La generación de imágenes DEBE recibir la operación y el texto de la petición (o variables), con el tiempo máximo de la operación (valor por defecto 60 s), y devolver la imagen sin almacenarla.
- **FR-057** (BE-FR-80 CA1): Si el modelo principal falla (error, no disponible o tiempo agotado), el sistema DEBE probar los respaldos en orden dentro del tiempo total de la operación y cobrar solo lo que cada proveedor haya facturado. Una tarea diaria actualiza el catálogo de modelos (precios, modalidades y parámetros) y comprueba cada modelo asignado: si desaparece o deja de admitir lo necesario → email y aviso en el panel; si su precio cambia más de un porcentaje configurable (valor por defecto 20 %) → email. La respuesta al cliente nunca revela el modelo ni si se usó un respaldo (salvo principal/respaldo en la transcripción).
- **FR-058** (BE-FR-81 CA1–CA2): Las peticiones de IA DEBEN aceptar una clave de idempotencia por acción del usuario. Para un mismo usuario y clave, durante una ventana configurable (valor por defecto 10 minutos): si sigue en curso → `REQUEST_IN_PROGRESS` sin llamar; si terminó y se entregó → `DUPLICATE_REQUEST` con el identificador de la operación, sin llamar ni cobrar; si terminó pero no se entregó → se ejecuta de nuevo y esa repetición no se cobra (el coste consta como absorbido); si falló o se canceló antes de la respuesta del proveedor → se ejecuta con normalidad. El contenido no se guarda para reentregarlo. Sin clave, cada petición es independiente.
- **FR-059** (BE-FR-37, Historias 7.4): Si el cliente cierra la conexión, el sistema DEBE abortar la llamada en curso, detener los reintentos y registrar la operación como cancelada (o no entregada si el proveedor ya había respondido), cobrando según FR-033 y FR-058. Abortar una petición sin *streaming* no evita que el proveedor la facture: la operación cancelada no se cobra al usuario, pero el coste del proveedor que se llegue a conocer se registra como pérdida por cancelación.
- **FR-060** (BE-FR-38 CA1–CA2, Historias §10.5): Cada operación DEBE dejar un registro de metadatos (usuario, app, sesión, operación, versión de plantilla, proveedor, modelo, estado, tokens, segundos de audio, coste real, reserva, cobro, duración, versión de la app, código de error, clave de idempotencia, marca de moderación) y **nunca** audios, textos, prompts, variables, imágenes ni resultados: ni en el almacenamiento, ni en los registros de diagnóstico, ni en ficheros temporales más allá de la vida de la petición (también en error o cancelación). Los registros de diagnóstico identifican al usuario por id, no por email, y no contienen cuerpos de petición o respuesta de IA ni de sincronización.
- **FR-061** (BE-FR-82): No hay moderación propia. Cuando un proveedor rechaza una petición por moderación, la operación DEBE registrarse como marcada (sin contenido) y el cliente recibe `PROVIDER_ERROR` con un mensaje genérico. Si un usuario acumula en un día un número configurable de operaciones marcadas (valor por defecto 3), se avisa al administrador, que puede bloquear la cuenta.
- **FR-062** (Historias 7.1–7.2, BE-FR-48 CA3): Todos los errores de la API DEBEN tener un formato común (código, mensaje en español apto para mostrar y detalles) y usar solo los códigos de `Historias.md` 7.2 (p. ej. `PROVIDER_ERROR` si el proveedor falla y `PROVIDER_TIMEOUT` si agota el tiempo). La API publica un contrato legible por máquina y se versiona: un cambio incompatible exige una versión nueva manteniendo la anterior durante una transición. El contrato detallado (rutas, cabeceras, cuerpos y códigos) está en `Historias.md` §7.
- **FR-063** (Historias §8): Cada operación de IA DEBE seguir este orden: identificar la app → autenticar la sesión de esa app → comprobar versión → mantenimiento, app activa, freno global y documentos pendientes → idempotencia → validación (incluida la medida del audio) → límites → coste máximo → saldo, deuda, tope diario y reserva → proveedor → coste real y cobro → respuesta → comprobación del aviso de saldo bajo. Si el proceso falla entre la reserva y el cobro, no se cobra.

#### Sincronización y predeterminados

- **FR-064** (BE-FR-39): Cada cuenta DEBE tener un documento por app. Cada app declara sus categorías y la estrategia de fusión de cada una: elementos con clave, fecha y marcas de borrado; bloque completo con fecha; o valores por clave con su fecha. La fusión la hace el cliente; el servidor valida que solo hay categorías declaradas, con la forma de su estrategia, y que no se supera el tamaño máximo (configurable por app, valor por defecto 1024 KB). Perfil de Secretario: sustituciones personalizadas (elementos, con marcas de borrado que caducan a los 30 días), sustituciones base, textos rápidos y prompts (bloques) y preferencias de uso (por clave); los ajustes propios de cada equipo no se sincronizan (`Historias.md` 5.9). Una tarea diaria elimina las marcas de borrado de más de 30 días.
- **FR-065** (BE-FR-40): La primera vez que una cuenta lee el documento de una app, el sistema DEBE crearlo (con revisión 1) copiando los predeterminados vigentes de esa app con todas las fechas a cero, de modo que los datos locales del usuario prevalecen.
- **FR-066** (BE-FR-41 CA1–CA2): La lectura DEBE devolver el documento y su número de revisión; la escritura indica la revisión esperada y, si no coincide, recibe `SYNC_CONFLICT`. Nunca se pierde una escritura en silencio. Categorías no declaradas o mal formadas → `VALIDATION_ERROR`; exceso de tamaño → `PAYLOAD_TOO_LARGE`.
- **FR-067** (BE-FR-42 CA1–CA4, BE-FR-57): El administrador DEBE poder editar los predeterminados de cada app y usar «Copiar mis datos actuales como predeterminados» con vista previa por categorías y casillas por elemento; solo se sustituyen las categorías con algún elemento seleccionado. Cambiar los predeterminados no modifica ninguna cuenta. Las apps pueden obtener los predeterminados vigentes, también durante el mantenimiento y con documentos legales pendientes. Cada copia o edición queda en la auditoría.
- **FR-068** (BE-FR-65 CA3, Historias 4.3): Los datos que dependen de una app (operaciones, sincronización, predeterminados, versiones, mantenimiento, enlaces, anuncios) DEBEN estar aislados por app: una app nunca lee ni modifica los de otra.

#### Protecciones y continuidad

- **FR-069** (BE-FR-43, BE-FR-63 CA4): Cada usuario DEBE tener un máximo de peticiones de IA por minuto (valor por defecto 30) y de transcripciones simultáneas (valor por defecto 2). El valor global se aplica a la **suma de todas las apps** de la cuenta; una app puede tener además su propio valor, que limita solo las peticiones de esa app y no puede ser mayor que el global. Se aplica el primero que se alcance; superarlo → `RATE_LIMITED` con el tiempo de espera.
- **FR-070** (BE-FR-44): El sistema DEBE rechazar sin llamar al proveedor ni cobrar: audio de más de 10 MB o texto de más de 200.000 caracteres o imagen de más de 10 MB → `PAYLOAD_TOO_LARGE`; audio de más de 300 s (más una tolerancia de 10 s por la parada automática de la app) → `AUDIO_TOO_LONG` con la duración máxima. Todos los valores son configurables (por app y, en texto e imagen, por operación). La duración se mide en el servidor sobre el audio completo; un audio ilegible → `VALIDATION_ERROR`. El servidor DEBE aceptar peticiones del tamaño del mayor audio configurado en cualquier app.
- **FR-071** (BE-FR-45): Login, registro, reenvío de verificación, recuperación de contraseña y cambio de email DEBEN tener límites de frecuencia por IP, además del límite de altas por IP (FR-020) y el bloqueo por email (FR-014).
- **FR-072** (BE-FR-46 CA1): Si el coste real acumulado del día (Europe/Madrid) de las cuentas sin compras reales más sus reservas en curso supera un freno configurable (valor por defecto 5 €), el sistema DEBE rechazar nuevas operaciones de esas cuentas con `SERVICE_LIMITED` hasta el día siguiente o hasta que el administrador lo libere, y enviar un email al administrador al activarse. Las cuentas con compras reales no se ven afectadas.
- **FR-073** (BE-FR-47): DEBE existir un modo mantenimiento global y otro por app, cada uno con mensaje. Activo, las operaciones de IA y la sincronización afectadas responden `MAINTENANCE` con el mensaje; el login, los datos de la cuenta y el estado de la app siguen funcionando.
- **FR-074** (BE-FR-48 CA1–CA2): Las apps DEBEN enviar su versión en cada petición. El administrador configura por app la versión mínima, la recomendada y si se exige (valores por defecto en Secretario: 4.0.0 / 4.0.0 / sí). Una petición autenticada de una app que exige versión, con versión inferior a la mínima o sin versión → `UPGRADE_REQUIRED`, salvo el cierre de sesión (el estado de la app no requiere sesión ni versión mínima). El estado de la app, consultable sin sesión, devuelve ambas versiones, el mantenimiento, los límites, el tiempo máximo de cada operación activa, los enlaces (registro, recuperación, panel, compra, precios y legales), el email de soporte y los anuncios activos.
- **FR-075** (BE-FR-84): DEBE existir un email de soporte global (configurable, valor por defecto `soporte@mardomingo.com`), sobrescribible por app, publicado en el estado de la app, el panel, las landings y el pie de los emails. No hay sistema de tickets en la v4.
- **FR-076** (BE-FR-85 CA1–CA2): El administrador DEBE poder crear anuncios con app (o todas), texto, nivel (información, advertencia, crítico), ventana de validez, enlace opcional y rango de versiones. El estado de la app devuelve los activos que aplican a esa app y versión; el panel de usuario los muestra según FR-087. Cada anuncio tiene un identificador estable para que el cliente recuerde los que el usuario ha cerrado.

#### Panel de usuario

- **FR-077** (BE-FR-49.1): El panel DEBE mostrar el saldo total, el reservado (si lo hay), el desglose por bolsas (gratuitas con fecha de caducidad y compradas), la deuda si existe y la equivalencia en euros según los créditos por euro de compra.
- **FR-078** (BE-FR-49.2): El panel DEBE permitir comprar los paquetes activos (FR-038 a FR-042), con enlace a los precios orientativos y la opción de factura completa.
- **FR-079** (BE-FR-49.3, BE-FR-49.4, BE-FR-63 CA2): El panel DEBE listar de forma paginada los movimientos y el consumo (fecha, app, nombre amigable de la operación, estado y créditos cobrados), con filtro por app, sin mostrar nunca el modelo ni el coste real.
- **FR-080** (BE-FR-49.5): El panel DEBE mostrar gráficas de créditos consumidos por día, por operación y por app en los últimos 30 o 90 días.
- **FR-081** (BE-FR-49.6): El panel DEBE permitir exportar en CSV los movimientos y el consumo, filtrando por fechas y app.
- **FR-082** (BE-FR-49.7): El usuario DEBE poder fijar un umbral de saldo bajo o desactivarlo (tan fácil como activarlo). Se envía un único email al cruzar el umbral hacia abajo y el aviso se rearma al volver a superarlo. Las apps usan el mismo umbral para su propio aviso.
- **FR-083** (BE-FR-49.8): El panel DEBE listar las sesiones activas (app, equipo, versión de la app, último uso, IP aproximada: IPv4 truncada a /24 e IPv6 a /48) y permitir cerrar una o todas.
- **FR-084** (BE-FR-49.9): El perfil DEBE permitir cambiar el email (FR-013) y la contraseña (FR-011), editar los datos fiscales (FR-046), exportar los datos (FR-105) y borrar la cuenta (FR-104).
- **FR-085** (BE-FR-49.10): El panel DEBE listar las facturas con descarga en PDF y permitir pedir la factura completa de una compra.
- **FR-086** (BE-FR-49.11): «Mis apps» DEBE mostrar las apps disponibles con su enlace de descarga o acceso (Secretario: instalador de la última versión publicada).
- **FR-087** (BE-FR-49.12, BE-FR-49.13, BE-FR-85 CA1): El panel DEBE mostrar los anuncios activos dirigidos a todas las apps y los de las apps que la cuenta ha usado (con sesión actual o pasada, o con documento sincronizado), sin filtrar por versión e indicando a qué app se refiere cada uno; además, los documentos legales pendientes de aceptar y el email de soporte.

#### Administración

- **FR-088** (BE-FR-50): El administrador DEBE poder buscar usuarios por email y ver su detalle (saldo, reservas, bolsas, movimientos, consumo por app, sesiones, pagos, facturas, datos fiscales, operaciones marcadas por moderación); bloquear o desbloquear con motivo (bloquear revoca sus sesiones); ajustar el saldo (FR-029); marcar o desmarcar como tester; cerrar sesiones y reembolsar compras (FR-043).
- **FR-089** (BE-FR-51): El administrador DEBE poder editar los parámetros económicos y los paquetes, y los valores manuales de los precios orientativos.
- **FR-090** (BE-FR-52): El administrador DEBE poder gestionar las apps, el catálogo de operaciones, las plantillas, los modelos y respaldos y, en la transcripción, el principal, el respaldo, la desactivación del principal y su precio por minuto; el panel muestra los avisos de modelos retirados o con cambio de precio.
- **FR-091** (BE-FR-53): El administrador DEBE poder gestionar los límites (globales y por app), el freno global y su liberación manual, el mantenimiento (global y por app) y las versiones mínima y recomendada por app.
- **FR-092** (BE-FR-54): Las estadísticas DEBEN mostrar, por día, app, operación y usuario: coste real (USD y EUR), cobrado (créditos y su equivalente en euros al valor de consumo), margen bruto, pérdidas por deuda absorbida, por repeticiones no cobradas y por cancelación (coste del proveedor de operaciones canceladas sin cobro), saldo perdido por borrado de cuentas, operaciones fallidas, canceladas, interrumpidas o truncadas, uso de modelos de respaldo, usuarios activos, altas por app de origen, compras reales (sin simuladas) e ingresos.
- **FR-093** (BE-FR-54): Las estadísticas DEBEN incluir un embudo de alta por app, semanal y acumulado: descargas del instalador (obtenidas a diario del contador de GitHub Releases cuando el enlace de descarga apunta allí), registros con esa app de origen, cuentas verificadas, primer login desde la app y primera operación de IA.
- **FR-094** (BE-FR-55): Toda acción del administrador que modifique datos (ajustes, bloqueos, configuración, apps, operaciones, plantillas, modelos, paquetes, predeterminados, anuncios, documentos legales, reembolsos, tipo de cambio manual) DEBE quedar en una auditoría con fecha, acción, entidad, valores anterior y nuevo y motivo, que no se puede editar ni borrar desde el panel.
- **FR-095** (BE-FR-56): Cada hora el sistema DEBE consultar el saldo del proveedor intermediario y avisar por email al administrador si baja de un umbral configurable (valor por defecto 10 USD), una vez por cruce. Para el proveedor de transcripción, que no expone saldo, se avisa cuando sus llamadas devuelven errores de pago o de cuota.
- **FR-096** (BE-FR-61 CA1–CA5): Todos los parámetros de `Historias.md` §9, los paquetes, las apps, las operaciones, las plantillas y los modelos DEBEN ser editables desde el panel sin redesplegar. Los cambios se aplican a la siguiente operación salvo que el parámetro diga otra cosa; cada campo se valida (tipos, rangos y coherencia: p. ej. margen ≥ 1 y mínimo para operar ≥ 0); cada cambio se audita con el valor anterior y el nuevo; el panel muestra el valor por defecto y una explicación de cada parámetro y, en los parámetros «por app», el valor efectivo y su origen (global o app). Solo los secretos y la infraestructura quedan fuera del panel.
- **FR-097** (Historias 5.12, BE-FR-57, BE-FR-70, BE-FR-76, BE-FR-85): El panel de administración DEBE incluir además los predeterminados por app, la facturación y la exportación contable, los documentos legales y sus versiones, y los anuncios.

#### Emails y alertas

- **FR-098** (BE-FR-58): Los emails DEBEN enviarse desde un dominio remitente autenticado, en español, con la marca paraguas, el nombre de la app cuando se refieran a una y el email de soporte en el pie. Al usuario: verificación de cuenta, recuperación de contraseña, aviso de contraseña cambiada, verificación del nuevo email, aviso de email cambiado (a la dirección anterior), saldo bajo, créditos gratuitos a punto de caducar, nueva versión de documentos legales, factura disponible (solo con cobros reales) y aviso de borrado por inactividad. Al administrador: freno global activado, saldo del intermediario bajo o errores de pago del proveedor de transcripción, modelo retirado o con cambio de precio, operaciones marcadas por moderación, discrepancia en el historial de movimientos y tipo de cambio sin actualizar. Con el pago simulado no se envían recibos.
- **FR-099** (Historias §5.13, BE-FR-56): Las alertas por umbral DEBEN enviarse una sola vez por cruce del umbral y no repetirse hasta que la situación se normalice y se vuelva a cruzar.

#### Landings, páginas legales, privacidad y retención

- **FR-100** (BE-FR-59): La landing principal DEBE explicar la Cuenta Mardomingo (una cuenta y un saldo para todas las apps) y ofrecer la lista de apps, «Crear cuenta», «Iniciar sesión» y el enlace a precios. Cada app tiene una landing generada desde su registro (qué hace, cómo empezar con la cuenta y el saldo de bienvenida, botón de descarga o acceso y «Crear cuenta» con su origen), o una landing externa si la declara. Las landings básicas se podrán sustituir sin cambiar la API.
- **FR-101** (BE-FR-59): La landing de Secretario DEBE incluir, junto a la descarga permanente, la explicación en texto de cómo continuar ante el aviso de Windows SmartScreen («Más información» → «Ejecutar de todas formas»), con una captura de apoyo.
- **FR-102** (BE-FR-60): DEBEN existir las páginas de términos, privacidad, cookies y uso aceptable, con contenido versionado. Solo se usan cookies técnicas (sesión y preferencias estrictamente necesarias, incluidas las de tema y efectos), sin analítica de terceros ni banner de consentimiento. El servicio y sus datos residen en la UE. La política de privacidad declara que no se almacena contenido, qué metadatos se guardan y cuánto tiempo, las apps de la plataforma, los proveedores que procesan contenido (dentro y fuera de la UE) y la base legal de las transferencias.
- **FR-103** (BE-FR-70 CA1–CA3, BE-FR-82): El administrador DEBE poder publicar nuevas versiones de términos, privacidad, cookies y uso aceptable (que prohíbe los usos ilícitos o abusivos de la IA), indicando si requieren nueva aceptación o son informativas. Con una aceptación pendiente, los datos de la cuenta y la respuesta de login la incluyen, y la IA y la sincronización responden `TERMS_ACCEPTANCE_REQUIRED`; el login, los datos de la cuenta, el estado de la app y la aceptación siguen funcionando. La app y el panel muestran los documentos y permiten aceptarlos (aceptar una versión no vigente → `VALIDATION_ERROR`). Las informativas se notifican por email y en el panel sin bloquear.
- **FR-104** (BE-FR-07 CA1–CA3): El borrado de cuenta DEBE hacerse desde el panel, con contraseña y aviso explícito de que el saldo restante se pierde sin reembolso y de que afecta a todas las apps. Revoca todas las sesiones, pone a cero las bolsas restantes con un movimiento de pérdida por borrado (que cuenta en las estadísticas) y elimina email, perfil, datos fiscales y datos sincronizados de todas las apps; la cuenta queda marcada como borrada. Movimientos, operaciones y pagos se conservan anonimizados; las facturas emitidas se conservan íntegras durante el plazo legal. El email queda libre, pero su forma normalizada no recibe de nuevo la bienvenida.
- **FR-105** (BE-FR-08): El panel DEBE permitir descargar en un fichero JSON el perfil, los datos fiscales, los datos sincronizados de cada app, los movimientos, los metadatos de las operaciones, los pagos, las facturas y las aceptaciones legales del usuario.
- **FR-106** (BE-FR-86 CA1–CA3): Una cuenta verificada sin compras reales y sin actividad (login, uso de la API o acceso al panel) durante un periodo configurable (valor por defecto 3 años) DEBE recibir un aviso y, si no hay actividad en el plazo siguiente (valor por defecto 30 días), borrarse como en FR-104. Cualquier actividad cancela el borrado. Las cuentas con alguna compra real nunca se borran de forma automática. Los créditos gratuitos restantes se pierden.
- **FR-107** (BE-FR-83): Una tarea diaria DEBE aplicar los plazos de conservación por defecto: cuentas sin verificar 7 días; cuentas inactivas sin compras 3 años + 30 días de aviso; sesiones caducadas o revocadas 30 días; IP de registro y de aceptaciones mientras exista la cuenta y después durante el plazo de prescripción; metadatos de operaciones ligados al usuario 24 meses y después anonimizados; registros de diagnóstico 30 días; movimientos, pagos y facturas el plazo legal (orientativo 6 años); datos sincronizados y fiscales mientras exista la cuenta; copias de seguridad 30 días.

#### Experiencia de usuario (Historias §16; detalle de estados en §16.6)

- **FR-108** (UX-TEMA CA1–CA5): Toda página DEBE ofrecer un selector de tema Sistema / Claro / Oscuro, disponible también sin sesión y sin JavaScript, como grupo de tres opciones con nombre accesible y la opción actual indicada. Sin preferencia guardada el tema es Sistema y sigue la apariencia del sistema desde la primera pintura, sin destello. Con Sistema, un cambio de apariencia durante la sesión actualiza la página sin recargar ni perder lo escrito, el foco o la posición. Claro u Oscuro se guardan en una cookie técnica y la página llega ya pintada con ese tema hasta que se vuelva a elegir Sistema. El tema oscuro está diseñado expresamente, incluidos estados, foco, gráficas e imágenes.
- **FR-109** (UX-EFECTOS CA1–CA4): Junto al selector de tema DEBE haber un ajuste «Reducir transparencia y movimiento», guardado en una cookie técnica y operable sin JavaScript, que vuelve opacas todas las superficies translúcidas y retira el movimiento no esencial sin perder acciones, contenido, foco ni estados. Las preferencias del sistema (transparencia reducida, movimiento reducido, más contraste, colores forzados) se respetan siempre; el ajuste propio solo puede reducir efectos, nunca reactivar lo que el sistema pide reducir.
- **FR-110** (Historias 16.3): Las superficies translúcidas DEBEN limitarse a la navegación, las superposiciones (casi opacas) y las tarjetas de resumen destacadas (saldo del panel y bloque principal de las landings); tablas, formularios, listas, gráficas, compra, textos legales, pantallas de datos de administración y emails son siempre opacos. No se anidan superficies translúcidas y su alternativa opaca conserva acciones, información, jerarquía y foco.
- **FR-111** (Historias 16.5, constitución IX): Toda la web, incluido el panel de administración, DEBE cumplir WCAG 2.2 AA y ser mobile-first: objetivos táctiles de al menos 44 × 44 px; sin desplazamiento horizontal de la página a 320 px (las tablas pueden desplazarse en su contenedor o pasar a vista de detalle, sin ocultar columnas necesarias); funcional con zoom al 200 % y con el espaciado de texto de WCAG; el campo con el foco y su acción visibles con el teclado virtual abierto; operable solo con teclado con foco visible; contraste suficiente en ambos temas; formularios con etiquetas visibles y errores en texto junto al campo; el color nunca como único indicador; cada página con un título propio que coincide con su encabezado principal y la ubicación actual marcada en la navegación.
- **FR-112** (constitución IX «Mejora progresiva», Historias 16.11): Todos los formularios y flujos críticos DEBEN funcionar sin JavaScript (login, compra, datos fiscales, aceptación legal, acciones de administración, tema y efectos, filtros y paginación). Solo las gráficas (que siempre tienen tabla equivalente) y el captcha del registro pueden requerir JavaScript; sin él, el registro lo explica.
- **FR-113** (Historias 16.6): Cada área DEBE implementar los estados que le apliquen según `Historias.md` 16.6: landings (landing externa, app desactivada, descarga no disponible, ninguna app activa); registro, verificación, login, recuperación y cambio de email (envío pendiente sin doble envío, errores por campo con resumen enlazado y foco en él, captcha que falla con reintento, mensaje neutro que explica qué hacer si el email no llega, enlace caducado o usado con forma de pedir otro, cuenta sin verificar, cuenta bloqueada con soporte, bloqueo temporal con tiempo restante, sesión caducada con vuelta a la página pedida); saldo, movimientos y consumo (primer uso, sin bienvenida explicada, reservado, deuda, saldo bajo, vacío, sin coincidencias, error de carga); compra (no disponible, casilla sin marcar, pendiente, éxito con saldo nuevo, repetición, error del proveedor con lo conservado y sin cobro); perfil, sesiones, exportación y borrado; avisos; gráficas; administración (sin resultados, usuario anonimizado, motivo obligatorio, confirmación con alcance e importe, valor anterior y nuevo, freno global visible, éxito con enlace a la auditoría); y errores globales 404, 403 y 500 con «Código de referencia» y una salida conocida.
- **FR-114** (Historias 16.7, constitución IX): Los textos DEBEN usar vocabulario de usuario (créditos, saldo, saldo reservado, deuda, créditos gratuitos o comprados y su caducidad), botones con su resultado concreto («Comprar 10 € de créditos», «Borrar mi cuenta», «Cerrar las demás sesiones»), importes en créditos con su equivalencia en euros y cifras tabulares, ayuda imprescindible fuera de los *tooltips* y errores que dicen qué ha fallado, dónde, cómo corregirlo y qué se ha conservado. Ante un error se conservan los datos válidos salvo contraseñas, y ningún resultado con consecuencias se presenta como confirmado antes de que lo confirme el servidor. Quedan prohibidos los patrones manipulativos: paquetes preseleccionados, urgencia falsa, casillas legales premarcadas y bajas más difíciles que las altas. Toda la interfaz está en español y preparada para traducción.
- **FR-115** (UX-01): El registro DEBE tener etiquetas visibles y persistentes, mostrar la regla de la contraseña (8–128) antes de escribir, admitir pegar y gestores de contraseñas, ofrecer un botón para mostrar la contraseña con nombre y estado, y, si falla, conservar todo salvo la contraseña y llevar el foco al resumen de errores.
- **FR-116** (UX-02): Tras registrarse, la pantalla DEBE indicar a qué dirección se ha enviado el email, qué hacer si no llega y permitir reenviarlo indicando cuándo se puede volver a intentar.
- **FR-117** (UX-03): La confirmación de la verificación DEBE mostrar el saldo de bienvenida concedido (o por qué no se concede) y el siguiente paso de la app de origen.
- **FR-118** (UX-04): El login DEBE mostrar un error de credenciales genérico, indicar en el bloqueo temporal cuándo se puede reintentar y, tras iniciar sesión, volver a la página pedida (solo destinos internos).
- **FR-119** (UX-05): El paso de compra DEBE mostrar el paquete, el precio con IVA, los créditos resultantes, la casilla obligatoria y la opción de factura completa; un doble envío muestra la misma compra y el resultado muestra el saldo nuevo.
- **FR-120** (UX-06): Cuando no se puede comprar, el texto «Próximamente» y su explicación DEBEN ser visibles y accesibles, no solo un botón desactivado.
- **FR-121** (UX-07): La confirmación del borrado DEBE mostrar el saldo que se pierde (en créditos y euros) y las apps afectadas, y pedir la contraseña; la acción se llama «Borrar mi cuenta» y el foco inicial no está en ella; al terminar, la sesión está cerrada y se confirma el borrado.
- **FR-122** (UX-08): Las gráficas DEBEN tener título, periodo, unidad y tabla equivalente; «sin datos» no se dibuja como cero; el selector de 30/90 días funciona sin JavaScript y deja el periodo en la dirección de la página.
- **FR-123** (UX-09): Filtros, orden y paginación DEBEN funcionar sin JavaScript con botón visible y enlaces de página; las listas conservan filtros y página en la dirección y los restauran al volver; la exportación CSV indica el rango y los filtros aplicados.
- **FR-124** (UX-10): La sesión actual DEBE identificarse como «Esta sesión» y el texto de «cerrar todas» indica si la actual se mantiene.
- **FR-125** (UX-11): El aviso de documentos pendientes DEBE enlazar a cada documento, permitir aceptarlos y explicar qué deja de funcionar en las apps hasta hacerlo.
- **FR-126** (UX-12): Los anuncios del panel DEBEN mostrar su nivel con icono y texto además del color.
- **FR-127** (UX-13): Antes de confirmar un ajuste de saldo, un reembolso, un bloqueo o un cierre de sesiones, el administrador DEBE ver el usuario, el importe y el efecto (saldo antes → después); el motivo es obligatorio y, al guardar, se enlaza la entrada de auditoría.
- **FR-128** (UX-14): Los cambios de parámetros económicos y de protecciones DEBEN mostrar el valor anterior, el nuevo y su alcance (global o por app) antes de guardar.
- **FR-129** (UX-15): La búsqueda de usuarios DEBE funcionar sin JavaScript, con estados inicial, sin resultados y error, y conservar la consulta.
- **FR-130** (UX-16): La explicación de SmartScreen DEBE dar los pasos en texto; la captura es un apoyo con texto alternativo.
- **FR-131** (UX-17): Los emails DEBEN leerse bien en clientes con modo oscuro, tener versión en texto plano, mostrar el enlace de cada botón también como dirección visible y no depender de imágenes.
- **FR-132** (UX-18): Tras cambiar la contraseña o el email, la confirmación DEBE indicar que las demás sesiones se han cerrado.

### Key Entities *(include if feature involves data)*

- **Cuenta (usuario)**: persona registrada. Email, forma normalizada del email, estado de verificación, roles (usuario, tester, administrador), bloqueo con motivo, app de origen del registro, fecha de alta y marca de borrado. Tiene sesiones, bolsas, un saldo, movimientos, operaciones de IA, pagos, perfil fiscal, facturas, documentos sincronizados (uno por app) y aceptaciones legales.
- **Sesión**: acceso abierto de una cuenta, en la web o en una app concreta. Caducidad deslizante, último uso, IP, equipo y versión de la app. Pertenece a una cuenta y, si es de app, a una app.
- **Intentos de login**: contador de fallos por email normalizado (sin revelar si existe) con su ventana y el fin del bloqueo temporal.
- **Concesión de bienvenida**: huella del email normalizado que ya recibió el saldo de bienvenida; sobrevive al borrado de la cuenta.
- **Dominio desechable**: dominio de email cuyo registro se bloquea; lista actualizable.
- **App**: cliente registrado (p. ej. Secretario). Identificador estable, nombre, descripción, tipos de cliente, estado, enlaces, versiones mínima y recomendada, exigencia de versión, mantenimiento propio, orígenes permitidos, texto opcional de pasos siguientes tras verificar, sobrescrituras de parámetros (incluidos los límites por usuario propios de la app), esquema de sincronización y email de soporte. Tiene operaciones, predeterminados y anuncios.
- **Operación de app**: tipo de uso de IA facturable de una app. Clave, nombre amigable, tipo, modo (libre o plantilla), modelo principal y respaldos, proveedor preferido, margen, temperatura, máximo de salida, coste máximo, tiempo máximo, capacidades, límites, configuración de transcripción, grupo y estado.
- **Plantilla de prompt**: versión inmutable de los mensajes, variables declaradas, esquema de salida y herramientas de una operación con plantilla.
- **Modelo de IA (catálogo)**: información de cada modelo disponible en el intermediario (precios, modalidades y parámetros admitidos) y fecha de actualización; base de la estimación y de la vigilancia.
- **Bolsa de créditos**: lote de créditos de una cuenta. Tipo (gratuita o comprada), importe inicial y restante, caducidad (solo gratuitas), origen (bienvenida, compra, ajuste), pago asociado y marca de simulada.
- **Saldo de la cuenta**: deuda actual, si la cuenta tiene alguna compra real, umbral de saldo bajo y si ya se avisó. El saldo es la suma de bolsas menos la deuda; el disponible descuenta además las reservas.
- **Reserva**: importe apartado temporalmente para una operación en curso, con su caducidad y su liberación. No cambia el saldo, solo el disponible.
- **Movimiento**: entrada inmutable del historial de saldo (incluida la pérdida del saldo restante al borrar la cuenta). Tipo, importe con signo, bolsa, operación, app (informativa), pago y motivo del administrador.
- **Operación de IA (registro)**: metadatos de cada uso de IA, sin contenido: cuenta, app, sesión, operación, versión de plantilla, proveedor, modelo, uso de respaldo, estado (en curso, correcta, error del proveedor, cancelada, no entregada, interrumpida, rechazada), clave de idempotencia, tokens, segundos de audio, coste real (y si es estimado; también el de las canceladas que el proveedor facture), reserva, cobro, coste absorbido, truncado, marcada por moderación, duración, versión de la app y código de error.
- **Paquete**: oferta de compra común a todas las apps. Nombre, precio con IVA, bonificación, estado y orden.
- **Pago (compra)**: compra de un paquete. Proveedor, referencia única, estado (pendiente, completado, reembolsado, parcialmente reembolsado, contracargo), importe, base, IVA y tipo, país, créditos acreditados, si pidió factura completa y si es simulado. Se asocia a un intento de compra de un solo uso y a la aceptación del desistimiento.
- **Perfil fiscal**: datos fiscales opcionales de la cuenta (tipo, nombre o razón social, identificador fiscal, dirección, código postal, ciudad, país).
- **Factura**: documento inmutable de una compra real. Tipo (simplificada, completa, rectificativa), serie y número, copia de los datos fiscales, importe, factura que corrige, proveedor de facturación, referencia y PDF.
- **Documento sincronizado**: datos de configuración de una cuenta para una app, con su número de revisión. Uno por cuenta y app.
- **Predeterminados de app**: plantilla de datos de usuario de una app que define el administrador y se copia al primer uso.
- **Documento legal**: versión publicada de términos, privacidad, cookies, uso aceptable o texto de renuncia al desistimiento, con fecha de publicación, si exige nueva aceptación y huella del contenido.
- **Aceptación**: registro de que una cuenta aceptó una versión de un documento legal (o declaró la edad mínima), con fecha, IP y app desde la que se aceptó.
- **Anuncio**: mensaje del administrador para una app (o todas), con nivel, texto, enlace, ventana de validez, rango de versiones y estado.
- **Parámetro de configuración**: valor global de `Historias.md` §9 con su valor por defecto; las apps y operaciones pueden sobrescribir los marcados como tales.
- **Entrada de auditoría**: registro inmutable de una acción del administrador con fecha, acción, entidad, valores anterior y nuevo y motivo.
- **Tipo de cambio**: valor USD→EUR aplicado, con su origen (BCE o manual), el tipo de referencia, el colchón y la fecha desde la que rige.
- **Precio orientativo**: coste típico de una operación de una app, con el tamaño de la muestra, su origen (automático o manual) y la fecha de cálculo.
- **Estado de alertas y protecciones**: si cada alerta por umbral está activa y cuándo se envió, y el estado diario del freno global y su liberación manual.
- **Descargas de la app**: descargas diarias del instalador de cada app, para el embudo de alta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona que llega desde la landing de Secretario puede registrarse, verificar el email y ver su saldo de bienvenida con el siguiente paso de la app en menos de 3 minutos de interacción, sin contar la espera de entrega del email (objetivo propio, sin medición previa).
- **SC-002**: Con 20 operaciones simultáneas sobre un saldo que solo admite 3, se ejecutan como máximo las que caben, hay cero cobros dobles y la exposición total nunca supera saldo + deuda máxima (salvo el exceso del coste real sobre la estimación).
- **SC-003**: En el 100 % de las cuentas, el saldo reconstruido desde el historial de movimientos coincide con el saldo materializado en cada comprobación diaria y bajo cualquier secuencia de operaciones probada.
- **SC-004**: Cero apariciones del contenido enviado por los usuarios (textos, prompts, variables, audios, imágenes o resultados) en el almacenamiento, los registros de diagnóstico o los ficheros temporales tras completarse, fallar o cancelarse una operación.
- **SC-005**: Cero acreditaciones dobles de compras y cero cobros dobles de acciones de IA ante dobles clics, reenvíos, reintentos con la misma clave y avisos de pago repetidos.
- **SC-006**: El 100 % de las operaciones rechazadas antes de llamar al proveedor, fallidas en todos los proveedores, canceladas antes de la respuesta o interrumpidas tienen cobro cero.
- **SC-007**: Los cuatro ejemplos numéricos de `Historias.md` BE-FR-22 se reproducen exactamente, al microcrédito y en su presentación redondeada.
- **SC-008**: Cero escrituras de sincronización perdidas en silencio: de dos escrituras simultáneas sobre la misma revisión, exactamente una se aplica y la otra recibe un conflicto.
- **SC-009**: Cero accesos de una app a sesiones, documentos sincronizados u operaciones de otra app.
- **SC-010**: El 100 % de los parámetros de `Historias.md` §9 (salvo secretos e infraestructura), paquetes, apps, operaciones, plantillas y modelos se pueden cambiar desde el panel y el cambio se aplica a la siguiente petición sin redesplegar; el 100 % de esos cambios aparece en la auditoría.
- **SC-011**: Las páginas de landing, login, saldo del panel, compra y estadísticas de administración alcanzan, en medición de laboratorio con perfil móvil limitado, contenido principal visible en ≤ 2,5 s (LCP), respuesta a la interacción en ≤ 200 ms (INP) y estabilidad visual con desplazamiento acumulado ≤ 0,1 (CLS) (`Historias.md` 16.8), tanto con efectos normales como reducidos.
- **SC-012**: El 100 % de los flujos críticos (login, compra, datos fiscales, aceptación legal, acciones de administración, tema y efectos, filtros y paginación) se pueden completar con JavaScript desactivado; el registro solo muestra el aviso del captcha.
- **SC-013**: Cero violaciones de accesibilidad graves o críticas detectadas automáticamente en todas las páginas, en tema claro y oscuro; sin desplazamiento horizontal a 320 px; y auditoría manual WCAG 2.2 AA completada antes del lanzamiento con cobros reales.
- **SC-014**: En la prueba de usabilidad previa al lanzamiento (3–5 personas, `Historias.md` 16.10), cada una de las cinco tareas (registrarse desde la landing de Secretario y verificar, comprar créditos, averiguar el gasto del último mes, cambiar la contraseña y borrar una cuenta de prueba) se completa sin ayuda; cualquier tarea no completada sin ayuda genera una corrección y se repite el recorrido (sin porcentajes, por el tamaño de la muestra).
- **SC-015**: Al activarse el freno global, el 100 % de las nuevas operaciones de cuentas sin compras reales se rechazan, las cuentas con compras reales no se ven afectadas y el administrador recibe un único email.
- **SC-016**: Ninguna cuenta con alguna compra real se borra de forma automática, y tras cada ejecución diaria no queda ningún dato personal fuera de su plazo de conservación. Quedan **excluidas** de esta comprobación las IP de registro y de aceptaciones de cuentas ya borradas mientras no se cierre H-17 (el «plazo de prescripción» está pendiente del abogado): hasta entonces se conservan sin plazo de borrado y la medida no las cuenta como fuera de plazo.
- **SC-017**: Cero primeras pintadas con un tema distinto del esperado (del sistema o elegido), con y sin JavaScript.
- **SC-018**: El 100 % de los criterios de aceptación (`CA`) de `Historias.md` y de los criterios `UX-TEMA`, `UX-EFECTOS` y `UX-01`…`UX-18` tienen al menos una prueba trazable antes de dar por terminada la historia correspondiente.
- **SC-019**: Ninguna alerta al administrador se envía más de una vez por el mismo cruce de umbral.

## Assumptions

- **Alcance de la v4**: pagos solo simulados (en producción, solo testers y administrador); proveedor de facturación «ninguno» (la emisión real llega con el primer cobro real); solo se da de alta la app Secretario (escritorio, Windows), aunque la plataforma es multi-app desde el principio; interfaz y emails solo en español, preparados para traducción; sin «Entrar con Google» ni login en el navegador con retorno a la app; soporte solo por email, sin tickets; landings básicas que se sustituirán.
- **Fuera de alcance** (`Historias.md` 1.3): integración real con Stripe y emisión real de facturas; OAuth/Google; *streaming*, *embeddings* y texto a voz; moderación propia; suscripciones, recarga automática, importe libre y códigos promocionales; varios administradores o roles de soporte; apps web y móviles reales (la plataforma las admite, pero no se construyen); idiomas distintos del español; landing definitiva; compras dentro de apps móviles (decisión aplazada 9).
- **Dependencias externas**: proveedores de IA (Mistral para la transcripción principal y OpenRouter como intermediario de texto, imagen y audio de respaldo), servicio de envío de emails (Resend), captcha (Cloudflare Turnstile), tipo de referencia del Banco Central Europeo, contador de descargas de GitHub Releases y almacenamiento de copias de seguridad en la UE. La disponibilidad, precios y políticas de estos servicios condicionan costes y continuidad.
- **Decisiones pendientes con profesionales** (`Historias.md` §12: fiscalidad y proveedor de facturación, IVA con precio único en la UE, textos legales, edad mínima, plazos de conservación): no bloquean la implementación de la v4 (sin cobros reales); sí bloquean el lanzamiento público con cobros reales. Hasta entonces se usan los valores por defecto del documento (p. ej. edad mínima 18, plazos de BE-FR-83). La redacción de los textos legales, la firma de los contratos de encargo de tratamiento con los proveedores y el registro de actividades de tratamiento son requisitos previos al lanzamiento público.
- **Decisiones aplazadas**: firma del instalador de Secretario (se decide tras la beta con el embudo de alta), *streaming* de respuestas y login en el navegador.
- **Personas**: las personas y tareas de `Historias.md` 16.1 (visitante que llega desde una app, usuario ocasional, usuario atento a su privacidad, administrador) son hipótesis del propietario sin investigación con usuarios; se contrastan en la prueba de 16.10.
- **Valores por defecto**: todos los valores numéricos citados son los acordados el 2026-10-07/10 y se revisarán con los costes reales medidos; son configurables salvo los secretos y la infraestructura.
- **Entornos**: existe un entorno de pruebas previas (staging) separado de producción, con datos propios, compras simuladas para todos y claves de proveedores con límite de gasto; nunca se copian datos de producción.
- **Contrato de la API y app cliente**: el contrato detallado está en `Historias.md` §7 y los cambios de la app Secretario, en `secretario2/docs/v4-app-spec.md` (las pruebas del cliente quedan fuera de esta especificación).
- **Precisión**: los importes se gestionan sin errores de redondeo (créditos con precisión de millonésima, euros en céntimos); los cortes diarios usan la hora de Madrid.
