## Aufgabe: Pull Request erstellen (PR-Task)

### Auftrag
Erstelle einen Pull Request von `{{SOURCE_BRANCH}}` nach `{{TARGET_BRANCH}}`.

### Schritte
1. Checke `{{SOURCE_BRANCH}}` aus
2. Lies `.ai/plan.md` für die Zusammenfassung
3. Erstelle PR mit `gh pr create`:
   - Base: {{TARGET_BRANCH}}
   - Head: {{SOURCE_BRANCH}}
   - Title: "{{PR_TITLE}}"
   - Body: Generiere aus Plan (Features, Schritte)

### Epic-Beschreibung
{{EPIC_DESCRIPTION}}

### Ergebnis melden
- PR-URL
- PR-Nummer

WICHTIG: Nur PR erstellen, nichts mergen. User reviewed und approved.
