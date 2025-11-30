# Autonomous Coding Swarm

KI-gestütztes Entwicklungssystem für parallele, asynchrone Task-Ausführung über ephemere Kubernetes-Jobs. Das System nutzt Claude Code CLI im Headless-Modus zur autonomen Ausführung von Coding-Aufgaben.

## Architektur

```
Blue Layer (UI)         ──┐
                          ├──→ legen Tasks an ──→ PostgreSQL
Green Layer (Planner)   ──┘                            ↓
                                              Spawning Engine
                                             (pollt DB, spawnt)
                                                    ↓
                                            K8s Jobs (Green/Red)
```

- **Blue Layer:** Executive UI – extern getriggert (User Input, Events)
- **Green Layer:** Project Manager – plant iterativ, legt Red-Tasks an
- **Red Layer:** Worker Agent – clont Repo, führt Claude aus, pusht
- **Spawning Engine:** Einziger persistenter Prozess, spawnt alle Agents

## Quickstart

```bash
# Base Image bauen
docker build -t tobiaswaggoner/coding-swarm-base:latest base-image/

# Agent Image bauen
docker build -t tobiaswaggoner/coding-swarm-agent:latest spike-01-container/

# Spawning Engine lokal starten
cd spawning-engine
SUPABASE_URL="https://xxx.supabase.co" SUPABASE_KEY="eyJ..." npx tsx src/index.ts
```

## Projektstruktur

| Verzeichnis | Beschreibung |
|-------------|--------------|
| `base-image/` | Docker-Base-Image (Node, Python, .NET, Claude CLI) |
| `spike-01-container/` | Red Agent (Worker) Implementierung |
| `spawning-engine/` | Spawning Engine (TypeScript) |
| `scripts/` | Hilfs-Skripte |
| `docs/` | Architektur-Dokumentation |

## Dokumentation

Detaillierte Anweisungen, Befehle und Architektur-Entscheidungen: **[CLAUDE.md](./CLAUDE.md)**

## Lizenz

MIT – siehe [LICENSE](./LICENSE)
