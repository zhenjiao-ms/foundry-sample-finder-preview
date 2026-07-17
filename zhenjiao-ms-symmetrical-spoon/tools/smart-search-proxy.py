#!/usr/bin/env python3
"""Local auth/CORS shim for the Foundry Sample Finder agent.

This is a *development-only* helper. The static site can't call the Foundry
hosted agent directly (it needs an Entra token and the endpoint sends no CORS
headers), so this tiny proxy:

  1. obtains a bearer token from your existing ``az login`` (no secret is stored
     or committed), and
  2. forwards ``GET /search?q=<text>`` to the agent's OpenAI-compatible
     ``responses`` endpoint, returning the agent's JSON with CORS headers.

It holds no ranking logic of its own -- the Foundry agent is the brain. When
this proxy isn't running, the web app silently falls back to its offline
keyword search.

Usage:
    az login                         # once, if not already logged in
    python tools/smart-search-proxy.py
    # then open the site and toggle "Smart search (Foundry agent)"

Config via environment variables (sensible defaults for the demo deployment):
    SF_AGENT_ENDPOINT   full responses URL of the deployed agent
    SF_AGENT_MODEL      agent name used as the "model" field
    SF_TOKEN_SCOPE      AAD scope for the access token
    SF_PROXY_PORT       port to listen on (default 8178)
"""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ENDPOINT = os.environ.get(
    "SF_AGENT_ENDPOINT",
    "https://zhenjiao-devtest-ncus-resource.services.ai.azure.com/api/projects/"
    "zhenjiao-devtest-ncus/agents/agent-framework-agent-basic-responses/"
    "endpoint/protocols/openai/responses?api-version=v1",
)
MODEL = os.environ.get("SF_AGENT_MODEL", "agent-framework-agent-basic-responses")
SCOPE = os.environ.get("SF_TOKEN_SCOPE", "https://ai.azure.com/.default")
PORT = int(os.environ.get("SF_PROXY_PORT", "8178"))

_token_cache = {"value": None, "exp": 0.0}


def get_token() -> str:
    """Return a cached AAD bearer token, refreshing shortly before expiry."""
    now = time.time()
    if _token_cache["value"] and now < _token_cache["exp"] - 120:
        return _token_cache["value"]
    out = subprocess.run(
        ["az", "account", "get-access-token", "--scope", SCOPE, "-o", "json"],
        capture_output=True,
        text=True,
        shell=(os.name == "nt"),
    )
    if out.returncode != 0:
        raise RuntimeError(f"az account get-access-token failed: {out.stderr.strip()}")
    data = json.loads(out.stdout)
    _token_cache["value"] = data["accessToken"]
    # expiresOn is local time; fall back to a conservative 25-minute TTL.
    _token_cache["exp"] = now + 25 * 60
    return _token_cache["value"]


def call_agent(query: str) -> dict:
    """Call the Foundry agent and return the parsed {matches, understood} dict."""
    body = json.dumps({"model": MODEL, "input": query}).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {get_token()}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    text = extract_output_text(payload)
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {"matches": [], "understood": [], "raw": text}
    parsed.setdefault("matches", [])
    parsed.setdefault("understood", [])
    return parsed


def extract_output_text(payload: dict) -> str:
    """Pull the assistant's text out of an OpenAI responses object."""
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    chunks = []
    for item in payload.get("output", []) or []:
        for part in item.get("content", []) or []:
            if part.get("type") in ("output_text", "text") and part.get("text"):
                chunks.append(part["text"])
    return "".join(chunks)


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status: int, obj: dict):
        blob = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(blob)))
        self.end_headers()
        self.wfile.write(blob)

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._json(200, {"ok": True, "model": MODEL})
            return
        if parsed.path != "/search":
            self._json(404, {"error": "not found"})
            return
        q = (parse_qs(parsed.query).get("q", [""])[0] or "").strip()
        if len(q) < 2:
            self._json(400, {"error": "query too short"})
            return
        try:
            result = call_agent(q)
            self._json(200, result)
        except Exception as exc:  # noqa: BLE001
            self._json(502, {"error": str(exc)})

    def log_message(self, fmt, *args):  # quieter console
        print("[proxy]", fmt % args)


def main():
    print(f"Foundry Sample Finder smart-search proxy on http://localhost:{PORT}")
    print(f"  -> agent: {MODEL}")
    print(f"  -> endpoint: {ENDPOINT}")
    print("  (Ctrl+C to stop)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
