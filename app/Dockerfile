FROM node:22-slim AS base
WORKDIR /app
COPY package*.json ./

FROM base AS prod-deps
RUN npm ci --omit=dev

FROM base AS build-deps
RUN npm ci

FROM build-deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "./dist/server/entry.mjs"]

