#!/bin/sh
# Arranque de la imagen (R15). Si la base no existe y hay réplica en Backblaze B2, la restaura; después la app
# corre bajo `litestream replicate -exec`, que replica la BD y reenvía las señales al proceso de Node.
set -eu

litestream restore -if-db-not-exists -if-replica-exists -config /app/litestream.yml "${DATABASE_PATH}"
exec litestream replicate -config /app/litestream.yml -exec "node build"
