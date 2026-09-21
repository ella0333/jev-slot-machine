/**
 * Configuration, written by setup.py and read here.
 *
 * .env is a plain key=value file. It is parsed by hand rather than with a
 * dependency, so `npm install` on this repo pulls in nothing at all.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const ENV_FILE = path.join(ROOT, '.env');

const DEFAULTS = {
  JEV_STARTING_BALANCE: '1200',
  JEV_ALLOW_PURCHASES: 'true',
  JEV_PORT: '0',
  JEV_TICK_SECONDS: '30',
};

function parseEnv(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/** Reads .env into process.env without overwriting anything already set. */
export async function loadEnv() {
  let text = '';
  try {
    text = await fs.readFile(ENV_FILE, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  for (const [key, value] of Object.entries(parseEnv(text))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export async function config() {
  await loadEnv();
  const get = (key) => process.env[key] ?? DEFAULTS[key];

  return {
    apiKey: get('TYPESAFE_API_KEY') ?? '',
    startingBalance: Number(get('JEV_STARTING_BALANCE')),
    allowPurchases: get('JEV_ALLOW_PURCHASES') !== 'false',
    port: Number(get('JEV_PORT')),
    tickSeconds: Math.max(5, Number(get('JEV_TICK_SECONDS'))),
  };
}
