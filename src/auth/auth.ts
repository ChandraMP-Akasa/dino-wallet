// src/auth/auth.ts
import express from "express";
import jwt from "jsonwebtoken";
import { dbQuery } from "../config/query";
import { authCheck } from "../queries/sql";
import { comparePassword } from "../utils/hashing";

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
      const payload = verifyJwt(authToken);
      if (!payload) {
        throw new Error("Unauthorized");
      }
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
      } catch (err: any) {
        const error: any = new Error("Invalid Basic Auth encoding");
        error.status = 401;
        throw error;
      }
      const [username, password] = decoded.split(":");

      if (!username || !password) {
        const error: any = new Error("Invalid Basic Auth format");
        error.status = 401;
        throw error;
      }
      console.log("Basic credentials received:", { username });
      const loginInput = username.trim().toLowerCase();
      const users: any = await dbQuery(
        authCheck,
        [loginInput, loginInput]
      );

      if (!users || users.length === 0) {
        const error: any = new Error("Invalid username or password");
        error.status = 401;
        throw error;
      }

      const user = users[0];
       const isMatch = await comparePassword(password, user.password_hash);
      if (!isMatch) {
        const error: any = new Error("Invalid username or password");
        error.status = 401;
        throw error;
      }

      return {
        id: user.id,
        username: user.username,
        role: user.type,
        email: user.email
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
    return payload as any;
  } catch (err: any) {
    console.error("JWT verification failed:", err.message);
    err.status = 401;
    throw err;
  }
}
