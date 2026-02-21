// src/config/db.ts
import configService from "../config/app-config";
import { Pool, PoolClient } from "pg";

const dbConfig = configService.getDbConfig();

const pool = new Pool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  max: dbConfig.connectionLimit || 20,   
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: dbConfig.ssl || true, 
  options: `-c search_path=${dbConfig.searchPath || "dinowallet"}`,
});

pool.on("connect", () => {
  console.log("PostgreSQL connected");
});

interface PoolError extends Error {
  code?: string;
  severity?: string;
}

pool.on("error", (err: PoolError) => {
  console.error("Unexpected PG error:", err);
  process.exit(1);
});

export async function closePool() {
  console.log("Closing PostgreSQL pool...");
  await pool.end();
  console.log("PostgreSQL pool closed.");
}

export default pool;
