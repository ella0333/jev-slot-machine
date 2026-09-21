/**
 * The local server: the loop that keeps Jev playing, the page that shows it,
 * and a small control endpoint the `jev.py` commands talk to.
 *
 * It binds to 127.0.0.1 on a free port and writes that port to data/port.json
 * so the command line can find it. Nothing here listens on a public interface.
 */

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { config, ROOT, DATA_DIR } from './lib/config.mjs';
import { tick } from './lib/engine.mjs';
import { formatUsd, round2, MINIMUM_BET } from './lib/machine.mjs';
import {
  MODES, freshState, loadState, saveState, loadTimeline,
  makeEvent, pushEvents, applyTopUp, enterMode,
} from './lib/state.mjs';
import { readJSON, writeJSON, KEYS } from './lib/store.mjs';

const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT_FILE = path.join(DATA_DIR, 'port.json');
const FIRST_PORT = 8787;
const PORT_ATTEMPTS = 40;

const cfg = await config();
const dry = process.argv.includes('--dry');

if (!cfg.apiKey && !dry) {
  console.error('No TYPESAFE_API_KEY. Run: python setup.py');
  process.exit(1);
}

/* ---------------- state, one writer ---------------- */

let state = (await loadState()) ?? freshState(Date.now(), { balance: cfg.startingBalance });

// Every mutation goes through here, so a control command can never land in the
// middle of a planning pass and lose an update.
let chain = Promise.resolve();
function exclusive(fn) {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

async function runTick() {
  return exclusive(async () => {
    try {
      await tick(state, { config: cfg, dry, log: (m) => console.log(m) });
    } catch (e) {
      console.error(`tick failed: ${e.message}`);
    }
  });
}

/* ---------------- control ---------------- */

const COMMANDS = {
  async status() {
    return { ok: true, ...summary() };
  },

  async balance({ amount }) {
    const value = round2(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, error: 'Amount must be a positive number.' };
    }

    const at = Math.max(state.plannedUntil, Date.now());
    applyTopUp(state, value);

    const wasBust = state.mode === MODES.BUST;
    if (wasBust) {
      enterMode(state, MODES.GAMBLING, at);
      state.plannedUntil = at;
    }

    await pushEvents([makeEvent(state, at, 'topup', { amount: value, resumed: wasBust })], state.plannedUntil);
    await saveState(state);

    return { ok: true, message: `Added ${formatUsd(value)}.`, ...summary() };
  },

  async restart() {
    const previous = state;
    state = freshState(Date.now(), {
      run: (previous.run ?? 1) + 1,
      balance: cfg.startingBalance,
      lifetime: previous.lifetime,
    });
    await saveState(state);
    await writeJSON(KEYS.timeline, { events: [], plannedUntil: 0, generatedAt: 0 });
    return { ok: true, message: `Run ${state.run} started with ${formatUsd(cfg.startingBalance)}.`, ...summary() };
  },

  async pause() {
    state.paused = true;
    await saveState(state);
    return { ok: true, message: 'Paused.', ...summary() };
  },

  async resume() {
    state.paused = false;
    state.plannedUntil = Math.max(state.plannedUntil, Date.now());
    await saveState(state);
    return { ok: true, message: 'Running.', ...summary() };
  },
};

function summary() {
  return {
    run: state.run,
    mode: state.paused ? 'paused' : state.mode,
    balance: round2(state.balance),
    started: round2(state.startingBalance),
    won: round2(state.totals.won),
    lost: round2(state.totals.lost),
    added: round2(state.totals.added),
    spent: round2(state.totals.spent),
    spins: state.spinCount,
    purchases: state.purchaseCount,
    minimumBet: MINIMUM_BET,
  };
}

/* ---------------- http ---------------- */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

function sendJSON(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

async function serveStatic(res, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const file = path.join(PUBLIC_DIR, relative);

  // Never serve anything outside public/.
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (url.pathname === '/api/timeline') {
    const since = Number(url.searchParams.get('since')) || 0;
    const timeline = await loadTimeline();
    return sendJSON(res, 200, {
      now: Date.now(),
      plannedUntil: timeline.plannedUntil,
      paused: state.paused,
      events: timeline.events.filter((e) => e.t > since),
    });
  }

  if (url.pathname === '/api/ledger') {
    const ledger = await readJSON(KEYS.ledger, { purchases: [] });
    const purchases = ledger.purchases.slice().reverse();
    return sendJSON(res, 200, {
      count: purchases.length,
      total: round2(purchases.reduce((sum, p) => sum + p.price, 0)),
      mostExpensive: purchases.reduce((top, p) => (!top || p.price > top.price ? p : top), null),
      purchases: purchases.slice(0, 200),
    });
  }

  if (url.pathname === '/api/control' && req.method === 'POST') {
    const body = await readBody(req);
    const command = COMMANDS[body.command];
    if (!command) return sendJSON(res, 400, { ok: false, error: `Unknown command: ${body.command}` });
    const result = await exclusive(() => command(body));
    if (result.ok && body.command !== 'status' && body.command !== 'pause') runTick();
    return sendJSON(res, 200, result);
  }

  return serveStatic(res, url.pathname);
});

/* ---------------- the port ---------------- */

function tryListen(port) {
  return new Promise((resolve, reject) => {
    const onError = (e) => { server.removeListener('listening', onListening); reject(e); };
    const onListening = () => { server.removeListener('error', onError); resolve(server.address().port); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

/** First free port from 8787 up, or whatever the OS hands out after that. */
async function listen() {
  // Port 0 asks the OS for any free port, which is the guaranteed fallback.
  if (cfg.port) {
    try {
      return await tryListen(cfg.port);
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      console.log(`Port ${cfg.port} is in use, picking another.`);
      return tryListen(0);
    }
  }

  for (let i = 0; i < PORT_ATTEMPTS; i += 1) {
    try {
      return await tryListen(FIRST_PORT + i);
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
    }
  }
  return tryListen(0);
}

const port = await listen();
await fs.mkdir(DATA_DIR, { recursive: true });
await writeJSON('port', { port, pid: process.pid, startedAt: Date.now() });

console.log(`Jev is playing at http://127.0.0.1:${port}`);
console.log(`Purchases ${cfg.allowPurchases ? 'on' : 'off'}, dataset in ${path.relative(ROOT, DATA_DIR)}${path.sep}`);
if (dry) console.log('Dry run: answers are stubbed and no API calls are made.');

await runTick();
const timer = setInterval(runTick, cfg.tickSeconds * 1000);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    clearInterval(timer);
    server.close();
    await fs.rm(PORT_FILE, { force: true });
    process.exit(0);
  });
}
