export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const BadRequest = (msg: string, details?: unknown) =>
  new HttpError(400, msg, details);

export const Unauthorized = (msg: string = "Unauthorized") =>
  new HttpError(401, msg);

export const Forbidden = (msg: string = "Forbidden") =>
  new HttpError(403, msg);

export const NotFound = (msg: string = "Not Found") =>
  new HttpError(404, msg);

export const MethodNotAllowed = (msg: string = "Method Not Allowed") => 
  new HttpError(405, msg);

export const Conflict = (msg: string = "Method Not Allowed") => 
  new HttpError(405, msg);

export const TooManyRequests = (msg: string = "Too Many Requests Not Allowed") => 
  new HttpError(405, msg);

export const InternalError = (msg: string = "Internal Server Error") =>
  new HttpError(500, msg);
