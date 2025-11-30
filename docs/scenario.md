# Szenario: Snake Clone - Happy Path Simulation

## Epic-Beschreibung

> Erstelle einen webbasierten Snake Clone mit:
> - NextJS als Frontend
> - Supabase für Userverwaltung und Datenbank
> - Highscore-Liste
> - Perks (System soll sich diese selbst ausdenken)

**Ziel-Branch:** `feature/new-snake-game`
**Ausgangs-Repo:** Leer (nur README.md)

---

## Kritische Design-Regel: Red darf NIEMALS mergen

### Warum?

1. **Review-Möglichkeit:** Wir wollen Pull-Requests nutzen und Änderungen reviewen
2. **Ablehnung möglich:** Branches können verworfen und Tasks mit neuem Prompt wiederholt werden
3. **Merge-Konflikte:** Bei Parallelisierung können Konflikte dediziert in eigenem Kontext gelöst werden
4. **Kontrolle:** Green behält volle Steuerung über den Integrationsprozess

### Die Lösung: Merge als separater Task

```
┌─────────────────────────────────────────────────────────────────┐
│ WORKFLOW PRO SCHRITT                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Green erstellt Code-Task für Red                            │
│            ↓                                                    │
│  2. Red arbeitet auf feature/step-X-timestamp                   │
│     Red pusht Branch, MERGED NICHT, stirbt                      │
│            ↓                                                    │
│  3. Green wacht auf, analysiert Result                          │
│            ↓                                                    │
│     ┌─────────────────────────────────────────┐                 │
│     │ Entscheidung:                           │                 │
│     │ - OK → Merge-Task erstellen             │                 │
│     │ - Review nötig → Reviewer-Task erstellen│                 │
│     │ - Fehlgeschlagen → Retry oder Verwerfen │                 │
│     └─────────────────────────────────────────┘                 │
│            ↓                                                    │
│  4. Red (Merger) führt Merge aus                                │
│     Löst ggf. Konflikte, pusht, stirbt                          │
│            ↓                                                    │
│  5. Green wacht auf, sieht Merge OK                             │
│     Erstellt nächsten Code-Task                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task-Typen

| Typ | Beschreibung | Beispiel-Addressee |
|-----|--------------|-------------------|
| **Code-Task** | Implementierung, Feature-Arbeit | `worker-code-a1b2c3` |
| **Merge-Task** | Branch in Integration-Branch mergen | `worker-merge-d4e5f6` |
| **Review-Task** | Code-Review, Validierung | `worker-review-g7h8i9` |
| **Fix-Task** | Bugfixes, Korrekturen | `worker-fix-j0k1l2` |
| **PR-Task** | Pull Request erstellen | `worker-pr-m1n2o3` |
| **Validate-Task** | Build/Test-Validierung | `worker-validate-p4q5r6` |

---

## Simulation: Agent-Aktivierungen

### Iteration 0: Epic-Start

**Trigger:** User/Blue erstellt Epic

```
┌─────────────────────────────────────────────────────────────────┐
│ TASK ERSTELLT                                                   │
├─────────────────────────────────────────────────────────────────┤
│ addressee:    project-mgr-snake-game                            │
│ project_id:   snake-game                                        │
│ prompt:       "Erstelle einen webbasierten Snake Clone mit..."  │
│ repo_url:     https://github.com/user/snake-game                │
│ branch:       main                                              │
│ created_by:   blue-ui                                           │
└─────────────────────────────────────────────────────────────────┘
```

**Git-Stand:**
```
main
  └── README.md (leer oder minimal)
```

---

### Iteration 1: Green - Initial Planning

**Trigger:** Engine spawnt Green-Job

**Green's Aktionen:**
1. Clont Repo (nur README.md vorhanden)
2. Analysiert Epic-Prompt
3. Erstellt initialen Plan in `.ai/plan.md`
4. Erstellt ersten Red Code-Task
5. Committed Plan auf `main`, pusht
6. Stirbt

**Erstellter Plan (.ai/plan.md):**

```markdown
# Snake Clone - Projektplan

