// src/auth/auth.ts
import express from "express";
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET environment variable is not set");
}

//Basic Implementation
export async function expressAuthentication(
  request: express.Request,
  securityName: string,
  scopes?: string[]
): Promise<any> {
  try{
    if(securityName === 'BearerAuth'){
      const authToken = extractBearerToken(request)
      if (!authToken) { 
        throw new Error("Missing or invalid Authorization header");
      }
      console.log('authToken -', authToken);

      const payload = verifyJwt(authToken);
      if (!payload) {
        throw new Error("Unauthorized");
      }
      console.log("User data:", payload);

      return payload;
    }else if(securityName === 'BasicAuth'){
      const header = request.headers.authorization;
      if (!header || !header.startsWith("Basic ")) {
        throw new Error("Missing or invalid Basic Authorization header");
      }
      const base64Credentials = header.substring("Basic ".length).trim();
      let decoded = "";
      try {
        decoded = Buffer.from(base64Credentials, "base64").toString("utf8");
      } catch {
        throw new Error("Invalid Basic Auth encoding");
      }
      const [username, password] = decoded.split(":");

      if (!username || !password) {
        throw new Error("Invalid Basic Auth format");
      }
      console.log("Basic credentials received:", { username });

      // TODO: Replace with your DB lookup or real auth logic
      const VALID_USER = "admin";
      const VALID_PASS = "secret123";

      if (username !== VALID_USER || password !== VALID_PASS) {
        throw new Error("Invalid username or password");
      }
      return {
        username,
        roles: ["basic-user"],
      };
    }
  }catch (err: any) {
    console.error("Authentication failed:", err.message);
    err.status = 401;
    throw err;
  }
}

function extractBearerToken(req: express.Request): string | null {
  try{
      const auth = req.headers.authorization;
      if (!auth) return null;
      const parts = auth.trim().split(/\s+/);
      if (parts.length !== 2) return null;
      const [scheme, token] = parts;  
      if (!/^Bearer$/i.test(scheme)) return null;
      return token || null;
  }catch(err: any){
    console.error('Failed to extractBearerToken with error -', err.message);
    err.status = 401;
    throw err;
  }
}

function verifyJwt(token: string) {
  try {
    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"], // force algorithm
    });
    return payload as any; // cast to your interface
  } catch (err: any) {
    console.error("JWT verification failed:", err.message);
    err.status = 401;
    throw err;
  }
}
