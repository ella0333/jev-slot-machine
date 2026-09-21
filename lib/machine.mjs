/**
 * The machine Jev is stuck at.
 *
 * Three reels, one payline, weighted virtual strips. This is how real
 * electromechanical-style slots work: each physical reel shows a handful of
 * symbols, but the RNG picks from a longer virtual strip where the good symbols
 * appear once and the blanks appear many times. That is where the house edge
 * lives, not in the paytable.
 *
 * Every number here is exact and enumerable. `npm run rtp` walks all
 * 32 x 32 x 32 = 32768 stop combinations and reports the true return to player.
 * Nothing about the payout is simulated or estimated.
 */

export const MACHINE_NAME = 'Triple Diamond Deluxe';

/** Symbols in payout order, weakest first. */
export const SYMBOLS = {
  BLANK: { id: 'BLANK', label: '', icon: 'blank' },
  CHERRY: { id: 'CHERRY', label: 'Cherry', icon: 'cherry' },
  BAR1: { id: 'BAR1', label: 'BAR', icon: 'bar1' },
  BAR2: { id: 'BAR2', label: 'BAR BAR', icon: 'bar2' },
  BAR3: { id: 'BAR3', label: 'BAR BAR BAR', icon: 'bar3' },
  SEVEN: { id: 'SEVEN', label: 'Red Seven', icon: 'seven' },
  DIAMOND: { id: 'DIAMOND', label: 'Triple Diamond', icon: 'diamond' },
};

/**
 * The three virtual reel strips, 32 stops each.
 *
 * Reel 3 is deliberately the stingiest on DIAMOND and SEVEN. That is the
 * classic near-miss construction: two jackpot symbols land often, the third
 * almost never. It is the single most important reason slot machines feel like
 * they are about to pay.
 */
export const STRIPS = [
  // Reel 1: 1 diamond, 2 sevens, 2 triple bars, 4 double bars, 6 single bars,
  // 4 cherries, 13 blanks.
  [
    'DIAMOND', 'BLANK', 'CHERRY', 'BAR1', 'BLANK', 'BAR2', 'CHERRY', 'BAR1',
    'BLANK', 'SEVEN', 'BAR1', 'BLANK', 'CHERRY', 'BAR2', 'BAR1', 'BLANK',
    'BAR3', 'CHERRY', 'BLANK', 'BAR1', 'BAR2', 'BLANK', 'SEVEN', 'BAR1',
    'BLANK', 'BAR2', 'BLANK', 'BAR3', 'BLANK', 'BLANK', 'BLANK', 'BLANK',
  ],
  // Reel 2: same census, different order, so the reels never march in step.
  [
    'DIAMOND', 'BLANK', 'BAR1', 'CHERRY', 'BLANK', 'BAR2', 'BLANK', 'BAR1',
    'SEVEN', 'BLANK', 'CHERRY', 'BAR1', 'BLANK', 'BAR3', 'BAR2', 'BLANK',
    'BAR1', 'CHERRY', 'BLANK', 'SEVEN', 'BAR1', 'BLANK', 'BAR2', 'CHERRY',
    'BLANK', 'BAR3', 'BLANK', 'BAR1', 'BLANK', 'BAR2', 'BLANK', 'BLANK',
  ],
  // Reel 3, the one that breaks your heart: one seven instead of two, three
  // cherries instead of four, and fifteen blanks. Two jackpot symbols land
  // together often. The third almost never does. That near miss is the whole
  // machine.
  [
    'DIAMOND', 'BLANK', 'BAR1', 'BLANK', 'CHERRY', 'BLANK', 'BAR2', 'BLANK',
    'BAR1', 'BLANK', 'BAR3', 'BLANK', 'BAR1', 'CHERRY', 'BLANK', 'SEVEN',
    'BLANK', 'BAR2', 'BLANK', 'BAR1', 'BLANK', 'BAR3', 'BLANK', 'BAR1',
    'CHERRY', 'BLANK', 'BAR2', 'BLANK', 'BAR1', 'BLANK', 'BAR2', 'BLANK',
  ],
];

export const REEL_STOPS = STRIPS[0].length;

/**
 * Paytable, in multiples of the bet, checked top down. First match wins.
 *
 * `match` is a triple of symbol ids; `ANY_BAR` matches BAR1, BAR2 or BAR3, and
 * `ANY` matches anything at all. The cherry rules are the traditional ones: a
 * single cherry anywhere pays back a fraction of the bet, which is what keeps a
 * player feeding the machine without ever getting ahead.
 */
