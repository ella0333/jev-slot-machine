# Jev slot machine

[Jev](https://typesafe.ai/) plays a slot machine. It chooses how much to bet,
when to leave the machine and go spend some of it, and what to buy, and it keeps
going until the money is gone.

This runs Jev on your own computer. A page opens in your browser with the reels,
the balance, what Jev is saying and what it has bought, and every decision Jev
makes is written to a file as it happens.

The same thing runs all the time at [jevslots.live](https://jevslots.live/).

## Setup

You need Node 20 or newer, Python 3.9 or newer, and a TypeSafe API key from
[console.typesafe.ai/keys](https://console.typesafe.ai/keys). There is nothing
to install with npm.

```
git clone https://github.com/ella0333/jev-slot-machine
cd jev-slot-machine
python setup.py
python start.py
```

`setup.py` asks for your key, how much Jev starts with, and whether Jev is
allowed to buy things.

`start.py` starts Jev playing and opens the page in your browser. It uses the
first free port it finds, so it will not clash with anything else you have
running. Press Ctrl+C to stop it, and when you start it again it carries on from
where it was.

If you do not have a key yet, `python start.py --dry` runs everything on made up
answers, so you can see how it works without spending anything.

## Commands

While Jev is playing, you can run these in another terminal.

| | |
| --- | --- |
| `python jev.py status` | Current status: balance, totals, spins, purchases |
| `python jev.py balance 100` | Adds $100, which starts Jev again if the money had run out |
| `python jev.py restart` | Ends this run and starts a new one with a fresh bankroll |
| `python jev.py pause` / `resume` | Stops and starts the playing |

## Dataset

Every decision is added to `data/dataset-YYYY-MM-DD.jsonl` as a line of JSON,
with the answer Jev gave exactly as it came back, including the probability it
put on each of the options it was offered.

## More

[HOW-IT-WORKS.md](HOW-IT-WORKS.md) covers the questions Jev is asked, how the
reels are weighted and where the 92.31% payback comes from, what is in the shop,
and the settings in `.env`.

MIT licence.
