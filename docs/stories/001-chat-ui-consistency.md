# User Story 001: Chat-Interface UI-Konsistenz

## Übersicht

Das Chat-Interface (`/projects/[id]/chat`) weicht vom Standard-Layout der Cockpit-Anwendung ab und muss konsistent gemacht werden.

## Problem

Aktuell hat die Chat-Seite:
- Einen eigenen minimalen Header (nur Back-Button + Titel)
- Keinen Theme-Toggle
- Keinen User-Avatar / Logout
- Keinen SystemStatus-Footer
- Volle Breite statt max-w-7xl Container

Alle anderen Seiten nutzen:
- `Header.tsx` mit Navigation, Theme-Toggle, User-Menu
- `SystemStatus.tsx` Footer mit Engine-Health, Pod-Count, Supabase-Status
- Konsistentes Padding und max-width

## Akzeptanzkriterien

- [ ] Chat-Seite verwendet globalen `Header.tsx` Component
- [ ] Theme-Toggle ist verfügbar auf Chat-Seite
- [ ] User-Avatar und Logout sind erreichbar
- [ ] SystemStatus-Footer wird angezeigt
- [ ] Layout passt sich in das bestehende Design ein
- [ ] Conversation-Sidebar bleibt funktional
- [ ] Mobile: Alternative Navigation für Conversations (z.B. Slide-over oder Modal)

## Technische Details

### Betroffene Dateien

```
services/cockpit/src/
├── app/projects/[id]/chat/page.tsx    # Layout anpassen
├── components/chat/ChatLayout.tsx      # Header/Footer integrieren
└── components/Header.tsx               # Evtl. anpassen für Chat-Kontext
```

### Vorgeschlagene Änderungen

1. **ChatLayout.tsx** - Standard Header/Footer einbinden:
```tsx
// Statt eigenem Header:
<Header />
<main className="flex-1 flex max-w-7xl mx-auto w-full">
  <ConversationSidebar />
  <ChatArea />
</main>
<SystemStatus />
```

2. **Mobile Navigation** - Conversation-Liste zugänglich machen:
   - Sheet/Drawer für Conversation-Liste
   - Hamburger-Menu oder Tab-Navigation

## Abhängigkeiten

- Keine

## Aufwand

Geschätzt: Klein (1-2 Stunden)

## Priorität

Hoch - UI-Inkonsistenz ist sofort sichtbar für User
