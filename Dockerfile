# Imagen de producción (R15; constitución, «Despliegue»). Dos etapas: la de construcción instala con el lockfile y
# compila; la final solo lleva el build de producción, las dependencias de producción y Litestream + ffmpeg.
ARG NODE_IMAGE=node:24.21.0-trixie-slim

FROM ${NODE_IMAGE} AS build
RUN npm install --global pnpm@12.8.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM ${NODE_IMAGE} AS runtime
ARG LITESTREAM_VERSION=0.5.17
# SHA-256 del .deb publicado en checksums.txt de la versión (se comprueba antes de instalar).
ARG LITESTREAM_SHA256=a191a0928884d1820fab1f866ede1d0d5811c323d0587bf863a43481a82a7668
RUN apt-get update \
	&& apt-get install --yes --no-install-recommends ca-certificates ffmpeg curl \
	&& curl --fail --silent --show-error --location --output /tmp/litestream.deb \
		"https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-x86_64.deb" \
	&& echo "${LITESTREAM_SHA256}  /tmp/litestream.deb" | sha256sum --check --strict \
	&& apt-get install --yes /tmp/litestream.deb \
	&& rm -f /tmp/litestream.deb \
	&& apt-get purge --yes curl \
	&& apt-get autoremove --yes \
	&& rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
	APP_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	DATABASE_PATH=/data/app.db
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY litestream.yml docker-entrypoint.sh ./
RUN chmod 0755 docker-entrypoint.sh \
	&& mkdir -p /data \
	&& chown node:node /data

USER node
VOLUME ["/data"]
EXPOSE 3000

# El healthcheck usa el mismo endpoint que Coolify (E13): 200 cuando la base de datos responde.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
