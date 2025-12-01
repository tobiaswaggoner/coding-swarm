## Aufgabe: Fixes durchführen (Fix-Task)

### Branch
`{{BRANCH_TO_FIX}}`

### Zu behebende Probleme
{{ISSUES_LIST}}

### Schritte
1. Checke den Branch aus: `git checkout {{BRANCH_TO_FIX}}`
2. Behebe die oben genannten Probleme
3. Stelle sicher, dass `npm run build` erfolgreich ist
4. Committe und pushe die Änderungen

### Ergebnis melden
- Welche Issues wurden behoben
- Build-Status nach den Fixes

WICHTIG:
- Merge NICHT nach {{INTEGRATION_BRANCH}}
- Nur die genannten Issues beheben, keine weiteren Änderungen