## Epic
Webbasierter Snake Clone mit NextJS, Supabase, Highscores, Perks

## Integration Branch
feature/new-snake-game

## Schritte

### Schritt 1: Projekt-Initialisierung
- Status: IN_PROGRESS
- Task-Type: CODE
- Beschreibung: NextJS Projekt erstellen, Supabase konfigurieren
- Branch: (wird bei Task-Erstellung gesetzt)

### Schritt 2: Basis-Spielmechanik
- Status: PENDING
- Beschreibung: Snake-Bewegung, Kollisionserkennung, Spielfeld

### Schritt 3: User-Authentifizierung
- Status: PENDING
- Beschreibung: Login/Register, Session-Handling

### Schritt 4: Highscore-System
- Status: PENDING
- Beschreibung: Scores speichern, Leaderboard anzeigen

### Schritt 5: Perk-System
- Status: PENDING
- Beschreibung: Perks konzipieren und implementieren

### Schritt 6: UI/UX Polish
- Status: PENDING
- Beschreibung: Styling, Responsive Design

### Schritt 7: Validierung
- Status: PENDING
- Beschreibung: Testing, Build-Check, Code-Review
```

**Erstellter Red Code-Task:**

```
┌─────────────────────────────────────────────────────────────────┐
│ CODE-TASK ERSTELLT                                              │
├─────────────────────────────────────────────────────────────────┤
│ addressee:    worker-code-a1b2c3d4                              │
│ project_id:   snake-game                                        │
│ prompt:       [siehe unten]                                     │
│ repo_url:     https://github.com/user/snake-game                │
│ branch:       main                                              │
│ created_by:   project-mgr-snake-game                            │
└─────────────────────────────────────────────────────────────────┘

PROMPT:
"""
## Aufgabe: Projekt-Initialisierung (Code-Task)

Du bist der erste Worker für dieses Projekt.

### Vorbereitung
1. Erstelle den Integration-Branch `feature/new-snake-game` von `main`
2. Erstelle deinen Arbeits-Branch `feature/step-1-init-{timestamp}` davon

### Implementierung
1. Initialisiere ein NextJS 14 Projekt mit TypeScript und Tailwind
2. Installiere und konfiguriere Supabase Client (@supabase/supabase-js)
3. Erstelle eine .env.example mit den benötigten Variablen
4. Erstelle eine Basis-Projektstruktur (lib/, components/, app/)
5. Stelle sicher, dass `npm run build` erfolgreich ist

### Abschluss
1. Committe alle Änderungen auf deinem Branch
2. Pushe deinen Branch `feature/step-1-init-{timestamp}`

WICHTIG:
- Merge NICHT nach feature/new-snake-game
- Erstelle KEINEN Pull Request
- Dein Branch bleibt separat für Review
"""
```

**Git-Stand nach Green:**
```
main
  └── README.md
  └── .ai/plan.md (NEU)
```

---

### Iteration 2: Red (Code) - Projekt-Initialisierung

**Trigger:** Engine spawnt Red-Job für worker-code-a1b2c3d4

**Red's Aktionen:**
1. Clont Repo
2. Erstellt `feature/new-snake-game` von `main`
3. Erstellt `feature/step-1-init-1701234567` davon
4. `npx create-next-app@latest . --typescript --tailwind --app`
5. `npm install @supabase/supabase-js`
6. Erstellt `.env.example`, `lib/supabase.ts`
7. Verifiziert: `npm run build` ✓
8. Committed auf `feature/step-1-init-1701234567`
9. Pusht **NUR** seinen Branch (KEIN Merge!)
10. Stirbt mit Result

**Task-Result:**
```json
{
  "success": true,
  "summary": "NextJS 14 Projekt initialisiert mit TypeScript und Supabase. Build erfolgreich. Branch: feature/step-1-init-1701234567",
  "branch": "feature/step-1-init-1701234567",
  "cost_usd": 0.12,
  "duration_ms": 45000
}
```

**Git-Stand nach Red:**
```
main
  └── README.md
  └── .ai/plan.md

feature/new-snake-game (leer, nur erstellt)
  └── README.md
  └── .ai/plan.md

