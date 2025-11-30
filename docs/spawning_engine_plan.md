# Spawning Engine - Implementierungsplan

## Überblick

Singleton-Container, der Tasks pollt und K8s Jobs spawnt.

```
┌─────────────────────────────────────────────────────────────┐
│                    SPAWNING ENGINE                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  Poll    │───▶│  Spawn   │───▶│  Monitor │              │
│  │  Loop    │    │  Jobs    │    │  & Reap  │              │
│  └──────────┘    └──────────┘    └──────────┘              │
└─────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
    ┌─────────┐     ┌─────────┐     ┌─────────┐
    │Supabase │     │ K8s API │     │ K8s API │
    │  tasks  │     │  Jobs   │     │  Logs   │
    └─────────┘     └─────────┘     └─────────┘
```

## Komponenten

### 1. Verzeichnisstruktur

```
spawning-engine/
├── Dockerfile
├── package.json
├── tsconfig.json
├── .gitignore
├── src/
│   ├── index.ts              # Entry point, main loop
│   ├── config.ts             # Environment variables, defaults
│   ├── logger.ts             # Structured logging
│   ├── db/
│   │   └── supabase.ts       # Supabase client, task queries
│   ├── k8s/
│   │   ├── client.ts         # K8s client setup (in-cluster)
│   │   ├── jobs.ts           # Job CRUD operations
│   │   └── logs.ts           # Log extraction + JSONL parsing
│   └── engine/
│       ├── spawner.ts        # Job spawning logic
│       ├── reaper.ts         # Timeout/completion handling
│       └── lock.ts           # File-based singleton lock
└── k8s/
    ├── deployment.yaml       # Singleton deployment (replicas: 1)
    └── rbac.yaml             # ServiceAccount + Role + RoleBinding
```

### 2. Konfiguration (Environment Variables)

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `SUPABASE_URL` | required | Supabase REST API URL |
| `SUPABASE_KEY` | required | Supabase anon/service_role key |
| `POLL_INTERVAL_MS` | 5000 | Polling-Intervall in ms |
| `JOB_TIMEOUT_MINUTES` | 30 | Max. Laufzeit pro Job |
| `JOB_NAMESPACE` | coding-swarm | K8s Namespace für Jobs |
| `JOB_IMAGE` | tobiaswaggoner/coding-swarm-agent:latest | Agent Image |
| `MAX_PARALLEL_JOBS` | 10 | Max. gleichzeitige Jobs (Backpressure) |
| `LOG_LEVEL` | info | debug, info, warn, error |

### 3. Singleton-Garantie

**Strategie: K8s Deployment mit replicas=1 + Lease**

```yaml
# deployment.yaml
spec:
  replicas: 1
  strategy:
    type: Recreate  # Kein Rolling Update, verhindert Überlappung
```

Optional für extra Sicherheit: K8s Lease-basiertes Leader Election (später).

## Algorithmus

### Main Loop (Pseudocode)

```typescript
while (true) {
  // 1. Timeout-Check für laufende Jobs
  const runningTasks = await db.getRunningTasks();
  for (const task of runningTasks) {
    if (isTimedOut(task)) {
      await k8s.deleteJob(task.worker_pod);
      await db.failTask(task.id, "Timeout exceeded");
    } else {
      const jobStatus = await k8s.getJobStatus(task.worker_pod);
      if (jobStatus.completed) {
        const logs = await k8s.getLogs(task.worker_pod);
        const result = parseJsonlResult(logs);
        await db.completeTask(task.id, result);
        await db.saveTaskLogs(task.id, logs);
      } else if (jobStatus.failed) {
        const logs = await k8s.getLogs(task.worker_pod);
        await db.failTask(task.id, { success: false, summary: "Job failed" });
        await db.saveTaskLogs(task.id, logs);
      }
    }
  }

  // 2. Neue Jobs spawnen
  const pendingTasks = await db.getPendingTasksPerAddressee();
  for (const task of pendingTasks) {
    const hasRunning = await db.hasRunningTask(task.addressee);
    if (!hasRunning) {
      const podName = generatePodName(task.id);
      await db.claimTask(task.id, podName);
      await k8s.createJob(task, podName);
    }
  }

  await sleep(POLL_INTERVAL_MS);
}
```

### Job Spawning Details

```typescript
// K8s Job Spec (dynamisch generiert)
{
  apiVersion: "batch/v1",
  kind: "Job",
  metadata: {
    name: `red-agent-${taskId.slice(0,8)}`,
    namespace: JOB_NAMESPACE,
    labels: {
      "app": "coding-swarm-agent",
      "task-id": taskId,
      "addressee": task.addressee
    }
  },
  spec: {
    ttlSecondsAfterFinished: 300,
    backoffLimit: 0,
    template: {
      spec: {
        restartPolicy: "Never",
        containers: [{
          name: "agent",
          image: JOB_IMAGE,
          env: [
            { name: "TASK_PROMPT", value: task.prompt },
            { name: "REPO_URL", value: task.repo_url },
            { name: "BRANCH", value: task.branch },
            // Secrets via secretKeyRef
          ],
          envFrom: [{
            secretRef: { name: "coding-swarm-secrets" }
          }]
        }]
      }
    }
  }
}
```

