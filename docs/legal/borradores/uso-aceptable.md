> BORRADOR: NO VIGENTE. Pendiente de revisión por abogado (Historias.md §12, decisión 4). No se publica ni se muestra a usuarios.

# Política de uso aceptable de Cuenta Mardomingo

Versión del borrador: 0.1 (2026-10-11). Clave `aup`. Ruta prevista: `/uso-aceptable`.

## 1. Ámbito

Esta política se aplica a tu cuenta, a todas las aplicaciones de la plataforma y a la API. Debes aceptarla para crear una cuenta. Complementa los términos de uso.

## 2. Usos prohibidos

No puedes usar el servicio para:

a) realizar actividades ilícitas, ni para cometer fraudes, estafas, suplantaciones de identidad o acoso;

b) generar contenido de abuso sexual de menores, en ningún caso;

c) crear o distribuir malware, ni preparar ataques contra sistemas, redes o personas, ni eludir medidas de seguridad;

d) enviar spam o mensajes masivos no solicitados;

e) crear contenido que suplante a personas reales sin su consentimiento o que las presente falsamente haciendo cosas que no hicieron;

f) difundir desinformación con la que se pretenda causar un daño;

g) vulnerar derechos de propiedad intelectual o de privacidad de terceros, ni tratar datos personales de terceros sin base legal.

[PENDIENTE ABOGADO: revisar el listado completo de usos prohibidos. La especificación solo dice que la política prohíbe los usos ilícitos o abusivos de la IA (BE-FR-82); la lista es una propuesta.]

## 3. Uso de la cuenta y de la API

3.1. **Una cuenta por persona.** El saldo de bienvenida se concede una sola vez por persona. Comparamos la forma normalizada de tu email (sin el sufijo «+etiqueta» y, en Gmail, sin puntos) para detectar cuentas duplicadas. No puedes crear varias cuentas para obtener varios saldos de bienvenida.

3.2. **Credenciales.** No compartas tu contraseña ni tu sesión. No uses sesiones o tokens de otra persona ni de otra aplicación.

3.3. **Límites.** No intentes eludir los límites de uso del servicio (sección 8.4 de los términos), ni con varias cuentas ni con otras técnicas.

3.4. **Acceso automatizado.** No uses robots, scripts ni herramientas para acceder a la web o a la API de forma masiva o distinta de su finalidad, ni para extraer datos de otros usuarios.

3.5. **Reventa.** No revendas el acceso al servicio ni los créditos, salvo autorización expresa por escrito.

3.6. **Ingeniería inversa.** No intentes obtener las claves de los proveedores de IA, ni el código o la configuración de la plataforma, ni acceder a los datos de otras cuentas.

[PENDIENTE ABOGADO: la reventa de créditos y la ingeniería inversa son propuestas no recogidas en la especificación.]

## 4. Límites de uso

Para mantener el servicio disponible para todos, se aplican estos límites por defecto:

- 30 peticiones de IA por minuto y cuenta, en todas las aplicaciones;
- 2 transcripciones simultáneas por cuenta;
- 5 minutos de grabación por transcripción en Secretario AI;
- un tope diario de 400 créditos para las cuentas que nunca han comprado créditos, sumando todas las aplicaciones;
- límites de tamaño para textos e imágenes.

Los límites pueden cambiar y se indicarán en la web.

## 5. Moderación y contenido

5.1. Los proveedores de IA aplican sus propios filtros de contenido. Si un proveedor rechaza una petición por moderación, la operación se registra como marcada y verás un mensaje genérico.

5.2. No guardamos el contenido de tus peticiones (ver la política de privacidad). Por eso no revisamos su contenido. Actuamos por las señales de los proveedores y por el comportamiento de la cuenta.

5.3. Si una cuenta acumula en un día un número de operaciones marcadas por moderación (3 por defecto), avisamos al responsable del servicio, que puede bloquear la cuenta.

## 6. Consecuencias del incumplimiento

Si incumples esta política o los términos de uso, podemos bloquear tu cuenta, con motivo registrado, y cerrar todas tus sesiones (sección 10 de los términos).

[PENDIENTE ABOGADO: qué ocurre con el saldo de una cuenta bloqueada por incumplimiento, y si el titular puede borrarla desde el panel. La especificación no lo resuelve (hueco H-32).]

## 7. Cómo comunicar un abuso

Si detectas un uso que incumpla esta política, escribe a soporte@mardomingo.com con la mayor información posible. No incluyas contraseñas ni datos personales de terceros.

## 8. Cambios

Podemos actualizar esta política. Cada versión indicará si requiere tu aceptación o solo es informativa, según la política de cambios de los términos de uso.

---

## Notas para el revisor (eliminar antes de publicar)

- Fuentes: BE-FR-82 (política de uso aceptable y moderación), BE-FR-11 (capas antiabuso y normalización del email), BE-FR-43 y BE-FR-44 (límites), BE-FR-38 (sin contenido persistido), BE-FR-50 y 70 de `Historias.md`.
- Los límites de la sección 4 son valores por defecto de la sección 9 de `Historias.md`, editables desde el panel.
- La lista de la sección 2 y las prohibiciones de las secciones 3.5 y 3.6 no están en la especificación: son propuestas para el abogado.
- H-32 (`data-model.md` §8.2): una cuenta bloqueada no puede entrar al panel para borrarse.
