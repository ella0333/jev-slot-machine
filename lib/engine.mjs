/**
 * One turn of Jev's night, and the loop that plans the next stretch of them.
 *
 * Every turn produces exactly one TypeSafe request. All the questions for the
 * turn go in that one request, which is the fan-out pattern from the docs: the
 * model reads the state once and answers everything against it in parallel.
 *
 * The loop plans ahead of real time rather than spinning on a timer, so the
 * page animates smoothly even though the server thinks in bursts. Nothing here
 * knows about the browser.
 */

import { ask, decide, scaleScore } from './jev.mjs';
import { betLadder, spin as spinReels, round2 } from './machine.mjs';
import { buildMenu, canShop } from './shop.mjs';
import { SHOP_LINES, BUST_LINES, situationFor, pick } from './lines.mjs';
import {
  gamblingState, gamblingQuestions, betForChoice,
  shopState, shopQuestions,
} from './questions.mjs';
import {
  MODES, PLAN_HORIZON_MS, SHOP_COOLDOWN_MS,
  viewFor, isBrokeState, makeEvent, applySpin, applyPurchase,
  enterMode, pushEvents, saveState,
} from './state.mjs';
import { readJSON, writeJSON, appendJSONL, KEYS } from './store.mjs';

/** Hard ceiling on work per pass, so a slow API cannot run the loop away. */
const MAX_TURNS_PER_TICK = 24;

/* Pace score maps onto the gap between spins. The reels themselves take a
 * couple of seconds to settle, and a real player then sits there a moment
 * before pressing again, so even the fast end is about nine seconds a spin. The
 * slow end is somebody who has stopped enjoying it. Faster than this looked like
 * a script hammering a button rather than somebody playing. */
const FAST_MS = 9000;
const SLOW_MS = 32000;

/* Occasionally he just sits there. */
const IDLE_CHANCE = 0.06;
const IDLE_MIN_MS = 20000;
const IDLE_MAX_MS = 70000;

/* A purchase is not instant either: Jev is in a shop, queueing, paying, and
 * walking back to the machine. */
const SHOP_GAP_MS = 90000;

/* Getting up and walking somewhere. */
const WALK_MS = 40000;

function jitter(ms, spread = 0.25) {
  return Math.round(ms * (1 - spread + Math.random() * spread * 2));
}

/**
 * Plan forward until the timeline covers the horizon.
 *
 * @param {object} state      mutated in place and saved before returning
 * @param {object} options
 * @param {object} options.config   { apiKey, allowPurchases }
 * @param {boolean} options.dry     stub Jev instead of calling him
 */
export async function tick(state, { config, dry = false, now = Date.now(), log = () => {} } = {}) {
  if (state.paused || state.mode === MODES.BUST) {
    return { turns: 0, events: [] };
  }

  // The frontier can fall behind if the process was asleep. Never replay the
  // gap: snap forward so nobody watches stale spins.
  if (state.plannedUntil < now) state.plannedUntil = now;

  const events = [];
  const records = [];
  let turns = 0;

  while (
    state.plannedUntil < now + PLAN_HORIZON_MS &&
    turns < MAX_TURNS_PER_TICK &&
    state.mode !== MODES.BUST
  ) {
    const turn = await runTurn(state, { config, dry });
    events.push(...turn.events);
    if (turn.record) records.push(turn.record);
    state.plannedUntil += turn.durationMs;
    turns += 1;
  }

  await saveState(state);
  if (events.length) await pushEvents(events, state.plannedUntil);
  if (records.length) await writeRecords(records);

  log(`planned ${turns} turns, ${events.length} events, frontier +${Math.round((state.plannedUntil - now) / 1000)}s`);
  return { turns, events };
}

function runTurn(state, options) {
  return state.mode === MODES.SHOPPING
    ? shoppingTurn(state, options)
    : gamblingTurn(state, options);
}

/* ------------------------------------------------------------------ */
/* Gambling                                                            */
/* ------------------------------------------------------------------ */

