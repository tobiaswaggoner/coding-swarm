# Red Agent Spike - basiert auf Coding Swarm Base Image
FROM tobiaswaggoner/coding-swarm-base:latest

# Build metadata (passed via --build-arg)
ARG BUILD_TIMESTAMP=unknown
ARG GIT_COMMIT=unknown
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV GIT_COMMIT=${GIT_COMMIT}

# Nur noch das Entrypoint-Skript hinzufügen
USER root
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
USER aiworker

WORKDIR /workspace
ENTRYPOINT ["/app/entrypoint.sh"]
