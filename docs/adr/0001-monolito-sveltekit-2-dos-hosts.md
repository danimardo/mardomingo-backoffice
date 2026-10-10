# 0001 — Monolito SvelteKit 2 que sirve la API y la web

- **Estado:** Aceptado (2026-10-10)

## Contexto

El backend sirve dos públicos: las apps cliente (API JSON con token Bearer en
`api.mardomingo.com`) y las personas (web SSR con registro, panel y administración en
`cuenta.mardomingo.com`). Lo desarrolla una persona con agentes de IA y se despliega en un único
servidor con Coolify. Better Auth, la librería de autenticación elegida, no soporta todavía
SvelteKit 3.

## Decisión

Una sola aplicación **SvelteKit 2.70** (Svelte 5, `adapter-node`, Node 24) sirve los dos hosts.
`handle` separa los dominios: el host de la API solo responde a `/api/v1/*` y el de la web solo a
la web; `/api/v1/health` responde con cualquier host. SvelteKit 3 queda prohibido hasta que Better
Auth lo soporte. Las *remote functions* no se usan por ser experimentales.

## Alternativas consideradas

- **Dos aplicaciones** (API en Fastify o Hono y web en SvelteKit): duplica la autenticación, la
  configuración, los despliegues y los tipos compartidos, sin ningún beneficio a esta escala.
- **SvelteKit 3**: incompatible con Better Auth en la fecha de la decisión.
- **Una SPA más una API**: pierde SSR y la mejora progresiva que exige la constitución (principio IX).

## Consecuencias

- Un solo despliegue, una sola base de código y tipos compartidos entre la API y la web.
- La separación por host es una responsabilidad del código, y la cubren tests HTTP.
- La migración a SvelteKit 3 se revisa al cerrar cada fase (constitución, «Gobernanza»).
