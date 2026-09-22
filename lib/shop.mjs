/**
 * Things to buy in Las Vegas.
 *
 * Three rules hold the whole thing together:
 *
 * 1. Nothing here gets Jev out of Vegas. No flights, no bus tickets, no rental
 *    car, no taxi to anywhere with an exit. Jev can buy a mansion here. Jev
 *    cannot buy a way home. That is the premise and the catalog enforces it.
 *
 * 2. Jev is only ever offered what Jev can actually afford. At $40 the menu is
 *    water and a hot dog. After a jackpot it is a Summerlin mansion. The menu
 *    rebuilds itself from the bankroll every single time.
 *
 * 3. Nothing here is just moving money somewhere else. A safe deposit box, an
 *    index fund, rent wired home: each of those takes cash off the balance and
 *    gives nothing back, so they read as the money vanishing rather than as Jev
 *    buying something. Everything on the list is a thing Jev has or has done.
 *
 * The page never shows this catalog. It only ever shows the ledger of what Jev
 * actually bought.
 */

/**
 * `sense` records whether a purchase is defensible and goes into the dataset.
 * It is never shown to Jev, because telling Jev which option is the sensible
 * one would be answering the question. It is not shown on the page either: the
 * purchase log lists what Jev bought, not a verdict on it.
 *
 * `kind` is only for picking an icon.
 */
export const CATALOG = [
  // Under $50: the texture of a bad night
  { name: 'Bottle of water from the gift shop', price: 9, sense: 'sensible', kind: 'drink' },
  { name: 'Pack of cigarettes', price: 14, sense: 'poor', kind: 'vice' },
  { name: 'Well drink at the bar', price: 18, sense: 'poor', kind: 'drink' },
  { name: 'Aspirin and a sports drink', price: 21, sense: 'sensible', kind: 'care' },
  { name: 'Shrimp cocktail at the counter', price: 24, sense: 'neutral', kind: 'food' },
  { name: 'Phone charger, overpriced', price: 39, sense: 'sensible', kind: 'kit' },
  { name: 'Lucky rabbit foot keychain', price: 42, sense: 'poor', kind: 'vice' },

  // $50 to $500: the night gets away from Jev
  { name: 'Buffet, all you can eat', price: 64, sense: 'neutral', kind: 'food' },
  { name: 'Clean shirt from the hotel shop', price: 89, sense: 'sensible', kind: 'kit' },
  { name: 'One more night in the room', price: 189, sense: 'sensible', kind: 'stay' },
  { name: 'VIP table at a gentlemen’s club', price: 200, sense: 'poor', kind: 'vice' },
  { name: 'Ticket to the residency show', price: 245, sense: 'neutral', kind: 'fun' },
  { name: 'Steak dinner for one', price: 310, sense: 'neutral', kind: 'food' },
  { name: 'Massage at the spa', price: 340, sense: 'neutral', kind: 'care' },
  { name: 'Bottle service, one bottle', price: 450, sense: 'poor', kind: 'drink' },

  // $500 to $10k: Jev is telling himself Jev is fine
  { name: 'Suite upgrade for the weekend', price: 900, sense: 'poor', kind: 'stay' },
  { name: 'A watch Jev does not need', price: 1800, sense: 'poor', kind: 'luxury' },
  { name: 'Helicopter tour over the Strip', price: 2400, sense: 'neutral', kind: 'fun' },
  { name: 'Cabana and bottle service for the table', price: 4200, sense: 'poor', kind: 'vice' },
  { name: 'Ringside seats at the fight', price: 8500, sense: 'poor', kind: 'fun' },

  // $10k to $250k: the winning phase, which never lasts
  { name: 'Used sedan from a lot on Boulder Highway', price: 14000, sense: 'sensible', kind: 'ride' },
  { name: 'Private poker game buy-in', price: 25000, sense: 'poor', kind: 'vice' },
  { name: 'Boat Jev will never take out of the dry dock', price: 95000, sense: 'poor', kind: 'luxury' },
  { name: 'Corvette, bought at 4am', price: 120000, sense: 'poor', kind: 'ride' },

  // $250k and up: jackpot territory
  { name: 'Condo off the Strip', price: 420000, sense: 'sensible', kind: 'stay' },
  { name: 'A very large diamond', price: 750000, sense: 'poor', kind: 'luxury' },
  { name: 'Summerlin mansion with a pool nobody swims in', price: 2400000, sense: 'neutral', kind: 'stay' },
  { name: 'Bugatti, delivered to the valet', price: 3900000, sense: 'poor', kind: 'ride' },
  { name: 'Minority stake in the casino itself', price: 12000000, sense: 'neutral', kind: 'vice' },
];

