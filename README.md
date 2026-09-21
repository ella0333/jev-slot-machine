# Jev slot machine

An AI model plays a slot machine. It picks how much to bet, when to get up and
spend some of it, and what to buy, until it is broke.

You run it on your own machine and watch in your browser: the reels, the
balance, what Jev is saying, and what it has bought. Every decision is saved to
a dataset as it happens.

The same thing runs continuously at [jevslots.live](https://jevslots.live/).

## Setup

Needs Node 20+, Python 3.9+, and a TypeSafe key from
[console.typesafe.ai/keys](https://console.typesafe.ai/keys). No npm install.

```
git clone https://github.com/ella0333/jev-slot-machine
cd jev-slot-machine
python setup.py
python start.py
```

`setup.py` asks for your key, the starting balance, and whether Jev is allowed
to buy things.

`start.py` starts Jev playing and opens the page in your browser. It picks a
free port, so it will not collide with anything else you have running. Ctrl+C
stops it, and it picks up where it left off next time.

No key yet? `python start.py --dry` runs the whole thing on stubbed answers for
free.

## Commands

Run these in another terminal while it is playing.

| | |
| --- | --- |
| `python jev.py status` | Current status: balance, totals, spins, purchases |
| `python jev.py balance 100` | Add $100, which starts Jev again if it went broke |
| `python jev.py restart` | New run, fresh bankroll |
| `python jev.py pause` / `resume` | Stop and start the playing |

## Dataset

Every decision lands in `data/dataset-YYYY-MM-DD.jsonl`, one JSON object per
line, with the model's answer exactly as it came back, probabilities and all.

## More

[HOW-IT-WORKS.md](HOW-IT-WORKS.md) covers the questions Jev is asked, the reel
strips and the 92.31% payback, the shop, and the config keys.

MIT.