feature/step-1-init-1701234567 (NEU - enthält die Arbeit!)
  └── README.md
  └── .ai/plan.md
  └── package.json
  └── next.config.js
  └── app/
  └── lib/supabase.ts
  └── .env.example
```

---

### Iteration 3: Green - Nach Code-Task Completion

**Trigger:** Engine erkennt Red-Completion, erstellt Green-Task

```
┌─────────────────────────────────────────────────────────────────┐
│ GREEN TASK (automatisch von Engine erstellt)                    │
├─────────────────────────────────────────────────────────────────┤
│ addressee:          project-mgr-snake-game                      │
│ triggered_by_task_id: <code-task-id>                            │
│ prompt:             MANAGER_WAKEUP: Task completed...           │
│                     Task-ID: ...                                │
│                     Status: ERFOLG                              │
│                     Branch: feature/step-1-init-1701234567      │
│                     Summary: "NextJS 14 Projekt initialisiert"  │
└─────────────────────────────────────────────────────────────────┘
```

**Green's Aktionen:**
1. Clont Repo
2. Analysiert Task-Result: Erfolg, Branch existiert
3. **Entscheidung:** Code sieht gut aus → Merge-Task erstellen
4. Updated Plan: Schritt 1 Status = MERGING
5. Erstellt Merge-Task für Red
6. Committed Plan, pusht
7. Stirbt

**Erstellter Merge-Task:**

```
┌─────────────────────────────────────────────────────────────────┐
│ MERGE-TASK ERSTELLT                                             │
├─────────────────────────────────────────────────────────────────┤
│ addressee:    worker-merge-e5f6g7h8                             │
│ project_id:   snake-game                                        │
│ prompt:       [siehe unten]                                     │
│ created_by:   project-mgr-snake-game                            │
└─────────────────────────────────────────────────────────────────┘

PROMPT:
"""
## Aufgabe: Branch Merge (Merge-Task)

### Auftrag
Merge den Branch `feature/step-1-init-1701234567` in `feature/new-snake-game`.

### Schritte
1. Checke `feature/new-snake-game` aus
2. Merge `feature/step-1-init-1701234567` hinein
3. Bei Konflikten: Löse sie sinnvoll auf
4. Stelle sicher, dass `npm run build` nach dem Merge erfolgreich ist
5. Pushe `feature/new-snake-game`

### Abschluss
Melde im Result:
- Ob der Merge erfolgreich war
- Ob es Konflikte gab und wie sie gelöst wurden
- Build-Status nach Merge

WICHTIG: Dies ist ein reiner Merge-Task. Keine neuen Features implementieren.
"""
```

---

### Iteration 4: Red (Merge) - Branch Integration

**Trigger:** Engine spawnt Red-Job für worker-merge-e5f6g7h8

**Red's Aktionen:**
1. Clont Repo
2. `git checkout feature/new-snake-game`
3. `git merge feature/step-1-init-1701234567`
4. Keine Konflikte (erster Merge)
5. `npm run build` ✓
6. Pusht `feature/new-snake-game`
7. Stirbt mit Result

**Task-Result:**
```json
{
  "success": true,
  "summary": "Merge erfolgreich. Keine Konflikte. Build OK.",
  "merged_branch": "feature/step-1-init-1701234567",
  "target_branch": "feature/new-snake-game",
  "conflicts": false,
  "cost_usd": 0.03,
  "duration_ms": 15000
}
```

**Git-Stand nach Merge-Red:**
```
feature/new-snake-game (JETZT MIT INHALT!)
  └── README.md
  └── .ai/plan.md
  └── package.json
  └── next.config.js
  └── app/
  └── lib/supabase.ts
  └── .env.example

feature/step-1-init-1701234567 (bleibt erhalten für Referenz)
  └── ... (gleicher Inhalt)
