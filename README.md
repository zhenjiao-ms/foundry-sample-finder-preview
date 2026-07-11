# Foundry Hosted-Agent Sample Finder

An interactive **decision tree** that turns the flat list of ~60 hosted-agent
samples in
[`microsoft-foundry/foundry-samples` → `samples/python/hosted-agents`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents)
into a few answerable questions, so users can find the right starting sample
instead of scrolling a long list.

Built as **plain static HTML/CSS/JS — no build step**. Double-click
`index.html` to run it, or serve the folder (see below).

---

## Why a decision tree?

The VS Code extension currently surfaces every sample as a flat list. That's
overwhelming and gives no sense of *where to start* or *how samples relate*.
The official docs already lead with two orthogonal axes, so the tree uses them
as its first two levels and adds a capability theme as the third:

| Level | Question | Picks |
|-------|----------|-------|
| **1** | Where are you starting from? | **Framework** — Agent Framework · LangGraph · Bring Your Own |
| **2** | How will clients interact with the agent? | **Protocol / channel** — Responses · Invocations · Invocations WS · A2A · Activity |
| **3** | What capability are you adding? | **Category theme** → a specific sample (or small set) |

The tree only offers branches that actually have samples for the chosen
framework (e.g. Voice Live and WebSocket transports are Bring-Your-Own only;
the Teams/Activity channel is Agent-Framework only). Every leaf resolves to one
or more real samples in the catalog.

### Single-page accordion (no step-by-step wizard)

The guide renders the **entire tree on one page** as a nested accordion rather
than walking users through separate pages one question at a time. A page-per-step
flow tested poorly in production (high drop-off at each step), so here you just
expand the branch you care about and drill in place; nothing navigates away.

Every choice shows a **sample count** — how many distinct samples sit beneath it
(e.g. the root reads *20 / 9 / 33 / 3*) — so you can see where the content is
before committing to a branch. **Expand all / Collapse all** reveal or hide the
whole tree at once.

There's also a **Browse all samples** tab: full-text search plus
framework / protocol / category / level filters over the whole catalog, for
users who'd rather scan than be guided.

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

Two JSON files under `data/`, kept separate so the catalog can power the
browse view (and the VS Code extension) independently of the tree, and so a
single leaf can recommend several samples.

**`samples.json`** — `meta` (dictionaries for frameworks, protocols,
categories, plus `repoBaseUrl`) and a flat `samples[]`:

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
Double-click `index.html` (or open it in a browser). It works offline because
`app.js` reads the `window.HA_SAMPLES` / `window.HA_TREE` globals defined by the
generated `data/*.js` shims.

### Option B — serve it (recommended for development)
Serving over http lets `app.js` fetch the canonical `data/*.json` directly:

```bash
cd SampleDecisionTree
python -m http.server 8000
# open http://localhost:8000
```

---

## Editing the data

`data/samples.json` and `data/tree.json` are the **source of truth**. After
editing either one, regenerate the browser shims so the double-click path stays
in sync:

```bash
python tools/build-data.py
```

This reads the JSON, validates it parses, and rewrites `data/samples.js` and
`data/tree.js`. Don't edit the `*.js` shims by hand — they're overwritten.

---

## Notes

- The catalog was built from the **verified live folder listing**, not only the
  READMEs (which are out of date), so it surfaces samples the READMEs miss.
- Sample paths/URLs are pinned to the `main` branch of
  `microsoft-foundry/foundry-samples`.
- Both data files are plain JSON with no dependencies, so the VS Code extension
  can consume them directly.