async function gamblingTurn(state, { config, dry }) {
  // Cannot cover a spin. There is nothing left to decide, so no request is
  // made and the run is over.
  if (isBrokeState(state)) return bust(state);

  const ladder = betLadder(state.balance);
  // Getting up is only on the table when there is something to get up for and
  // Jev has not just been out. Without the cooldown the question came round every
  // spin and Jev left the machine about once a minute.
  const sinceLastPurchase = state.lastPurchaseAt
    ? state.plannedUntil - state.lastPurchaseAt
    : Infinity;
  const canSpend = config.allowPurchases
    && canShop(state.balance)
    && sinceLastPurchase >= SHOP_COOLDOWN_MS;

  // React to the spin that just finished, not to nothing.
  const last = state.recent[state.recent.length - 1] ?? null;
  const situation = situationFor({
    spin: last
      ? {
          isJackpot: last.payout > 0 && last.winName === 'Triple Diamond jackpot',
          multiplier: last.bet > 0 ? last.payout / last.bet : 0,
          payout: last.payout,
          symbols: last.symbols ?? null,
        }
      : null,
    balance: state.balance,
    startingBalance: state.startingBalance,
    lossStreak: state.lossStreak,
  });
  const view = viewFor(state, situation);

  const questions = gamblingQuestions(view, ladder, { canSpend });
  const result = dry
    ? stubAnswers(questions)
    : await ask(gamblingState(view, ladder), questions, { apiKey: config.apiKey });

  const a = result.answers;
  const mutter = a.mutter?.choice ?? null;
  // Jev decides when to get up. `choice` is documented as the highest
  // probability option, so it is already the answer: comparing its confidence
  // against a floor and substituting our own value would be overruling it. The
  // confidence is recorded on the event instead. The fallback is only reached
  // when there is no answer at all.
  const action = canSpend
    ? decide(a.action, { floor: 0, fallback: 'spin_again' })
    : { value: 'spin_again', confident: true };

  if (action.value === 'go_spend') {
    enterMode(state, MODES.SHOPPING, state.plannedUntil);
    return {
      events: [makeEvent(state, state.plannedUntil, 'leave_machine', {
        line: mutter,
        confidence: a.action?.confidence ?? null,
        usedFallback: !action.confident,
      })],
      durationMs: jitter(WALK_MS),
      record: recordFor(state, 'leave_machine', result, { action: action.value }),
    };
  }

  const bet = Math.min(betForChoice(a.bet_size?.choice, ladder), state.balance);
  const outcome = spinReels(bet);
  applySpin(state, outcome);

  const situationAfter = situationFor({
    spin: outcome,
    balance: state.balance,
    startingBalance: state.startingBalance,
    lossStreak: state.lossStreak,
  });

  const event = makeEvent(state, state.plannedUntil, 'spin', {
    bet: outcome.bet,
    stops: outcome.stops,
    symbols: outcome.symbols,
    payout: outcome.payout,
    multiplier: outcome.multiplier,
    winName: outcome.winName,
    isJackpot: outcome.isJackpot,
    net: outcome.net,
    situation: situationAfter,
    line: mutter,
    tilt: a.tilt ? round2(a.tilt.score) : null,
  });

  let durationMs = Math.round(scaleScore(a.pace, SLOW_MS, FAST_MS));
  // A big win stops the room for a moment.
  if (outcome.isJackpot) durationMs += 45000;
  else if (outcome.multiplier >= 50) durationMs += 12000;
  else if (Math.random() < IDLE_CHANCE) {
    durationMs += IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
  }

  const events = [event];
  const record = recordFor(state, 'spin', result, {
    bet: outcome.bet,
    symbols: outcome.symbols,
    stops: outcome.stops,
    payout: outcome.payout,
    multiplier: outcome.multiplier,
    net: outcome.net,
  });

  if (isBrokeState(state)) {
    const over = bust(state, jitter(4000));
    events.push(...over.events);
    return { events, durationMs: jitter(Math.max(FAST_MS, durationMs), 0.15) + over.durationMs, record };
  }

  return { events, durationMs: jitter(Math.max(FAST_MS, durationMs), 0.15), record };
}

/** The end of a run: the bankroll will not cover another spin. */
function bust(state, delayMs = 0) {
  const at = state.plannedUntil + delayMs;
  enterMode(state, MODES.BUST, at);
  return {
    events: [makeEvent(state, at, 'bust', {
      line: pick(BUST_LINES),
      spins: state.spinCount,
      run: state.run,
    })],
    durationMs: jitter(6000) + delayMs,
    record: null,
  };
}

/* ------------------------------------------------------------------ */
/* Shopping                                                            */
/* ------------------------------------------------------------------ */