```

---

### Iteration 5: Green - Nach Merge-Task Completion

**Trigger:** Engine erkennt Merge-Red-Completion

**Green's Aktionen:**
1. Liest Task-Result: Merge erfolgreich, Build OK
2. Updated Plan: Schritt 1 = DONE ✓
3. Bestimmt nächsten Schritt: Schritt 2 (Basis-Spielmechanik)
4. Erstellt Code-Task für Schritt 2
5. Updated Plan: Schritt 2 = IN_PROGRESS
6. Committed, pusht
7. Stirbt

**Aktualisierter Plan:**
```markdown
### Schritt 1: Projekt-Initialisierung
- Status: DONE ✓
- Completed: 2024-01-15T10:45:00Z
- Branch: feature/step-1-init-1701234567
- Cost: $0.15 (Code: $0.12, Merge: $0.03)

### Schritt 2: Basis-Spielmechanik
- Status: IN_PROGRESS
- Task-Type: CODE
- Branch: feature/step-2-game-{timestamp}
```

**Erstellter Code-Task:**
```
PROMPT:
"""
## Aufgabe: Basis-Spielmechanik (Code-Task)

### Basis
Erstelle deinen Arbeits-Branch von `feature/new-snake-game`:
`feature/step-2-game-{timestamp}`

### Implementierung
Implementiere die Snake-Grundmechanik:

1. Canvas-basiertes Spielfeld (600x600px)
2. Snake als Array von Segmenten
3. Keyboard-Steuerung (WASD oder Pfeiltasten)
4. Bewegungslogik mit Game-Loop (requestAnimationFrame)
5. Kollisionserkennung (Wand, Selbst)
6. Food-Spawning und Einsammeln
7. Score-Zähler (lokal, noch ohne Supabase)
8. Game Over Screen mit Restart-Option

### Abschluss
1. Stelle sicher, dass `npm run build` erfolgreich ist
2. Committe und pushe deinen Branch

WICHTIG: Merge NICHT. Branch bleibt separat.
"""
```

---

### Iteration 6-7: Red (Code) + Green (Analyse)

Der Zyklus wiederholt sich:

```
Red (Code) arbeitet → Green analysiert → entscheidet → Red (Merge) merged → Green sieht Erfolg → nächster Schritt
```

---

### Iteration X: Fehlerfall - Review nötig

**Szenario:** Red liefert Code, aber Green ist unsicher

**Green's Entscheidung:** Reviewer-Task erstellen

```
┌─────────────────────────────────────────────────────────────────┐
│ REVIEW-TASK ERSTELLT                                            │
├─────────────────────────────────────────────────────────────────┤
│ addressee:    worker-review-x1y2z3                              │
│ project_id:   snake-game                                        │
│ prompt:       [siehe unten]                                     │
└─────────────────────────────────────────────────────────────────┘

PROMPT:
"""
## Aufgabe: Code-Review (Review-Task)

### Zu prüfender Branch
`feature/step-5-perks-1701234800`

### Prüfkriterien
1. Funktionalität: Funktionieren die Perks wie beschrieben?
2. Code-Qualität: Ist der Code sauber und wartbar?
3. Security: Gibt es Sicherheitsprobleme?
4. Performance: Gibt es offensichtliche Performance-Issues?
5. Build: Läuft `npm run build` erfolgreich?

### Ergebnis
Melde im Result:
- APPROVE: Code ist gut, kann gemerged werden
- REQUEST_CHANGES: Probleme gefunden (beschreibe sie)
- REJECT: Fundamentale Probleme, Branch verwerfen

### Format
{
  "decision": "APPROVE" | "REQUEST_CHANGES" | "REJECT",
  "issues": [...],
  "suggestions": [...]
}
"""
```

**Nach Review:**
- **APPROVE** → Green erstellt Merge-Task
- **REQUEST_CHANGES** → Green erstellt Fix-Task mit den Issues
- **REJECT** → Green verwirft Branch, erstellt neuen Code-Task mit angepasstem Prompt

---

### Iteration Y: Fehlerfall - Merge-Konflikt

**Szenario:** Bei Parallelisierung gibt es Konflikte

**Merge-Red's Result:**
```json
{
  "success": true,
  "summary": "Merge mit Konflikten. 2 Dateien manuell gelöst: app/game/page.tsx, lib/scoring.ts",
  "conflicts": true,
  "resolved_files": ["app/game/page.tsx", "lib/scoring.ts"],
  "resolution_notes": "Beide Versionen der Score-Berechnung kombiniert"
}
```

**Green reagiert:**
- Sieht Konflikte wurden gelöst
- Kann optional Validation-Task erstellen um sicherzustellen, dass alles funktioniert
- Oder direkt weitermachen

---

### Finale Iteration: Epic Complete + PR

**Green erkennt:** Alle Schritte DONE, letzter Merge erfolgreich

**Green's Aktionen:**
1. Updated Plan: Status = READY_FOR_PR
2. Erstellt **PR-Task für Red**
3. Stirbt

```
┌─────────────────────────────────────────────────────────────────┐
│ PR-TASK ERSTELLT                                                │
├─────────────────────────────────────────────────────────────────┤
│ addressee:    worker-pr-m1n2o3p4                                │
│ project_id:   snake-game                                        │
│ prompt:       [siehe unten]                                     │
│ created_by:   project-mgr-snake-game                            │
└─────────────────────────────────────────────────────────────────┘

