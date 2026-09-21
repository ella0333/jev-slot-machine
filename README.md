# Jev slot machine

Jev decides how to play a slot machine until the money runs out. It has been
running continuously at [jevslots.live](https://jevslots.live/). This is that,
on your laptop.

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
to buy things. `start.py` finds a free port and opens the page. Ctrl+C stops it.

No key yet? `python start.py --dry` runs the whole thing on stubbed answers for
free.

## Commands

Run these in another terminal while it is playing.

| | |
| --- | --- |
| `python jev.py status` | Where the money is |
| `python jev.py balance 100` | Add $100, and restart a busted run |
| `python jev.py restart` | New run, fresh bankroll |
| `python jev.py pause` / `resume` | |

## Dataset

Every decision lands in `data/dataset-YYYY-MM-DD.jsonl`, one JSON object per
line, with the model's answer exactly as it came back, probabilities and all.

## More

[HOW-IT-WORKS.md](HOW-IT-WORKS.md) covers the questions Jev is asked, the reel
strips and the 92.31% payback, the shop, and the config keys.

MIT.
