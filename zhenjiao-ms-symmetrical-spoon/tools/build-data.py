#!/usr/bin/env python3
"""Generate browser JS shims from the canonical JSON data files.

The JSON files under data/ are the source of truth (and are what the VS Code
extension consumes). Browsers block fetch() of local files over file://, so we
also emit data/*.js shims that assign the same data to window globals. That lets
the prototype work by simply double-clicking index.html — no server required.

Run this whenever you edit data/samples.json or data/tree.json:

    python tools/build-data.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

TARGETS = [
    ("samples.json", "samples.js", "HA_SAMPLES"),
    ("tree.json", "tree.js", "HA_TREE"),
]


def main() -> None:
    for json_name, js_name, global_name in TARGETS:
        src = DATA / json_name
        obj = json.loads(src.read_text(encoding="utf-8"))
        # Validate it round-trips before writing the shim.
        payload = json.dumps(obj, ensure_ascii=False, indent=2)
        banner = f"// AUTO-GENERATED from data/{json_name} by tools/build-data.py. Do not edit by hand.\n"
        js = f"{banner}window.{global_name} = {payload};\n"
        (DATA / js_name).write_text(js, encoding="utf-8")
        print(f"wrote data/{js_name} ({len(js):,} bytes) from data/{json_name}")


if __name__ == "__main__":
    main()
