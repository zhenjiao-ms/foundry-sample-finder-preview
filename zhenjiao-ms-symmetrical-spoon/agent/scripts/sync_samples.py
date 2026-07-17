#!/usr/bin/env python3
"""Sync the website's canonical sample catalog into the agent build context.

The website's source of truth is `data/samples.json` at the repo root. The
hosted agent reads a bundled copy at
`src/agent-framework-agent-basic-responses/samples.json` so the catalog ships
inside the container image. This script refreshes that bundled copy and is run
by the azd `prepackage` hook before every deploy, keeping the two in sync.

Safe to run anywhere: if the canonical file can't be found (e.g. the agent
folder was copied out of the repo), it leaves the existing bundled copy alone.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

# scripts/ -> agent/ -> repo root
AGENT_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = AGENT_DIR.parent

SRC = REPO_ROOT / "data" / "samples.json"
DST = AGENT_DIR / "src" / "agent-framework-agent-basic-responses" / "samples.json"


def main() -> int:
    if not SRC.exists():
        print(f"[sync_samples] canonical source not found at {SRC}; "
              f"keeping existing bundled copy.")
        return 0
    DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SRC, DST)
    print(f"[sync_samples] copied {SRC} -> {DST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
