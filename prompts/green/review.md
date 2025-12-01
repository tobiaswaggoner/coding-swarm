## Aufgabe: Code-Review (Review-Task)

### Zu prüfender Branch
`{{BRANCH_TO_REVIEW}}`

### Erwartete Änderungen
{{STEP_DESCRIPTION}}

### Prüfkriterien
1. Funktionalität: Erfüllt der Code die Anforderungen?
2. Code-Qualität: Ist der Code sauber und wartbar?
3. Security: Gibt es Sicherheitsprobleme?
4. Performance: Gibt es offensichtliche Performance-Issues?
5. Build: Läuft `npm run build` erfolgreich?

### Ergebnis
Melde im Result:
- **decision**: "APPROVE", "REQUEST_CHANGES", oder "REJECT"
- **issues**: Liste der gefundenen Probleme (falls vorhanden)
- **summary**: Kurze Zusammenfassung des Reviews

Format:
{
  "decision": "APPROVE" | "REQUEST_CHANGES" | "REJECT",
  "issues": ["Issue 1", "Issue 2"],
  "summary": "..."
}
