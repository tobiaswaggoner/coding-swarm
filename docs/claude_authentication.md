● Hier die Zusammenfassung aus der Dokumentation:

  Das Kernproblem

  Subscription-basierte Authentifizierung in headless/Container-Umgebungen ist aktuell schwierig, da der normale Login einen Browser
  erfordert. Es gibt aber Workarounds:

  Optionen für Container mit Subscription

  Option 1: Credentials-Verzeichnis mounten (empfohlen)

  # Erst auf deinem Host-System einloggen:
  claude /login   # Wähle deinen Claude.ai Account mit Pro/Max

  # Dann im Container das .claude-Verzeichnis mounten:
  docker run -v ~/.claude:/root/.claude your-image

  In docker-compose.yml:
  volumes:
    - ~/.claude:/root/.claude

  Option 2: OAuth-Token generieren

  # Auf dem Host:
  claude setup-token

  # Token aus ~/.claude/.credentials.json auslesen
  # Im Container als Env-Variable setzen:
  export CLAUDE_CODE_OAUTH_TOKEN="sk-..."

  Wichtig: Was du NICHT setzen darfst

  # NICHT setzen, wenn du Subscription nutzen willst:
  export ANTHROPIC_API_KEY="sk-..."   # ← Erzwingt API-Abrechnung!

  Claude Code priorisiert ANTHROPIC_API_KEY über Subscription-Auth. Wenn diese Variable gesetzt ist, zahlst du per Token.

  Headless-Aufruf

  # Einfacher Prompt:
  claude -p "Dein Task hier"

  # Mit JSON-Output für Automatisierung:
  claude --output-format json "Dein Task"

  Bekannte Einschränkung

  Es gibt keine offiziellen Service-Account-Tokens für Subscriptions. Das ist ein bekanntes Feature-Gap (siehe
  https://github.com/anthropics/claude-code/issues/1454). Die Credentials-Mount-Methode ist aktuell der praktikabelste Weg.

  Verifizierung

  Nach dem Setup prüfen:
  claude /status
  # Sollte "Subscription" anzeigen, nicht "API Key"
