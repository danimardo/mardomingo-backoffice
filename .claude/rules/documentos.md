---
paths:
  - "Historias.md"
  - ".specify/memory/constitution.md"
  - "ARCHITECTURE.md"
  - "docs/adr/**"
  - "Design/**"
---

# Edición de los documentos normativos

## Constitución (`.specify/memory/constitution.md`)

- Solo se modifica con `/speckit-constitution`, tras explicar el cambio y su impacto y obtener la
  aprobación del propietario.
- La versión sube según su política: MAJOR, MINOR o PATCH (sección «Gobernanza»).
- El *Sync Impact Report* (comentario HTML al principio) se quita antes del commit.

## `Historias.md`

- Se conservan los identificadores existentes (`BE-FR-XX`, `CA`, `UX-XX`, `DS-XX`, lotes `L0X`).
  Los requisitos nuevos toman el siguiente número libre.
- Cada cambio sube la «Versión del documento» de la cabecera e indica qué cambió.
- Las decisiones nuevas se añaden a la tabla de la sección 13 con su fecha.
- Después de editar, se vuelve a copiar literalmente en `F:\Apps\secretario2\docs\v4-backend-spec.md`
  y se comprueba que son idénticos (`cmp`). Ese fichero no se edita directamente.

## `ARCHITECTURE.md`

- Concreta la constitución y nunca la contradice. Si hace falta contradecirla, primero se enmienda
  la constitución.
- Cambiar una regla, una frontera o el orden de las funcionalidades exige un ADR.
- Al crear, fusionar o dividir una funcionalidad se actualiza la tabla de la sección 3 (tablas,
  requisitos y dependencias permitidas).

## ADR (`docs/adr/`)

- Formato y numeración del `README.md` de la carpeta; el número es el siguiente libre y la tabla del
  índice se actualiza.
- Un ADR aceptado y ya integrado en `main` no se edita. Si la decisión cambia, se escribe otro que lo
  sustituye, y en el anterior solo se cambia el estado a «Sustituido por NNNN».

## `Design/`

- Es la fuente canónica de la identidad visual **hasta L01**; desde L01 mandan
  `src/lib/design-system/` y `src/lib/components/{ui,layout}/` (ADR 0007). Solo se modifica con la
  aprobación del propietario.
- Los cambios son centrales: tokens con pareja clara y oscura, y componentes compartidos. Nunca
  colores literales ni estilos locales repetidos.
- Las adaptaciones pendientes están en la tabla DS de `Historias.md` 16.2. Al resolver una, se
  actualiza esa tabla.
