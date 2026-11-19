# 0011 — Sin entorno de staging: producción cerrada hasta el lanzamiento

- **Estado:** Aceptado (2026-11-19)

## Contexto

La constitución y `Historias.md` preveían un entorno `staging` (otra aplicación de Coolify en el mismo servidor, puerto
7312, base de datos y bucket propios) por el que debía pasar todo cambio antes de producción. Staging nunca se creó: el
humo posterior al despliegue está desactivado (`STAGING_ENABLED`) y el host de staging quedó «por confirmar» tras el
ADR 0010. El propietario ha decidido no crearlo y usar producción como único entorno, probándola él antes de abrirla.

## Decisión

- Hay un único entorno desplegado, `production`, en `https://backend.mardomingo.com`. Se elimina el entorno `staging`,
  su rama, su puerto (7312) y su host.
- Hasta el lanzamiento, producción está **cerrada a Internet**: solo accede el propietario (lista de acceso o resolución
  restringida en Nginx Proxy Manager). Se abre cuando el propietario lo decida.
- Las ramas son `main` (despliega a producción) y las ramas de trabajo `NNN-nombre-corto`. Se integra en `main` mediante
  PR con el CI en verde y `pnpm validate`.
- Las migraciones se aplican al arrancar, tras un backup (Litestream a Backblaze B2 activo desde el primer despliegue).
  Se prueban en local y en el contenedor de prueba (`docker-compose.yml`) antes de desplegar.
- El humo posterior al despliegue (`e2e/smoke.spec.ts`, solo lectura) se ejecuta contra producción.
- Las verificaciones que se hacían en staging (IP real del cliente con `XFF_DEPTH=1`, formularios sin `403` de origen, emails
  en Gmail, Outlook y Apple Mail, carga) se hacen en producción cerrada, antes de abrirla.

## Consecuencias

- No hay ensayo con datos separados: una migración defectuosa afecta a datos reales. Mitigación: backup previo,
  réplica continua y simulacro de restauración (`docs/operaciones/restauracion.md`).
- Las claves son las de producción (Turnstile real, proveedores de IA con su límite de gasto): las claves de prueba de
  Turnstile se rechazan en producción.
- Los pagos son simulados (`PAYMENTS_PROVIDER=simulated`) mientras producción esté cerrada.
- Enmienda de la constitución pendiente (`/speckit-constitution`): despliegue, ramas, puertos y verificación en staging.
- Si más adelante hay usuarios reales, se reabre la decisión y se crea un staging con un ADR nuevo que sustituya a este.
