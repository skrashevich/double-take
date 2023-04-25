# syntax = docker/dockerfile-upstream:master-labs

FROM node:16 as canvas-builder
ARG DEBIAN_FRONTEND=noninteractive
# Prepare apt for buildkit cache
RUN rm -f /etc/apt/apt.conf.d/docker-clean \
  && echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' >/etc/apt/apt.conf.d/keep-cache

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt,sharing=locked <<EOT
apt -y update
apt install -y build-essential libpixman-1-dev libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev pax-utils curl bash
ln -s /usr/bin/lddtree /usr/bin/lddtree.sh
EOT
ENV BUN_INSTALL /usr/local/
RUN curl -fsSL https://bun.sh/install | bash
RUN npm install -g node-gyp
ADD https://github.com/Automattic/node-canvas.git#v2.11.2 /src
WORKDIR /src
RUN bun install --ignore-scripts
RUN cp ./prebuild/Linux/binding.gyp ./binding.gyp
RUN node-gyp rebuild -j $(nproc)
RUN cd build/Release && cp `lddtree -l canvas.node | grep -v 'canvas.node'` /opt/

FROM --platform=$BUILDPLATFORM node:16 AS frontend-builder
ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /build
RUN apt -y update && apt install -y --no-install-recommends curl bash unzip
ENV BUN_INSTALL /usr/local/
RUN curl -fsSL https://bun.sh/install | bash
COPY /frontend/package.json .
RUN --mount=type=cache,target=/root/.npm bun install --cache-dir=/root/.npm/_buncache
COPY /frontend/src ./src
COPY /frontend/public ./public
COPY /frontend/.env.production /frontend/vue.config.js /frontend/vite.config.js /frontend/.eslintrc.js /frontend/index.html ./
RUN --mount=type=cache,target=/root/.npm npm run build


FROM node:16 as build
ARG DEBIAN_FRONTEND=noninteractive
# Prepare apt for buildkit cache
RUN rm -f /etc/apt/apt.conf.d/docker-clean \
  && echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' >/etc/apt/apt.conf.d/keep-cache

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt,sharing=locked <<EOT
apt -y update
apt install -y curl bash jq unzip wget
 #curl -sL https://deb.nodesource.com/setup_16.x | bash -
apt install -y gcc g++ make libpixman-1-dev libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev

export BUN_INSTALL=/usr/local/
curl -fsSL https://bun.sh/install | bash
 
EOT
WORKDIR /double-take/api
COPY /api/package.json .

RUN --mount=type=cache,target=/root/.npm bun install --cache-dir=/root/.npm/_buncache
RUN cd node_modules/sharp && npm rebuild
COPY --link --from=canvas-builder /src ./node_modules/canvas

WORKDIR /double-take/api
COPY /api/server.js .
COPY /api/src ./src

WORKDIR /
RUN mkdir /.storage && ln -s /.storage /double-take/.storage

WORKDIR /double-take
COPY --link --from=frontend-builder /build/dist ./frontend
RUN --mount=type=cache,target=/root/.npm npm install nodemon -g
RUN mkdir -p /opt/lib
COPY --link --from=canvas-builder /opt/* /opt/lib/
RUN cp /lib/*-linux-gnu*/libuuid.so.1.3.0 /opt/lib/libuuid.so.1

#COPY /.build/entrypoint.sh .

#COPY --from=sqlite-web /src/dist/sqlite_web /usr/local/bin/sqlite_web

FROM node:16-slim
COPY --link --from=build /double-take /double-take
COPY --from=build /opt/lib/* /lib/

ENV NODE_ENV=production
WORKDIR /double-take
EXPOSE 3000
CMD ["api/server.js"]
