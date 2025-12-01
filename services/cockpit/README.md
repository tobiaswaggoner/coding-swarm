# Blue UI - Executive Interface

> **Status:** Geplant (noch nicht implementiert)

## Übersicht

Das Blue UI ist die Benutzeroberfläche für Executives/Product Owner, um:

- Epics einzureichen
- Fortschritt zu verfolgen
- Pull Requests zu reviewen und zu genehmigen
- Änderungswünsche zu kommunizieren

## Geplante Technologie

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Auth:** GitHub OAuth
- **Deployment:** Vercel oder K8s

## Geplante Features

### MVP
- [ ] GitHub OAuth Login
- [ ] Epic erstellen (schreibt in `projects` Tabelle)
- [ ] Projekt-Status Dashboard
- [ ] PR-Review Interface

### Später
- [ ] Echtzeit-Updates via Supabase Realtime
- [ ] Task-Log Viewer
- [ ] Cost Tracking (Token Usage)
- [ ] Multi-Repo Support

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│ Blue UI (Next.js)                                           │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Epic Form   │  │ Dashboard   │  │ PR Review Interface │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                           │                                 │
│                    Supabase Client                          │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Supabase    │
                    │  (PostgreSQL) │
                    └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Spawning    │
                    │    Engine     │
                    └───────────────┘
```

## Setup (sobald implementiert)

```bash
cd services/blue-ui
npm install
npm run dev
```
