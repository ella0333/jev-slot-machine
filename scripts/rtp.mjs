/**
 * Exact return to player for the machine in lib/machine.mjs.
 *
 * This is not a simulation. It walks every one of the 32^3 stop combinations
 * once, so the numbers it prints are the true long-run figures for the strips
 * and paytable as written. Run it after touching either.
 *
 *   node scripts/rtp.mjs
 */

import { STRIPS, PAYTABLE, evaluate, REEL_STOPS } from '../lib/machine.mjs';

const total = STRIPS.reduce((acc, strip) => acc * strip.length, 1);

const byRow = new Map(PAYTABLE.map((row) => [row.name, { row, hits: 0 }]));
let returned = 0;
let hits = 0;

for (const a of STRIPS[0]) {
  for (const b of STRIPS[1]) {
    for (const c of STRIPS[2]) {
      const win = evaluate([a, b, c]);
      if (!win) continue;
      hits += 1;
      returned += win.pays;
      byRow.get(win.name).hits += 1;
    }
  }
}

const rtp = returned / total;
const hitFrequency = hits / total;

const pct = (n) => `${(n * 100).toFixed(2)}%`;

console.log(`Reel stops        ${REEL_STOPS} per reel`);
console.log(`Combinations      ${total.toLocaleString('en-US')}`);
console.log('');
console.log(`RTP               ${pct(rtp)}`);
console.log(`House edge        ${pct(1 - rtp)}`);
console.log(`Hit frequency     ${pct(hitFrequency)}  (1 in ${(1 / hitFrequency).toFixed(1)} spins)`);
console.log('');
console.log('Contribution by combination');
console.log('  pays    hits         odds   of RTP   name');

const rows = [...byRow.values()].sort((x, y) => y.row.pays - x.row.pays);
for (const { row, hits: n } of rows) {
  const odds = n === 0 ? 'never' : `1 in ${Math.round(total / n).toLocaleString('en-US')}`;
  const share = n === 0 ? 0 : (n * row.pays) / total / rtp;
  console.log(
    `  ${String(row.pays).padStart(4)}x` +
      `${String(n).padStart(8)}` +
      `${odds.padStart(13)}` +
      `${pct(share).padStart(9)}   ${row.name}`,
  );
}

console.log('');
if (rtp < 0.88 || rtp > 0.96) {
  console.log('OUT OF RANGE. A real Vegas slot sits between 88% and 96%. Retune the strips.');
  process.exitCode = 1;
} else {
  console.log('In range for a real Vegas slot (88% to 96%).');
}
