/**
 * Everything Jev appears to say.
 *
 * Jev cannot write. From the model jaggedness page: "jev-1.13 is not trained to
 * generate text... If you really need to generate text, there are other models
 * for that." So none of this is generated. These are written lines, and Jev
 * picks one with a Choice question over a pool that code has already narrowed
 * to the moment Jev is in.
 *
 * A model that only chooses is a character that can only ever pick from what
 * is in front of it.
 */

/** Lines for the slot machine, keyed by the situation code decides Jev is in. */
export const MUTTERS = {
  jackpot: [
    'That is not real. Look at it again.',
    'I need someone to come over here and confirm this.',
    'Nobody move.',
    'I was one spin from walking out.',
  ],
  big_win: [
    'There it is. That is what I was waiting for.',
    'See, this one is warm. This is the one.',
    'I should take this and go. I should.',
    'Okay. Okay. Now we are talking.',
  ],
  small_win: [
    'Fine. That is something.',
    'That barely covers the last three.',
    'Back where I was ten minutes ago.',
    'It is giving a little back. It always does.',
  ],
  near_miss: [
    'Two of them. Two.',
    'It was right there. It stopped right there.',
    'One position. One.',
    'That machine knows exactly what it is doing.',
  ],
  loss: [
    'One more.',
    'It is due.',
    'That is fine. That is normal.',
    'I am not even down that much.',
    'Just running cold. It turns.',
  ],
  losing_streak: [
    'This machine is done. I should move.',
    'I am not moving, though.',
    'How long have I been sitting here?',
    'That is a lot of spins with nothing.',
    'I have seen it do this before and then pay.',
  ],
  down_big: [
    'I need one good one to get level.',
    'I do not want to think about the number.',
    'I had more than this when I sat down. A lot more.',
    'If I get back to even I walk. That is the deal.',
  ],
  up_big: [
    'I am up. I am genuinely up.',
    'The smart thing is to stop. Obviously.',
    'A little more and this trip pays for itself twice.',
    'This is house money now. Sort of.',
  ],
  up: [
    'I am ahead. Keep it that way.',
    'A bit more and I can call it a night on a high.',
    'This is the part where people get greedy.',
    'I could stop here and nobody would blame me.',
    'Slow and steady. That is the plan.',
  ],
  even: [
    'Right about where I started.',
    'All that and I have gone nowhere.',
    'Nothing has really happened yet.',
    'Still here. Still level.',
    'One good one and I am properly ahead.',
  ],
  nearly_broke: [
    'That is most of it gone.',
    'I can do a few more at the minimum.',
    'I am not calling anybody.',
    'How did it get to this quickly.',
  ],
};

/** Shown on the shop screen the instant before Jev commits to something. */
export const SHOP_LINES = {
  sensible: [
    'This one I can justify.',
    'That is the responsible move, and I am making it.',
    'Somebody would tell me to do exactly this.',
  ],
  neutral: [
    'I am in Vegas. This is what you do in Vegas.',
    'Might as well.',
    'It is not the worst thing I have done tonight.',
  ],
  poor: [
    'I have earned this. I have definitely earned this.',
    'It is only money. There is more of it in the slot machine.',
    'Do not do the maths on this one.',
    'I will win it back in twenty minutes.',
  ],
};

/** The last thing said, when the bankroll will not cover another spin. */
export const BUST_LINES = [
  'That was the last of it.',
  'I cannot cover a spin. That is the end of that.',
  'I am a model that makes choices and I have run out of choices.',
  'There is no amount of deciding that fixes zero dollars.',
];

/**
 * Which pool of lines fits the moment.
 *
 * `spin` is the spin that just finished, so the line is a reaction to
 * something that actually happened.
 */
export function situationFor({ spin, balance, startingBalance, lossStreak }) {
  // What just happened takes priority over how the night is going overall.
  if (spin?.isJackpot) return 'jackpot';
  if (spin && spin.multiplier >= 25) return 'big_win';
  if (spin && spin.payout > 0) return 'small_win';
  if (spin && isNearMiss(spin.symbols)) return 'near_miss';

  // Otherwise the standing position. Down is checked against the bankroll Jev
  // actually started with, so "down" never means "up".
  if (balance < startingBalance * 0.1) return 'nearly_broke';
  if (balance > startingBalance * 1.6) return 'up_big';
  if (balance > startingBalance * 1.05) return 'up';
  if (lossStreak >= 8) return 'losing_streak';
  if (balance < startingBalance * 0.4) return 'down_big';
  if (balance < startingBalance * 0.95) return 'loss';
  return 'even';
}

/** Two of the top symbols and a third that missed. The machine's best trick. */
function isNearMiss(symbols) {
  if (!symbols) return false;
  const top = ['DIAMOND', 'SEVEN', 'BAR3'];
  for (const symbol of top) {
    const count = symbols.filter((s) => s === symbol).length;
    if (count === 2) return true;
  }
  return false;
}

/** Criteria map for a Choice over a pool of lines. */
export function lineCriteria(lines) {
  const criteria = {};
  for (const line of lines) criteria[line] = null;
  return criteria;
}

export function pick(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}
