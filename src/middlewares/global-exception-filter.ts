import { Request, Response, NextFunction } from "express";
import { ValidateError } from "tsoa";

export function exceptionFilter() {
  return (err: any, req: Request, res: Response, _next: NextFunction) => {

    // 1️⃣ TSOA validation errors
    if (err instanceof ValidateError) {
      return res.status(400).json({
        status: 400,
        message: "Validation failed",
        errors: err.fields
      });
    }

    // 2️⃣ Authentication / custom errors
    const status =
      err.status ||
      err.statuscode ||
      500;

    return res.status(status).json({
      status,
      message: err.message || "Internal Server Error"
    });
  };
}
