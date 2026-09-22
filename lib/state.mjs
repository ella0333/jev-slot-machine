/**
 * Jev's world state, and the timeline the browser replays.
 *
 * The loop plays out the next stretch of time in one go and writes events
 * stamped with when they should be seen. `state.plannedUntil` is the frontier:
 * everything before it has already happened as far as the stored balance is
 * concerned, even though the page has not shown it yet.
 *
 * That means the balance in `state` is always slightly ahead of the balance on
 * screen. Nothing reads the stored balance to render, only to keep playing.
 * The numbers on the page come from the snapshot carried on each event, so they
 * can never drift out of step with the animation.
 */

import { readJSON, writeJSON, KEYS } from './store.mjs';
import { round2, MINIMUM_BET } from './machine.mjs';

/** How far ahead of real time the loop plans. */
export const PLAN_HORIZON_MS = 90_000;

/** How much history the timeline keeps, for a page that joins late. */
export const TIMELINE_WINDOW_MS = 300_000;

/**
 * How long Jev plays before getting up is on the table again.
 *
 * The question is put on every spin, so with nothing holding Jev in the seat it
 * came round about once a minute and the page was trips to the shop rather than a
 * slot machine. The cooldown runs from sitting down, and during it the question
 * is not asked at all, rather than asked and then overruled.
 */
export const LEAVE_COOLDOWN_MS = 10 * 60 * 1000;

export const MODES = {
  GAMBLING: 'gambling',
  SHOPPING: 'shopping',
  BUST: 'bust',
};

/**
 * A restart ends the run and starts a new one rather than pretending the old
 * one never happened. The run number rides along on every dataset row, so
 * somebody reading the data can tell a fresh bankroll apart from a top-up and
 * never accidentally joins two separate nights into one losing streak.
 */
export function freshState(now = Date.now(), { run = 1, balance = 5000, lifetime } = {}) {
  return {
    version: 1,
    run,
    startedAt: now,

    // Carried across restarts, so the page can show what Jev has done in total
    // as well as what Jev has done on this run.
    lifetime: lifetime ?? { won: 0, lost: 0, added: 0, spent: 0, spins: 0, staked: 0 },
    balance,
    startingBalance: balance,
    mode: MODES.GAMBLING,
    modeSince: now,
    plannedUntil: now,
    paused: false,

    totals: { won: 0, lost: 0, added: 0, spent: 0 },

    spinCount: 0,
    purchaseCount: 0,
    lastBet: null,
    lastPurchaseAt: null,
    lossStreak: 0,

    session: { startedAt: now, spins: 0, net: 0 },

    recent: [],           // last 10 spins, oldest first
    recentPurchases: [],  // last 5 things bought, shown to Jev in the shop only
    eventSeq: 0,
  };
}

export async function loadState() {
  return (await readJSON(KEYS.state)) ?? null;
}

export async function saveState(state) {
  return writeJSON(KEYS.state, state);
}

/** The derived view the questions want, so questions.mjs stays free of maths. */
export function viewFor(state, situation) {
  return {
    balance: round2(state.balance),
    lastBet: state.lastBet,
    totals: {
      won: round2(state.totals.won),
      lost: round2(state.totals.lost),
      spent: round2(state.totals.spent),
    },
    session: {
      spins: state.session.spins,
      minutes: Math.max(0, Math.round((state.plannedUntil - state.session.startedAt) / 60000)),
      net: round2(state.session.net),
    },
    recent: state.recent,
    recentPurchases: state.recentPurchases,
    situation,
    startingBalance: state.startingBalance,
  };
}

