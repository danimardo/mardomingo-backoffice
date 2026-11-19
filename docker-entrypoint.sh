#!/bin/sh
# Arranque de la imagen (R15). Con réplica configurada (LITESTREAM_BUCKET), si la base no existe y hay réplica en
# Backblaze B2 la restaura; después la app corre bajo `litestream replicate -exec`, que replica la BD y reenvía las
# señales al proceso de Node. Sin LITESTREAM_BUCKET la app arranca igualmente, sin réplica, y lo avisa en el log.
set -eu

if [ -n "${LITESTREAM_BUCKET:-}" ]; then
	litestream restore -if-db-not-exists -if-replica-exists -config /app/litestream.yml "${DATABASE_PATH}"
	exec litestream replicate -config /app/litestream.yml -exec "node build"
fi

echo "AVISO: LITESTREAM_BUCKET sin definir. La base de datos NO se replica a Backblaze B2." >&2
exec node build
