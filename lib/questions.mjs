/**
 * The questions put to Jev, and the state Jev sees when answering them.
 *
 * Three constraints from the TypeSafe docs shape every line in this file.
 *
 * 1. Jev cannot do arithmetic. "Jev is not a calculator. We strongly recommend
 *    implementing any mathematical logic in code." So no question ever asks Jev
 *    to compare, total, or divide anything. Code works out the dollar figures
 *    and the percentages, and hands Jev the finished sentence.
 *
 * 2. Jev reads literally. "jev-1.13 answers the question you wrote, not the one
 *    you meant." So an option says what it is and nothing else. Jev is not a
 *    language model and does not need to be narrated at.
 *
 * 3. Context rot is real. "Giving it more context in state than the question
 *    needs" costs accuracy. The state below is deliberately small and every
 *    field in it is something a question actually refers to.
 *
 * All questions for a turn go in one request. Per the fan-out pattern, the
 * model ingests the state once and answers everything in parallel, so a
 * question whose answer turns out not to matter costs almost nothing.
 */

import { choice, score } from './jev.mjs';
import { MACHINE_NAME, MINIMUM_BET, formatUsd } from './machine.mjs';
import { menuCriteria } from './shop.mjs';
import { MUTTERS, lineCriteria } from './lines.mjs';

const usd = (n) => formatUsd(n);

/** Percentage of the bankroll, worked out in code and written into the prose. */
function shareOf(amount, balance) {
  if (balance <= 0) return 'more than everything Jev has';
  const pct = (amount / balance) * 100;
  if (pct < 1) return 'well under 1% of what Jev has';
  if (pct >= 100) return 'everything Jev has';
  return `about ${Math.round(pct)}% of what Jev has`;
}

/**
 * The wallet block. Identical in every mode so Jev always knows the running
 * totals the page shows.
 */
function wallet(s) {
  return {
    cash_on_hand: usd(s.balance),
    total_won_from_the_machine: usd(s.totals.won),
    total_lost_to_the_machine: usd(s.totals.lost),
    total_spent_in_the_city: usd(s.totals.spent),
  };
}

const WHO_HE_IS =
  'Jev is in a casino in Las Vegas and cannot leave the city. When the money ' +
  'runs out, it is over.';

/* ------------------------------------------------------------------ */
/* Gambling                                                            */
/* ------------------------------------------------------------------ */

export function gamblingState(s, ladder) {
  return {
    situation: WHO_HE_IS,
    wallet: wallet(s),
    machine: {
      name: MACHINE_NAME,
      description: 'Three reels, one payline. Most spins pay nothing.',
      smallest_bet_allowed: usd(MINIMUM_BET),
      largest_bet_offered_right_now: usd(ladder[ladder.length - 1] ?? MINIMUM_BET),
      last_bet: s.lastBet ? usd(s.lastBet) : 'Jev has not bet yet',
    },
    this_session: {
      spins_played: s.session.spins,
      minutes_at_this_machine: s.session.minutes,
      result_so_far:
        s.session.net >= 0
          ? `up ${usd(s.session.net)} since Jev sat down`
          : `down ${usd(Math.abs(s.session.net))} since Jev sat down`,
    },
    // Newest last, so the run of results reads in the order Jev lived it.
    last_ten_spins: s.recent.map(describeSpin),
  };
}

function describeSpin(spin) {
  if (spin.payout > 0) {
    return `bet ${usd(spin.bet)}, won ${usd(spin.payout)} on ${spin.winName.toLowerCase()}`;
  }
  return `bet ${usd(spin.bet)}, won nothing`;
}

/**
 * One request per turn. `canSpend` is false when purchases are switched off or
 * when nothing in the city is within reach, and then the question that offers
 * leaving the machine is simply not asked.
 */
export function gamblingQuestions(s, ladder, { canSpend }) {
  const questions = {
    bet_size: choice('How much does Jev bet?', betCriteria(ladder, s.balance)),

    pace: score('How fast is Jev playing?', [
      'Long gaps between spins',
      'A few seconds between spins',
      'As fast as the machine takes it',
    ]),

    tilt: score('How much control does Jev have?', [
      'In control, playing for fun',
      'Starting to chase losses',
      'Betting to get even',
      'Not deciding anything any more',
    ]),

    mutter: choice(
      'Which of these does Jev say?',
      lineCriteria(MUTTERS[s.situation] ?? MUTTERS.loss),
    ),
  };

  if (canSpend) {
    questions.action = choice('What does Jev do next?', {
      spin_again: 'Play another spin.',
      go_spend: 'Leave the machine and spend money in the city.',
    });
  }

  return questions;
}

/**
 * Bet options as named rungs. Jev never sees a bare number to reason about: the
 * dollar amount and its size relative to the bankroll are both written out for
 * Jev in words, computed here.
 */
function betCriteria(ladder, balance) {
  const names = ['minimum', 'small', 'standard', 'large', 'max'];
  const criteria = {};
  ladder.forEach((amount, i) => {
    const name = ladder.length === 1 ? 'minimum' : names[i + (names.length - ladder.length)];
    criteria[name] = `${usd(amount)} a spin, ${shareOf(amount, balance)}.`;
  });
  return criteria;
}

/** Map the chosen rung name back to a real dollar amount. */
export function betForChoice(name, ladder) {
  const names = ['minimum', 'small', 'standard', 'large', 'max'];
  if (ladder.length === 0) return 0;
  if (ladder.length === 1) return ladder[0];
  const offset = names.length - ladder.length;
  const index = names.indexOf(name) - offset;
  return ladder[index] ?? ladder[0];
}

/* ------------------------------------------------------------------ */
/* Shopping                                                            */
/* ------------------------------------------------------------------ */

export function shopState(s) {
  return {
    situation: WHO_HE_IS,
    wallet: wallet(s),
    where_jev_is:
      'Jev has left the slot machine and is looking at things to buy. Nothing ' +
      'for sale is a way out of Las Vegas.',
    // The one thing Jev cannot work out from the menu: what this trip has
    // already cost. Without it Jev buys the same bottle of water four times.
    already_bought_on_this_trip: s.recentPurchases.length
      ? {
          note:
            'Jev already owns these, bought since leaving the slot machine a ' +
            'few minutes ago. Buying one of them again would mean paying twice ' +
            'for the same thing.',
          items: s.recentPurchases.map((p) => `${p.name}, paid ${usd(p.price)}`),
        }
      : 'Nothing yet. Jev has just walked over from the slot machine.',
  };
}

export function shopQuestions(s, menu) {
  return {
    purchase: choice('Which one does Jev buy?', menuCriteria(menu, s.balance)),

    after_purchase: choice('What does Jev do next?', {
      buy_something_else: 'Buy something else.',
      back_to_slots: 'Go back to the slot machine.',
    }),

    regret: score('How much will Jev regret this tomorrow?', [
      'Not at all, it was sensible',
      'A little, but it was worth it',
      'Quite a lot',
      'Completely',
    ]),
  };
}
