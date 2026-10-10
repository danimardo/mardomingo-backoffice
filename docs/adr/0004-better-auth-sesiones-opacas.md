# 0004 — Better Auth con sesiones opacas

- **Estado:** Aceptado (2026-10-10)

## Contexto

Hay que autenticar a personas en la web y a las apps cliente (escritorio hoy; web y móvil
después), con sesiones revocables al instante, bloqueo de cuentas, verificación de email, captcha
y Google OAuth en una fase posterior. Implementar la criptografía de contraseñas y sesiones a mano
es un riesgo de seguridad.

## Decisión

**Better Auth** con el adaptador de Drizzle y los plugins `bearer`, `admin` y `captcha`
(Turnstile). Las **sesiones son opacas** y viven en la base de datos, con caducidad deslizante de
30 días. La web usa solo la cookie de sesión (`HttpOnly`, `Secure`, `SameSite=Lax`); la API usa
solo el token Bearer, y cada sesión queda ligada a la app con la que se inició. La cuenta de
administración se protege solo con contraseña en la v4.

## Alternativas consideradas

- **JWT de sesión**: no se pueden revocar al instante sin una lista negra, que reintroduce el
  estado en el servidor. PROHIBIDOS por el principio III.
- **Auth.js / Lucia**: Auth.js se centra en OAuth y Lucia dejó de mantenerse como librería.
- **Implementación propia**: prohibida por el principio III.

## Consecuencias

- Revocar una sesión tiene efecto en la siguiente petición; bloquear o cambiar la contraseña
  revoca las demás sesiones.
- La versión de SvelteKit depende de la compatibilidad de Better Auth (ADR 0001).
- La tabla `account` separada de `user` permite añadir Google sin migrar datos (BE-FR-09).
