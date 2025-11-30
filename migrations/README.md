# Datenbank-Migrationen

Manuelle SQL-Migrationen für das Autonomous Coding Swarm Schema.

## Übersicht

| Datei | Beschreibung |
|-------|--------------|
| `001_initial_schema.sql` | Basis-Schema: `schema_migrations`, `tasks`, `task_logs` |

## Ausführung via Supabase Dashboard

1. Öffne das [Supabase Dashboard](https://supabase.com/dashboard)
2. Wähle dein Projekt
3. Gehe zu **SQL Editor**
4. Kopiere den Inhalt der `.sql` Datei
5. Klicke **Run**

## Ausführung via psql (Direct Connection)

```bash
# Connection String aus Supabase Dashboard -> Settings -> Database
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Schema anwenden
psql "$DATABASE_URL" -f migrations/001_initial_schema.sql
```

## Verifizierung

Nach der Migration sollten diese Tabellen existieren:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('schema_migrations', 'tasks', 'task_logs');
```

## Migrations-Status prüfen

```sql
SELECT * FROM schema_migrations ORDER BY applied_at;
```

## Rollback

```sql
-- ACHTUNG: Löscht alle Daten!
DROP TABLE IF EXISTS task_logs CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;
```

## Konventionen

- Dateinamen: `NNN_beschreibung.sql` (NNN = fortlaufende Nummer)
- Immer `IF NOT EXISTS` / `IF EXISTS` für Idempotenz
- Am Ende jeder Migration: `INSERT INTO schema_migrations ... ON CONFLICT DO NOTHING`
- Timestamps immer mit `WITH TIME ZONE`
- UUIDs als Primary Keys (`gen_random_uuid()`)
