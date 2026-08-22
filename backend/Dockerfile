# Build context = repository root (see docker-compose.yml)
FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
RUN npm install --no-audit --no-fund
COPY backend/prisma backend/prisma
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/src backend/src
RUN cd backend && npx prisma generate && npx tsc -p tsconfig.json

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/node_modules /app/node_modules
COPY --from=build /repo/backend/dist /app/dist
COPY --from=build /repo/backend/prisma /app/prisma
EXPOSE 5000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]