#!/usr/bin/env python3
"""Write .env. Run this once, then `python start.py`."""

import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
ENV = os.path.join(ROOT, ".env")

DEFAULTS = {
    "TYPESAFE_API_KEY": "",
    "JEV_STARTING_BALANCE": "5000",
    "JEV_ALLOW_PURCHASES": "true",
    "JEV_PORT": "0",
}


def read_env():
    values = dict(DEFAULTS)
    if not os.path.exists(ENV):
        return values
    with open(ENV, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def write_env(values):
    lines = [
        "# Written by setup.py. Keep this file out of version control.",
        "",
        "# Your TypeSafe key. https://console.typesafe.ai/keys",
        f"TYPESAFE_API_KEY={values['TYPESAFE_API_KEY']}",
        "",
        "# What Jev starts each run with, in dollars.",
        f"JEV_STARTING_BALANCE={values['JEV_STARTING_BALANCE']}",
        "",
        "# false keeps Jev in the seat: no shop, no purchases.",
        f"JEV_ALLOW_PURCHASES={values['JEV_ALLOW_PURCHASES']}",
        "",
        "# 0 means pick the first free port. Set a number to pin it.",
        f"JEV_PORT={values['JEV_PORT']}",
        "",
    ]
    with open(ENV, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
    if os.name == "posix":
        os.chmod(ENV, 0o600)


def ask(prompt, default):
    answer = input(f"{prompt} [{default}]: ").strip()
    return answer or default


def ask_yes_no(prompt, default):
    suffix = "Y/n" if default else "y/N"
    while True:
        answer = input(f"{prompt} [{suffix}]: ").strip().lower()
        if not answer:
            return default
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False


def node_ok():
    node = shutil.which("node")
    if not node:
        print("Node 20 or newer is required, and node is not on PATH.")
        return False
    version = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()
    major = int(version.lstrip("v").split(".")[0])
    if major < 20:
        print(f"Node 20 or newer is required, found {version}.")
        return False
    return True


def main():
    if not node_ok():
        return 1

    values = read_env()

    current = values["TYPESAFE_API_KEY"]
    hint = f" [keep {current[:6]}...{current[-4:]}]" if len(current) > 12 else ""
    key = input(f"TypeSafe API key{hint}: ").strip()
    if key:
        values["TYPESAFE_API_KEY"] = key
    elif not current:
        print("A key is needed. Get one at https://console.typesafe.ai/keys")
        return 1

    values["JEV_STARTING_BALANCE"] = ask("Starting balance in dollars", values["JEV_STARTING_BALANCE"])
    allow = ask_yes_no("Let Jev leave the machine and buy things", values["JEV_ALLOW_PURCHASES"] != "false")
    values["JEV_ALLOW_PURCHASES"] = "true" if allow else "false"

    write_env(values)
    print("\nWrote .env. Start it with: python start.py")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError):
        print()
        sys.exit(1)
