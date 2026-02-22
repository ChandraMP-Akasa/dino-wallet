import dotenv from "dotenv";

dotenv.config();

interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  searchPath: string;
  connectionLimit: number;
  ssl?: boolean;
}

interface AppConfig {
  db: DbConfig;
  jwtSecret: string;
  nodeEnv: string;
}

class AppConfigService {
  private config: AppConfig;

  constructor() {
    this.config = {
      db: {
        host: this.getEnv("DB_HOST", "localhost"),
        port: this.getEnvNumber("DB_PORT", 5432),
        user: this.getEnv("DB_USERNAME", ""),
        password: this.getEnv("DB_PASSWORD", ""),
        database: this.getEnv("DB_NAME", ""),
        searchPath: this.getEnv("SEARCH_PATH", "dinowallet"),
        connectionLimit: this.getEnvNumber("DB_POOL_LIMIT", 20),
        ssl: this.getEnv("SSL", "true").toLowerCase() === "true",
      },
      jwtSecret: this.getRequiredEnv("JWT_SECRET"),
      nodeEnv: this.getEnv("NODE_ENV", "local"),
    };
  }

  private getEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  private getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getDbConfig(): DbConfig {
    return this.config.db;
  }

  public getJwtSecret(): string {
    return this.config.jwtSecret;
  }

  public isProduction(): boolean {
    return this.config.nodeEnv === "production";
  }
}

export default new AppConfigService();