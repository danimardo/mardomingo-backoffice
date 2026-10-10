# Decisiones de arquitectura (ADR)

Registro de las decisiones importantes y difíciles de revertir (constitución, «Gobernanza»).

- Formato: contexto, decisión, alternativas consideradas, consecuencias y estado.
- Nombre: `NNNN-titulo-en-minusculas.md`, numeración correlativa.
- Un ADR aceptado no se edita: si la decisión cambia, se escribe otro que lo sustituye y se marca
  el anterior como «Sustituido por NNNN».
- Se crea un ADR al cambiar la arquitectura, al introducir una dependencia transversal o cuando un
  plan necesita romper una regla de `ARCHITECTURE.md`.

| ADR | Título | Estado |
|---|---|---|
| [0001](0001-monolito-sveltekit-2-dos-hosts.md) | Monolito SvelteKit 2 que sirve la API y la web | Aceptado |
| [0002](0002-sqlite-litestream-una-instancia.md) | SQLite con Litestream en una sola instancia | Aceptado |
| [0003](0003-dinero-en-enteros-y-ledger.md) | Dinero en enteros, ledger de solo inserción y reservas | Aceptado |
| [0004](0004-better-auth-sesiones-opacas.md) | Better Auth con sesiones opacas | Aceptado |
| [0005](0005-monolito-modular-por-funcionalidades.md) | Monolito modular por funcionalidades | Aceptado |
| [0006](0006-form-actions-y-zod.md) | Form actions con helper propio y Zod como única validación | Aceptado |
| [0007](0007-fuente-canonica-del-sistema-de-diseno.md) | Fuente canónica del sistema de diseño | Aceptado |
