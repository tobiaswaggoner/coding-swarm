import { config } from "./config.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[config.logLevel as LogLevel];
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `${timestamp} [${level.toUpperCase()}] ${message}`;
}

export const log = {
  debug(message: string) {
    if (shouldLog("debug")) console.log(formatMessage("debug", message));
  },
  info(message: string) {
    if (shouldLog("info")) console.log(formatMessage("info", message));
  },
  warn(message: string) {
    if (shouldLog("warn")) console.warn(formatMessage("warn", message));
  },
  error(message: string) {
    if (shouldLog("error")) console.error(formatMessage("error", message));
  },
};
