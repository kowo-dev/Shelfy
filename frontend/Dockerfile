FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG API_BASE_URL
ARG APP_VERSION=dev
RUN test -n "$API_BASE_URL" \
    && printf "export const environment = { production: true, version: '%s', baseUrl: '%s', tmdbImageBaseUrl: 'https://image.tmdb.org/t/p/' };\n" "$APP_VERSION" "$API_BASE_URL" > src/environments/environment.prod.ts \
    && npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
USER root
RUN apk upgrade --no-cache
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/shelfy/browser /usr/share/nginx/html

EXPOSE 8080
