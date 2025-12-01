import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Circle } from "lucide-react";

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
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
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

          <Badge variant={overallHealthy ? "default" : "destructive"} className="gap-1.5">
            {overallHealthy ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {overallHealthy ? "System healthy" : "System degraded"}
          </Badge>
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
      <span className="text-sm text-muted-foreground">{label}:</span>
      <div className="flex items-center gap-1.5">
        <Circle
          className={`h-2 w-2 fill-current ${
            healthy ? "text-green-500" : "text-destructive"
          }`}
        />
        <span className={`text-sm font-medium ${healthy ? "text-foreground" : "text-destructive"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
