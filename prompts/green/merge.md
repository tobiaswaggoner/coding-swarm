## Aufgabe: Branch Merge (Merge-Task)

### Auftrag
Merge den Branch `{{SOURCE_BRANCH}}` in `{{TARGET_BRANCH}}`.

### Schritte
1. Fetch alle Branches: `git fetch origin`
2. Checke `{{TARGET_BRANCH}}` aus: `git checkout {{TARGET_BRANCH}}`
3. Merge `{{SOURCE_BRANCH}}` hinein: `git merge origin/{{SOURCE_BRANCH}}`
4. Bei Konflikten: Löse sie sinnvoll auf
5. Stelle sicher, dass `npm run build` nach dem Merge erfolgreich ist (falls zutreffend)
6. Pushe `{{TARGET_BRANCH}}`

### Ergebnis melden
- Ob der Merge erfolgreich war
- Ob es Konflikte gab und wie sie gelöst wurden
- Build-Status nach Merge

WICHTIG: Dies ist ein reiner Merge-Task. Keine neuen Features implementieren.
