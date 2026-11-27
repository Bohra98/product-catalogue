# Frontend image. Build context: ./frontend
# Builds the static React app and serves it with nginx, which also forwards
# /api to the backend so the browser only ever talks to one origin.
# On AWS the same dist/ can instead go to S3 + CloudFront (see README).

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.30-alpine AS runtime
# Where nginx forwards /api. Override per environment (e.g. an internal ALB or
# ECS Service Connect name). The nginx image substitutes env vars into
# /etc/nginx/templates/*.template at startup.
ENV API_UPSTREAM=http://backend:4000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
