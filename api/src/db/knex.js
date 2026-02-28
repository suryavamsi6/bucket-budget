import knex from 'knex';
import knexConfig from '../../knexfile.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbPath = process.env.DB_PATH || './data/budget.db';
mkdirSync(dirname(dbPath), { recursive: true });

const db = knex(knexConfig);

export default db;
