# syntax=docker/dockerfile:1
# Build once on the runner's native platform: the output is plain JS, so every target arch reuses it.
FROM --platform=$BUILDPLATFORM node:26-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
RUN npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
RUN pnpm install --frozen-lockfile
COPY . .
ARG HUB_VERSION=
ENV HUB_VERSION=$HUB_VERSION
RUN pnpm build && pnpm prune --prod

FROM node:26-alpine
LABEL org.opencontainers.image.source=https://github.com/Armistice-Group/Atrium
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "build"]
