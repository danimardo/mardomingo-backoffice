# 0006 — Form actions con helper propio y Zod como única validación

- **Estado:** Aceptado (2026-10-10)

## Contexto

Todas las interacciones críticas de la web (registro, compra, borrado de cuenta, acciones del
administrador) tienen que funcionar sin JavaScript (principio IX). Además, la API, los formularios,
las respuestas de los proveedores, el entorno y las columnas JSON se tienen que validar en la
frontera (principio XII), y el contrato OpenAPI debe salir del mismo código.

## Decisión

- Las mutaciones de la web son **form actions con nombre** con `use:enhance`, y siguen siempre los
  mismos pasos: *guard*, helper de formularios, un servicio, y `redirect(303)` o `fail`.
- Un **helper de formularios propio** (`$lib/server/forms/`) normaliza el `FormData`, valida con
  Zod y devuelve `fail(400, { values, errors })` sin reenviar los campos sensibles.
- **Zod 4** es la única librería de validación. `zod-openapi` genera el contrato de la API a
  partir de los mismos esquemas.

## Alternativas consideradas

- **sveltekit-superforms**: resuelve lo mismo con más superficie y otra dependencia en el núcleo,
  y fija una forma de trabajar que el helper propio cubre en pocas líneas.
- **Remote functions de SvelteKit**: experimentales en 2.70; se reevaluarán con SvelteKit 3.
- **`fetch` a `+server.ts` desde los componentes**: rompe la mejora progresiva y duplica la
  autorización.
- **Valibot / ArkType**: válidos, pero dos librerías de validación para lo mismo están prohibidas
  y `zod-openapi` depende de Zod.

## Consecuencias

- Los formularios funcionan sin JavaScript, y con JavaScript mejoran sin cambiar el contrato.
- Los esquemas compartidos con el cliente viven en `$lib/schemas/<funcionalidad>/` y no importan
  código de servidor.
- La única excepción a la mejora progresiva es el captcha del registro (constitución, «Mejora
  progresiva»).
