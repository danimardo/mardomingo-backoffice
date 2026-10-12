# Cuenta Mardomingo (mardomingo-backoffice)

Backend multi-app de IA: API `api.mardomingo.com` (apps cliente con token Bearer) y web
`cuenta.mardomingo.com` (registro, panel de usuario, panel de administración). Primera app
cliente: Secretario AI. SvelteKit 2 + Svelte 5 + TypeScript, SQLite con Drizzle, Better Auth,
desplegado con Docker en Coolify.

**Idioma:** responde, documenta y escribe los mensajes de commit en español. Los identificadores
del código, las tablas y las columnas, en inglés.

## Fuentes de verdad

Si se contradicen, manda la primera:

1. `.specify/memory/constitution.md`: cómo se construye (stack y versiones fijadas, capas,
   dinero, privacidad, seguridad, logging, validación, accesibilidad, diseño, puertas del CI y
   definición de terminado).
2. `Historias.md`: qué se construye (requisitos `BE-FR-XX` con sus `CA`, testing en la sección 15
   y experiencia de usuario en la sección 16).
3. `ARCHITECTURE.md`: dónde va cada cosa, fronteras entre funcionalidades, flujos y el
   «Architecture Check» de cada plan. Las decisiones y sus alternativas, en `docs/adr/`.
4. Sistema de diseño: hasta L01, `Design/`; desde L01, `src/lib/design-system/` y
   `src/lib/components/{ui,layout}/` (ADR 0007). Adaptaciones pendientes en `Historias.md` 16.2.
5. `specs/NNN-*/`: especificación, plan y tareas de cada funcionalidad, generados con Spec Kit.

Una contradicción no se resuelve en silencio: se informa y se enmienda uno de los documentos.

## Flujo de trabajo (Spec Kit)

`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze`
→ `/speckit-implement` → `/speckit-converge`. La constitución solo se cambia con
`/speckit-constitution`.

- En `/speckit-plan`, lee `ARCHITECTURE.md` y añade después del «Constitution Check» la sección
  «Architecture Check» (sección 12), con las aristas nuevas entre funcionalidades.

- Cada especificación cita los `BE-FR` que cubre. El trabajo va por lotes (L01–L16,
  `Historias.md` 15.6), y cada lote cierra con su checkpoint (15.29).
- Ramas: `main` (producción), `staging` y ramas de trabajo `NNN-nombre-corto`, creadas por Spec
  Kit. Commits con Conventional Commits.

## Localizar el código

El servidor es un monolito modular: `src/lib/server/features/<funcionalidad>/` (`index.ts` como API
pública y, si hacen falta, `domain/`, `service.ts`, `repository.ts`, `schema.ts`, `contract.ts`,
`events.ts` y `presenters.ts`). La tabla de funcionalidades con su orden, tablas, requisitos y
dependencias permitidas está en `ARCHITECTURE.md` (sección 3); dónde va cada cosa, en la sección 7.

- Busca primero el `BE-FR` en esa tabla para saber qué funcionalidad toca.
- Desde otra funcionalidad o desde una ruta, importa **solo** su `index.ts`, y solo de las
  funcionalidades anteriores en el orden. Nunca leas tablas ajenas. Solo `credits` escribe en el
  saldo.
- Si una tarea necesita romper una frontera, detente y propón un cambio de diseño o un ADR.

## Comandos

Los scripts son los de la constitución («Scripts estándar») y `Historias.md` 15.25, ya creados en L01. Tiempos medidos el 2026-10-10 en Windows, en serie (T064, `specs/001-cuenta-mardomingo-v4/research.md`): `check` 19 s, `lint` 53 s, `lint:changed` 14 s (sin cambios), `lint:tokens` 1 s, `test` 23 s, `test:coverage` 25 s, `build` 22 s, `test:http` 10 s, `test:e2e:smoke` 8 s y `test:e2e:a11y` 12 s en Chromium. `pnpm validate` se ejecutará completo en el checkpoint de L01 (T066).

