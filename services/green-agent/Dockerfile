# Green Agent - Project Manager for Coding Swarm
# Multi-stage build for faster iteration cycles
#
# BUILD: Run from repository root with:
#   docker build -f services/green-agent/Dockerfile -t tobiaswaggoner/green-agent:latest .
#

# ===========================================
# Stage 1: Builder (slim Node image for fast npm/tsc)
# ===========================================
FROM node:25-alpine AS builder

WORKDIR /build

# Copy package files first for better caching
COPY services/green-agent/package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source and build
COPY services/green-agent/tsconfig.json ./
COPY services/green-agent/src ./src
RUN npm run build

# Remove devDependencies for smaller copy
RUN npm prune --omit=dev

# ===========================================
# Stage 2: Runtime (base image with Claude CLI, gh, etc.)
# ===========================================
FROM tobiaswaggoner/coding-swarm-base:latest

# Build metadata (passed via --build-arg)
ARG BUILD_TIMESTAMP=unknown
ARG GIT_COMMIT=unknown
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV GIT_COMMIT=${GIT_COMMIT}

USER root
WORKDIR /app

# Copy only production artifacts from builder
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./package.json

# Copy entrypoint (small, changes rarely)
COPY services/green-agent/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Copy prompts (small, can be overridden via volume mount)
COPY prompts/green /prompts/green

# Ensure aiworker owns everything
RUN chown -R aiworker:aiworker /app /prompts

USER aiworker
WORKDIR /workspace

ENTRYPOINT ["/app/entrypoint.sh"]
