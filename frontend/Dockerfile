# Build stage
FROM node:24-slim AS build

WORKDIR /app

COPY package.json package-lock.json* .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage — serve with nginx as non-root (uid 101); listens on unprivileged :3000
FROM nginxinc/nginx-unprivileged:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# SPA routing + API proxy + gzip compression + P4 timeout protection
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
