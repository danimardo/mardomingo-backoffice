> BORRADOR: NO VIGENTE. Pendiente de revisión por abogado (Historias.md §12, decisión 4). No se publica ni se muestra a usuarios.

# Política de privacidad de Cuenta Mardomingo

Versión del borrador: 0.1 (2026-10-11). Clave `privacy`. Ruta prevista: `/privacidad`.

## 1. Responsable del tratamiento

- Responsable: [NOMBRE DEL TITULAR], autónomo, NIF [NIF].
- Domicilio: [DOMICILIO].
- Contacto para cualquier asunto de privacidad: [EMAIL DE SOPORTE].

## 2. Servicios cubiertos

Cuenta Mardomingo ofrece una cuenta y un saldo comunes a las aplicaciones de la plataforma. Esta política cubre todas ellas. Hoy son:

- **Secretario AI**: aplicación de escritorio para Windows. Envía audio y texto a la plataforma para transcribirlos o procesarlos con IA, y guarda en tu cuenta sus datos sincronizados.

## 3. Datos que tratamos

**3.1. Datos de la cuenta.** Email; su forma normalizada (en minúsculas, sin el sufijo «+etiqueta» y, en Gmail, sin puntos), que sirve para evitar que el saldo de bienvenida se conceda dos veces; contraseña, guardada solo como resumen (hash), que no permite recuperarla; estado de verificación; fechas de creación y de última actividad.

**3.2. Aceptaciones legales.** Versión y fecha de cada documento que aceptas, incluida la declaración de edad y, en cada compra, la renuncia al derecho de desistimiento. También la dirección IP desde la que aceptas.

**3.3. Seguridad y sesiones.** IP desde la que te registraste, para limitar el número de altas por IP. Para cada sesión: aplicación, nombre del equipo, versión de la aplicación, fechas e IP aproximada. La IP que se muestra en el panel es aproximada: IPv4 truncada a /24 e IPv6 a /48 [VERIFICAR TÉCNICO: si la IP guardada en la base de datos está ya truncada o es la completa]. Para limitar los intentos de acceso guardamos la IP del cliente durante un plazo corto y un contador de intentos fallidos por email, que se guarda con un resumen (hash) del email y no con el email en claro.

**3.4. Saldo.** Créditos, bolsas con su caducidad, reservas, deuda, movimientos, ajustes con su motivo y la aplicación que originó cada consumo.

**3.5. Uso de la IA (solo metadatos).** Aplicación, operación, proveedor y modelo usados, tokens, segundos de audio, coste, estado, código de error, clave de idempotencia y si el proveedor marcó la petición por moderación.

**3.6. Compras, datos fiscales y facturas.** Paquete comprado, importe, IVA, país y referencia del pago. Los datos fiscales son opcionales: tipo (particular o empresa), nombre o razón social, NIF, NIE, CIF o NIF-IVA, dirección, código postal, ciudad y país. Solo los necesitamos para emitir factura completa. Las facturas emitidas se guardan en la cuenta.

**3.7. Datos sincronizados de cada aplicación.** Lo que la aplicación guarda en tu cuenta para usarlo en cualquier equipo: sustituciones personalizadas, textos rápidos, prompts y preferencias de uso. **Este contenido lo escribes tú** y se guarda hasta que lo cambies o borres tu cuenta.

**3.8. Actividad por aplicación.** Aplicación con la que te registraste, primer inicio de sesión en cada aplicación y primera operación de IA. Lo usamos para estadísticas.

**3.9. Soporte.** Los emails que nos envías.

**3.10. Cookies.** Las que se describen en la política de cookies.

## 4. Contenido de las operaciones de IA

No guardamos audios, textos, prompts, variables, imágenes ni resultados de las operaciones de IA. Tampoco los guardamos en los registros técnicos ni en ficheros temporales más allá de la vida de cada petición. Los audios se procesan en memoria o en un temporal que se borra al terminar, también si hay un error o una cancelación.

