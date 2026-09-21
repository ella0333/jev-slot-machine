#!/usr/bin/env python3
"""Commands for a machine that is already running.

    python jev.py status          where the money is
    python jev.py balance 100     put another $100 in
    python jev.py restart         end this run, start a new one
    python jev.py pause
    python jev.py resume
"""

import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT_FILE = os.path.join(ROOT, "data", "port.json")


def call(command, **payload):
    try:
        with open(PORT_FILE, encoding="utf-8") as handle:
            port = json.load(handle)["port"]
    except (OSError, KeyError, ValueError):
        print("Nothing is running. Start it with: python start.py")
        return None

    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/api/control",
        data=json.dumps({"command": command, **payload}).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.load(response)
    except urllib.error.URLError:
        print(f"Nothing answered on port {port}. Start it with: python start.py")
        return None


def usd(n):
    return f"${n:,.2f}"


def show(result):
    print(f"run       {result['run']}")
    print(f"mode      {result['mode']}")
    print(f"balance   {usd(result['balance'])}")
    print(f"started   {usd(result['started'])}")
    print(f"won       {usd(result['won'])}")
    print(f"lost      {usd(result['lost'])}")
    print(f"added     {usd(result['added'])}")
    print(f"spent     {usd(result['spent'])}")
    print(f"spins     {result['spins']:,}")
    print(f"purchases {result['purchases']:,}")


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__.strip())
        return 0

    command = args[0]
    payload = {}

    if command == "balance":
        if len(args) < 2:
            print("How much? For example: python jev.py balance 100")
            return 1
        payload["amount"] = args[1].lstrip("$").replace(",", "")

    if command not in ("status", "balance", "restart", "pause", "resume"):
        print(f"Unknown command: {command}")
        print(__doc__.strip())
        return 1

    result = call(command, **payload)
    if result is None:
        return 1
    if not result.get("ok"):
        print(result.get("error", "That did not work."))
        return 1

    if result.get("message"):
        print(result["message"])
    show(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
