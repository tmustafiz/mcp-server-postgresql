import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  pgHost: string;
  pgPort: number;
  pgUser: string;
  pgPassword: string;
  pgDatabase: string;
  serverPort: number;
  pgSsl: boolean;
  pgSslRejectUnauthorized: boolean;
}

export const config: Config = {
  pgHost: process.env.PGHOST || 'localhost',
  pgPort: Number(process.env.PGPORT) || 5432,
  pgUser: process.env.PGUSER || 'postgres',
  pgPassword: process.env.PGPASSWORD || '',
  pgDatabase: process.env.PGDATABASE || 'postgres',
  serverPort: Number(process.env.PORT) || 8080,
  pgSsl: process.env.PGSSL === 'true',
  pgSslRejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false'
};
