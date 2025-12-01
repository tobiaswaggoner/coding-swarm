# .ai/ - AI Project Management

Dieses Verzeichnis enthaelt die Projektverwaltung fuer den Coding Swarm.

## Struktur

```
.ai/
├── epic/              # Aktuelles Epic
│   └── epic.md        # Epic-Beschreibung und Status
├── stories/           # User Stories
│   ├── active/        # In Bearbeitung (max. 1)
│   ├── backlog/       # Warteschlange
│   └── done/          # Abgeschlossen
├── context/           # Projekt-Kontext
│   ├── architecture.md
│   ├── conventions.md
│   └── tech-stack.md
└── reviews/           # Review-Ergebnisse
```

## Konventionen

### IDs
- Epic-IDs: E001, E002, E003, ...
- Story-IDs: S001, S002, S003, ...
- Vollstaendige ID: E001-S001, E001-S002, ...

### Branches
- Epic-Branch: `feature/E{NNN}-{kurzer-name}`
- Story-Branch: `story/E{NNN}-S{NNN}-{kurzer-name}`

Beispiele:
- `feature/E001-snake-game`
- `story/E001-S001-initialize-project`
- `story/E001-S002-implement-game-loop`

## Story-Phasen

| Phase | Bedeutung | Verzeichnis |
|-------|-----------|-------------|
| BACKLOG | Noch nicht begonnen | stories/backlog/ |
| ACTIVE | In Bearbeitung | stories/active/ |
| IMPLEMENTED | Code fertig, wartet auf Review | stories/active/ |
| IN_REVIEW | Wird reviewed | stories/active/ |
| DONE | Abgeschlossen und gemerged | stories/done/ |

## Workflow

1. Project Manager erstellt Epic in `epic/epic.md`
2. Stories werden in `stories/backlog/` angelegt
3. Naechste Story wird nach `stories/active/` verschoben
4. Developer implementiert Story
5. Nach Completion wird Story nach `stories/done/` verschoben
6. Repeat bis Epic abgeschlossen
