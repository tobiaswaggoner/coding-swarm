# Prompts

Dieses Verzeichnis enthält alle Prompt-Templates für die Coding Swarm Agents.

## Struktur

```
prompts/
├── green/           # Green Agent (Project Manager) Prompts
│   ├── code.md              # CODE Task - Implementierung eines Schritts
│   ├── merge.md             # MERGE Task - Branch mergen
│   ├── review.md            # REVIEW Task - Code Review
│   ├── fix.md               # FIX Task - Issues beheben
│   ├── pr.md                # PR Task - Pull Request erstellen
│   ├── validate.md          # VALIDATE Task - Build/Test validieren
│   └── plan-generation.md   # Initial Plan Generation
└── README.md
```

## Platzhalter

Prompts verwenden das Format `{{VARIABLE_NAME}}` für Platzhalter. Diese werden zur Laufzeit durch die entsprechenden Werte ersetzt.

### Beispiel

```markdown
## Aufgabe: {{STEP_NAME}} (Code-Task)

### Branch
Erstelle deinen Branch von `{{INTEGRATION_BRANCH}}`:
`{{BRANCH_NAME}}`
```

## Verwendung in K8s

### Option 1: Im Image eingebaut (Default)

Die Prompts werden beim Docker Build ins Image kopiert nach `/prompts/green/`.

### Option 2: ConfigMap Mount (Empfohlen für Produktion)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: green-agent-prompts
  namespace: coding-swarm
data:
  code.md: |
    ## Aufgabe: {{STEP_NAME}} (Code-Task)
    ...
  merge.md: |
    ...
---
apiVersion: batch/v1
kind: Job
metadata:
  name: green-agent
spec:
  template:
    spec:
      containers:
        - name: green-agent
          env:
            - name: PROMPTS_DIR
              value: /custom-prompts
          volumeMounts:
            - name: prompts
              mountPath: /custom-prompts
      volumes:
        - name: prompts
          configMap:
            name: green-agent-prompts
```

### Option 3: PersistentVolume (für dynamische Updates)

Für Szenarien wo Prompts zur Laufzeit geändert werden sollen ohne Pod-Restart.

## Prompt-Variablen Referenz

### code.md
| Variable | Beschreibung |
|----------|--------------|
| `STEP_NAME` | Name des aktuellen Schritts |
| `INTEGRATION_BRANCH` | Ziel-Branch für späteres Mergen |
| `BRANCH_NAME` | Generierter Feature-Branch Name |
| `PROJECT_CONTEXT` | Epic/Projekt Beschreibung |
| `STEP_DESCRIPTION` | Detaillierte Schritt-Beschreibung |

### merge.md
| Variable | Beschreibung |
|----------|--------------|
| `SOURCE_BRANCH` | Branch der gemerged werden soll |
| `TARGET_BRANCH` | Ziel-Branch |

### review.md
| Variable | Beschreibung |
|----------|--------------|
| `BRANCH_TO_REVIEW` | Zu prüfender Branch |
| `STEP_DESCRIPTION` | Erwartete Änderungen |

### fix.md
| Variable | Beschreibung |
|----------|--------------|
| `BRANCH_TO_FIX` | Branch mit den Problemen |
| `ISSUES_LIST` | Liste der zu behebenden Issues |
| `INTEGRATION_BRANCH` | Für Merge-Warnung |

### pr.md
| Variable | Beschreibung |
|----------|--------------|
| `SOURCE_BRANCH` | PR Head Branch |
| `TARGET_BRANCH` | PR Base Branch |
| `PR_TITLE` | Titel für den PR |
| `EPIC_DESCRIPTION` | Beschreibung für PR Body |

### validate.md
| Variable | Beschreibung |
|----------|--------------|
| `BRANCH` | Zu validierender Branch |

### plan-generation.md
| Variable | Beschreibung |
|----------|--------------|
| `EPIC_PROMPT` | Epic-Beschreibung vom User |

## Lokale Entwicklung

Bei lokaler Entwicklung sucht der Prompt-Loader in dieser Reihenfolge:

1. `PROMPTS_DIR` Environment Variable
2. `/prompts/green` (Container-Pfad)
3. Relativ zum Source-Code (Development)

## Tipps

- Halte Prompts fokussiert und klar strukturiert
- Verwende Markdown-Formatierung für bessere Lesbarkeit
- Teste Prompt-Änderungen lokal bevor du sie deployst
- Bei wichtigen Änderungen: Neue Version taggen für Rollback-Möglichkeit