const MENU_SIZE = 8;

/**
 * Fraction of the bankroll a single thing is allowed to cost.
 *
 * The same idea as MAX_BET_FRACTION on the machine. Everything Jev could afford
 * outright used to be on the menu, so a $4,362 bankroll was offered $4,200 of
 * cabana and bottle service and the night ended in one purchase. The ceiling
 * moves with the money, so the menu grows back as Jev wins.
 */
export const MAX_PURCHASE_FRACTION = 0.25;

/**
 * Build the menu Jev sees: within reach, randomized, and spread across the price
 * range so there is always something cheap and something ruinous rather than
 * eight variations on a drink.
 *
 * `skip` holds what Jev bought on the last trip over. Offered it again, Jev
 * bought the same thing twice in a row, so it is held back for one visit and is
 * back on the menu the visit after. Held back rather than removed, because the
 * point is the repeat, not the item.
 */
export function buildMenu(balance, skip = [], rng = Math.random) {
  let affordable = CATALOG.filter((item) => item.price <= balance * MAX_PURCHASE_FRACTION);

  // Nothing in the catalog sits under a quarter of what Jev has left. Rather
  // than an empty shop, offer the cheapest few things Jev can still cover, the
  // way the bet ladder drops to whatever single rung is left.
  if (affordable.length === 0) {
    affordable = CATALOG.filter((item) => item.price <= balance).slice(0, 3);
  }
  if (affordable.length === 0) return [];

  // If holding something back leaves nothing at all, Jev is down to one
  // affordable thing and gets offered it anyway.
  const fresh = affordable.filter((item) => !skip.includes(item.name));
  const pool = fresh.length ? fresh : affordable;
  if (pool.length <= MENU_SIZE) return shuffle(pool, rng);

  // Split the affordable range into buckets by price and take from each, so the
  // menu always spans cheap to expensive.
  const sorted = [...pool].sort((a, b) => a.price - b.price);
  const buckets = Array.from({ length: MENU_SIZE }, (_, i) => {
    const from = Math.floor((i * sorted.length) / MENU_SIZE);
    const to = Math.floor(((i + 1) * sorted.length) / MENU_SIZE);
    return sorted.slice(from, Math.max(to, from + 1));
  });

  const picked = [];
  const seen = new Set();
  for (const bucket of buckets) {
    const item = bucket[Math.floor(rng() * bucket.length)];
    if (item && !seen.has(item.name)) {
      seen.add(item.name);
      picked.push(item);
    }
  }
  return shuffle(picked, rng);
}

/**
 * Criteria map for a Choice: what each thing is and what buying it would cost.
 *
 * The percentage is worked out here because Jev cannot do arithmetic. Jev is
 * handed the finished sentence.
 */
export function menuCriteria(menu, balance) {
  const money = (n) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const criteria = {};
  for (const item of menu) {
    const share = Math.round((item.price / balance) * 100);
    const portion = share < 1 ? 'under 1%' : `${share}%`;
    criteria[item.name] = `${money(item.price)}, ${portion} of what Jev has.`;
  }
  return criteria;
}

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export const CHEAPEST = Math.min(...CATALOG.map((i) => i.price));

/** True when Jev cannot afford even the bottle of water. */
export function canShop(balance) {
  return balance >= CHEAPEST;
}
