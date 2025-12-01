# Cockpit Design - Konzept & Anforderungen

## Übersicht

Das Cockpit ist das zentrale User Interface zur Kontrolle und Überwachung des Coding Swarm Systems. Es läuft auf Vercel und kommuniziert ausschließlich über Supabase mit dem Cluster.

**Wichtige Architektur-Entscheidung:** Der K8s-Cluster soll komplett hinter einer Firewall liegen und von außen nicht erreichbar sein. Supabase dient als einzige Kommunikationsschnittstelle zwischen Cockpit und Cluster. Ein internes Cluster-Monitoring schreibt Status-Informationen in die Datenbank.

---

## Authentifizierung

- **Framework:** NextAuth
- **Provider:** GitHub OAuth (primär)
- Login erforderlich für alle Cockpit-Funktionen

---

## Dashboard-Ansicht (Hauptseite)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo, Navigation, User-Menu                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Projekt-Kacheln (Hauptbereich, ~75% Höhe)                  │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Proj A  │  │ Proj B  │  │ Proj C  │  │ Proj D  │        │
│  │ 🟢 aktiv │  │ ⏸️ pause │  │ 💤 idle │  │ 🔴 error│        │
│  │ 2 Red   │  │ 0 Red   │  │ 0 Red   │  │ 1 Red   │        │
│  │ "Auth"  │  │ "—"     │  │ "—"     │  │ "DB fix"│        │
│  │ vor 2m  │  │ vor 1h  │  │ vor 3d  │  │ vor 5m  │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ System-Status Footer (~25% Höhe)                            │
│ Pods: 5/10 | Engine: ✅ | Supabase: ✅ | Cluster: healthy   │
└─────────────────────────────────────────────────────────────┘
```

### Projekt-Kacheln

Jede Kachel zeigt kompakt:

| Element | Beschreibung |
|---------|--------------|
| **Projektname** | Identifikation |
| **Status-Icon** | 🟢 aktiv, ⏸️ pausiert, 💤 idle, 🔴 Fehler |
| **Agent-Status** | Arbeitet Green? Wie viele Reds? |
| **Stichwort** | Was wird gerade getan (aus Task extrahiert) |
| **Letzte Aktivität** | Zeitstempel des letzten Tasks |

**Design-Prinzipien:**
- Viel Color-Coding
- Symbolsprache für schnelle Erfassung
- Kompakt für viele Projekte gleichzeitig

**Sortierung:**
- Alphabetisch
- Nach letzter Aktivität (Standard)

### System-Status (Footer)

Kompakte Darstellung im unteren Bereich:
- Anzahl laufender Pods
- Engine-Status (healthy/unhealthy)
- Supabase-Erreichbarkeit
- Allgemeiner Cluster-Health

**Hinweis:** Diese Daten kommen von einem internen Monitoring-Container im Cluster, der in Supabase schreibt.

---

## Projektansicht (Detail)

Wenn ein Projekt ausgewählt wird, wechselt die Ansicht zur Projektdetail-Seite.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: ← Zurück | Projektname | Status | Pause/Kill       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐  ┌───────────────────────────────┐│
│  │ Task-Historie       │  │ Kommunikation / Anweisungen   ││
│  │                     │  │                               ││
│  │ ✅ Task 1 - Merge   │  │ [Green] [Blue]                ││
│  │ ✅ Task 2 - Code    │  │                               ││
│  │ 🔄 Task 3 - Code    │  │ Kontext-Dateien:              ││
│  │ ⏳ Task 4 - Review  │  │ 📄 .ai/plan.md                ││
│  │                     │  │ 📄 .ai/epic.md                ││
│  │ [Task auswählen     │  │                               ││
│  │  für Details]       │  │ Neue Anweisung:               ││
│  │                     │  │ ┌─────────────────────────┐   ││
│  │                     │  │ │                         │   ││
│  │                     │  │ └─────────────────────────┘   ││
│  │                     │  │ [Senden]                      ││
│  └─────────────────────┘  └───────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Task-Historie (Linke Seite)

Sequentielle Liste aller Tasks:
- **Abgeschlossen** (✅)
- **In Arbeit** (🔄)
- **Geplant/Pending** (⏳)

Jeder Task zeigt:
- Status-Icon
- Kurzbeschreibung
- Typ (CODE, MERGE, REVIEW, etc.)
- Zeitstempel

### Task-Detail-Ansicht

Bei Klick auf einen Task:

1. **Summary** (LLM-generiert)
   - 1-3 Sätze, was in diesem Task passiert ist
   - Automatisch bei Log-Erstellung generiert
   - Spart das Durchlesen langer Logs

2. **Initial Prompt**
   - Der Auftrag, der an den Agent ging

3. **Log-Visualisierung**
   - JSONL-Parsing und Darstellung
   - Kategorien:
     - Konversation (Assistant-Messages)
     - Thinking Tokens (collapsible)
     - Tool Calls (mit Input/Output)
   - Sinnvoll strukturiert und navigierbar

### Kommunikation / Anweisungen (Rechte Seite)

**Agent-Auswahl:**
- Tab oder Toggle: Green | Blue
- Kommunikation ist immer projektbezogen

**Kontext-Dateien:**
- Anzeige der relevanten Markdown-Dateien
- `.ai/plan.md` - Aktueller Plan
- `.ai/epic.md` - Epic-Beschreibung
- Weitere Kontext-Dateien

**Anweisungs-Eingabe:**
- Textfeld für neue Anweisungen
- Anweisungen werden als Markdown-Dateien in Git geschrieben
- Bessere Trackbarkeit durch Git-Historie
- Reproduzierbarkeit

**Workflow-Vision:**
- Direkt mit Green: Konkrete Aufgaben anstoßen
- Mit Blue (später): Strategische Diskussionen
- Blue gibt dann Aufgaben an Green weiter

---

## Steuerung & Kontrolle

### Pause / Resume (Green Agent)

| Aktion | Effekt |
|--------|--------|
| **Pause** | Aktueller Red darf weiterlaufen, aber Green erstellt keine neuen Tasks |
| **Resume** | Green arbeitet normal weiter |

**Use Case:** Neuen Input einspeisen während der Arbeit, bevor der nächste Schritt beginnt.

### Kill Job (Notfall)

| Aktion | Effekt |
|--------|--------|
| **Kill Red** | Laufenden Red-Job terminieren |
| **Kill Green** | Laufenden Green-Job terminieren |

**Cleanup nach Kill:**
- Branch löschen (wurde extra für diesen Agent erstellt)
- Keine persistenten Artefakte dank Git-Architektur
- Task als `killed` markieren

**Use Cases:**
- Out of Tokens
- Falsche Richtung erkannt
- Endlosschleife

**Hinweis:** Soft-Break wäre optimal, ist aber schwierig, da Claude Code in einer Loop läuft, auf die wir keinen Zugriff haben. Daher: Hard-Kill des K8s Jobs.

---

## Kommunikation über Git (Wichtig!)

**Paradigmenwechsel:** Statt alles in den Task-Prompt zu packen, sollen Aufgaben in Markdown-Dateien geschrieben werden.

**Vorteile:**
- Git-Historie für Tracking
- Reproduzierbarkeit
- Lesbarkeit
- Konsistenz

**Implementierung:**
- Agent bekommt Pfad zu Markdown-Datei mit Aufgabe
- Cockpit schreibt Anweisungen als Markdown-Commits
- Alle Ebenen (Red, Green, Blue) nutzen dieses Pattern

**Beispiel-Struktur im Projekt-Repo:**
```
.ai/
├── plan.md           # Aktueller Plan (von Green gepflegt)
├── epic.md           # Epic-Beschreibung
├── context/          # Zusätzlicher Kontext
│   └── decisions.md
└── instructions/     # Anweisungen
    └── next-step.md
