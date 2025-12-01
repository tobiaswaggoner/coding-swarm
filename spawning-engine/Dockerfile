# Spawning Engine - Multi-stage build for faster iteration cycles

# ===========================================
# Stage 1: Builder
# ===========================================
FROM node:25-alpine AS builder

WORKDIR /build

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remove devDependencies for smaller copy
RUN npm prune --omit=dev

# ===========================================
# Stage 2: Runtime (slim Alpine image)
# ===========================================
FROM node:25-alpine

# Build metadata (passed via --build-arg)
ARG BUILD_TIMESTAMP=unknown
ARG GIT_COMMIT=unknown
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV GIT_COMMIT=${GIT_COMMIT}

WORKDIR /app

# Copy only production artifacts from builder
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./package.json

# Use node user (UID 1000) for security
USER node

CMD ["node", "dist/index.js"]
