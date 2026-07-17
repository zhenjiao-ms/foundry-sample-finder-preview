# Copyright (c) Microsoft. All rights reserved.

import json
import os
from pathlib import Path

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from agent_framework_foundry_hosting import ResponsesHostServer
from azure.identity import DefaultAzureCredential
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Marker in instructions.md where the sample catalog is injected at runtime.
_CATALOG_MARKER = "{{CATALOG}}"

_FALLBACK_INSTRUCTIONS = (
    "You are the Foundry Sample Finder agent. Given a developer's natural-language "
    "description of what they want to build, recommend the best-matching Foundry "
    "hosted-agent sample. Respond only with compact JSON: "
    '{"matches":[{"id":"<sampleId>","why":"<reason>"}],"understood":["<concept>"]}.'
)


def _load_samples() -> list[dict]:
    """Load the sample catalog from the website's source of truth (data/samples.json).

    Search order:
      1. SAMPLES_JSON_PATH env override
      2. samples.json bundled next to this file (shipped into the container image)
      3. repo-root data/samples.json (for local `python main.py` runs from the repo)
    """
    here = Path(__file__).parent
    candidates = []
    env_path = os.getenv("SAMPLES_JSON_PATH")
    if env_path:
        candidates.append(Path(env_path))
    candidates.append(here / "samples.json")
    # agent/src/<agent>/ -> repo root -> data/samples.json
    candidates.append(here.parents[2] / "data" / "samples.json")

    for path in candidates:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        samples = data.get("samples") if isinstance(data, dict) else data
        if samples:
            return samples
    return []


def _format_catalog(samples: list[dict]) -> str:
    """Render samples into the CATALOG block the model reads, one line per sample."""
    lines = [f"CATALOG ({len(samples)} samples; [sdk] shown in brackets):"]
    for s in samples:
        sdk = s.get("sdk") or "-"
        title = s.get("title") or s.get("id", "")
        tags = ", ".join(s.get("tags") or [])
        desc = (s.get("description") or "").strip()
        line = f"- {s.get('id', '')} [{sdk}] {title}"
        if tags:
            line += f" — tags: {tags}"
        line += f". {desc}" if desc else "."
        lines.append(line)
    return "\n".join(lines)


def load_instructions() -> str:
    """Base behavior/rules prompt with the CATALOG injected from samples.json."""
    path = Path(__file__).with_name("instructions.md")
    try:
        base = path.read_text(encoding="utf-8").strip()
    except OSError:
        base = ""
    if not base:
        base = _FALLBACK_INSTRUCTIONS

    samples = _load_samples()
    if samples:
        catalog = _format_catalog(samples)
        if _CATALOG_MARKER in base:
            return base.replace(_CATALOG_MARKER, catalog)
        return f"{base}\n\n{catalog}"
    # No data file available — fall back to whatever is in instructions.md as-is
    # (with the marker stripped so we never leak the placeholder to the model).
    return base.replace(_CATALOG_MARKER, "").strip()


def main():
    model_name = os.getenv("AZURE_AI_MODEL_DEPLOYMENT_NAME") or os.getenv("FOUNDRY_MODEL_NAME")
    if not model_name:
        raise RuntimeError(
            "Model deployment name is not configured. Set "
            "AZURE_AI_MODEL_DEPLOYMENT_NAME or FOUNDRY_MODEL_NAME."
        )

    client = FoundryChatClient(
        project_endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
        model=model_name,
        credential=DefaultAzureCredential(),
    )

    agent = Agent(
        client=client,
        instructions=load_instructions(),
        # History will be managed by the hosting infrastructure, thus there
        # is no need to store history by the service. Learn more at:
        # https://developers.openai.com/api/reference/resources/responses/methods/create
        default_options={"store": False},
    )

    server = ResponsesHostServer(agent)
    server.run()


if __name__ == "__main__":
    main()