PROMPT:
"""
## Aufgabe: Pull Request erstellen (PR-Task)

### Auftrag
Erstelle einen Pull Request von `feature/new-snake-game` nach `main`.

### Schritte
1. Checke `feature/new-snake-game` aus
2. Lies `.ai/plan.md` für die Zusammenfassung
3. Erstelle PR mit `gh pr create`:
   - Base: main
   - Head: feature/new-snake-game
   - Title: "Feature: Snake Clone mit Perks und Highscores"
   - Body: Generiere aus Plan (Schritte, Kosten, Features)

### Abschluss
Melde im Result:
- PR-URL
- PR-Nummer

WICHTIG: Nur PR erstellen, nichts mergen. User reviewed und approved.
"""
```

---

### Nach PR-Task: Red erstellt PR

**Red's Aktionen:**
1. Clont Repo, checkt `feature/new-snake-game` aus
2. Liest `.ai/plan.md`
3. `gh pr create --base main --head feature/new-snake-game --title "..." --body "..."`
4. Stirbt mit Result

**Task-Result:**
```json
{
  "success": true,
  "summary": "Pull Request #42 erstellt",
  "pr_url": "https://github.com/user/snake-game/pull/42",
  "pr_number": 42,
  "cost_usd": 0.02,
  "duration_ms": 8000
}
```

---

### Engine triggert Green nach PR-Erstellung

**Green's finale Aktionen:**
1. Sieht: PR erfolgreich erstellt
2. Updated Plan: Status = COMPLETED, PR-URL hinzugefügt
3. Markiert Projekt als `awaiting_review`
4. Stirbt

**CI/CD läuft automatisch:**
```
PR erstellt (#42)
    ↓
GitHub Actions / Vercel / etc. triggert
    ↓
Build + Tests laufen
    ↓
Preview-Deployment live
    ↓
User kann sofort testen (ohne weitere Aktion!)
```

**Git-Stand:**
```
main
  └── README.md
  └── .ai/plan.md (initial)

feature/new-snake-game (PR offen nach main)
  └── [Vollständiges Spiel]
  └── .ai/plan.md (completed)

feature/step-1-init-xxx (archiviert)
feature/step-2-game-xxx (archiviert)
...
```

---

## Nach PR: User-Review-Flow

### CI/CD Deployment

```
PR erstellt
    ↓
CI/CD Pipeline läuft
    ↓
Preview-Deployment (z.B. Vercel Preview)
    ↓
User kann live testen
```

### Änderungen anfordern

**User/Blue:** "Die Steuerung ist zu schnell, und die Perks brauchen bessere Icons"

```
┌─────────────────────────────────────────────────────────────────┐
│ NEUER TASK VON USER/BLUE                                        │
├─────────────────────────────────────────────────────────────────┤
│ addressee:    project-mgr-snake-game                            │
│ project_id:   snake-game                                        │
│ prompt:       "Änderungen am PR:                                │
│                1. Steuerung langsamer machen                    │
│                2. Bessere Icons für Perks"                      │
│ created_by:   blue-ui                                           │
└─────────────────────────────────────────────────────────────────┘
```

**Green wacht auf:**
1. Sieht: Projekt ist `awaiting_review`, PR offen
2. Analysiert Änderungswünsche
3. Erstellt Fix-Tasks auf `feature/new-snake-game`
4. Nach Fixes: Pusht, PR wird automatisch aktualisiert
5. Markiert Projekt wieder als `awaiting_review`

---

## Zusammenfassung: Vollständiger Task-Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ VOLLSTÄNDIGER HAPPY PATH                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. [Blue→Green]    Epic: Snake Clone erstellen                 │
│  2. [Green→Red]     CODE: Projekt-Initialisierung               │
│  3. [Engine→Green]  Wakeup (Code fertig)                        │
│  4. [Green→Red]     MERGE: step-1 → feature-branch              │
│  5. [Engine→Green]  Wakeup (Merge fertig)                       │
│  6. [Green→Red]     CODE: Basis-Spielmechanik                   │
│  7. [Engine→Green]  Wakeup                                      │
│  8. [Green→Red]     MERGE: step-2 → feature-branch              │
│  9. [Engine→Green]  Wakeup                                      │
│ 10. [Green→Red]     CODE: User-Auth                             │
│ 11. [Engine→Green]  Wakeup                                      │
│ 12. [Green→Red]     MERGE: step-3 → feature-branch              │
│ 13. [Engine→Green]  Wakeup                                      │
│ 14. [Green→Red]     CODE: Highscores                            │
│ 15. [Engine→Green]  Wakeup                                      │
│ 16. [Green→Red]     MERGE: step-4 → feature-branch              │
│ 17. [Engine→Green]  Wakeup                                      │
│ 18. [Green→Red]     CODE: Perk-System                           │
│ 19. [Engine→Green]  Wakeup                                      │
│ 20. [Green→Red]     REVIEW: Perk-Code prüfen                    │
│ 21. [Engine→Green]  Wakeup (Review: APPROVE)                    │
│ 22. [Green→Red]     MERGE: step-5 → feature-branch              │
│ 23. [Engine→Green]  Wakeup                                      │
│ 24. [Green→Red]     CODE: UI/UX Polish                          │
│ 25. [Engine→Green]  Wakeup                                      │
│ 26. [Green→Red]     MERGE: step-6 → feature-branch              │
│ 27. [Engine→Green]  Wakeup                                      │
│ 28. [Green→Red]     VALIDATE: Final Build + Test                │
│ 29. [Engine→Green]  Wakeup (Validation OK)                      │
│ 30. [Green→Red]     PR-TASK: Pull Request erstellen             │
│ 31. [Engine→Green]  Wakeup (PR #42 erstellt)                    │
│ 32. Green: Plan COMPLETED, Projekt → awaiting_review            │
│                                                                 │
│ --- CI/CD AUTOMATISCH ---                                       │
│                                                                 │
│ 33. GitHub Actions triggert Build + Tests                       │
│ 34. Preview-Deployment live (Vercel/Netlify/etc.)               │
│ 35. User kann sofort testen!                                    │
│                                                                 │
│ --- USER REVIEW PHASE ---                                       │
│                                                                 │
│ 36. [Blue→Green]    Änderungswünsche                            │
│ 37. [Green→Red]     FIX: Steuerung + Icons                      │
│ 38. [Engine→Green]  Wakeup                                      │
│ 39. [Green→Red]     MERGE: fix → feature-branch                 │
│ 40. PR automatisch aktualisiert (CI/CD läuft erneut)            │
│                                                                 │
│ 41. User approved PR → Merge nach main                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Total: ~41 Steps im Happy Path (mit User-Review-Runde)
       ~20 Green Aktivierungen
       ~20 Red Executions:
           - 7 CODE (Features implementieren)
           - 7 MERGE (Branches integrieren)
           - 2 VALIDATE (Build/Test prüfen)
           - 1 REVIEW (Code-Review)
           - 1 PR (Pull Request erstellen)
           - 2 FIX (Änderungen nach User-Feedback)
```

---

## Analyse: Design-Validierung

### ✅ Erfüllte Anforderungen

| Anforderung | Status | Umsetzung |
|-------------|--------|-----------|
| Green plant nur | ✅ | Nur Plan-Updates in `.ai/plan.md`, keine Code-Änderungen |
| Green darf Plan committen | ✅ | Einzige Ausnahme: `.ai/` Verzeichnis ist Green's Bereich |
| Red merged NIE | ✅ | Separater Merge-Task |
| Review möglich | ✅ | Review-Task vor Merge |
| Branch verwerfen | ✅ | Green kann REJECT → neuer Code-Task |
| Merge-Konflikte | ✅ | Merge-Red löst in eigenem Kontext |
| PR am Ende | ✅ | Green erstellt PR via Red-Task |
| User-Feedback | ✅ | Blue/User kann neue Tasks erstellen |
| CI/CD Integration | ✅ | PR triggert Preview-Deployment |

### Trade-offs

| Aspekt | Vorher (Red merged) | Jetzt (separater Merge) |
|--------|---------------------|-------------------------|
| Tasks pro Step | 2 (Code + Wakeup) | 4 (Code + Wakeup + Merge + Wakeup) |
| Kontrolle | Gering | Hoch |
| Review-Möglichkeit | Keine | Vollständig |
| Parallelisierung | Problematisch | Sauber (Merge-Red löst Konflikte) |
| Kosten | ~$0.15/Step | ~$0.20/Step (+$0.03-0.05 Merge) |

### Kein konzeptioneller Fehler gefunden

Das Design ist konsistent und robust:

1. ✅ **Klare Trennung:** Code-Arbeit vs. Integration sind getrennte Concerns
2. ✅ **Review-Gate:** Jeder Branch kann vor Merge geprüft werden
3. ✅ **Fehlertoleranz:** Branches können verworfen, Tasks wiederholt werden
4. ✅ **Parallelisierung-ready:** Merge-Konflikte werden isoliert gelöst
5. ✅ **Human-in-the-loop:** Finaler PR braucht menschliches Approval
6. ✅ **Iterativ:** Nach PR-Feedback kann weitergearbeitet werden

---

## Branch-Lifecycle Übersicht

```
                    main
                      │
                      ├── feature/new-snake-game (Integration)
                      │         │
                      │         ├── feature/step-1-init-xxx ──────┐
                      │         │                                 │ MERGE
                      │         │←────────────────────────────────┘
                      │         │
                      │         ├── feature/step-2-game-xxx ──────┐
                      │         │                                 │ MERGE
                      │         │←────────────────────────────────┘
                      │         │
                      │         ├── feature/step-3-auth-xxx ──────┐
                      │         │                                 │ MERGE
                      │         │←────────────────────────────────┘
                      │         │
                      │         └── ... weitere Steps ...
                      │
                      │←─────── PR (nach User-Approval)
                      │
                    main (mit Snake-Game)
```

---

## Geklärte Design-Entscheidungen

### Branch-Cleanup

**Entscheidung:** Step-Branches werden nach erfolgreichem Merge gelöscht.

Der MERGE-Task löscht den Step-Branch nach erfolgreichem Merge:
```bash
git push origin --delete feature/step-X-timestamp
```

### Plan-Location

**Entscheidung:** Plan liegt in `.ai/plan.md` auf dem Integration-Branch.

- Green darf `.ai/plan.md` direkt committen und pushen
- Das `.ai/` Verzeichnis enthält allen Projekt-Kontext:
  ```
  .ai/
  ├── plan.md      # Aktueller Plan
  ├── context.md   # (Später) Architektur, Guidelines
  └── spec.md      # (Später) Technische Spezifikation
  ```
- Plan muss existieren, bevor Red-Tasks gespawnt werden

### Cost-Limits

**Entscheidung:** Keine Cost-Limits aktuell (Claude Subscription/Flatrate).

### Parallelisierung

**Entscheidung:** Später, wird Green's Intelligenz überlassen.

Beispiel: Nach Contract-Definition können UI und Backend parallel entwickelt werden.
Aktuell: Strikt sequentiell.
