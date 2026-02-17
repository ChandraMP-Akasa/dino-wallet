// src/middlewares/global-api-request-logger.ts
import { Request, Response, NextFunction } from "express";

type SimpleLogger = {
  info: (msg: string, meta?: any) => void;
  warn?: (msg: string, meta?: any) => void;
  error?: (msg: string, meta?: any) => void;
};

interface ApiLoggerOptions {
  logger?: SimpleLogger;
  redactHeaders?: string[]; // header names to redact (case-insensitive)
  redactQuery?: string[]; // query param names to redact
  maxBodyLength?: number; // maximum characters to capture from bodies
  redactBodyFields?: string[]; // body JSON fields to redact (top-level only)
}

const defaultOptions: ApiLoggerOptions = {
  logger: console as unknown as SimpleLogger,
  redactHeaders: ["authorization", "cookie"],
  redactQuery: ["token", "password"],
  maxBodyLength: 1500,
  redactBodyFields: ["password", "ssn", "token"],
};

/**
 * API request logger middleware
 */
export function apiLogger(opts: ApiLoggerOptions = {}) {
  const { logger, redactHeaders, redactQuery, maxBodyLength, redactBodyFields } = {
    ...defaultOptions,
    ...opts,
  };

  const redactHeadersSet = new Set((redactHeaders || []).map((h) => h.toLowerCase()));
  const redactQuerySet = new Set((redactQuery || []).map((q) => q.toLowerCase()));
  const redactBodySet = new Set((redactBodyFields || []).map((b) => b.toLowerCase()));

  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // --- sanitize headers (case-insensitive) ---
    const cleanedHeaders: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      cleanedHeaders[k] = redactHeadersSet.has(k.toLowerCase()) ? "[REDACTED]" : (v as any);
    }

    // --- sanitize query params ---
    const cleanedQuery: Record<string, any> = {};
    for (const [k, v] of Object.entries(req.query || {})) {
      cleanedQuery[k] = redactQuerySet.has(k.toLowerCase()) ? "[REDACTED]" : v;
    }

    // --- helper to safely stringify and truncate ---
    function safeStringifyAndTruncate(obj: any): string | undefined {
      if (obj === undefined) return undefined;
      try {
        const s = typeof obj === "string" ? obj : JSON.stringify(obj);
        if (!s) return s;
        return s.length > (maxBodyLength as number) ? s.slice(0, maxBodyLength as number) + '...[truncated]' : s;
      } catch {
        try {
          // Fallback: use toString
          const s = String(obj);
          return s.length > (maxBodyLength as number) ? s.slice(0, maxBodyLength as number) + '...[truncated]' : s;
        } catch {
          return undefined;
        }
      }
    }

    // --- redact top-level body fields (if JSON) ---
    function redactBody(body: any) {
      if (!body || typeof body !== "object") return body;
      try {
        const clone: any = Array.isArray(body) ? [...body] : { ...body };
        if (!Array.isArray(body)) {
          for (const key of Object.keys(clone)) {
            if (redactBodySet.has(key.toLowerCase())) clone[key] = "[REDACTED]";
          }
        }
        return clone;
      } catch {
        return body;
      }
    }

    // --- capture request body safely ---
    let loggedRequestBody: string | undefined = undefined;
    if (req.body !== undefined) {
      try {
        loggedRequestBody = safeStringifyAndTruncate(redactBody(req.body));
      } catch {
        loggedRequestBody = undefined;
      }
    }

    // --- capture response body by patching res.write/res.end/res.send ---
    const chunks: Buffer[] = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const originalSend = (res as any).send?.bind(res);

    // intercept write
    (res as any).write = function (chunk: any, ...args: any[]) {
      try {
        if (chunk) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
          chunks.push(buf);
          // keep chunk length bounded to avoid memory blowup
          const totalLength = chunks.reduce((s, c) => s + c.length, 0);
          if (totalLength > (maxBodyLength as number) * 2) {
            // trim earliest chunks
            let acc = 0;
            while (chunks.length && acc + chunks[0].length < (maxBodyLength as number)) {
              acc += chunks.shift()!.length;
            }
            // keep only last portion
            if (chunks.length > 10) chunks.splice(0, chunks.length - 10);
          }
        }
      } catch {
        // ignore capture errors
      }
      return originalWrite(chunk, ...args);
    };

    // intercept end
    (res as any).end = function (chunk: any, ...args: any[]) {
      try {
        if (chunk) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
          chunks.push(buf);
        }
      } catch {
        // ignore
      }
      return originalEnd(chunk, ...args);
    };

    // Some frameworks call res.send directly — intercept as well
    if (typeof originalSend === "function") {
      (res as any).send = function (body?: any) {
        try {
          if (body) {
            const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
            chunks.push(buf);
          }
        } catch {
          // ignore
        }
        return originalSend(body);
      };
    }

    // When response finishes, log it
    res.on("finish", () => {
      // restore patched methods briefly (safe to leave patched but restore to original to avoid surprises)
      try {
        (res as any).write = originalWrite;
        (res as any).end = originalEnd;
        if (typeof originalSend === "function") (res as any).send = originalSend;
      } catch {
        // ignore restore errors
      }

      const duration = Date.now() - start;
      let responseBody: string | undefined = undefined;
      try {
        if (chunks.length) {
          // only keep last maxBodyLength characters for performance
          const last = Buffer.concat(chunks);
          const s = last.toString("utf8");
          responseBody = s.length > (maxBodyLength as number) ? s.slice(0, maxBodyLength as number) + '...[truncated]' : s;
        }
      } catch {
        responseBody = undefined;
      }

      const metadata = {
        timestamp: new Date().toISOString(),
        level: determineLevel(res.statusCode),
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: duration,
        request: {
          headers: cleanedHeaders,
          query: cleanedQuery,
          body: loggedRequestBody,
        },
      };

      const response = {
        body: responseBody,
      }

      try {
        if (metadata.level === "error" && logger?.error) {
          logger.error("HTTP " + metadata.statusCode, metadata);
          console.error("Body - " + response.body)
        } else if (metadata.level === "warn" && logger?.warn) {
          logger.warn("HTTP " + metadata.statusCode, metadata);
          console.warn("Body - " + response.body)
        } else {
          logger?.info?.("HTTP " + metadata.statusCode, metadata);
          console.info("Body - " + response.body)
        }
      } catch (err) {
        // ensure logging failure doesn't crash app
        try {
          console.error("Failed to log request", err);
        } catch {}
      }
    });

    // proceed
    next();
  };
}

function determineLevel(statusCode: number): "info" | "warn" | "error" {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warn";
  return "info";
}
