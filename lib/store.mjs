/**
 * Storage: a directory of JSON files under data/.
 *
 * The live site keeps this in Netlify Blobs because a serverless function has
 * no disk. Locally there is a disk, so there is no reason for anything else.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.mjs';

const file = (key) => path.join(DATA_DIR, `${key}.json`);

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readJSON(key, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file(key), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

export async function writeJSON(key, value) {
  await ensureDir();
  await fs.writeFile(file(key), JSON.stringify(value, null, 2), 'utf8');
  return value;
}

/** One JSON object per line, which is what the dataset is. */
export async function appendJSONL(name, rows) {
  if (!rows.length) return;
  await ensureDir();
  const text = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await fs.appendFile(path.join(DATA_DIR, name), text, 'utf8');
}

export const KEYS = {
  state: 'state',
  timeline: 'timeline',
  ledger: 'ledger',
};