Los proveedores de IA sí reciben ese contenido para procesarlo (sección 7). Los datos sincronizados del apartado 3.7 sí se guardan en tu cuenta.

## 5. Finalidades y bases jurídicas

| Finalidad                                                                                                   | Base jurídica                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crear y verificar la cuenta, y prestar el servicio                                                          | Ejecución del contrato (art. 6.1.b RGPD)                                                                                                                |
| Procesar las operaciones de IA, cobrar el consumo, gestionar el saldo y sincronizar tus datos entre equipos | Ejecución del contrato                                                                                                                                  |
| Enviar los emails del servicio: verificación, seguridad, saldo, caducidad, cambios legales e inactividad    | Ejecución del contrato                                                                                                                                  |
| Emitir facturas y llevar la contabilidad                                                                    | Obligación legal (art. 6.1.c RGPD)                                                                                                                      |
| Evitar abusos: límite de altas por IP, normalización del email, tope diario y bloqueo temporal de accesos   | Interés legítimo (art. 6.1.f RGPD). [PENDIENTE ABOGADO: ponderación del interés legítimo para la IP de registro y para la forma normalizada del email.] |
| Estadísticas de uso y embudo de alta por aplicación                                                         | Interés legítimo. [PENDIENTE ABOGADO: base para las estadísticas por usuario, no solo agregadas.]                                                       |
| Atender el ejercicio de derechos y las reclamaciones                                                        | Obligación legal                                                                                                                                        |

No enviamos publicidad. Los emails de la plataforma son de servicio.

## 6. Plazos de conservación

- **Cuentas sin verificar:** se eliminan a los 7 días.
- **Cuentas inactivas sin compras reales:** aviso tras 3 años sin actividad; borrado 30 días después si no hay actividad.
- **Sesiones caducadas:** se eliminan 30 días después de caducar.
- **Datos de la cuenta, perfil, datos fiscales y datos sincronizados:** mientras exista la cuenta. Al borrarla, se eliminan (sección 9).
- **IP de registro y de aceptaciones legales:** mientras exista la cuenta y después durante el plazo de prescripción aplicable. [PENDIENTE ABOGADO: plazo de prescripción aplicable a la prueba del consentimiento. La especificación no fija un número.]
- **Metadatos de operaciones de IA:** 24 meses. Después se anonimizan y solo quedan como datos agregados. [PENDIENTE ABOGADO: validar el plazo de 24 meses.]
- **Movimientos de saldo, pagos y facturas:** plazo legal mercantil y fiscal, orientativamente 6 años. Al borrar la cuenta quedan sin datos personales y con un identificador opaco. [PENDIENTE ABOGADO y gestoría: confirmar el plazo.]
- **Resumen (hash) del email para el saldo de bienvenida:** se conserva también después de borrar la cuenta, para que no se conceda dos veces. [PENDIENTE ABOGADO: base legal y plazo de esta conservación, que la especificación deja sin límite.]
- **Registros de auditoría de las acciones del administrador:** [PENDIENTE ABOGADO: plazo; la especificación no lo fija.]
- **IP y contadores de intentos de acceso:** [PENDIENTE ABOGADO: plazo; la especificación solo los describe como de vida corta.]
- **Registros técnicos (logs):** en la versión inicial salen a la salida estándar del servidor y los conserva la rotación de Docker. [PENDIENTE ABOGADO: plazo. La especificación fija 30 días para un sistema de logs que aún no existe y no fija plazo para la rotación actual.]
- **Copias de seguridad:** 30 días. Los datos borrados desaparecen de las copias a los 30 días.

## 7. Destinatarios y encargados del tratamiento

Estos proveedores tratan datos por cuenta nuestra para prestar el servicio:

- **Mistral AI:** transcripción de audio. Tratamiento en la UE.
- **OpenRouter** y los proveedores de modelos a los que dirige cada petición: texto, imagen y audio de respaldo. Tratan datos fuera de la UE (sección 8). La plataforma configura cada petición para que OpenRouter use solo proveedores que no recopilen datos (`data_collection: deny`). Esto reduce el riesgo, pero no sustituye a las garantías de la sección 8.
- **Resend:** envío de emails del servicio.
- **Cloudflare:** verificación del captcha (Turnstile) en el registro.
- **Backblaze:** copias de seguridad, en la región UE.
- **[NOMBRE DEL PROVEEDOR DE ALOJAMIENTO]:** servidor y base de datos, en la UE.

