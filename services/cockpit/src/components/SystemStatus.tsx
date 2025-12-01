interface SystemStatusProps {
  runningPods: number;
  totalPods: number;
  engineHealthy: boolean;
  engineLastHeartbeat: string | null;
  supabaseHealthy: boolean;
}

function getHeartbeatStatus(lastHeartbeat: string | null): {
  healthy: boolean;
  label: string;
} {
  if (!lastHeartbeat) {
    return { healthy: false, label: "No heartbeat" };
  }

  const heartbeatDate = new Date(lastHeartbeat);
  const now = new Date();
  const diffMs = now.getTime() - heartbeatDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  // Consider unhealthy if last heartbeat was more than 60 seconds ago
  if (diffSecs > 60) {
    return {
      healthy: false,
      label: `${Math.floor(diffSecs / 60)}m ago`,
    };
  }

  return {
    healthy: true,
    label: diffSecs < 5 ? "just now" : `${diffSecs}s ago`,
  };
}

export function SystemStatus({
  runningPods,
  totalPods,
  engineHealthy,
  engineLastHeartbeat,
  supabaseHealthy,
}: SystemStatusProps) {
  const heartbeat = getHeartbeatStatus(engineLastHeartbeat);
  const overallHealthy = engineHealthy && heartbeat.healthy && supabaseHealthy;

  return (
    <footer className="border-t border-zinc-800 bg-zinc-900/50">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <StatusIndicator
              label="Pods"
              value={`${runningPods}/${totalPods}`}
              healthy={runningPods <= totalPods}
            />
            <StatusIndicator
              label="Engine"
              value={heartbeat.label}
              healthy={engineHealthy && heartbeat.healthy}
            />
            <StatusIndicator
              label="Supabase"
              value={supabaseHealthy ? "Connected" : "Disconnected"}
              healthy={supabaseHealthy}
            />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${overallHealthy ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm text-zinc-400">
              {overallHealthy ? "System healthy" : "System degraded"}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function StatusIndicator({
  label,
  value,
  healthy,
}: {
  label: string;
  value: string;
  healthy: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-500">{label}:</span>
      <span
        className={`text-sm font-medium ${healthy ? "text-green-400" : "text-red-400"}`}
      >
        {healthy ? "✅" : "❌"} {value}
      </span>
    </div>
  );
}
