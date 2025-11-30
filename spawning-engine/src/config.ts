/**
 * Configuration loaded from environment variables.
 * All required variables throw on missing values.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function optionalInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid integer for ${name}: ${value}`);
  }
  return parsed;
}

export const config = {
  // Supabase
  supabaseUrl: required("SUPABASE_URL"),
  supabaseKey: required("SUPABASE_KEY"),

  // Polling
  pollIntervalMs: optionalInt("POLL_INTERVAL_MS", 5000),

  // Job settings
  jobTimeoutMinutes: optionalInt("JOB_TIMEOUT_MINUTES", 30),
  jobNamespace: optional("JOB_NAMESPACE", "coding-swarm"),
  jobImage: optional("JOB_IMAGE", "tobiaswaggoner/coding-swarm-agent:latest"),
  maxParallelJobs: optionalInt("MAX_PARALLEL_JOBS", 10),

  // Logging
  logLevel: optional("LOG_LEVEL", "info"),
} as const;

export type Config = typeof config;
