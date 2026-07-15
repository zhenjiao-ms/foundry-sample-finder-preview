# Foundry Hosted-Agent Sample Finder

> **▶️ Try it live:** Want to try out the Hosted-Agent Sample Finder? Open it here — **https://kimizhu.github.io/foundry-sample-finder**

An interactive **decision tree** that turns the flat list of ~60 hosted-agent samples in [`microsoft-foundry/foundry-samples` → `samples/python/hosted-agents`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents) into a few answerable questions, so users can find the right starting sample instead of scrolling a long list.

Built as **plain static HTML/CSS/JS — no build step**. Double-click `index.html` to run it, or serve the folder (see below).

---

## Why a decision tree?

### The problem

Microsoft Foundry ships **60+ hosted-agent samples** in a single folder of the [`foundry-samples`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents) repo, and the VS Code extension surfaces every one of them as a **flat, alphabetical list**. For anyone who isn't already an expert, that list is a wall of near-identical, jargon-heavy folder names (`byo-inv-ag-ui`, `af-resp-basic`, `langgraph-invocations-hitl`…) with no signal about:

- **Where to start** — which sample is the "hello world" versus a niche edge case.
- **How samples relate** — that they actually vary along a few consistent axes (which framework you build on, how clients talk to the agent, what capability is being demonstrated).
- **What's even available** — the folder READMEs are partially out of date, so scanning them can *hide* samples rather than surface them.

The result is classic **choice overload**: a new user opens the list, can't tell the options apart, and either picks the wrong starting point or abandons the sample gallery altogether. The very artifacts meant to accelerate adoption end up being a barrier to it.

### Why we built this

The key insight is that the flat list isn't actually unstructured — it just *looks* that way. Every sample can be placed on the same small set of decisions, and the official docs already lead with two of them. This project makes that hidden structure **explicit and navigable**: instead of scrolling ~60 folders, you answer a few plain-language questions and are handed the sample(s) that fit.

| Level | Question | Picks |
|-------|----------|-------|
| **1** | Where are you starting from? | **Framework** — Agent Framework · LangGraph · Bring Your Own |
| **2** | How will clients interact with the agent? | **Protocol / channel** — Responses · Invocations · A2A · Activity |
| **3** | What capability are you adding? | **Category theme** → a specific sample (or small set) |

The tree only ever offers branches that **actually have samples** for the choices you've made (e.g. the Teams/Activity channel is Agent-Framework only), so you can never walk down a path that dead-ends. Every leaf resolves to one or more **real samples** in the catalog.

### What value it delivers

- **Faster time-to-first-sample.** A newcomer goes from "60 folders, no idea" to a concrete, runnable sample in two or three clicks — no prior knowledge of the naming scheme required.
- **Decision-making, not memorization.** Each level asks one thing in human terms and narrows the field, turning an overwhelming catalog into a short, guided conversation.
- **No dead ends.** Because branches are pruned to what exists, users never hit an empty result or an unsupported combination.
- **A safe default for the unsure.** Every question flags a **★ Recommended** option, so there's always an obvious path forward for people who just want the best place to start.

---

## Files

```
index.html          # shell: header, tabs, guide + browse views
styles.css          # light, card-based UI
app.js              # vanilla-JS renderer (accordion guide + counts + browse/filter)
data/
  samples.json      # canonical flat catalog (source of truth)
  tree.json         # canonical decision graph (source of truth)
  samples.js        # generated shim → window.HA_SAMPLES (for file://)
  tree.js           # generated shim → window.HA_TREE   (for file://)
tools/
  build-data.py     # regenerates the *.js shims from the *.json files
```

### Data model

Two JSON files under `data/`, kept separate so the catalog can power the browse view (and the VS Code extension) independently of the tree, and so a single leaf can recommend several samples.

**`samples.json`** — `meta` (dictionaries for frameworks, protocols, categories, plus `repoBaseUrl`) and a flat `samples[]`:

```jsonc
{
  "id": "af-resp-basic",
  "title": "Basic Agent",
  "framework": "agent-framework",   // key into meta.frameworks
  "protocol": "responses",           // key into meta.protocols
  "category": "foundations",         // key into meta.categories
  "level": "beginner",               // beginner | intermediate | advanced
  "kind": "agent",                   // agent | client
  "tags": ["chat", "multi-turn"],
  "path": "agent-framework/responses/01-basic",  // relative to rootPath
  "description": "…"
}
```

The full GitHub URL for a sample is `meta.repoBaseUrl + sample.path`.

**`tree.json`** — `meta` (with `rootId: "start"`) and a `nodes{}` map:

```jsonc
// question node
{ "id": "start", "type": "question", "breadcrumb": "Start",
  "title": "Where are you starting from?", "help": "…",
  "options": [ { "label": "…", "description": "…", "next": "af-interaction" } ] }

// result node
{ "id": "notsure-result", "type": "result", "breadcrumb": "Recommended start",
  "intro": "…", "sampleIds": ["af-resp-basic", "byo-resp-hello-world"] }
```

`sampleIds` reference `samples.json` by `id`.

---

## Running it

### Option A — just open the file
Double-click `index.html` (or open it in a browser). It works offline because `app.js` reads the `window.HA_SAMPLES` / `window.HA_TREE` globals defined by the generated `data/*.js` shims.

### Option B — serve it (recommended for development)
Serving over http lets `app.js` fetch the canonical `data/*.json` directly:

```bash
cd SampleDecisionTree
python -m http.server 8000
# open http://localhost:8000
```

---

## Editing the data

`data/samples.json` and `data/tree.json` are the **source of truth**. After editing either one, regenerate the browser shims so the double-click path stays in sync:

```bash
python tools/build-data.py
```

This reads the JSON, validates it parses, and rewrites `data/samples.js` and `data/tree.js`. Don't edit the `*.js` shims by hand — they're overwritten.

---

## Notes

- The catalog was built from the **verified live folder listing**, not only the READMEs (which are out of date), so it surfaces samples the READMEs miss.
- Sample paths/URLs are pinned to the `main` branch of `microsoft-foundry/foundry-samples`.
- Both data files are plain JSON with no dependencies, so the VS Code extension can consume them directly.
