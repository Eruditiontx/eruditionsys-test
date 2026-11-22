// Helpers for tests that need a real database instead of mocked models.
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { Sequelize } from 'sequelize';
import { defaultDangerKey } from '../routes/users/authSettings.js';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

/**
 * Create an in-memory SQLite database with every migration applied,
 * so tests run against the same schema as a deployed instance.
 */
export async function createTestDatabase() {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  for (const file of readdirSync(migrationsDir).sort()) {
    const migration = await import(pathToFileURL(path.join(migrationsDir, file)).href);
    await migration.up(sequelize.getQueryInterface(), Sequelize);
  }
  return sequelize;
}

/** Authorization header value for a signed-in user, as verifySignedIn expects it. */
export function bearerFor(userId) {
  const token = jwt.sign({ userId }, process.env.SECRET_KEY || defaultDangerKey);
  return `Bearer ${token}`;
}
