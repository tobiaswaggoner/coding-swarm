# =============================================================================
# Coding Swarm - Unified Agent Image
# =============================================================================
# Ein Image fuer alle Agent-Rollen (project-manager, developer, reviewer)
# Rolle wird zur Laufzeit via AGENT_ROLE Environment Variable bestimmt
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build TypeScript tools
# -----------------------------------------------------------------------------
FROM node:25-alpine AS builder

WORKDIR /build

# Install dependencies first (better layer caching)
COPY tools/package*.json ./
RUN npm ci

# Copy source and compile
COPY tools/tsconfig.json ./
COPY tools/src ./src
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Runtime image
# -----------------------------------------------------------------------------
FROM tobiaswaggoner/coding-swarm-base:latest

ARG BUILD_TIMESTAMP=unknown
ARG GIT_COMMIT=unknown

LABEL org.opencontainers.image.title="Coding Swarm Agent"
LABEL org.opencontainers.image.description="Unified agent for all roles (project-manager, developer, reviewer)"
LABEL org.opencontainers.image.version="${BUILD_TIMESTAMP}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"

# Install additional global tools as root
USER root
RUN npm install -g typescript tsx

# Copy compiled tools from builder
COPY --from=builder /build/dist /app/tools/dist
COPY --from=builder /build/node_modules /app/tools/node_modules
COPY --from=builder /build/package.json /app/tools/package.json

# Copy fallback templates (used when runtime repo is unavailable)
COPY templates /app/templates

# Copy entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Ensure proper ownership
RUN chown -R aiworker:aiworker /app

# Switch to non-root user
USER aiworker
WORKDIR /workspace

# Environment defaults
ENV AGENT_ROLE="developer"
ENV RUNTIME_REPO="https://github.com/tobiaswaggoner/coding-swarm-runtime"
ENV RUNTIME_BRANCH="main"
ENV RUNTIME_DIR="/tmp/runtime"
ENV OUTPUT_FORMAT="stream-json"

# Store build info
ENV BUILD_TIMESTAMP="${BUILD_TIMESTAMP}"
ENV GIT_COMMIT="${GIT_COMMIT}"

ENTRYPOINT ["/app/entrypoint.sh"]
