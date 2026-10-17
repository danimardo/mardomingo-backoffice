> BORRADOR: NO VIGENTE. Pendiente de revisión por abogado (Historias.md §12, decisión 4). No se publica ni se muestra a usuarios.

# Política de cookies de Cuenta Mardomingo

Versión del borrador: 0.1 (2026-10-11). Clave `cookies`. Ruta prevista: `/cookies`.

## 1. Qué son las cookies

Las cookies son pequeños ficheros que la web guarda en tu navegador. Sirven para que la web recuerde algo entre una página y otra o entre visitas.

## 2. Qué cookies usamos

Usamos solo cookies técnicas, es decir, estrictamente necesarias para el funcionamiento de la web o para recordar una preferencia que tú eliges.

| Nombre                                                                                   | Para qué sirve                                                                                                         | Duración                                                                                                            | Atributos                                                              |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `better-auth.session_token` (en HTTPS aparece como `__Secure-better-auth.session_token`) | Mantiene tu sesión iniciada en la web. La emite la propia web.                                                         | 30 días desde el último uso. Se renueva con cada uso, al pasar más de 24 horas desde la última renovación.          | `HttpOnly`, `Secure`, `SameSite=Lax`. Solo en `cuenta.mardomingo.com`. |
| `mdm_theme`                                                                              | Recuerda tu elección de tema. Valor `light` o `dark`; si no existe, se sigue el tema del sistema.                      | 1 año [VERIFICAR TÉCNICO: la especificación dice que se mantiene hasta que elijas «Sistema»; el código fija 1 año]. | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.                        |
| `mdm_effects`                                                                            | Recuerda que has pedido reducir transparencias y movimientos. Valor `reduced`; si no existe, los efectos son normales. | 1 año [VERIFICAR TÉCNICO: igual que `mdm_theme`].                                                                   | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.                        |

El nombre de la cookie de sesión depende de la biblioteca de autenticación (Better Auth) y de la configuración del servidor. [VERIFICAR TÉCNICO: nombre exacto en producción.]

**Alcance.** Las cookies solo se envían al sitio web de la cuenta (`cuenta.mardomingo.com`). Las aplicaciones y la API no usan cookies: se conectan con un token que la propia aplicación guarda. Las dos cookies de preferencias se envían también sin sesión iniciada, porque el tema debe aplicarse en todas las páginas.

**Qué contienen.** El valor de `better-auth.session_token` es un identificador aleatorio que enlaza tu navegador con tu sesión. Por eso lo tratamos como dato personal, como se explica en la política de privacidad. Las dos cookies de preferencias solo guardan una de las opciones permitidas; no contienen datos personales.

## 3. Cookies de terceros

**Cloudflare Turnstile.** En la página de registro se usa Turnstile, un sistema que comprueba que una persona, y no un programa, envía el formulario. [PENDIENTE ABOGADO: confirmar si Turnstile establece cookies propias en esa página. Si lo hace, hay que nombrarlas y describirlas aquí.]

No usamos cookies de analítica, de publicidad, de seguimiento ni de redes sociales de terceros.

## 4. Consentimiento

Las cookies de este documento son estrictamente necesarias o se usan para una preferencia que tú eliges. Por eso la web no muestra un aviso de consentimiento de cookies.

[PENDIENTE ABOGADO: confirmar que no se necesita consentimiento para ninguna de estas cookies (art. 22.2 de la Ley de Servicios de la Sociedad de la Información), tras revisar Turnstile y cualquier cambio posterior.]

## 5. Cómo gestionarlas

Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Ten en cuenta que:

- si borras `better-auth.session_token`, cerrarás tu sesión en la web;
- si borras `mdm_theme` o `mdm_effects`, la web volverá a los valores por defecto (tema del sistema y efectos normales);
- si bloqueas las cookies técnicas, es posible que no puedas iniciar sesión ni usar el panel.

Para cambiar el tema o reducir transparencias y movimientos, usa el selector de la propia web, que funciona también sin JavaScript. Cada navegador tiene su propio apartado de cookies en su configuración; la ayuda del fabricante explica cómo borrarlas.

Si cierras sesión desde el panel, o revocas una sesión desde otro dispositivo, la cookie de esa sesión deja de ser válida en el siguiente uso.

## 6. Preguntas frecuentes

**¿Por qué no aparece un aviso de cookies?** Porque la web solo usa cookies estrictamente necesarias o preferencias que tú eliges. Consulta el apartado 4 sobre la base de esta decisión.

**¿Qué pasa si borro las cookies del navegador?** Cerrarás tu sesión y la web volverá a los valores por defecto: tema del sistema y efectos normales. Tu cuenta y tu saldo no se ven afectados.

**¿Puedo usar la web sin cookies?** No puedes iniciar sesión ni usar el panel. Sí puedes ver las páginas públicas, como la landing o los términos.

**¿Y las aplicaciones de escritorio?** No usan estas cookies. Se conectan con el token de sesión que se explica en el apartado 2.

## 7. Cambios en esta política

Si cambiamos esta política, la nueva versión indicará si requiere tu aceptación o solo es informativa. Lo comunicaremos según la política de privacidad.

[PENDIENTE ABOGADO: si esta política requiere aceptación. El registro no pide aceptar la política de cookies (H-31), así que una versión que exigiera aceptación dejaría pendientes a todas las cuentas.]

## 7. Más información

Sobre cómo tratamos tus datos personales, consulta la política de privacidad. Para cualquier duda, escribe a soporte@mardomingo.com.

Responsable: [NOMBRE DEL TITULAR], NIF [NIF], [DOMICILIO].

---

## Notas para el revisor (eliminar antes de publicar)

- Fuentes: BE-FR-60 (solo cookies técnicas, sin analítica de terceros), UX-TEMA y UX-EFECTOS de `Historias.md` 16.4, y el código de preferencias de apariencia (`src/lib/appearance/preferences.ts` y la ruta `preferencias`).
- Las dos cookies de preferencias se fijan con `httpOnly`, `secure`, `sameSite: lax`, `Path=/` y 1 año. La especificación dice que se mantienen hasta que el usuario elija «Sistema»: hay que decidir cuál es la regla correcta y, si cambia, corregir el código o el texto.
- La cookie de sesión la emite Better Auth con su configuración por defecto (`session.expiresIn` de 30 días y `updateAge` de 24 horas). No se usa caché de sesión en cookie (`cookieCache`), así que no hay una segunda cookie de sesión.
- Turnstile: revisar qué cookies establece.
