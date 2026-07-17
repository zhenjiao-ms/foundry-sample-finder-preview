# Foundry Hosted-Agent Sample Finder

▶️ **Try it live:** Want to try out the Hosted-Agent Sample Finder? Open it here — https://kimizhu.github.io/foundry-sample-finder-preview

A single **blended finder** that turns the flat list of 60+ hosted-agent samples in [`microsoft-foundry/foundry-samples` → `samples/python/hosted-agents`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents) into one page where you can search by keyword, browse by scenario, or describe your goal and let a Foundry agent pick — instead of scrolling a long list.

Built as **plain static HTML/CSS/JS — no build step**. Double-click `index.html` to run it, or serve the folder (see below).

---

## Why one blended finder?

### The problem

Microsoft Foundry ships **60+ hosted-agent samples** in a single folder of the [`foundry-samples`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents) repo, and the VS Code extension surfaces every one of them as a **flat, alphabetical list**. For anyone who isn't already an expert, that list is a wall of near-identical, jargon-heavy folder names (`byo-inv-ag-ui`, `af-resp-basic`, `langgraph-invocations-hitl`…) with no signal about:

- **Where to start** — which sample is the "hello world" versus a niche edge case.
- **How samples relate** — that they actually cluster into a handful of real-world scenarios (tools & MCP, knowledge & memory, human-in-the-loop, multi-agent, voice…).
- **What's even available** — the folder READMEs are partially out of date, so scanning them can *hide* samples rather than surface them.

The result is classic **choice overload**: a new user opens the list, can't tell the options apart, and either picks the wrong starting point or abandons the sample gallery altogether. The very artifacts meant to accelerate adoption end up being a barrier to it.

### Why we built this

The key insight is that a newcomer shouldn't have to learn a taxonomy before they can find a sample — they should just say what they want to build. Earlier iterations exposed three separate ways to search (keyword filtering, scenario categories, and an AI "smart" search) as separate tabs. This version merges all three into **one blended page** that reveals information gradually instead of dumping everything at once. You land on a single question — *"What should your hosted agent do?"* — and choose your own depth:

| If you… | You get… |
|---------|----------|
| Know a keyword | Type it — the catalog filters instantly across titles, tags, and descriptions |
| Want to browse by scenario | Pick from a curated set of scenario cards (Just the basics, Tools/MCP & Skills, Knowledge/RAG & Memory, Human-in-the-Loop, Multi-Agent, Voice…), each showing its sample count, with **Show all** to reveal the full set |
| Aren't sure what to search | Describe your goal in plain language and hit **✨ Smart search** — a deployed Foundry hosted agent reads the whole catalog and returns the best-fit samples, with the top pick marked **★ Recommended** and a one-line reason why each fits |

Every one of the 62 samples is mapped to exactly one scenario, so nothing is hidden and no path dead-ends. Each result links straight to the sample on GitHub, a one-click **⚡ Code an agent** flow (the `azd` commands to scaffold and deploy it), and **Open in VS Code** for the Web.

### What value it delivers

- **Faster time-to-first-sample.** A newcomer goes from "60 folders, no idea" to a concrete, runnable sample in one search or two clicks — no prior knowledge of the naming scheme required.
- **Progressive disclosure, not a wall.** The page starts with one search box and six curated scenarios; detail is revealed only as you ask for it, turning an overwhelming catalog into a short, guided experience.
- **Describe-your-goal search.** When keywords fall short, the Foundry agent does the semantic matching for you and explains its picks — the same "smart" mechanism, now front and center.
- **A safe default for the unsure.** Smart-search results flag a **★ Recommended** option, so there's always an obvious place to start.

---

## Files

```
index.html          # shell: slim header + single landing (hero, search, scenario grid)
styles.css          # light, card-based UI
app.js              # vanilla-JS renderer (landing, category grid + drill-in, smart-search panel)
data/
  samples.json      # canonical flat catalog + meta.categoryList (source of truth)
  tree.json         # canonical capability graph (source of truth; consumed by the VS Code extension)
  samples.js        # generated shim → window.HA_SAMPLES (for file://)
  tree.js           # generated shim → window.HA_TREE   (for file://)
tools/
  build-data.py     # regenerates the *.js shims from the *.json files
```

### Data model

Two JSON files under `data/`, kept separate so the catalog can power the browse view (and the VS Code extension) independently of the tree, and so a single leaf can recommend several samples.

**`samples.json`** — `meta` (dictionaries for frameworks, protocols, categories, an ordered `categoryList` that drives the scenario grid, plus `repoBaseUrl`) and a flat `samples[]`:

```jsonc
{
  "id": "af-resp-basic",
  "title": "Basic Agent",
  "framework": "agent-framework",   // key into meta.frameworks
  "protocol": "responses",           // key into meta.protocols
  "category": "basics",              // key into meta.categories / meta.categoryList
  "level": "beginner",               // beginner | intermediate | advanced
  "kind": "agent",                   // agent | client
  "tags": ["chat", "multi-turn"],
  "path": "agent-framework/responses/01-basic",  // relative to rootPath
  "description": "…",
  "runFile": "./src/…/main.py"       // entry point for the azd "Code an agent" flow
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
