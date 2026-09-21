# Jev slot machine

Jev is given a bankroll and a three reel slot machine, and left to it. It picks
how much to bet, when to get up and spend some of it, and what to buy, until the
money runs out. Every decision it makes is written to a dataset as it happens.

A version of this has been running continuously at
[jevslots.live](https://jevslots.live/). This repo is the same machine, the same
catalog and the same page, cut down to something that runs on your laptop.

## What Jev is

Jev is a System One model from [TypeSafe](https://typesafe.ai/). It is not a
chat model. You hand it a situation and a typed question, and it returns a
decision with a probability attached to every option you offered it. Three
things about it shape all the code here:

It cannot generate text. Every line Jev appears to say is written down in
`lib/lines.mjs`, and Jev picks one with a Choice over a pool that code has
already narrowed to the moment it is in.

It cannot do arithmetic. No question asks Jev to compare or total anything. The
bet options are named rungs, `minimum` through `max`, whose dollar figures and
percentages are worked out in `lib/questions.mjs` before Jev sees them.

It gets worse with context it does not need. The state it reads is small, and
every field in it is something a question actually refers to.

## Running it

You need Node 20 or newer, Python 3.9 or newer, and a TypeSafe API key from
[console.typesafe.ai/keys](https://console.typesafe.ai/keys). There are no npm
dependencies to install.

```
git clone https://github.com/ella0333/jev-slot-machine
cd jev-slot-machine
python setup.py
python start.py
```

`setup.py` asks for your key, what Jev starts with, and whether Jev is allowed
to leave the machine and buy things. It writes `.env`, which stays on your
machine and is gitignored.

`start.py` finds a free port, starts the loop, and opens the page. Watch it as
long as you like and press Ctrl+C to stop. Nothing listens on anything but
127.0.0.1.

To see the whole thing work without a key and without spending anything, run
`python start.py --dry`. Answers are stubbed with plausible probabilities in the
same shape a real response has, so the loop, the page and the dataset all behave
exactly as they do for real.

## Commands

While it is running, in another terminal:

| Command | What it does |
| --- | --- |
| `python jev.py status` | Balance, totals, spins, purchases |
| `python jev.py balance 100` | Puts another $100 in, and restarts a busted run |
| `python jev.py restart` | Ends this run and starts a new one on a fresh bankroll |
| `python jev.py pause` | Stops planning. Nothing is lost |
| `python jev.py resume` | Carries on |

Runs are numbered, and the number is on every dataset row, so a fresh bankroll
never reads as a continuation of the last one.

## What Jev is asked

One request per turn, with every question in it. The model reads the situation
once and answers all of them against it in parallel, which is cheaper and faster
than asking one at a time.

At the machine:

| Question | Type | Decides |
| --- | --- | --- |
| `bet_size` | Choice | Which rung of the bet ladder |
| `pace` | Score | How fast the button is being pressed, which sets the real gap between spins |
| `tilt` | Score | How much control is left |
| `mutter` | Choice | Which written line gets said |
| `action` | Choice | Stay in the seat, or get up and go spend. Only asked when purchases are on and something is affordable |

In the shop:

| Question | Type | Decides |
| --- | --- | --- |
| `purchase` | Choice | Which of the eight things on the menu Jev buys |
| `after_purchase` | Choice | Keep shopping, or go back to the machine |
| `regret` | Score | How much Jev will regret it tomorrow |

Everything after the answer is ordinary code. A Choice comes back with a
confidence, and where the code needs a decision it can act on it takes a
fallback below the floor rather than treating a coin flip as an answer.

## The machine

Three reels, one payline, 32 stop virtual strips. Real machines carry their
house edge in the strips rather than the paytable: the good symbols appear once
and the blanks appear many times. The third reel here holds one seven where the
others hold two, which is the standard way near misses are manufactured, and it
is why two jackpot symbols land together far more often than three.

Payback is 92.31%, house edge 7.69%, and 17.79% of spins pay something. Those
are not sampled figures. Run `npm run rtp` and it walks all 32,768 stop
combinations and prints the exact numbers, and fails if the machine has drifted
outside the 88% to 96% range a real Vegas slot sits in.

## The catalog

`lib/shop.mjs` holds everything in the city, from a $9 bottle of water to a $25m
foundation. Jev is only ever offered the eight things it can currently afford,
spread across the price range so there is always something cheap and something
ruinous on the menu.

Nothing in it is a way out of Las Vegas. No flight, no bus ticket, no rental
car. Jev can buy a mansion and cannot buy an exit. That is the premise, and the
catalog is where it is enforced.

Each item carries a `sense` of sensible, neutral or poor. It goes into the
dataset and is never shown to Jev, because telling Jev which option is the
sensible one would be answering the question.

## The dataset

One JSON object per line in `data/dataset-YYYY-MM-DD.jsonl`, one line per
decision:

```json
{"at":1758400000000,"run":1,"spin_count":214,"kind":"spin","mode":"gambling",
 "balance_after":742.5,"totals":{...},"outcome":{"bet":25,"symbols":[...],
 "payout":0,"multiplier":0,"net":-25},"model":"jev-1.13","latency_ms":312,
 "usage":{...},"answers":{...}}
```

`outcome` is what actually happened. `answers` is the response exactly as
TypeSafe returned it, including the full probability distribution over every
option Jev was offered. Nothing is rounded, collapsed or summarised, so you can
look at what Jev nearly did as well as what it did.

Purchases are also kept in `data/ledger.json`, which is what the page reads for
the list at the bottom.

## Configuration

`setup.py` writes these, and you can edit `.env` by hand afterwards.

| Key | Default | |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | | Your key |
| `JEV_STARTING_BALANCE` | `1200` | What each run starts with |
| `JEV_ALLOW_PURCHASES` | `true` | `false` keeps Jev in the seat with no shop |
| `JEV_PORT` | `0` | `0` picks the first free port. Set a number to pin it |

## What is not in here

The live site takes donations, which is how Jev keeps playing after a bad night.
All of that is gone: no Ko-fi, no webhook, no donor names and so no name
moderation, and no second API key for anything. Jev does not beg here either,
since there is nobody to beg. Running out of money is just the end of the run,
and `python jev.py balance 50` is how it gets going again.

## What it costs

One request per decision, and a decision every ten seconds or so depending on
how fast Jev is playing. Nothing else calls out to anything. `--dry` calls
nothing at all.

## License

MIT.