```

---

## Cluster-Monitoring (Backend)

Da das Cockpit auf Vercel läuft und der Cluster hinter einer Firewall ist, brauchen wir einen internen Monitoring-Service.

**Monitoring-Container (im Cluster):**
- Läuft als Deployment im K8s-Cluster
- Sammelt:
  - Pod-Status (laufend, pending, failed)
  - Engine-Health
  - Resource-Usage
- Schreibt periodisch in Supabase
- Cockpit liest nur aus Supabase

**Datenbank-Schema (neu):**
```sql
CREATE TABLE cluster_status (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_name    VARCHAR(255) NOT NULL,
    pods_running    INTEGER,
    pods_total      INTEGER,
    engine_healthy  BOOLEAN,
    last_heartbeat  TIMESTAMP DEFAULT NOW(),
    details         JSONB
);
```

---

## LLM-Summary Service

Automatische Zusammenfassung von Task-Logs.

**Trigger:** Bei Erstellung eines Task-Logs
**Input:** Vollständiges JSONL + Task-Kontext
**Output:** 1-3 Sätze Summary

**Implementierungs-Optionen:**
1. Eigener Watcher-Service (empfohlen)
2. Supabase Edge Function
3. Teil der Spawning Engine

**Speicherung:**
```sql
ALTER TABLE tasks ADD COLUMN summary TEXT;
```

---

## Phasen-Plan

### Phase 1: Basis-Dashboard
- [ ] NextAuth Setup (GitHub OAuth)
- [ ] Dashboard-Layout mit Projekt-Kacheln
- [ ] Supabase Realtime für Live-Updates
- [ ] System-Status Footer (aus DB lesen)

### Phase 2: Projektansicht
- [ ] Task-Historie Ansicht
- [ ] Task-Detail mit Log-Visualisierung
- [ ] JSONL-Parser und Renderer

### Phase 3: Steuerung
- [ ] Pause/Resume für Green
- [ ] Kill-Funktion für Jobs
- [ ] Cluster-Monitoring Container

### Phase 4: Kommunikation
- [ ] Anweisungs-Interface (Green)
- [ ] Markdown-basierte Kommunikation
- [ ] LLM-Summary Service

### Phase 5: Blue Integration
- [ ] Blue Agent Kommunikation
- [ ] Strategische Planung
- [ ] Agent-Routing (Green vs Blue)

---

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS |
| Auth | NextAuth (GitHub Provider) |
| Realtime | Supabase Realtime |
| Deployment | Vercel |
| Monitoring | Eigener K8s-Container |

**Wichtig:** Vor Implementierung muss der Tech-Stack recherchiert werden! Next.js, Tailwind und NextAuth entwickeln sich schnell weiter. Aktuelle Dokumentation und Best Practices prüfen, um veraltete Patterns zu vermeiden.
