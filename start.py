#!/usr/bin/env python3
"""Start the machine and open it in a browser. Ctrl+C stops it.

    python start.py           play
    python start.py --no-open do not open a browser
"""

import os
import re
import shutil
import subprocess
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
URL = re.compile(r"https?://127\.0\.0\.1:\d+")


def main():
    if not os.path.exists(os.path.join(ROOT, ".env")):
        print("No .env yet. Run: python setup.py")
        return 1

    node = shutil.which("node")
    if not node:
        print("node is not on PATH.")
        return 1

    args = [a for a in sys.argv[1:] if a != "--no-open"]
    open_browser = "--no-open" not in sys.argv

    process = subprocess.Popen(
        [node, "server.mjs", *args],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    opened = False
    try:
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            if open_browser and not opened:
                found = URL.search(line)
                if found:
                    opened = True
                    threading.Timer(0.4, webbrowser.open, [found.group(0)]).start()
        return process.wait()
    except KeyboardInterrupt:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        print("\nStopped.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
