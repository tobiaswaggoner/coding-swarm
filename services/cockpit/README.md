# Cockpit - Control & Monitoring UI

> **Status:** Geplant (noch nicht implementiert)

## Übersicht

Das Cockpit ist das zentrale Kontroll- und Steuerungsinterface für das Coding Swarm System. Es dient zur:

- **Diagnostik:** System-Status, laufende Jobs, Fehler
- **Monitoring:** Task-Historie, Logs, Performance-Metriken
- **Steuerung:** Epic-Einreichung, manuelle Eingriffe
- **Kommunikation:** Interface zum Blue Agent (später)
- **Review:** PR-Review und Genehmigungen

**Wichtig:** Das Cockpit ist **nicht** der Blue Layer. Der Blue Layer wird mittelfristig ein AI-Agent (Executive Assistant), der zwischen User und Green Layer vermittelt. Das Cockpit ist das User Interface zur Interaktion mit dem Gesamtsystem.

## Geplante Technologie

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **Realtime:** Supabase Realtime für Live-Updates
- **Auth:** NextAuth (GitHub Provider)
- **Deployment:** Vercel

**Hinweis:** Tech-Stack vor Implementierung recherchieren (aktuelle Docs, Best Practices).

## Geplante Features

### Phase 1: Diagnostik & Monitoring (MVP)
- [ ] GitHub OAuth Login
- [ ] System-Dashboard (Engine-Status, aktive Jobs)
- [ ] Task-Liste mit Status (pending, running, completed, failed)
- [ ] Task-Detail-Ansicht mit Logs
- [ ] Echtzeit-Updates via Supabase Realtime

### Phase 2: Steuerung
- [ ] Epic erstellen (schreibt in `projects` Tabelle)
- [ ] Task manuell erstellen/abbrechen
- [ ] PR-Review Interface
- [ ] Änderungswünsche kommunizieren

### Phase 3: Blue Agent Integration
- [ ] Chat-Interface zum Blue Agent
- [ ] Epic-Diskussion mit Blue vor Planung
- [ ] Feedback-Loop für Entscheidungen
- [ ] Cost Tracking (Token Usage)

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│ Cockpit (Next.js)                                           │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Dashboard   │  │ Task Logs   │  │ Epic Form / Chat    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                           │                                 │
│                    Supabase Client (Realtime)               │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Supabase    │
                    │  (PostgreSQL) │
                    └───────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
      ┌───────────┐  ┌───────────┐  ┌───────────┐
      │  Engine   │  │   Green   │  │   Blue    │
      │           │  │   Agent   │  │  (später) │
      └───────────┘  └───────────┘  └───────────┘
```

## Setup (sobald implementiert)

```bash
cd services/cockpit
npm install
npm run dev
```
