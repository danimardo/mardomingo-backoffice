# 0005 — Monolito modular por funcionalidades

- **Estado:** Aceptado (2026-10-10). Sustituye a la organización por capas globales de la
  constitución 1.x.

## Contexto

La constitución 1.x organizaba el servidor en carpetas globales por capa (`domain/`, `services/`,
`db/`, `adapters/`). Así, una funcionalidad queda repartida en cuatro sitios y nada impide que un
servicio lea las tablas de otro, incluidas las del saldo. El proyecto lo desarrollan agentes de
IA, que necesitan saber sin ambigüedad dónde va cada cosa y qué pueden tocar. Todavía no hay
código, así que cambiar de estructura no cuesta nada.

## Decisión

El código de servidor se organiza en `src/lib/server/features/<funcionalidad>/` con capas dentro
(`domain/` puro, `service.ts`, `repository.ts`, `schema.ts`, `contract.ts`, `events.ts`,
`presenters.ts`, todos opcionales) y una **API pública** (`index.ts`). Las reglas son las del
principio IV y `ARCHITECTURE.md`:

- Una funcionalidad solo importa el `index.ts` de las que van antes en el orden de
  `ARCHITECTURE.md` (sección 3), así que el grafo no tiene ciclos. Los agregados de una
  funcionalidad posterior llegan por parámetro.
- Cada tabla tiene un único dueño. `credits` es la única funcionalidad que escribe en el saldo.
- `$lib/shared/` (cliente y servidor) y `$lib/server/shared/` son solo código puro, y la
  infraestructura (`db`, `adapters`, `config`, `logging`, `forms`, `api`, `jobs`) es común. Las
  dependencias se construyen en un único punto de composición.
- Las reglas se comprueban con ESLint y con un test de arquitectura, **sin dependencias nuevas**.

## Alternativas consideradas

- **Capas globales** (la estructura anterior): más simple a primera vista, pero con fronteras
  difusas entre funcionalidades y ninguna garantía de que el dinero tenga una sola puerta.
- **Clean Architecture / hexagonal completa** (puertos por caso de uso, contenedor de
  dependencias): demasiadas capas e indirecciones para este tamaño.
- **Paquetes de monorepo por funcionalidad**: fronteras más fuertes, a costa de configuración,
  build y versiones extra sin un segundo despliegue que lo justifique.
- **dependency-cruiser o eslint-plugin-boundaries**: pospuestos; se adoptarán si el test de
  arquitectura se vuelve difícil de mantener.

## Consecuencias

- Cada funcionalidad se puede desarrollar y revisar de forma aislada, con menos conflictos en git.
- Las operaciones que cruzan funcionalidades se coordinan en el servicio que orquesta y pasan la
  transacción como parámetro.
- Para evitar ciclos, la compra real y el saldo bajo pasaron de `user` a `user_balances`
  (`credits`), y la exportación, el borrado y la inactividad forman una funcionalidad propia,
  `privacy`, en la cima del orden (revisión del 2026-10-10).
- Las rutas de cobertura y mutation testing apuntan a `features/*/domain/**` y a los dos
  `shared/`. Los tests de integración viven junto a su funcionalidad.
