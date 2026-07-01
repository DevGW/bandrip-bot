import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { requireEnv } from "../services/configService.js";

/**
 * Creates and configures the BandRip SQLite database connection.
 *
 * @returns An initialized SQLite database connection.
 */
function createDatabase(): Database.Database {
    const databasePath = requireEnv("DATABASE_PATH");
    const databaseDir = path.dirname(databasePath);

    fs.mkdirSync(databaseDir, { recursive: true });

    const database = new Database(databasePath);

    database.pragma("foreign_keys = ON");
    database.pragma("journal_mode = WAL");

    return database;
}

/**
 * Shared SQLite database connection for the application.
 */
export const db = createDatabase();

/**
 * Applies the current database schema.
 */
export function initializeDatabase(): void {
    const schemaPath = path.resolve("src/db/schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    db.exec(schema);
}