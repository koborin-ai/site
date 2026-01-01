# Build stage
FROM node:22-slim AS build
WORKDIR /app

# Install Playwright dependencies for Chromium and image optimization tools
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    webp \
    imagemagick \
    file \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
RUN npx playwright install chromium
COPY . .

# Optimize OG images before build
RUN ./scripts/optimize-og-images.sh

RUN npm run build

# Runtime stage - serve static files with nginx
FROM nginx:alpine AS runtime
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
