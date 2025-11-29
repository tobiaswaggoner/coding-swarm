# Red Agent Spike - basiert auf Coding Swarm Base Image
FROM tobiaswaggoner/coding-swarm-base:latest

# Nur noch das Entrypoint-Skript hinzufügen
USER root
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
USER aiworker

WORKDIR /workspace
ENTRYPOINT ["/app/entrypoint.sh"]
