# How it works

## Jev

Jev is a System One model from [TypeSafe](https://typesafe.ai/). It does not
hold a conversation. You give it a situation and a typed question, and it gives
back a decision with a probability on each of the options you offered it. Three
things about how it works shape most of the code here.

It cannot generate text, so every line Jev appears to say is written down in
`lib/lines.mjs`. Jev picks one of them with a Choice, from a pool that the code
has already narrowed down to the situation Jev is in.

It cannot do arithmetic, so no question asks it to compare or total anything.
The bet options are named rungs, `minimum` through `max`, and their dollar
figures and percentages are worked out in `lib/questions.mjs` before Jev sees
them.

It gets less accurate when it is given context it does not need, so the state it
reads is kept small and every field in it is something one of the questions
refers to.

## The questions

Each turn is one request with every question for that turn in it. Jev reads the
situation once and answers all of them against it at the same time, which is
cheaper and quicker than asking one at a time.

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
| `regret` | Score | How much Jev will regret it tomorrow |

Everything that happens after the answer is ordinary code. A Choice comes back
with every option mapped to a probability, and `choice` is the highest of them,
so the answer is the decision and the code acts on it. The confidence that comes
with it is recorded alongside the outcome rather than used as a veto. Treating
it as a threshold means replacing Jev's answer with a default, which is not
reading the model, it is overruling it.

## The machine

The machine has three reels, one payline, and 32 stop virtual strips. Real
machines carry their house edge in those strips rather than in the paytable: the
good symbols appear once on a strip and the blanks appear many times over. The
third reel here holds one seven where the other two hold two of them, which is
the usual way near misses are produced, and it is why two jackpot symbols land
together much more often than three do.

The payback is 92.31%, the house edge is 7.69%, and 17.79% of spins pay
something. These are not sampled figures. `npm run rtp` works through all 32,768
stop combinations and prints the exact numbers, and it fails if the machine has
drifted outside the 88% to 96% range that a real Vegas slot sits in.

## The shop

`lib/shop.mjs` holds everything that can be bought in the city, from a $9 bottle
of water up to a $12m stake in the casino. Jev is only ever offered the eight
things it can currently afford, and they are spread across the price range so
that there is always something cheap and something ruinous on the menu.

None of it is a way out of Las Vegas. There are no flights, bus tickets or
rental cars in the catalog. Jev can buy a mansion but cannot buy an exit.

Nothing in the catalog is only moving money somewhere else either. A safe
deposit box or an index fund would take cash off the balance and give nothing
back, so it would read as the money vanishing rather than as Jev buying
something. Every item is a thing Jev has or has done.

A trip to the shop is one purchase. Jev is not asked whether to keep shopping,
because left to decide Jev bought most of the menu in a few minutes and the
bankroll went on souvenirs rather than on the machine. Buying ends the trip, and
leaving the machine again is a decision Jev makes back in the seat.

Jev is told the last five things it bought, and only in the shop, so it does not
pay twice for the same bottle of water. Whatever Jev bought on the last trip over
is also held off the menu for one visit and is back the visit after, because
offered it again Jev bought the same thing two trips running.

Every item also carries a `sense` of sensible, neutral or poor. That goes into
the dataset, and it is never shown to Jev, because telling Jev which option is
the sensible one would be answering the question for it.

## The dataset

Each decision is one line in `data/dataset-YYYY-MM-DD.jsonl`:

```json
{"at":1758400000000,"run":1,"spin_count":214,"kind":"spin","mode":"gambling",
 "balance_after":742.5,"totals":{...},"outcome":{"bet":25,"symbols":[...],
 "payout":0,"multiplier":0,"net":-25},"model":"jev-1.13","latency_ms":312,
 "usage":{...},"answers":{...}}
```

`outcome` is what actually happened. `answers` is the response exactly as
TypeSafe returned it, including the probability it put on every option Jev was
offered, so you can see what Jev nearly did as well as what it did. Nothing is
rounded or summarised.

Runs are numbered and the run number is on every row, so a fresh bankroll never
reads as a continuation of the previous one. Purchases are also kept in
`data/ledger.json`, which is what the page reads to build the list at the
bottom.

## Config

`setup.py` writes these into `.env`, and you can edit that file by hand
afterwards.

| Key | Default | |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | | Your key |
| `JEV_STARTING_BALANCE` | `5000` | What each run starts with |
| `JEV_ALLOW_PURCHASES` | `true` | `false` keeps Jev in the seat with no shop |
| `JEV_PORT` | `0` | `0` picks the first free port. Set a number to pin it |

## What is not here

The live site takes donations, which is how Jev keeps playing there after a bad
night. None of that is in here. There is no Ko-fi, no webhook, no donor names
and so no name moderation, and no second API key for anything. Jev does not beg
here either, since there is nobody to beg. Running out of money is simply the
end of the run, and `python jev.py balance 50` is how it starts again.

## Cost

There is one request per decision, and a decision every ten seconds or so
depending on how fast Jev is playing. Nothing else in here calls out to
anything. Running with `--dry` makes no requests at all.
