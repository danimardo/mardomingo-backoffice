# 0008 — La factura referencia la compra por clave foránea

- **Estado:** Aceptado (2026-10-12).

## Contexto

`ARCHITECTURE.md` (sección 3) ordena las funcionalidades: `invoicing` (7) va antes que `payments`
(9), y una funcionalidad solo puede importar las anteriores. La tabla `invoices` (dueña:
`invoicing`) tiene `payment_id` con clave foránea a `payments`, que es de `payments`. Así, el
esquema de `invoicing` depende de la tabla de una funcionalidad posterior.

El test de arquitectura no lo marca, porque solo vigila imports de código, no claves foráneas. Pero
la regla de `ARCHITECTURE.md` pretende evitar justo este acoplamiento.

## Decisión

Se mantiene la clave foránea `invoices.payment_id → payments.id`. Es la única referencia de datos
entre las dos funcionalidades y garantiza, en la base de datos, que una factura pertenece a una
compra existente. No se cambia el esquema.

El código sí respeta el orden: `invoicing` nunca importa `payments`. Los datos de la compra llegan
por parámetro (`payments` llama a `invoicing`). `invoicing` solo referencia el identificador.

## Alternativas consideradas

- **Quitar la clave foránea** con una migración nueva: `invoices.payment_id` pasaría a texto sin
  referencia. Desacopla el esquema, pero pierde la garantía de integridad y exige una migración
  sobre una tabla inmutable (`0011_invoices_immutable`).
- **Mover la tabla `invoices` a `payments`**: rompe el reparto de tablas por funcionalidad de
  `ARCHITECTURE.md` (sección 7).

## Consecuencias

- Una factura siempre apunta a una compra real; la integridad la garantiza SQLite.
- Si se cambia el orden de funcionalidades o se extrae `payments`, esta clave es el primer punto a
  revisar. Un cambio así sustituye este ADR.
- Pendiente de la constitución: `ARCHITECTURE.md` debe mencionar esta excepción en la sección 3.
