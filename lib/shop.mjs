/**
 * Things to buy in Las Vegas.
 *
 * Two rules hold the whole thing together:
 *
 * 1. Nothing here gets Jev out of Vegas. No flights, no bus tickets, no rental
 *    car, no taxi to anywhere with an exit. Jev can buy a mansion here. Jev
 *    cannot buy a way home. That is the premise and the catalog enforces it.
 *
 * 2. Jev is only ever offered what Jev can actually afford. At $40 the menu is
 *    water and a hot dog. After a jackpot it is a Summerlin mansion. The menu
 *    rebuilds itself from the bankroll every single time.
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
  { name: 'Safe deposit box for the rest of the cash', price: 150, sense: 'sensible', kind: 'money' },
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
  { name: 'Paying back the guy at the bar', price: 3000, sense: 'sensible', kind: 'money' },
  { name: 'Cabana and bottle service for the table', price: 4200, sense: 'poor', kind: 'vice' },
  { name: 'A month of rent, wired home', price: 5500, sense: 'sensible', kind: 'money' },
  { name: 'Ringside seats at the fight', price: 8500, sense: 'poor', kind: 'fun' },

  // $10k to $250k: the winning phase, which never lasts
  { name: 'Used sedan from a lot on Boulder Highway', price: 14000, sense: 'sensible', kind: 'ride' },
  { name: 'Private poker game buy-in', price: 25000, sense: 'poor', kind: 'vice' },
  { name: 'Index fund, opened from the casino floor', price: 50000, sense: 'sensible', kind: 'money' },
  { name: 'Boat Jev will never take out of the dry dock', price: 95000, sense: 'poor', kind: 'luxury' },
  { name: 'Corvette, bought at 4am', price: 120000, sense: 'poor', kind: 'ride' },
  { name: 'Paying off somebody else’s medical bills', price: 180000, sense: 'sensible', kind: 'money' },

  // $250k and up: jackpot territory
  { name: 'Condo off the Strip', price: 420000, sense: 'sensible', kind: 'stay' },
  { name: 'A very large diamond', price: 750000, sense: 'poor', kind: 'luxury' },
  { name: 'Summerlin mansion with a pool nobody swims in', price: 2400000, sense: 'neutral', kind: 'stay' },
  { name: 'Bugatti, delivered to the valet', price: 3900000, sense: 'poor', kind: 'ride' },
  { name: 'Minority stake in the casino itself', price: 12000000, sense: 'neutral', kind: 'vice' },
  { name: 'A charitable foundation, set up in one name', price: 25000000, sense: 'sensible', kind: 'money' },
];

const MENU_SIZE = 8;

/**
 * Build the menu Jev sees: affordable only, randomized, and spread across the
 * price range so there is always something cheap and something ruinous rather
 * than eight variations on a drink.
 */
export function buildMenu(balance, rng = Math.random) {
  const affordable = CATALOG.filter((item) => item.price <= balance);
  if (affordable.length === 0) return [];
  if (affordable.length <= MENU_SIZE) return shuffle(affordable, rng);

  // Split the affordable range into buckets by price and take from each, so the
  // menu always spans cheap to expensive.
  const sorted = [...affordable].sort((a, b) => a.price - b.price);
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