export const PAYTABLE = [
  { match: ['DIAMOND', 'DIAMOND', 'DIAMOND'], pays: 1199, name: 'Triple Diamond jackpot' },
  { match: ['SEVEN', 'SEVEN', 'SEVEN'], pays: 200, name: 'Three red sevens' },
  { match: ['BAR3', 'BAR3', 'BAR3'], pays: 100, name: 'Triple triple bar' },
  { match: ['BAR2', 'BAR2', 'BAR2'], pays: 50, name: 'Triple double bar' },
  { match: ['CHERRY', 'CHERRY', 'CHERRY'], pays: 45, name: 'Three cherries' },
  { match: ['BAR1', 'BAR1', 'BAR1'], pays: 25, name: 'Triple single bar' },
  { match: ['ANY_BAR', 'ANY_BAR', 'ANY_BAR'], pays: 5, name: 'Any three bars' },
  { match: ['CHERRY', 'CHERRY', 'ANY'], pays: 5, name: 'Two cherries' },
  { match: ['CHERRY', 'ANY', 'ANY'], pays: 2, name: 'One cherry' },
];

const BARS = new Set(['BAR1', 'BAR2', 'BAR3']);

function matchesSlot(pattern, symbol) {
  if (pattern === 'ANY') return true;
  if (pattern === 'ANY_BAR') return BARS.has(symbol);
  return pattern === symbol;
}

/** Returns the winning paytable row for a symbol triple, or null. */
export function evaluate(symbols) {
  for (const row of PAYTABLE) {
    if (row.match.every((pattern, i) => matchesSlot(pattern, symbols[i]))) {
      return row;
    }
  }
  return null;
}

/**
 * Bet denominations Jev can put in, from a quarter machine up to the high
 * limit room. Real machines offer a fixed ladder rather than arbitrary
 * amounts, and $5,000 a spin is about where the highest limit machines in
 * Vegas actually stop.
 *
 * The ladder deliberately does not climb past that even if Jev is sitting on
 * millions, because no real machine would take it. A bankroll that outgrows
 * the machine has somewhere else to go: the shop scales all the way up to
 * property, so a rich Jev spends rather than betting amounts no casino
 * accepts.
 */
export const DENOMINATIONS = [
  0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000,
];

/** Fraction of the bankroll the top rung is allowed to reach. */
export const MAX_BET_FRACTION = 0.1;

/**
 * The five rungs offered at a given bankroll, cheapest first.
 *
 * As Jev wins the ladder climbs, so a jackpot at the top of the ladder is worth
 * a genuinely absurd amount. As he loses it collapses back toward the quarter
 * machine. The top rung never exceeds 10% of what he has, because no real
 * machine lets you liquidate yourself in ten spins.
 */
export function betLadder(balance) {
  const ceiling = balance * MAX_BET_FRACTION;
  const affordable = DENOMINATIONS.filter((d) => d <= ceiling && d <= balance);

  // Nearly broke: offer whatever single rung he can still cover.
  if (affordable.length === 0) {
    const lowest = DENOMINATIONS.filter((d) => d <= balance);
    return lowest.length ? [lowest[lowest.length - 1]] : [];
  }

  return affordable.slice(-5);
}

export const MINIMUM_BET = DENOMINATIONS[0];

/** True when Jev cannot cover even a single spin. This is what ends the run. */
export function isBroke(balance) {
  return balance < MINIMUM_BET;
}

/**
 * Spin. `rng` returns a float in [0, 1); injected so tests are reproducible.
 */
export function spin(bet, rng = Math.random) {
  const stops = STRIPS.map((strip) => Math.floor(rng() * strip.length));
  const symbols = stops.map((stop, i) => STRIPS[i][stop]);
  const win = evaluate(symbols);
  const payout = win ? round2(bet * win.pays) : 0;

  return {
    stops,
    symbols,
    bet: round2(bet),
    payout,
    multiplier: win ? win.pays : 0,
    winName: win ? win.name : null,
    net: round2(payout - bet),
    isJackpot: win ? win.pays >= 1199 : false,
  };
}

/** Money is stored in dollars, so every arithmetic result gets pinned to cents. */
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatUsd(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