## Datenbank-Queries

```typescript
// getPendingTasksPerAddressee()
// Holt pro Addressee den ältesten pending Task
SELECT DISTINCT ON (addressee) *
FROM tasks
WHERE status = 'pending'
ORDER BY addressee, created_at ASC;

// hasRunningTask(addressee)
SELECT EXISTS(
  SELECT 1 FROM tasks
  WHERE addressee = $1 AND status = 'running'
);

// claimTask(id, podName)
UPDATE tasks
SET status = 'running', started_at = NOW(), worker_pod = $2
WHERE id = $1 AND status = 'pending'
RETURNING *;

// getRunningTasks()
SELECT * FROM tasks WHERE status = 'running';

// completeTask(id, result)
UPDATE tasks
SET status = 'completed', completed_at = NOW(), result = $2
WHERE id = $1;

// failTask(id, result)
UPDATE tasks
SET status = 'failed', completed_at = NOW(), result = $2
WHERE id = $1;
```

## K8s RBAC

```yaml
# ServiceAccount für Spawning Engine
apiVersion: v1
kind: ServiceAccount
metadata:
  name: spawning-engine
  namespace: coding-swarm

---
# Role mit Job-Permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: job-manager
  namespace: coding-swarm
rules:
- apiGroups: ["batch"]
  resources: ["jobs"]
  verbs: ["create", "get", "list", "watch", "delete"]
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]

---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: spawning-engine-job-manager
  namespace: coding-swarm
subjects:
- kind: ServiceAccount
  name: spawning-engine
roleRef:
  kind: Role
  name: job-manager
  apiGroup: rbac.authorization.k8s.io
```

## Dependencies (package.json)

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "@kubernetes/client-node": "^0.21.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "tsx": "^4.x"
  }
}
```

## Implementierungs-Reihenfolge

### Phase 1: Grundgerüst ✅
1. [x] Projekt-Setup (package.json, tsconfig.json, Dockerfile)
2. [x] Config-Modul mit Environment Variables
3. [x] Supabase Client + Basis-Queries
4. [x] Main Loop Skeleton (nur Logging)

### Phase 2: K8s Integration ✅
5. [x] K8s Client Setup (in-cluster config)
6. [x] RBAC Manifeste (ServiceAccount, Role, RoleBinding)
7. [x] Job Creation Logic
8. [x] Job Status Abfrage

### Phase 3: Reaping ✅
9. [x] Job Completion Detection
10. [x] Log Extraction aus Pods
11. [x] JSONL Parsing für Result
12. [x] Task Update (completed/failed)

### Phase 4: Timeout & Robustheit ✅
13. [x] Timeout-Check Implementation
14. [x] Job Deletion bei Timeout
15. [x] Graceful Shutdown (SIGTERM handling)
16. [x] Error Recovery (DB reconnect, K8s API errors)

### Phase 5: Deployment ✅
17. [x] Dockerfile für Spawning Engine
18. [x] K8s Deployment Manifest
19. [x] Secret-Erweiterung (SUPABASE_URL, SUPABASE_KEY)
20. [x] End-to-End Test (lokal getestet)

## Verifikation

### Unit Tests (optional, später)
- Config parsing
- JSONL result parsing
- Timeout calculation

### Integration Tests
```bash
# 1. Manuell Task einfügen
INSERT INTO tasks (addressee, prompt, repo_url)
VALUES ('worker-test', 'echo "Hello World"', 'https://github.com/test/repo');

# 2. Spawning Engine Logs beobachten
kubectl logs -f deployment/spawning-engine -n coding-swarm

# 3. Job-Erstellung verifizieren
kubectl get jobs -n coding-swarm -w

# 4. Task-Status in DB prüfen
SELECT id, status, worker_pod, result FROM tasks;
```

### Checkliste End-to-End ✅
- [x] Task pending → Job wird erstellt
- [x] Job running → Task status = 'running'
- [x] Job completed → Logs extrahiert, Task status = 'completed'
- [x] Job failed → Task status = 'failed'
- [x] Timeout → Job gelöscht, Task status = 'failed'
- [x] Gleicher Addressee → Sequentielle Ausführung
- [x] Verschiedene Addressees → Parallele Ausführung

## Offene Fragen (für spätere Iterationen)

1. **Leader Election**: ~~Brauchen wir K8s Lease?~~ → File-Lock implementiert, K8s Lease optional
2. **Secrets Rotation**: Wie werden SUPABASE_KEY und andere Secrets aktualisiert?
3. **Metriken**: Prometheus-Export für Monitoring?
4. ~~**Backpressure**: Max. gleichzeitige Jobs limitieren?~~ → ✅ Implementiert via `MAX_PARALLEL_JOBS`
