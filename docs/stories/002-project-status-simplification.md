# User Story 002: Projekt-Status vereinfachen

## Übersicht

Das Projekt-Status-Management ist zu komplex und enthält Zustände, die keinen praktischen Nutzen haben. Die Logik soll vereinfacht und an die richtige Stelle (Spawning Engine) verlagert werden.

## Problem

### Aktueller Status-Enum
```typescript
type ProjectStatus =
  | "active"
  | "paused"
  | "awaiting_review"
  | "completed"
  | "failed";
```

### Probleme damit

| Status | Problem |
|--------|---------|
| `completed` | Macht keinen Sinn - Projekte sind nie "fertig", es gibt immer Follow-ups |
| `failed` | Macht keinen Sinn - Ein Task kann fehlschlagen, nicht das ganze Projekt |
| `awaiting_review` | Redundant - Wenn ein PR offen ist, wartet das System automatisch |

### Korrekte Logik

- **Kein offener Task** → Reaper triggert Green Agent für Follow-up
- **Task wartet auf User** → System ist implizit "pending" (kein expliziter Status nötig)
- **Pause** → User will aktiv verhindern, dass Tasks verarbeitet werden

Die Pause-Logik gehört in die **Task Spawning Engine**, nicht in die Agent-Logik.

## Neues Status-Modell

```typescript
type ProjectStatus = "active" | "paused";
```

| Status | Bedeutung | Wer setzt es |
|--------|-----------|--------------|
| `active` | Projekt wird normal bearbeitet | User (oder Default) |
| `paused` | Tasks werden nicht gespawnt | User explizit |

## Akzeptanzkriterien

- [ ] `ProjectStatus` Enum auf `active` | `paused` reduziert
- [ ] Migration: Alte Status-Werte auf `active` mappen
- [ ] Cockpit UI: Nur noch Active/Paused Toggle
- [ ] Spawning Engine: Prüft `paused` Status vor Task-Spawn
- [ ] Green Agent: Keine Status-Änderungen mehr (außer Plan-Updates)
- [ ] Dashboard: Status-Badge zeigt nur Active/Paused
- [ ] Projektansicht: Entfernen von "Awaiting Review", "Completed", "Failed" Badges

## Technische Details

### Betroffene Komponenten

```
services/cockpit/src/
├── lib/database.types.ts              # ProjectStatus Type
├── components/ProjectCard.tsx         # Status-Badge
├── app/admin/projects/[id]/edit/      # Status-Dropdown
└── app/projects/[id]/page.tsx         # Status-Anzeige

services/spawning-engine/src/
├── engine/spawner.ts                  # Pause-Check vor Spawn
└── db/supabase.ts                     # Query anpassen

services/green-agent/src/
├── decisions/engine.ts                # Status-Updates entfernen
└── db/supabase.ts                     # updateProjectStatus entfernen

infrastructure/migrations/
└── 007_simplify_project_status.sql    # Migration
```

### Migration SQL

```sql
-- Migration: 007_simplify_project_status.sql

-- Alle nicht-paused Status auf 'active' setzen
UPDATE projects
SET status = 'active'
WHERE status NOT IN ('active', 'paused');

-- Constraint aktualisieren (falls vorhanden)
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('active', 'paused'));
```

### Spawning Engine Änderung

```typescript
// engine/spawner.ts
async function shouldSpawnTask(task: Task): Promise<boolean> {
  const project = await getProject(task.project_id);

  // Projekt pausiert → keine Tasks spawnen
  if (project.status === 'paused') {
    logger.info(`Skipping task ${task.id} - project ${project.id} is paused`);
    return false;
  }

  return true;
}
```

## Abhängigkeiten

- Keine (kann unabhängig implementiert werden)

## Aufwand

Geschätzt: Klein (2-3 Stunden)

## Priorität

Mittel - Vereinfacht das mentale Modell, aber blockiert nichts
