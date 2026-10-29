import mysql from 'mysql2/promise';

let pool;

const hasDbConfig =
  process.env.DB_HOST &&
  process.env.DB_USER &&
  process.env.DB_PASSWORD !== undefined &&
  process.env.DB_NAME;

if (hasDbConfig) {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });
}

export const db = pool || null;

export const hasDatabase = Boolean(pool);