| Script                                                                     | Uso                                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm check`                                                               | `svelte-kit sync` + `svelte-check` sin avisos                                                    |
| `pnpm lint`                                                                | Prettier + ESLint sin avisos (nivel historia, PR y CI)                                           |
| `pnpm lint:changed`                                                        | ESLint solo sobre lo modificado (nivel lote)                                                     |
| `pnpm verify:batch`                                                        | Cierre de lote: Prettier, lint:changed, check, arquitectura, tests afectados y dominio           |
| `pnpm lint:tokens`                                                         | Sin colores literales fuera de los tokens                                                        |
| `pnpm test` / `pnpm test:coverage`                                         | Vitest: unit, componente e integración (sin `http`)                                              |
| `pnpm test:related <ficheros>`                                             | Tests afectados por un cambio (nivel edición)                                                    |
| `pnpm test:http`                                                           | Hooks y API contra el build                                                                      |
| `pnpm test:trace`                                                          | Lista los `CA` y `UX-xx` sin test                                                                |
| `pnpm test:e2e` / `test:e2e:smoke` / `test:e2e:critical` / `test:e2e:a11y` | Playwright contra el build                                                                       |
| `pnpm build`                                                               | Build de producción (sin secretos)                                                               |
| `pnpm validate`                                                            | `check`, `lint`, `test:coverage`, `build` y `test:e2e`, en ese orden, parando en el primer fallo |

Qué ejecutar en cada nivel (edición, lote, historia o PR): `Historias.md` 15.24. El test de
arquitectura se ejecuta siempre al cerrar un lote: `test:related` no lo selecciona.

Gestor de paquetes: **pnpm** (no uses npm ni yarn). Node 24.21.0 y pnpm 12.8.1.

## Reglas de trabajo

- **No ejecutes check, lint y tests a la vez.** Encadénalos y anota cuánto tarda cada uno.
- En el nivel de lote usa `lint:changed`. El lint completo es para la historia, el PR y el CI. No
  esperes en segundo plano a un lint completo que tarde decenas de minutos: páralo y usa el parcial.
- **Mide antes de optimizar**: sin el número de antes y el de después, una optimización no cuenta.
- Los tests de datos no ejecutan el `load` ni el layout. Para eso hacen falta un test de carga o un
  E2E contra el build.
- Un test que falla una vez bajo carga y luego pasa es contención, no un test inestable: ejecútalo
  aislado y mira el uso de la máquina antes de tocarlo.
- **No declares terminado ni verificado lo que no has ejecutado.** Dilo expresamente («no
  verificado») e indica qué falta.
- No rebajes umbrales ni ocultes fallos para que algo pase (constitución, «Política de errores y
  avisos»).
- No añadas dependencias ni cambies versiones fijadas sin justificarlo en el plan.

## Límites

- **No hagas commit ni push sin autorización explícita.** Antes de cada commit revisa
  `git status` y no incluyas ficheros ajenos a la tarea.
- No leas ni muestres secretos (`.env*` salvo `.env.example`, claves y tokens).
- No modifiques a mano `.specify/` ni `.claude/skills/speckit-*`: los gestiona Spec Kit (la
  constitución, solo con `/speckit-constitution`).
- Un ADR aceptado y ya integrado no se edita: se sustituye por otro (`docs/adr/README.md`).
- El sistema de diseño solo se cambia con aprobación, de forma centralizada (tokens y
  componentes), nunca con estilos locales.
- No borres ni sobrescribas especificaciones ya cerradas en `specs/`.

## Interfaz

- Antes de crear un componente, busca en `components/ui/`, `components/layout/` y el sistema de
  diseño; las variantes nuevas se añaden ahí.
- Sin colores literales ni paleta de Tailwind: solo tokens. El cristal, solo en las zonas del
  principio XIII. Iconos con el componente `Icon` del sistema de diseño.
- Enlaces con `resolve()`, mutaciones con form actions y filtros por formulario GET. Prueba sin
  JavaScript: nada crítico depende de él salvo el captcha del registro.

## Entorno (Windows)

- Hay dos shells: Bash (Git Bash) y PowerShell 5.1, cada una con su sintaxis.
- Si un comando falla por rutas, comillas o _heredocs_ largos, escribe el fichero con la
  herramienta de escritura en lugar de repetirlo.
- En Node usa rutas de Windows (`cygpath -w`): el `/tmp` de Git Bash no es el `/tmp` que ve Node.
- Las capturas de regresión visual solo se generan en el contenedor oficial de Playwright, nunca
  en Windows (`Historias.md` 15.18).

## Terminado

Una tarea está terminada cuando cumple la definición de la constitución («Definición de terminado»)
y, según su alcance, la _Definition of Checkpoint_ o la _Definition of Done_ de `Historias.md`
(15.29 y 15.30). Si tiene interfaz, se informa de cada comprobación de UX como comprobado,
pendiente, no verificable o no aplica.
