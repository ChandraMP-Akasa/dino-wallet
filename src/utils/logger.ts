// src/utils/logger.ts
import { createLogger, format, transports } from "winston";

const { combine, timestamp, printf, colorize, errors, splat, json } = format;

const isProd = process.env.NODE_ENV === "production";

// ----- PRETTY PRINT FORMAT FOR DEV -----
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  errors({ stack: true }),
  splat(),
  printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}] ${stack || message}`;
  })
);

// ----- JSON FORMAT FOR PROD -----
const prodFormat = combine(timestamp(), errors({ stack: true }), splat(), json());

// ----- LOGGER INSTANCE -----
export const logger = createLogger({
  level: isProd ? "info" : "debug",
  format: isProd ? prodFormat : devFormat,
  transports: [
    new transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

// -----------------------------------------
// CONSOLE INTERCEPTOR
// -----------------------------------------
export function interceptConsole() {
  if ((global as any).__consoleIntercepted) return; // avoid duplicate interception
  (global as any).__consoleIntercepted = true;

  const wrap =
    (fn: (msg: string, meta?: any) => void, level: string) =>
    (...args: any[]) => {
      try {
        if (args.length === 1) {
          const a = args[0];
          fn(typeof a === "string" ? a : JSON.stringify(a));
        } else {
          fn(args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
        }
      } catch (err) {
        // fallback if error
        console.error("Logging error:", err);
      }
    };

  console.log = wrap(logger.info.bind(logger), "info");
  console.info = wrap(logger.info.bind(logger), "info");
  console.warn = wrap(logger.warn.bind(logger), "warn");
  console.error = wrap(logger.error.bind(logger), "error");
  console.debug = wrap(logger.debug.bind(logger), "debug");
}

export default logger;
