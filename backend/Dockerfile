# Backend image. Build context: ./backend
# Runs as-is on ECS Fargate, App Runner or EKS: config comes from env vars,
# logs go to stdout, it listens on $PORT, and it exposes /healthz.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Writable outbox in case MAIL_PROVIDER=file is used inside the container.
RUN mkdir outbox && chown node:node outbox
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
CMD ["node", "dist/index.js"]
