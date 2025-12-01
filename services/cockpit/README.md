# Cockpit - Control & Monitoring UI

> **Status:** Phase 1 implementiert

Das Cockpit ist das zentrale Kontroll- und Steuerungsinterface für das Coding Swarm System.

## Features

### Phase 1 (Implementiert)

- GitHub OAuth Login via NextAuth v5
- Dashboard mit Projekt-Kacheln
- System-Status Footer (Engine, Supabase, Pods)
- Responsive Design mit Tailwind CSS
- Server Components für optimale Performance

### Phase 2 (Geplant)

- Task-Historie Ansicht
- Task-Detail mit Log-Visualisierung
- JSONL-Parser und Renderer

### Phase 3 (Geplant)

- Pause/Resume für Green Agent
- Kill-Funktion für Jobs

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4
- **Auth:** NextAuth v5 (Auth.js) mit GitHub Provider
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel

## Setup

### 1. Umgebungsvariablen

Kopiere `.env.example` nach `.env.local` und fülle die Werte aus:

```bash
cp .env.example .env.local
```

Benötigte Variablen:

| Variable | Beschreibung |
|----------|--------------|
| `AUTH_SECRET` | Random secret für NextAuth (generieren mit `openssl rand -base64 32`) |
| `AUTH_GITHUB_ID` | GitHub OAuth App Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |

### 2. GitHub OAuth App erstellen

1. Gehe zu https://github.com/settings/developers
2. Klicke "New OAuth App"
3. Setze:
   - **Homepage URL:** `http://localhost:3000` (oder Vercel URL)
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Kopiere Client ID und Client Secret in `.env.local`

### 3. Lokale Entwicklung

```bash
npm install
npm run dev
```

Die App läuft dann auf http://localhost:3000

### 4. Vercel Deployment

1. Importiere das Repository in Vercel
2. Setze das Root Directory auf `services/cockpit`
3. Füge alle Umgebungsvariablen in den Project Settings hinzu
4. Aktualisiere die GitHub OAuth App URLs auf die Vercel Domain

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│ Cockpit (Next.js on Vercel)                                 │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Dashboard   │  │ Project     │  │ Login               │ │
│  │ (Server)    │  │ Detail      │  │ (GitHub OAuth)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                           │                                 │
│                    Supabase Client                          │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTPS
                            ▼
                    ┌───────────────┐
                    │   Supabase    │
                    │  (PostgreSQL) │
                    └───────────────┘
```

**Wichtig:** Der K8s-Cluster ist hinter einer Firewall. Das Cockpit kommuniziert **nur** über Supabase mit dem System.

## Verzeichnisstruktur

```
cockpit/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/auth/           # NextAuth API Routes
│   │   ├── login/              # Login Page
│   │   ├── projects/[id]/      # Project Detail Page
│   │   ├── layout.tsx          # Root Layout
│   │   └── page.tsx            # Dashboard
│   ├── components/             # React Components
│   │   ├── Header.tsx
│   │   ├── ProjectCard.tsx
│   │   └── SystemStatus.tsx
│   ├── lib/                    # Utilities
│   │   ├── database.types.ts   # TypeScript Types
│   │   └── supabase.ts         # Supabase Client
│   ├── auth.ts                 # NextAuth Configuration
│   └── middleware.ts           # Auth Middleware
├── .env.example                # Example Environment Variables
├── package.json
└── README.md
```