export function isBrokeState(state) {
  return state.balance < MINIMUM_BET;
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

/**
 * Every event carries the running totals and the balance as of that moment, so
 * a page can join at any point and render correctly from the first event it
 * sees without a second request.
 */
export function snapshot(state) {
  const life = lifetime(state);
  return {
    // started + won - lost + added - spent always equals balance, which is what
    // the page displays, so the numbers reconcile on screen instead of looking
    // like four unrelated figures.
    started: round2(state.startingBalance),
    balance: round2(state.balance),
    won: round2(state.totals.won),
    lost: round2(state.totals.lost),
    added: round2(state.totals.added),
    spent: round2(state.totals.spent),

    mode: state.mode,
    spinCount: state.spinCount,
    run: state.run ?? 1,

    allTime: {
      won: round2(life.won),
      lost: round2(life.lost),
      added: round2(life.added),
      spent: round2(life.spent),
      spins: life.spins,
    },
  };
}

export function makeEvent(state, at, type, payload) {
  state.eventSeq += 1;
  return { id: `${state.startedAt}-${state.eventSeq}`, t: at, type, ...payload, hud: snapshot(state) };
}

export async function loadTimeline() {
  return (await readJSON(KEYS.timeline)) ?? { events: [], plannedUntil: 0, generatedAt: 0 };
}

/** Append, then drop anything older than the replay window. */
export async function pushEvents(events, plannedUntil) {
  const timeline = await loadTimeline();
  const cutoff = Date.now() - TIMELINE_WINDOW_MS;
  const merged = [...timeline.events, ...events]
    .filter((e) => e.t >= cutoff)
    .sort((a, b) => a.t - b.t);

  return writeJSON(KEYS.timeline, {
    events: merged,
    plannedUntil,
    generatedAt: Date.now(),
  });
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export function applySpin(state, spin) {
  state.balance = round2(state.balance - spin.bet + spin.payout);
  state.totals.lost = round2(state.totals.lost + spin.bet);
  state.totals.won = round2(state.totals.won + spin.payout);

  const life = lifetime(state);
  life.lost = round2(life.lost + spin.bet);
  life.won = round2(life.won + spin.payout);
  life.staked = round2(life.staked + spin.bet);
  life.spins += 1;

  state.spinCount += 1;
  state.session.spins += 1;
  state.session.net = round2(state.session.net + spin.net);
  state.lastBet = spin.bet;
  state.lossStreak = spin.payout > 0 ? 0 : state.lossStreak + 1;

  state.recent.push({
    bet: spin.bet,
    payout: spin.payout,
    winName: spin.winName,
    // Kept so the next turn can tell a near miss from an ordinary loss.
    symbols: spin.symbols,
  });
  if (state.recent.length > 10) state.recent.shift();
}

function lifetime(state) {
  if (!state.lifetime) {
    state.lifetime = { won: 0, lost: 0, added: 0, spent: 0, spins: 0, staked: 0 };
  }
  return state.lifetime;
}

export function applyPurchase(state, item, at = Date.now()) {
  state.balance = round2(state.balance - item.price);
  state.totals.spent = round2(state.totals.spent + item.price);
  lifetime(state).spent = round2(lifetime(state).spent + item.price);
  state.purchaseCount += 1;
  state.lastPurchaseAt = at;
  state.recentPurchases.push({ name: item.name, price: item.price });
  // A trip is one purchase now, so this list runs across trips rather than
  // within one, and it is what stops Jev buying the same thing again the next
  // time Jev gets up from the machine. The newest five, and Jev only ever sees
  // them in the shop, where they are the one thing the menu does not say.
  if (state.recentPurchases.length > 5) state.recentPurchases.shift();
}

/** Topping the bankroll up from the command line. */
export function applyTopUp(state, amount) {
  state.balance = round2(state.balance + amount);
  state.totals.added = round2(state.totals.added + amount);
  lifetime(state).added = round2(lifetime(state).added + amount);
}

export function enterMode(state, mode, at) {
  state.mode = mode;
  state.modeSince = at;
  if (mode === MODES.GAMBLING) {
    state.session = { startedAt: at, spins: 0, net: 0 };
    state.lossStreak = 0;
  }
}
