# 0007 — Fuente canónica del sistema de diseño

- **Estado:** Aceptado (2026-10-10)

## Contexto

El sistema de diseño (`Design/`) se recicló de NetworkBench, otra app del propietario hecha con
Tauri, y se adaptó con una identidad propia («Aurora Salvia»). Incluye tokens, componentes Svelte 5,
una maqueta y documentación. En L01 los tokens y los componentes tienen que vivir dentro de la app
(`src/lib/`) para que Tailwind 4, SvelteKit y los tests los usen. Si `Design/` y la app tuvieran cada
uno su `tokens.css`, divergirían.

## Decisión

- **Hasta L01**, `Design/` es la fuente canónica de la identidad, los tokens y los componentes base,
  y allí se resuelven las adaptaciones DS-01, 02, 04, 05, 07 y 09 (`Historias.md` 16.2).
- **Desde L01** mandan `src/lib/design-system/` (tokens y tema) y `src/lib/components/ui/` y
  `layout/`. `Design/` queda como documentación de la identidad y de sus reglas, y apunta a esos
  ficheros. `Design/src` se archiva y nunca vuelve a editarse.
- Nunca hay dos ficheros de tokens. El script de tokens del CI (puerta 10) comprueba el código de la
  app.

## Alternativas consideradas

- **`Design/` canónico para siempre, con una copia en la app comprobada por el CI**: cada cambio
  exige editar en dos sitios y sincronizar.
- **Importar desde `Design/` con un alias**: mezcla una carpeta de documentación con el código, y
  `Design/` tiene componentes de escritorio que la web no usa.

## Consecuencias

- L01 incluye migrar los tokens y los componentes que se reutilizan (DS-03, DS-06 para el marco,
  DS-08 y DS-10) y marcar `Design/src` como archivado.
- `Design/` queda fuera de Prettier, ESLint y `tsconfig`, para no comprobar código que ya no se usa.
- Los cambios de identidad posteriores se hacen en el código y se documentan en `Design/`.
