# Build stage
FROM node:22-slim AS build
WORKDIR /workspace

# Install Playwright dependencies for Chromium, image optimization tools, and git
# Git is required for Starlight's lastUpdated feature to extract file modification dates
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
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy .git directory first for Starlight's lastUpdated feature
COPY .git ./.git

# Copy app directory and install dependencies
COPY app/package*.json ./app/
WORKDIR /workspace/app
RUN npm install
RUN npx playwright install chromium

# Copy the rest of the app
COPY app/ ./

# Optimize OG images before build
RUN ./scripts/optimize-og-images.sh

# Build the app (Git history is available at /workspace/.git)
RUN npm run build

# Runtime stage - serve static files with nginx
FROM nginx:alpine AS runtime
COPY app/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /workspace/app/dist /usr/share/nginx/html
EXPOSE 8080
