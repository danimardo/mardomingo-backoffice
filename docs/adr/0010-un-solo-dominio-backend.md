# 0010 — Un solo dominio para la API y la web

- **Estado:** Aceptado (2026-11-19)

## Contexto

El ADR 0001 fijó dos hosts servidos por la misma instancia: `api.mardomingo.com` (apps cliente con
token Bearer) y `cuenta.mardomingo.com` (web). El propietario ha decidido servir toda la
aplicación desde un único dominio, `https://backend.mardomingo.com`, con Nginx Proxy Manager (NPM)
externo como único proxy inverso delante, TLS terminado en NPM y la app publicada en el puerto
7311 del host (accesible desde la LAN, nunca el 3000). El despliegue es un docker-compose en
Coolify.

## Decisión

- La API (`/api/v1/*`) y la web (registro, panel de usuario y administración) se sirven en la raíz
  de `https://backend.mardomingo.com`.
- `PUBLIC_API_URL` y `PUBLIC_WEB_URL` valen el mismo origen. El código ya lo admite: cuando ambos
  hosts coinciden, `hostSeparation` de `src/hooks.server.ts` no separa. No se cambia código de la
  aplicación.
- `api.mardomingo.com` y `cuenta.mardomingo.com` dejan de existir como hosts.
- Un solo proxy delante (NPM); la app escucha en el puerto 7311.

## Alternativas consideradas

- **Mantener los dos hosts** (ADR 0001): separación fuerte entre cookies de sesión y token Bearer
  por origen, pero dos certificados y dos entradas en NPM por un beneficio que el propietario no
  necesita.
- **`backend.` como principal y `api.`/`cuenta.` como alias**: mantendría compatibilidad con URLs
  antiguas, pero obliga a decidir qué host es canónico, duplica orígenes de confianza (Better
  Auth, CORS, CSRF) y deja la separación por host a medias. Se descarta.

## Consecuencias

- Las cookies de sesión de Better Auth y la comprobación de CSRF de `handle` operan en un solo
  origen: `/api/v1/*` y la web comparten origen y la separación por host queda inerte.
- Las rutas de la API siguen sin leer cookies y autentican solo con Bearer; la distinción entre
  API y web pasa a ser solo por ruta, no por host.
- A revisar: CSP y CORS (los orígenes permitidos y `connect-src` ya no distinguen dos hosts),
  `BETTER_AUTH_URL` y los orígenes de confianza (uno solo), y las URL absolutas que `/app/status`
  entrega a las apps cliente.
- Las apps cliente (Secretario AI) deben cambiar su URL base a
  `https://backend.mardomingo.com/api/v1`.

## Documentos que se actualizan

`Historias.md` (versión 2.18, sección 13) y su copia en `secretario2`, `ARCHITECTURE.md`,
`docs/manual-api.md`, `docs/api/api-v1.md` y el estado del ADR 0001. La constitución
(«Rutas y dominios», «Proxy, puerto e IP del cliente» y su cabecera) y los `specs/` cerrados no se
editan aquí: la constitución se enmienda con `/speckit-constitution`.
