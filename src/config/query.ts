import pool from "./db";
import { PoolClient, QueryResult } from "pg";

export async function dbQuery<T = any>(
  sql: string,
  params: any[] = [],
  retries = 3,
  client?: PoolClient,
): Promise<T[]> {
  const start = Date.now();
  const executor = client ?? pool;

  try {
    const result = await executor.query(sql, params);
    const duration = Date.now() - start;
    return result.rows as T[];
  } catch (err: any) {
    if (
      retries > 0 &&
      (err.code === "40P01" || err.code === "40001")
    ) {
      console.warn("Retrying query due to serialization/deadlock...");
      return dbQuery<T>(sql, params, retries - 1);
    }

    console.error("[DB ERROR]", {
      sql,
      params,
      durationMs: Date.now() - start,
      error: err.message,
      code: err.code,
    });

    throw err;
  }
}