Antes del lanzamiento público firmaremos o aceptaremos con cada proveedor un contrato de encargo del tratamiento.

Cuando un proveedor de pagos o de facturación entre en servicio, se añadirá aquí. [PENDIENTE ABOGADO: en la fase de cobros reales, pasarela de pagos y proveedor de facturación.]

Podemos comunicar datos a autoridades y tribunales cuando la ley lo exija.

## 8. Transferencias internacionales

OpenRouter y sus proveedores de modelos tratan datos fuera de la Unión Europea, al procesar las peticiones de texto, imagen y audio de respaldo.

[PENDIENTE ABOGADO: base legal de las transferencias a OpenRouter y sus proveedores (por ejemplo, cláusulas contractuales tipo u otra garantía del capítulo V del RGPD), y si hay que indicar los países concretos.]

[PENDIENTE ABOGADO: confirmar si Resend y Cloudflare tratan datos fuera de la UE y, en ese caso, la base de esas transferencias.]

## 9. Tus derechos

Puedes pedir acceso, rectificación, supresión, limitación, oposición y portabilidad de tus datos. Desde el panel puedes descargar tus datos en JSON y borrar tu cuenta. Para cualquier otra petición, escribe a [EMAIL DE SOPORTE]. Responderemos en el plazo que fija la ley.

Puedes presentar una reclamación ante la Agencia Española de Protección de Datos (aepd.es).

**Al borrar la cuenta** eliminamos tus datos personales de la cuenta, el perfil, los datos fiscales y los datos sincronizados de todas las aplicaciones. Se conservan, sin datos personales, los movimientos de saldo y los pagos. Las facturas emitidas se conservan íntegras durante el plazo legal, porque la ley lo exige. Las IP de registro y de aceptaciones siguen el plazo de la sección 6.

## 10. Seguridad

- Conexión cifrada (HTTPS) y cookies de sesión con los atributos `Secure`, `HttpOnly` y `SameSite=Lax`.
- Contraseñas guardadas solo como resumen (hash).
- Claves de los proveedores fuera del código, en variables de entorno del servidor, y claves distintas para pruebas y producción.
- Los registros técnicos no contienen contenido ni cuerpos de peticiones.
- Protección contra envíos de formularios desde otros sitios web.

## 11. Menores

Solo pueden usar el servicio las personas que cumplen la edad mínima fijada en los términos de uso.

## 12. Cambios en esta política

Si cambiamos esta política, la nueva versión indicará si requiere tu aceptación o solo es informativa. En el segundo caso te lo comunicaremos por email y en el panel. Si requiere aceptación, deberás aceptarla para usar las operaciones de IA y la sincronización.

---

## Notas para el revisor (eliminar antes de publicar)

- Fuentes: BE-FR-07, 08, 38, 56, 58, 60, 63, 70, 74, 83 y 86 de `Historias.md`; secciones 6 y 10 y tablas `legal`, `accounts` y `ai` de `specs/001-cuenta-mardomingo-v4/data-model.md`.
- La sección 4 es una afirmación importante: el contenido de las operaciones de IA no se guarda, pero los datos sincronizados (3.7) sí, porque el usuario los escribe para usarlos en varios equipos. Conviene que el abogado lo confirme.
- BE-FR-83 fija 30 días para los logs de OpenObserve, pero la constitución (principio XI, enmienda 2.2.0) aplaza OpenObserve y en la v4 los logs van a stdout.
- H-17 y H-18 de `data-model.md` (plazos sin parámetro y anonimización de `ai_operations`).
- Ubicación de Resend, Cloudflare y del proveedor de alojamiento: los datos están en la especificación solo en parte.
