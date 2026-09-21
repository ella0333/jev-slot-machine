/**
 * The slot machine front end.
 *
 * The server plans Jev's night a minute ahead and writes events stamped with
 * when they should be seen. This fetches that window every half minute and
 * plays each event at its own moment, so the page animates continuously while
 * barely touching the network.
 */

const POLL_MS = 15_000;
const SPIN_MS = 2000;
const REEL_STAGGER_MS = 240;
const TILE = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile'));

/* Must match lib/machine.mjs exactly. */
const STRIPS = [
  ['DIAMOND','BLANK','CHERRY','BAR1','BLANK','BAR2','CHERRY','BAR1','BLANK','SEVEN','BAR1','BLANK','CHERRY','BAR2','BAR1','BLANK','BAR3','CHERRY','BLANK','BAR1','BAR2','BLANK','SEVEN','BAR1','BLANK','BAR2','BLANK','BAR3','BLANK','BLANK','BLANK','BLANK'],
  ['DIAMOND','BLANK','BAR1','CHERRY','BLANK','BAR2','BLANK','BAR1','SEVEN','BLANK','CHERRY','BAR1','BLANK','BAR3','BAR2','BLANK','BAR1','CHERRY','BLANK','SEVEN','BAR1','BLANK','BAR2','CHERRY','BLANK','BAR3','BLANK','BAR1','BLANK','BAR2','BLANK','BLANK'],
  ['DIAMOND','BLANK','BAR1','BLANK','CHERRY','BLANK','BAR2','BLANK','BAR1','BLANK','BAR3','BLANK','BAR1','CHERRY','BLANK','SEVEN','BLANK','BAR2','BLANK','BAR1','BLANK','BAR3','BLANK','BAR1','CHERRY','BLANK','BAR2','BLANK','BAR1','BLANK','BAR2','BLANK'],
];
const STOPS = STRIPS[0].length;
const REPEATS = 3;

const $ = (id) => document.getElementById(id);
const usd = (n) =>
  Number(n ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 10000 ? 0 : 2 });
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (ms) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ---------------- reels ---------------- */

const reels = [0, 1, 2].map((i) => {
  const strip = $(`reel-${i}`).querySelector('.reel-strip');
  strip.innerHTML = Array.from({ length: STOPS * REPEATS }, (_, n) => {
    const symbol = STRIPS[i][n % STOPS];
    return `<div class="reel-cell" data-symbol="${symbol}">${
      symbol === 'BLANK' ? '' : `<svg><use href="#sym-${symbol}"/></svg>`
    }</div>`;
  }).join('');
  return { el: strip, position: 0 };
});

function setReel(reel, stop) {
  reel.el.style.transition = 'none';
  reel.position = stop;
  reel.el.style.transform = `translate3d(0, ${-stop * TILE()}px, 0)`;
  void reel.el.offsetHeight;
}

function spinReel(reel, stop, durationMs) {
  if (reduceMotion) return setReel(reel, stop);

  const from = reel.position % STOPS;
  const target = from + STOPS + ((stop - from + STOPS) % STOPS);

  reel.el.style.transition = `transform ${durationMs}ms cubic-bezier(0.2, 0.85, 0.25, 1.02)`;
  reel.el.style.transform = `translate3d(0, ${-target * TILE()}px, 0)`;
  reel.position = target;

  // Snap back into the first repetition once it lands, so the strip never
  // runs off the end of the DOM.
  setTimeout(() => setReel(reel, stop), durationMs + 40);
}

function markHits(symbols, payout) {
  for (const reel of reels) {
    for (const cell of reel.el.children) cell.classList.remove('hit');
  }
  if (payout <= 0) return;
  reels.forEach((reel, i) => {
    const cell = reel.el.children[reel.position % STOPS];
    if (cell && cell.dataset.symbol === symbols[i]) cell.classList.add('hit');
  });
}

/** The handle drops, then rides back up. Something is visibly pressed. */
function pullHandle() {
  if (reduceMotion) return;
  const handle = $('handle');
  handle.classList.add('pull');
  setTimeout(() => handle.classList.remove('pull'), 320);
}

/* ---------------- celebration ---------------- */

const shell = $('reels-shell');
const banner = $('win-banner');
let bannerTimer;

function celebrate({ payout, multiplier, isJackpot, winName }) {
  shell.classList.remove('win-small', 'win-big', 'win-jackpot');
  banner.classList.remove('show', 'jackpot');
  $('payline').classList.toggle('hot', payout > 0);
  if (payout <= 0) return;

  void shell.offsetWidth;

  // Escalate on multiple of the stake, not raw dollars, so a win reads the
  // same at a quarter a spin as at five hundred.
  if (isJackpot) {
    shell.classList.add('win-jackpot');
    showBanner('JACKPOT', payout, true);
    rainCoins(80, 4200);
  } else if (multiplier >= 50) {
    shell.classList.add('win-big');
    showBanner(winName ? winName.toUpperCase() : 'BIG WIN', payout, false);
    rainCoins(40, 2600);
  } else if (multiplier >= 15) {
    shell.classList.add('win-big');
    showBanner('WIN', payout, false);
    rainCoins(18, 1800);
  } else {
    shell.classList.add('win-small');
  }
}

