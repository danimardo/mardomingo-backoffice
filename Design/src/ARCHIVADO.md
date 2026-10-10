# Archivado

Esta carpeta conserva el prototipo original del sistema de diseño (NetworkBench, «Aurora Salvia»). Se archiva
en L01 (ADR 0007) y **no se importa desde la aplicación**.

Fuente canónica desde L01:

- Tokens: `src/lib/design-system/tokens.css` (único fichero con valores; `light-dark()` por rol).
- Componentes: `src/lib/components/ui/` (`Button`, `TextField`, `Icon`) y `src/lib/components/layout/` (marco y
  controles de apariencia).
- Controlador de apariencia: `src/lib/design-system/theme.svelte.ts` (por contexto, sin `localStorage`).

Los componentes de aquí quedan como referencia visual para los lotes siguientes. Cuando un lote necesite uno,
se adapta a `src/lib/components/` con sus tokens y su prueba de componente, y no se copia tal cual.
