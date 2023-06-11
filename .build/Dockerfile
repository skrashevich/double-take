# syntax = docker/dockerfile-upstream:master-labs
FROM --platform=${BUILDPLATFORM} alpine:latest as recognizer-models
RUN apk add wget bzip2
WORKDIR /src/models
RUN wget https://github.com/davisking/dlib-models/raw/master/shape_predictor_5_face_landmarks.dat.bz2
RUN wget https://github.com/davisking/dlib-models/raw/master/dlib_face_recognition_resnet_model_v1.dat.bz2
RUN wget https://github.com/davisking/dlib-models/raw/master/mmod_human_face_detector.dat.bz2
RUN wget https://github.com/Kagami/go-face-testdata/raw/master/models/shape_predictor_68_face_landmarks.dat
RUN bunzip2 *.bz2 && rm -rf *.bz2


FROM golang:1.20-buster as recognizer-builder
ARG DEBIAN_FRONTEND=noninteractive
ARG TARGETARCH

# Cache dependencies
WORKDIR /src
COPY ./recognizer/go.mod ./recognizer/go.sum  ./
COPY ./recognizer/pkg/go-recognizer/go.mod ./pkg/go-recognizer/go.mod 
COPY ./recognizer/pkg/go-face/go.mod ./pkg/go-face/go.mod 
RUN --mount=type=cache,target=/root/.cache/go-build --mount=type=cache,target=/go/pkg/mod go mod download

# Prepare apt for buildkit cache
RUN rm -f /etc/apt/apt.conf.d/docker-clean \
  && echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' >/etc/apt/apt.conf.d/keep-cache

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt,sharing=locked apt update
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt,sharing=locked apt install -y libdlib-dev libblas-dev libatlas-base-dev liblapack-dev libjpeg62-turbo-dev wget bzip2 gfortran 

ADD ./recognizer /src

WORKDIR /src

RUN --mount=type=cache,target=/root/.cache/go-build --mount=type=cache,target=/go/pkg/mod/cache/download \
  --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt,sharing=locked <<EOT
if [ "${TARGETARCH}" = "amd64" ]; then
  apt install -y libquadmath0;
  export CGO_LDFLAGS="-lcblas -llapack_atlas -lgfortran -lquadmath -lblas -latlas"
else
  export CGO_LDFLAGS="-lcblas -llapack_atlas -lgfortran -lblas -latlas"
fi
CGO_ENABLED=1 go build -trimpath -ldflags "-s -w -extldflags -static" -o recognizer
EOT

FROM --platform=$BUILDPLATFORM node:16 AS frontend-builder
ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /build
RUN apt -y update && apt install -y --no-install-recommends curl bash unzip

COPY /frontend/package.json .
RUN --mount=type=cache,target=/root/.npm npm install
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

ENV PATH /opt/bun/bin:/root/.bun/bin:$PATH
RUN bun install -g nodemon

WORKDIR /double-take
COPY .build/entrypoint.sh ./
EXPOSE 3000
ENV NODE_ENV 'production'
ENTRYPOINT ["/bin/bash", "./entrypoint.sh"]