function showBanner(label, amount, jackpot) {
  $('win-label').textContent = label;
  $('win-amount').textContent = usd(amount);
  banner.classList.add('show');
  if (jackpot) banner.classList.add('jackpot');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.remove('show', 'jackpot'), jackpot ? 5500 : 2400);
}

function rainCoins(count, lifetimeMs) {
  if (reduceMotion) return;
  const box = $('coins');
  for (let i = 0; i < Math.min(count, 80); i += 1) {
    const coin = document.createElement('i');
    coin.className = 'coin';
    coin.style.left = `${Math.random() * 100}%`;
    coin.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
    coin.style.animationDelay = `${Math.random() * 0.8}s`;
    const size = 10 + Math.random() * 12;
    coin.style.width = coin.style.height = `${size}px`;
    box.appendChild(coin);
  }
  setTimeout(() => { box.innerHTML = ''; }, lifetimeMs);
}

/* ---------------- money ---------------- */

function renderMoney(hud) {
  if (!hud) return;

  $('m-started').textContent = usd(hud.started);
  $('m-won').textContent = `+${usd(hud.won)}`;
  $('m-lost').textContent = `-${usd(hud.lost)}`;
  $('m-added').textContent = `+${usd(hud.added)}`;
  $('m-spent').textContent = `-${usd(hud.spent)}`;
  $('m-left').textContent = usd(hud.balance);

  // started + won - lost + added - spent = remaining. The row is laid out in
  // that order so it reads as the sum it is, and the total sits under it.

  const all = hud.allTime;
  if (all && all.spins > hud.spinCount) {
    $('m-alltime').textContent =
      `All time across ${hud.run} runs: ${all.spins.toLocaleString('en-US')} spins, ` +
      `${usd(all.won)} won, ${usd(all.lost)} lost, ${usd(all.spent)} spent.`;
  }

  $('r-spin').textContent = Number(hud.spinCount).toLocaleString('en-US');
  setMode(hud.mode);
}

/* ---------------- status ---------------- */

const STATUS = {
  gambling: ['Jev is at the slot machine', 'playing'],
  shopping: ['Jev has left the slot machine', 'spending money in the city'],
  bust: ['Jev is out of money', 'the run is over'],
};

function setMode(mode) {
  const [text, sub] = STATUS[mode] ?? STATUS.gambling;
  $('status').dataset.mode = mode;
  $('status-text').textContent = text;
  $('status-sub').textContent = sub;
  $('panel-shop').hidden = mode !== 'shopping';
  $('panel-bust').hidden = mode !== 'bust';
}

function say(text, note) {
  if (!text) return;
  const p = $('jev-text');
  p.style.opacity = '0';
  setTimeout(() => {
    p.innerHTML = note
      ? `${escapeHtml(text)}<small>${escapeHtml(note)}</small>`
      : escapeHtml(text);
    p.style.opacity = '1';
  }, reduceMotion ? 0 : 200);
}

/* ---------------- playing an event ---------------- */

function play(event) {
  switch (event.type) {
    case 'spin': {
      $('r-bet').textContent = usd(event.bet);
      pullHandle();

      event.stops.forEach((stop, i) => {
        setTimeout(() => spinReel(reels[i], stop, SPIN_MS + i * REEL_STAGGER_MS), 150 + i * 80);
      });

      const settle = 150 + SPIN_MS + 2 * REEL_STAGGER_MS + 120;
      setTimeout(() => {
        const win = $('r-win');
        win.textContent = event.payout > 0 ? usd(event.payout) : 'nothing';
        win.className = event.payout > 0 ? 'win' : '';
        markHits(event.symbols, event.payout);
        celebrate(event);
        renderMoney(event.hud);
        if (event.line) say(event.line, event.winName);
      }, reduceMotion ? 0 : settle);
      break;
    }

    case 'leave_machine':
      renderMoney(event.hud);
      say(event.line ?? 'Jev gets up.', 'Jev is going to spend some of it');
      break;

    case 'purchase':
      renderMoney(event.hud);
      say(event.line, `Bought ${event.name} for ${usd(event.price)}`);
      addPurchase(event);
      loadBought();
      break;

    case 'bust':
      renderMoney(event.hud);
      $('bust-line').textContent = event.line;
      say(event.line, `${Number(event.spins).toLocaleString('en-US')} spins`);
      break;

    case 'topup':
      renderMoney(event.hud);
      say(`${usd(event.amount)} added from the command line.`, event.resumed ? 'Back in' : null);
      rainCoins(24, 2000);
      break;

    case 'mode':
      renderMoney(event.hud);
      break;
  }
}

