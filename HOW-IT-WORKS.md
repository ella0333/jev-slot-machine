# How it works

## Jev

Jev is a System One model from [TypeSafe](https://typesafe.ai/). Not a chat
model. You hand it a situation and a typed question, and it returns a decision
with a probability on every option you offered. Three things about it shape all
the code here.

It cannot generate text. Every line Jev appears to say is written down in
`lib/lines.mjs`, and Jev picks one with a Choice over a pool that code has
already narrowed to the moment it is in.

It cannot do arithmetic. No question asks Jev to compare or total anything. Bet
options are named rungs, `minimum` through `max`, whose dollar figures and
percentages are worked out in `lib/questions.mjs` before Jev sees them.

It gets worse with context it does not need. The state it reads is small and
every field in it is something a question refers to.

## The questions

One request per turn with every question in it. The model reads the situation
once and answers all of them against it in parallel.

At the machine:

| Question | Type | Decides |
| --- | --- | --- |
| `bet_size` | Choice | Which rung of the bet ladder |
| `pace` | Score | How fast the button is pressed, which sets the real gap between spins |
| `tilt` | Score | How much control is left |
| `mutter` | Choice | Which written line gets said |
| `action` | Choice | Stay, or go spend. Only asked when purchases are on and something is affordable |

In the shop:

| Question | Type | Decides |
| --- | --- | --- |
| `purchase` | Choice | Which of the eight things on the menu Jev buys |
| `after_purchase` | Choice | Keep shopping, or back to the machine |
| `regret` | Score | How much Jev will regret it tomorrow |

Everything after the answer is ordinary code. A Choice comes back with a
confidence, and where the code needs a decision it can act on it takes a
fallback below the floor rather than treating a coin flip as an answer.

## The machine

Three reels, one payline, 32 stop virtual strips. Real machines carry the house
edge in the strips rather than the paytable: good symbols appear once, blanks
appear many times. The third reel here holds one seven where the others hold
two, which is the standard way near misses are manufactured, and it is why two
jackpot symbols land together far more often than three.

Payback is 92.31%, house edge 7.69%, and 17.79% of spins pay something. Those
are not sampled. `npm run rtp` walks all 32,768 stop combinations, prints the
exact numbers, and fails if the machine has drifted outside the 88% to 96% a
real Vegas slot sits in.

## The shop

`lib/shop.mjs` holds everything in the city, from a $9 bottle of water to a $25m
foundation. Jev is only offered the eight things it can currently afford, spread
across the price range so there is always something cheap and something ruinous
on the menu.

Nothing in it is a way out of Las Vegas. No flight, no bus ticket, no rental
car. Jev can buy a mansion and cannot buy an exit.

Each item carries a `sense` of sensible, neutral or poor. It goes into the
dataset and is never shown to Jev, because telling Jev which option is the
sensible one would be answering the question.

## The dataset

One line per decision in `data/dataset-YYYY-MM-DD.jsonl`:

```json
{"at":1758400000000,"run":1,"spin_count":214,"kind":"spin","mode":"gambling",
 "balance_after":742.5,"totals":{...},"outcome":{"bet":25,"symbols":[...],
 "payout":0,"multiplier":0,"net":-25},"model":"jev-1.13","latency_ms":312,
 "usage":{...},"answers":{...}}
```

`outcome` is what happened. `answers` is the response exactly as TypeSafe
returned it, including the full distribution over every option Jev was offered,
so you can see what Jev nearly did as well as what it did. Nothing is rounded or
collapsed.

Runs are numbered and the number is on every row, so a fresh bankroll never
reads as a continuation of the last one. Purchases are also kept in
`data/ledger.json`, which is what the page reads for the list at the bottom.

## Config

`setup.py` writes `.env`. Edit it by hand afterwards if you like.

| Key | Default | |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | | Your key |
| `JEV_STARTING_BALANCE` | `1200` | What each run starts with |
| `JEV_ALLOW_PURCHASES` | `true` | `false` keeps Jev in the seat with no shop |
| `JEV_PORT` | `0` | `0` picks the first free port. Set a number to pin it |

## What is not here

The live site takes donations, which is how Jev keeps playing after a bad night.
None of that is here: no Ko-fi, no webhook, no donor names and so no name
moderation, no second API key. Jev does not beg either, since there is nobody to
beg. Running out of money is the end of the run, and `python jev.py balance 50`
is how it starts again.

## Cost

One request per decision, and a decision every ten seconds or so depending on
how fast Jev is playing. Nothing else calls out anywhere. `--dry` calls nothing
at all.
