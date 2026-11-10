import path from 'path';
import { defaultDangerKey } from '../routes/users/authSettings.js';

export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:8000';
export const SECRET_KEY = process.env.SECRET_KEY || defaultDangerKey;

export const IS_PROD = process.env.NODE_ENV === 'production';
export const PORT = process.env.PORT || 8001;
export const API_PATH = process.env.API_PATH || '/api';
// sub-path the frontend is served under ('' at the root); must match the frontend build
export const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '');
// base URL of the frontend pages, as opposed to the bare origin used for CORS
export const FRONTEND_URL = `${FRONTEND_ORIGIN}${BASE_PATH}`;

const databasePath = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'database/database.sqlite');

export default {
  development: {
    dialect: 'sqlite',
    storage: databasePath,
  },
  test: {
    dialect: 'sqlite',
    storage: databasePath,
  },
  production: {
    dialect: 'sqlite',
    storage: databasePath,
  },
};