function addPurchase(event) {
  const feed = $('shop-feed');
  const row = document.createElement('div');
  row.className = 'buy';
  row.innerHTML =
    `<span class="thumb">${iconFor(event.kind)}</span>` +
    `<span class="name">${escapeHtml(event.name)}</span>` +
    `<span class="price">${usd(event.price)}</span>`;
  feed.prepend(row);
  while (feed.children.length > 6) feed.lastChild.remove();
}

const KIND_ICONS = {
  drink: '<svg class="i" viewBox="0 0 24 24"><path d="M5 3h14l-7 9v8"/><path d="M8 20h8"/></svg>',
  food: '<svg class="i" viewBox="0 0 24 24"><path d="M4 3v8a3 3 0 0 0 6 0V3"/><path d="M7 11v10"/><path d="M17 3c-2 0-3 3-3 6s1 4 3 4v8"/></svg>',
  stay: '<svg class="i" viewBox="0 0 24 24"><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-7h6v7"/></svg>',
  ride: '<svg class="i" viewBox="0 0 24 24"><path d="M5 17h14M6 17v2M18 17v2"/><path d="M4 17v-4l2-5h12l2 5v4"/><circle cx="8" cy="13" r="1"/><circle cx="16" cy="13" r="1"/></svg>',
  luxury: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3 20 9l-8 12L4 9z"/><path d="M4 9h16M9 9l3 12M15 9l-3 12"/></svg>',
  money: '<svg class="i" viewBox="0 0 24 24"><path d="M12 2v20"/><path d="M17 6.5A4 4 0 0 0 13 4h-2a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-2a4 4 0 0 1-4-2.5"/></svg>',
  fun: '<svg class="i" viewBox="0 0 24 24"><path d="M4 6h16v11H4z"/><path d="M4 6l8 6 8-6M9 21h6"/></svg>',
  care: '<svg class="i" viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5c0 5-7 9.5-7 9.5z"/></svg>',
  vice: '<svg class="i" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="12" cy="12" r="1"/></svg>',
  kit: '<svg class="i" viewBox="0 0 24 24"><path d="M3 8h18v12H3z"/><path d="M9 8V5h6v3"/></svg>',
};
const iconFor = (kind) => KIND_ICONS[kind] ?? KIND_ICONS.kit;

/* ---------------- the purchase log ---------------- */

async function loadBought() {
  try {
    const data = await (await fetch('/api/ledger', { cache: 'no-store' })).json();
    if (!data.purchases?.length) return;
    $('panel-bought').hidden = false;
    $('bought-list').innerHTML = data.purchases.slice(0, 40).map((x) => `
      <div class="buy">
        <span class="thumb">${iconFor(x.kind)}</span>
        <span class="name">${escapeHtml(x.name)}<span class="when">${when(x.at)} &middot; left ${usd(x.balanceAfter)}</span></span>
        <span class="price">${usd(x.price)}</span>
      </div>`).join('');
  } catch {
    // The page keeps working without the log.
  }
}

/* ---------------- the clock ---------------- */

const queue = [];
const seen = new Set();
let lastEventTime = 0;
let clockSkew = 0;
let primed = false;

async function poll() {
  try {
    const response = await fetch(`/api/timeline?since=${lastEventTime}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();

    clockSkew = data.now - Date.now();

    for (const event of data.events) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      lastEventTime = Math.max(lastEventTime, event.t);
      queue.push(event);
    }
    queue.sort((a, b) => a.t - b.t);

    // Joining mid stream: show the current state at once rather than sitting
    // at zero until the next event fires.
    if (!primed && data.events.length) {
      const past = data.events.filter((e) => e.t <= Date.now() + clockSkew);
      if (past.length) renderMoney(past[past.length - 1].hud);
      primed = true;
    }
  } catch {
    // The next poll is a few seconds away. Not worth surfacing.
  }
}

function drain() {
  const serverNow = Date.now() + clockSkew;
  while (queue.length && queue[0].t <= serverNow) {
    const event = queue.shift();
    // A backgrounded tab must not replay a minute of spins at once.
    if (serverNow - event.t > 8000) renderMoney(event.hud);
    else play(event);
  }
  requestAnimationFrame(drain);
}

reels.forEach((reel) => setReel(reel, 0));
await poll();
await loadBought();
setInterval(poll, POLL_MS);
requestAnimationFrame(drain);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
