# Componentes activos del catálogo

Lista de los componentes del catálogo que se han **promovido** a la app (ADR 0009; constitución, principio XIII). El
catálogo de esta carpeta está copiado sin adaptar y queda fuera de ESLint, `svelte-check`, Prettier, Vitest, cobertura,
`lint:tokens`, el test de arquitectura, Tailwind y la imagen Docker: **solo se comprueba lo que se usa**, y lo que se
usa se promueve antes. `pnpm verify:catalog` (puerta 10 del CI y `pnpm verify:batch`) comprueba esta lista.

## Promovidos

| Componente del catálogo | Destino | Fecha | Motivo |
| ----------------------- | ------- | ----- | ------ |

## Reglas de promoción

1. Un componente se promueve **solo cuando una pantalla lo usa**.
2. Se **copia** a `src/lib/components/ui/` (primitivas) o `src/lib/components/layout/` (marco). El original se queda en
   el catálogo, sin cambios.
3. Se **adapta** antes de usarlo:
   - sin dependencias de Tauri ni de APIs de escritorio;
   - mutaciones con form actions y filtros con formularios GET; funciona **sin JavaScript** (salvo el captcha del
     registro);
   - **solo tokens** de `src/lib/design-system/tokens.css`: ni colores literales ni paleta de Tailwind; si falta un
     token, se añade al sistema antes;
   - iconos con el componente `Icon`; textos con Paraglide; enlaces con `resolve()`;
   - las importaciones de `../tokens/…` u otras carpetas del catálogo se sustituyen por las de la app.
4. Se **testea** (componente y, si tiene interfaz, accesibilidad) y desde ese momento entra en todas las
   comprobaciones: ESLint, `svelte-check`, Prettier, Vitest con cobertura, `lint:tokens` y arquitectura.
5. El fichero promovido lleva en su cabecera, en las primeras 20 líneas, de dónde viene, con la ruta relativa a esta
   carpeta:
   - en un `.svelte`: `<!-- @promovido-de buttons/Button.svelte -->`;
   - en un `.ts`: `// @promovido-de core/focusTrap.ts`.
6. Se añade aquí su fila: la ruta del catálogo (relativa a esta carpeta), el destino (desde la raíz del repositorio),
   la fecha (AAAA-MM-DD) y el motivo (la pantalla o la tarea que lo usa).
7. **Nada se importa nunca desde `design-catalog/`**: ni la app, ni los tests, ni los E2E.

`pnpm verify:catalog` falla si alguien importa el catálogo, si un componente de la tabla no existe en el catálogo o en
su destino, si su destino no declara `@promovido-de` con su ruta, o si un fichero de `components/ui` o `layout`
declara `@promovido-de` con una ruta que no figura aquí o que no existe en el catálogo.
