# Restauración de la base de datos (Litestream)

Procedimiento para restaurar la base SQLite desde la réplica de Backblaze B2 (UE), según `litestream.yml`,
`docker-entrypoint.sh` y la ADR 0002. La copia se toma cada 24 h como snapshot y se conserva 720 h (30 días).

## Cómo funciona hoy

- Al arrancar el contenedor, `docker-entrypoint.sh` ejecuta
  `litestream restore -if-db-not-exists -if-replica-exists` sobre `DATABASE_PATH`. Si la base ya existe, no restaura.
- Después arranca `litestream replicate -exec "node build"`, que replica la base mientras corre la aplicación.
- Las credenciales (`LITESTREAM_*`) vienen del entorno de Coolify. Nunca se escriben en el repositorio.

## Restaurar a un punto en el tiempo

> **NO VERIFICADO.** Los comandos de esta sección no se han ejecutado todavía. La verificación es la tarea T372
> (simulacro en staging). Hasta entonces, no se consideran válidos.

1. Parar la aplicación en el entorno afectado (Coolify) para que nadie escriba durante la restauración.
2. Conservar la base actual (renombrarla, no borrarla).
3. Restaurar en un fichero nuevo, indicando el instante deseado:

   ```sh
   litestream restore -config /app/litestream.yml -timestamp 2026-10-21T10:00:00Z -o /data/restaurada.db "$DATABASE_PATH"
   ```

4. Comprobar la integridad: `sqlite3 /data/restaurada.db "PRAGMA integrity_check;"` debe responder `ok`.
5. Sustituir la base por la restaurada y arrancar la aplicación.
6. Comprobar `/api/v1/health` y el panel de administración con una cuenta de prueba.
7. Anotar en el registro de operaciones: instante restaurado, duración y quién lo ejecutó.

## Simulacro (T372)

- Restaurar en staging a un instante conocido (con una escritura de prueba antes y después).
- Medir el tiempo de restauración y anotar si la escritura posterior al instante elegido desaparece, como debe.
- Registrar el resultado en este fichero con la fecha y el responsable.

## Qué no cubre esta réplica

- Escrituras que no llegaron a la réplica antes del fallo (ventana de replicación de Litestream).
- Ficheros fuera de SQLite: la configuración y los secretos se recuperan desde Coolify, no desde la copia.
