# Revisión manual por checkpoint

Comprobaciones que no puede automatizar el agente. Cada una se registra como **comprobado**, **pendiente**, **no verificable** o **no aplica**, con la fecha y el nombre de quien la hizo, en la tarea de `specs/001-cuenta-mardomingo-v4/tasks.md` que se indica. Sin esa nota, la tarea sigue abierta.

Antes de empezar: levantar la aplicación con `pnpm build` y `node build/index.js` (o usar staging). Anotar el navegador, el sistema operativo y la versión de cada cliente.

## L01 · Contraste sobre cristal (T055, T363; DS-09)

Medir a mano el contraste del texto sobre el cristal de la cabecera y del pie (`SiteHeader`, `SiteFooter`), y después en las demás zonas de cristal.

1. Abrir `/` con la aplicación levantada, en tema claro y en tema oscuro.
2. Repetir con efectos normales y con efectos reducidos (`/preferencias`).
3. Medir el contraste del texto sobre el fondo real (la composición con el fondo ambiental), no sobre un color plano. Herramienta sugerida: las DevTools del navegador o un medidor de contraste sobre una captura.
4. Zonas de T363: cabecera, pie y `Sidebar` (`glass-chrome`), diálogos, avisos y menús (`glass-overlay`), tarjeta de saldo y bloque principal de las portadas (`glass-card`).
5. Registrar cada zona con su contraste y si cumple WCAG 2.2 AA (4,5:1 texto normal, 3:1 texto grande). Si no cumple, abrir una tarea de corrección en `tokens.css`, nunca con estilos locales.

Dónde anotar: T055 y T363 en `tasks.md`.

## L16 · Auditoría WCAG 2.2 AA con lectores de pantalla (T364)

1. Usar NVDA en Windows y VoiceOver en iOS.
2. Recorrer los flujos de `Historias.md` 15.17: registro, verificación, login, compra y panel.
3. Seguir la lista de comprobación de `e2e/manual/wcag-22-aa.md` (si no existe, crearla con los puntos de WCAG 2.2 AA).
4. Por cada hallazgo: corregir o registrar como tarea con prioridad.

Dónde anotar: T364 en `tasks.md`.

## L16 · Correos en clientes reales (T344; UX-17)

1. Enviar desde staging las plantillas de `src/lib/server/features/notifications/emails/` a Gmail, Outlook y Apple Mail.
2. Revisar cada una en modo claro y en modo oscuro, incluida la inversión forzada del cliente.
3. Registrar el resultado de cada cliente como comprobado, pendiente o no verificable.

Dónde anotar: T344 en `tasks.md`.

## L16 · Tema oscuro y primer fotograma (T359, CA1 y CA5)

1. **Primer fotograma sin destello:** con sistema claro y sin cookie, recargar `/` y grabar la carga (`gif` o vídeo) para comprobar que no aparece el tema oscuro antes del claro.
2. **Tema oscuro:** revisar en oscuro los estados (carga, error, vacío), el foco visible, las gráficas de `/admin/estadisticas` y las imágenes.

Dónde anotar: T359 en `tasks.md`.

## L16 · Proxy e IP real en staging (T373; constitución, «Proxy, puerto e IP del cliente»)

Registrar en `docs/operaciones/verificacion-staging.md`:

1. `ss -ltn` en el servidor con el puerto 7312 libre antes del primer despliegue.
2. La IP real del cliente en los logs y en `user.signup_ip`, con una petición desde una IP conocida.
3. `url.origin` igual a `https://cuenta-staging.mardomingo.com` y formularios sin `403` de la comprobación de origen, con el `Origin` real de `PUBLIC_WEB_URL`.
4. El puerto 7312 no responde desde fuera del host.
5. En OpenObserve, buscar un marcador enviado en una operación y comprobar que no aparece (privacidad de los logs).

Dónde anotar: T373 y T209 en `tasks.md`.

## L16 · Simulacro de restauración de Litestream (T372)

Seguir `docs/operaciones/restauracion.md`: restaurar a un volumen nuevo, arrancar la imagen, comprobar que el saldo de cuentas de prueba coincide con el anterior y con la reconstrucción del ledger, y restaurar un punto antiguo para validar `snapshot.retention: 720h`.

Dónde anotar: T372 en `tasks.md`.

## L16 · Mediciones de producción (T370, T371)

Solo cuando haya una imagen de producción con sus secretos reales:

1. Carga con `pnpm perf:load` contra la imagen de producción (una sesión y veinte sesiones) y comparar con los números de L12.
2. Web Vitals con `e2e/perf/web-vitals.spec.ts` contra la URL desplegada.

Mientras no se haga, las mediciones locales y de staging quedan registradas como tales, y producción como NO VERIFICADO.

Dónde anotar: T370 y T371 en `tasks.md`.
