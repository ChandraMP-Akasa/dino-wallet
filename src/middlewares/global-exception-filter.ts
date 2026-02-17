import { Request, Response, NextFunction } from "express";

export interface HttpException extends Error {
  statusCode?: number;
  details?: unknown;
}

export function exceptionFilter() {
  return (err: HttpException, req: Request, res: Response, _next: NextFunction) => {
    const status = err.statusCode || 500;

    const errorResponse = {
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
      message: err.message || "Internal server error",
      details: err.details || null,
      statusCode: status
    };

    // Log error server-side (can be replaced with Winston/Pino etc.)
    console.error("[ERROR]", {
      message: err.message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method
    });

    res.status(status).json(errorResponse);
  };
}
