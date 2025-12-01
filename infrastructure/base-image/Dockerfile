# Coding Swarm Base Image
# Enthält: Node.js 25, Python 3, .NET 9 SDK, Git, Claude Code CLI
# Basis: Debian 13 (Trixie) Full Image

FROM node:25-trixie

LABEL org.opencontainers.image.title="Coding Swarm Base"
LABEL org.opencontainers.image.description="Base image for autonomous coding agents with Node.js, Python, .NET and Claude Code"
LABEL org.opencontainers.image.source="https://github.com/tobiaswaggoner/coding-swarm"

# System-Dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    jq \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI (gh)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# .NET 9 SDK (Microsoft Repository)
RUN wget https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -O packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y dotnet-sdk-9.0 \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code \
    && npm cache clean --force

# Non-root User für Sicherheit (UID 1000 für K8s Kompatibilität)
# Node-Image hat bereits UID/GID 1000 (node:node), wir nutzen diese
RUN usermod -l aiworker -d /home/aiworker -m node \
    && groupmod -n aiworker node
RUN mkdir -p /home/aiworker/.claude /home/aiworker/.dotnet /home/aiworker/.nuget \
    && chown -R aiworker:aiworker /home/aiworker

# Standard-Arbeitsverzeichnis
WORKDIR /workspace
RUN chown aiworker:aiworker /workspace

USER aiworker
ENV HOME=/home/aiworker
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1

# Versionsinfo ausgeben beim Build
RUN echo "=== Installed Versions ===" \
    && node --version \
    && npm --version \
    && python3 --version \
    && dotnet --version \
    && gh --version \
    && claude --version || true
