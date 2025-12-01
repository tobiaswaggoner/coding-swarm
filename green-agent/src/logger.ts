/**
 * Simple structured logger for Green Agent
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = levels[(process.env.LOG_LEVEL as LogLevel) || "info"] || levels.info;

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `${timestamp} [${level.toUpperCase()}] ${message}`;
}

export const log = {
  debug(message: string): void {
    if (levels.debug >= currentLevel) {
      console.log(formatMessage("debug", message));
    }
  },

  info(message: string): void {
    if (levels.info >= currentLevel) {
      console.log(formatMessage("info", message));
    }
  },

  warn(message: string): void {
    if (levels.warn >= currentLevel) {
      console.warn(formatMessage("warn", message));
    }
  },

  error(message: string): void {
    if (levels.error >= currentLevel) {
      console.error(formatMessage("error", message));
    }
  },
};
