"""Azure Functions HTTP proxy for the Foundry Sample Finder agent.

Cloud counterpart of tools/smart-search-proxy.py. It lets the *public* static
site (GitHub Pages) use Smart search without ever handling a credential:

  1. mints an Entra token with the Function App's **managed identity**
     (DefaultAzureCredential -> no secret stored anywhere), and
  2. forwards ``GET /api/search?q=<text>`` to the agent's OpenAI-compatible
     ``responses`` endpoint, returning the agent's parsed JSON.

CORS is configured at the Function App platform level (az functionapp cors),
so this code does not emit CORS headers itself.

App settings (configured on the Function App):
    SF_AGENT_ENDPOINT   full responses URL of the deployed agent
    SF_AGENT_MODEL      agent name used as the "model" field
    SF_TOKEN_SCOPE      AAD scope for the access token (default ai.azure.com)
"""
from __future__ import annotations

import json
import os
import time
import urllib.request

import azure.functions as func
from azure.identity import DefaultAzureCredential

app = func.FunctionApp()

ENDPOINT = os.environ.get(
    "SF_AGENT_ENDPOINT",
    "https://zhenjiao-devtest-ncus-resource.services.ai.azure.com/api/projects/"
    "zhenjiao-devtest-ncus/agents/agent-framework-agent-basic-responses/"
    "endpoint/protocols/openai/responses?api-version=v1",
)
MODEL = os.environ.get("SF_AGENT_MODEL", "agent-framework-agent-basic-responses")
SCOPE = os.environ.get("SF_TOKEN_SCOPE", "https://ai.azure.com/.default")

_credential = DefaultAzureCredential()
_token_cache = {"value": None, "exp": 0.0}


def get_token() -> str:
    """Return a cached managed-identity bearer token, refreshed before expiry."""
    now = time.time()
    if _token_cache["value"] and now < _token_cache["exp"] - 120:
        return _token_cache["value"]
    tok = _credential.get_token(SCOPE)
    _token_cache["value"] = tok.token
    _token_cache["exp"] = float(tok.expires_on)
    return tok.token


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


def _json(obj: dict, status: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(obj), status_code=status, mimetype="application/json"
    )


@app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def health(req: func.HttpRequest) -> func.HttpResponse:
    return _json({"ok": True, "model": MODEL})


@app.route(route="search", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def search(req: func.HttpRequest) -> func.HttpResponse:
    q = (req.params.get("q") or "").strip()
    if len(q) < 2:
        return _json({"error": "query too short"}, 400)
    try:
        return _json(call_agent(q))
    except Exception as exc:  # noqa: BLE001
        return _json({"error": str(exc)}, 502)
