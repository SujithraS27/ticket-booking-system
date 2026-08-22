# Build context = repository root (see docker-compose.yml)
FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
RUN npm install --no-audit --no-fund
COPY frontend/vite.config.ts frontend/tailwind.config.js frontend/postcss.config.js frontend/tsconfig.json frontend/index.html frontend/
COPY frontend/src frontend/src
RUN cd frontend && npx tsc --noEmit && npx vite build

FROM nginx:1.27-alpine
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80