async function shoppingTurn(state, { config, dry }) {
  // Just the last purchase is held back, so it is on the menu again the trip
  // after. Jev was picking the same thing on consecutive visits.
  const justBought = state.recentPurchases.slice(-1).map((p) => p.name);
  const menu = buildMenu(state.balance, justBought);

  if (menu.length === 0) {
    enterMode(state, MODES.GAMBLING, state.plannedUntil);
    return {
      events: [makeEvent(state, state.plannedUntil, 'mode', { mode: MODES.GAMBLING, reason: 'nothing affordable' })],
      durationMs: jitter(5000),
      record: null,
    };
  }

  const view = viewFor(state, 'shopping');
  const questions = shopQuestions(view, menu);
  const result = dry
    ? stubAnswers(questions)
    : await ask(shopState(view), questions, { apiKey: config.apiKey });

  const a = result.answers;
  const item = menu.find((i) => i.name === a.purchase?.choice) ?? menu[0];

  applyPurchase(state, item, state.plannedUntil);

  const line = pick(SHOP_LINES[item.sense] ?? SHOP_LINES.neutral);

  const events = [
    makeEvent(state, state.plannedUntil, 'purchase', {
      name: item.name,
      price: item.price,
      kind: item.kind,
      sense: item.sense,
      line,
      regret: a.regret ? round2(a.regret.score) : null,
      confidence: a.purchase?.confidence ?? null,
    }),
  ];

  await appendLedger({
    at: state.plannedUntil,
    name: item.name,
    price: item.price,
    kind: item.kind,
    sense: item.sense,
    balanceAfter: round2(state.balance),
    regret: a.regret ? round2(a.regret.score) : null,
    spinCount: state.spinCount,
  });

  const record = recordFor(state, 'purchase', result, {
    item: item.name,
    price: item.price,
    sense: item.sense,
    next: 'back_to_slots',
  });

  if (isBrokeState(state) && !canShop(state.balance)) {
    const over = bust(state);
    events.push(...over.events);
    return { events, durationMs: jitter(SHOP_GAP_MS) + over.durationMs, record };
  }

  // One thing per trip. Jev is not asked whether to keep shopping: left to
  // decide, Jev bought the whole menu in a few minutes and the bankroll went on
  // souvenirs rather than on the machine. Buying ends the trip, and getting back
  // up to leave the machine again is a decision Jev makes at the machine.
  enterMode(state, MODES.GAMBLING, state.plannedUntil);
  events.push(makeEvent(state, state.plannedUntil, 'mode', {
    mode: MODES.GAMBLING,
    reason: 'back to the slot machine',
  }));

  return { events, durationMs: jitter(SHOP_GAP_MS), record };
}

/* ------------------------------------------------------------------ */
/* The dataset                                                         */
/* ------------------------------------------------------------------ */

/**
 * One row per decision, carrying the answer exactly as TypeSafe returned it.
 * Probabilities are not rounded, collapsed, or summarised.
 */
function recordFor(state, kind, result, outcome) {
  return {
    at: state.plannedUntil,
    run: state.run ?? 1,
    spin_count: state.spinCount,
    kind,
    mode: state.mode,
    balance_after: round2(state.balance),
    totals: {
      won: round2(state.totals.won),
      lost: round2(state.totals.lost),
      added: round2(state.totals.added),
      spent: round2(state.totals.spent),
    },
    outcome,
    model: result.model ?? null,
    latency_ms: result.latencyMs ?? null,
    usage: result.usage ?? null,
    answers: result.answers, // raw, untouched
  };
}

async function writeRecords(records) {
  const byDay = new Map();
  for (const r of records) {
    const day = new Date(r.at).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(r);
  }
  for (const [day, rows] of byDay) {
    await appendJSONL(`dataset-${day}.jsonl`, rows);
  }
}

async function appendLedger(entry) {
  const ledger = await readJSON(KEYS.ledger, { purchases: [] });
  ledger.purchases.push(entry);
  await writeJSON(KEYS.ledger, ledger);
}

/* ------------------------------------------------------------------ */
/* Dry mode                                                            */
/* ------------------------------------------------------------------ */

/**
 * Plausible answers without calling the API, so the loop, the timeline, the
 * ledger and the front end can all be exercised for free. Shaped exactly like a
 * real response so nothing downstream can tell the difference.
 */
function stubAnswers(questions) {
  const answers = {};
  for (const [id, q] of Object.entries(questions)) {
    if (q.type === 'choice') {
      const options = Object.keys(q.criteria);
      const probabilities = randomSimplex(options);
      const top = options.reduce((a, b) => (probabilities[a] > probabilities[b] ? a : b));
      answers[id] = {
        type: 'choice',
        choice: top,
        probabilities,
        confidence: confidenceOf(Object.values(probabilities)),
      };
    } else if (q.type === 'score') {
      const levels = q.criteria.length;
      const probabilities = randomSimplex(Array.from({ length: levels }, (_, i) => String(i)));
      const legend = Object.fromEntries(q.criteria.map((c, i) => [String(i), c]));
      const score = Object.entries(probabilities).reduce((sum, [k, p]) => sum + Number(k) * p, 0);
      answers[id] = {
        type: 'score',
        score: round2(score),
        legend,
        probabilities,
        confidence: confidenceOf(Object.values(probabilities)),
      };
    } else {
      answers[id] = { type: 'noul', noul: Math.round(Math.random() * 100) / 100 };
    }
  }
  return { model: 'dry-run', answers, usage: { input_tokens: 0, output_tokens: 0 }, latencyMs: 0 };
}

function randomSimplex(keys) {
  // Biased toward a clear winner, so dry runs do not sit at 50/50 forever.
  const raw = keys.map(() => Math.random() ** 2.5);
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(keys.map((k, i) => [k, Math.round((raw[i] / total) * 1000) / 1000]));
}

function confidenceOf(values) {
  const n = values.length;
  if (n < 2) return 1;
  const peak = Math.max(...values);
  return Math.max(0, Math.min(1, (n * peak - 1) / (n - 1)));
}
