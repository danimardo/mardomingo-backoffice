# 0009 — Sistema de diseño propio (BeCall) con el color verde salvia

- **Estado:** Aceptado (2026-11-18). Sustituye al [0007](0007-fuente-canonica-del-sistema-de-diseno.md).

## Contexto

El ADR 0007 fijó la identidad «Aurora Salvia», reciclada de NetworkBench, y declaró fuente canónica
`src/lib/design-system/` y `src/lib/components/{ui,layout}/` desde L01. En la práctica, la web salió
con la capa de tipografía base sin escribir (títulos, párrafos y enlaces sin estilo) y con un catálogo
de componentes pequeño (16 componentes de `ui/`).

El propietario mantiene un sistema de diseño propio (`@becall/design-system`: Svelte 5, ~114
componentes, tokens generados por script con contraste WCAG 2.2 AA verificado, tipografía Poppins,
fondo ambiental y cristal). Es obra del propietario, que tiene permiso absoluto para reutilizarlo;
solo quedan fuera los logotipos y el nombre de BeCall.

## Decisión

- Se **adopta el sistema de diseño del propietario** como base de estructura, tipografía, espacios,
  radios, movimiento y componentes. Sin logotipos ni nombre de BeCall.
- El **color de marca es el verde salvia** actual, generado con el script de tokens del sistema, con
  su escala, estados y tema oscuro y el contraste verificado por script. No se usa el azul `#008AAB`.
- Sigue habiendo **un solo fichero de tokens**: `src/lib/design-system/tokens.css`. Manda el código de
  la app; `Design/` es documentación archivada.
- El **catálogo completo** se copia a `src/lib/design-catalog/`, **excluido** de ESLint,
  `svelte-check`, Vitest y cobertura, y sin importaciones desde la app. Un componente se **promueve**
  a `src/lib/components/ui/` o `layout/` cuando una pantalla lo usa: se adapta (sin Tauri, con form
  actions, sin JavaScript salvo el captcha del registro), y desde entonces se comprueba y se testea.
  `src/lib/design-catalog/ACTIVOS.md` lista los promovidos y el CI comprueba que coincide con lo
  importado.
- **Poppins** (licencia OFL) se sirve desde el propio servidor. Los iconos usan `@lucide/svelte`
  (ISC, versión fijada exacta) a través del componente `Icon`.
- **Cristal y fondo ambiental animado** en casi toda la web. Bajo tablas, formularios, listas largas,
  paso de compra, textos legales y datos de la administración, cristal denso casi opaco u opaco.
  Los emails, sin cristal.
- Se **elimina el ajuste propio** «Reducir transparencia y movimiento». Siguen respetándose siempre
  `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast` y `forced-colors`.

## Alternativas consideradas

- **Solo tokens y estilo base**, manteniendo los componentes actuales: menos riesgo y menos trabajo,
  pero se pierde el catálogo y cada componente nuevo se escribe a mano.
- **Instalarlo como paquete** (`@becall/design-system`): es privado y vive en otro repositorio; el
  Docker y el CI no podrían descargarlo sin publicarlo, y la app quedaría atada a su calendario.
- **Copiar solo los componentes que usamos**: un catálogo más pequeño, pero cada componente futuro
  exigiría volver a buscarlo y copiarlo. Se prefiere el catálogo entero aparte y la promoción.
- **Mantener «Aurora Salvia» y arreglar la capa base**: resuelve el aspecto roto, no el catálogo.
- **Ignorar las preferencias de movimiento y transparencia del dispositivo**: descartada. Incumple
  WCAG 2.2 y el principio IX.

## Consecuencias

- Constitución 3.0.0 (principio XIII). `Historias.md` 16 (DS-xx) y los requisitos de UX relativos al
  ajuste de efectos, y `ARCHITECTURE.md` y `CLAUDE.md`, se actualizan para no contradecirla.
- El código actual contradice la constitución hasta que termine la migración: tokens, tipografía,
  fondo, cristal por zonas, retirada del ajuste y componentes promovidos.
- Nueva dependencia: `@lucide/svelte`. Se justifica y se fija en el plan.
- Hay que tocar la configuración de lint, check, tests y CI para excluir `design-catalog/` y para
  comprobar la lista de activos.
- Una nueva medida de contraste sobre la composición real (cristal sobre fondo) en ambos temas.
- Los logotipos de BeCall no entran en el repositorio.
