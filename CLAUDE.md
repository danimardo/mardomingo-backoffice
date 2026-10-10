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
3. `Design/`: identidad visual, tokens y componentes base. Tiene adaptaciones pendientes
   (`Historias.md` 16.2, DS-01 a DS-09).
4. `specs/NNN-*/`: especificación, plan y tareas de cada funcionalidad, generados con Spec Kit.

Una contradicción no se resuelve en silencio: se informa y se enmienda uno de los documentos.

## Flujo de trabajo (Spec Kit)

`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze`
→ `/speckit-implement`. La constitución solo se cambia con `/speckit-constitution`.

- Cada especificación cita los `BE-FR` que cubre. El trabajo va por lotes (L01–L16,
  `Historias.md` 15.6), y cada lote cierra con su checkpoint (15.29).
- Ramas: `main` (producción), `staging` y ramas de trabajo `NNN-nombre-corto`, creadas por Spec
  Kit. Commits con Conventional Commits.

## Comandos

**Pendientes del scaffold (L01): todavía no existen `package.json` ni scripts.** Son los previstos
en la constitución («Scripts estándar») y en `Historias.md` 15.25. Cuando existan, se comprueban,
se mide cuánto tarda cada uno y se actualiza esta sección.

| Script | Uso |
|---|---|
| `pnpm check` | `svelte-kit sync` + `svelte-check` sin avisos |
| `pnpm lint` | Prettier + ESLint sin avisos (nivel historia, PR y CI) |
| `pnpm lint:changed` | ESLint solo sobre lo modificado (nivel lote) |
| `pnpm test` / `pnpm test:coverage` | Vitest |
| `pnpm test:e2e` / `test:e2e:smoke` / `test:e2e:critical` | Playwright contra el build |
| `pnpm build` | Build de producción (sin secretos) |
| `pnpm validate` | Todo lo anterior en orden, parando en el primer fallo |

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
- No modifiques `.specify/` ni `.claude/skills/speckit-*`: los gestiona Spec Kit.
- `Design/` solo se cambia con aprobación, de forma centralizada (tokens y componentes), nunca con
  estilos locales.
- No borres ni sobrescribas especificaciones ya cerradas en `specs/`.

## Entorno (Windows)

- Hay dos shells: Bash (Git Bash) y PowerShell 5.1, cada una con su sintaxis.
- Si un comando falla por rutas, comillas o *heredocs* largos, escribe el fichero con la
  herramienta de escritura en lugar de repetirlo.
- En Node usa rutas de Windows (`cygpath -w`): el `/tmp` de Git Bash no es el `/tmp` que ve Node.
- Las capturas de regresión visual solo se generan en el contenedor oficial de Playwright, nunca
  en Windows (`Historias.md` 15.18).

## Terminado

Una tarea está terminada cuando cumple la definición de la constitución («Definición de terminado»)
y, según su alcance, la *Definition of Checkpoint* o la *Definition of Done* de `Historias.md`
(15.29 y 15.30). Si tiene interfaz, se informa de cada comprobación de UX como comprobado,
pendiente, no verificable o no aplica.
