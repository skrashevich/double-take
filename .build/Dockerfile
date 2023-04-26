# syntax = docker/dockerfile-upstream:master-labs

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

export BUN_INSTALL=/opt/bun
curl -fsSL https://bun.sh/install | bash
 
EOT
WORKDIR /double-take/api
COPY /api/package.json .
ENV PATH /opt/bun/bin:$PATH
RUN --mount=type=cache,target=/root/.npm bun install --cache-dir=/root/.npm/_buncache
RUN cd node_modules/sharp && npm rebuild

WORKDIR /double-take/api
COPY /api/server.js .
COPY /api/src ./src

WORKDIR /
RUN mkdir /.storage && ln -s /.storage /double-take/.storage

WORKDIR /double-take
COPY --link --from=frontend-builder /build/dist ./frontend

RUN mkdir -p /opt/lib
RUN cp /lib/*-linux-gnu*/libuuid.so.1.3.0 /opt/lib/libuuid.so.1


FROM node:16-slim
COPY --link --from=build /opt/bun /opt/bun
COPY --link --from=build /double-take /double-take
COPY --from=build /opt/lib/* /lib/

WORKDIR /double-take
EXPOSE 3000
CMD ["/opt/bun/bin/bun", "api/server.js"]
