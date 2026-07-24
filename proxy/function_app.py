"""Foundry Sample Finder smart-search proxy (Azure Functions, Flex Consumption).

Auth/CORS shim for the static site. The site can't call the Foundry hosted
agent directly (needs an Entra token + the endpoint sends no CORS headers), so
this function:

  1. obtains a bearer token via the app's **managed identity** (no secret), and
  2. forwards ``GET /api/search?q=<text>`` to the agent's OpenAI-compatible
     ``responses`` endpoint, returning the agent's JSON with CORS headers.

The Foundry agent holds all ranking logic; this proxy is stateless.

See ``README.md`` in this folder for provisioning + deployment steps. For local
development without deploying, ``tools/smart-search-proxy.py`` offers the same
endpoints backed by your ``az login`` token.
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.request

import azure.functions as func
from azure.identity import DefaultAzureCredential

ENDPOINT = os.environ.get(
    "SF_AGENT_ENDPOINT",
    "https://zhenjiao-devtest-ncus-resource.services.ai.azure.com/api/projects/"
    "zhenjiao-devtest-ncus/agents/agent-framework-agent-basic-responses/"
    "endpoint/protocols/openai/responses?api-version=v1",
)
MODEL = os.environ.get("SF_AGENT_MODEL", "agent-framework-agent-basic-responses")
SCOPE = os.environ.get("SF_TOKEN_SCOPE", "https://ai.azure.com/.default")

_cred = DefaultAzureCredential()
_token_cache = {"value": None, "exp": 0.0}
_token_lock = threading.Lock()

app = func.FunctionApp()

_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def _json(status: int, obj: dict) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(obj),
        status_code=status,
        mimetype="application/json",
        headers=_CORS,
    )


def get_token() -> str:
    """Return a cached managed-identity bearer token, refreshing before expiry."""
    now = time.time()
    with _token_lock:
        if _token_cache["value"] and now < _token_cache["exp"] - 120:
            return _token_cache["value"]
        tok = _cred.get_token(SCOPE)
        _token_cache["value"] = tok.token
        _token_cache["exp"] = float(tok.expires_on)
        return tok.token


def extract_output_text(payload: dict) -> str:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    chunks = []
    for item in payload.get("output", []) or []:
        for part in item.get("content", []) or []:
            if part.get("type") in ("output_text", "text") and part.get("text"):
                chunks.append(part["text"])
    return "".join(chunks)


def call_agent(query: str) -> dict:
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


@app.route(route="health", methods=["GET", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def health(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_CORS)
    return _json(200, {"ok": True, "model": MODEL})


@app.route(route="search", methods=["GET", "OPTIONS"], auth_level=func.AuthLevel.ANONYMOUS)
def search(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_CORS)
    q = (req.params.get("q") or "").strip()
    if len(q) < 2:
        return _json(400, {"error": "query too short"})
    try:
        return _json(200, call_agent(q))
    except Exception as exc:  # noqa: BLE001
        return _json(502, {"error": str(exc)})
