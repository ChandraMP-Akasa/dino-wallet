import dotenv from 'dotenv';

dotenv.config();

interface DbConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
}

interface AppConfig {
    db: DbConfig;
    secrets: {
        apiKey: string;
        jwtSecret: string;
    };
    nodeEnv: string;
}

class AppConfigService {
    private config: AppConfig;

    constructor() {
        this.config = {
            db: {
                host: this.getEnv('DB_HOST', 'localhost'),
                port: this.getEnvNumber('DB_PORT', 3306),
                username: this.getEnv('DB_USERNAME', 'root'),
                password: this.getEnv('DB_PASSWORD', ''),
                database: this.getEnv('DB_NAME', 'app_db'),
            },
            secrets: {
                apiKey: this.getEnv('API_KEY', null),
                jwtSecret: this.getEnv('JWT_SECRET', null),
            },
            nodeEnv: this.getEnv('NODE_ENV', 'development'),
        };
    }

    private getEnv(key: string, defaultValue: any): string {
        return process.env[key] || defaultValue;
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

    public getSecrets() {
        return this.config.secrets;
    }
}

export default new AppConfigService();