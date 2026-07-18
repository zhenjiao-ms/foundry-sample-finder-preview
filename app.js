/* Foundry Hosted-Agent Sample Finder — vanilla JS, no build step.
 *
 * Guide view: a "Foundry base + building blocks" stack. The base is the minimal
 * getting-started agent; each block is a capability you stack on top. Every block
 * shows colored SDK dots (solid = an SDK already has a sample for it, hollow = not
 * yet), mapped in the legend. Opening a block lists its samples grouped by SDK.
 *
 * Data loading: prefers window.HA_SAMPLES / window.HA_TREE injected by the
 * generated data/*.js shims (so the page works when opened via file://).
 * Falls back to fetching data/*.json when served over http(s).
 */

const SHORT_FRAMEWORK = {
  "agent-framework": "Agent Framework",
  "langgraph": "LangGraph",
  "bring-your-own": "Bring Your Own",
};
const SHORT_PROTOCOL = {
  "responses": "Responses",
  "invocations": "Invocations",
  "invocations_ws": "Invocations WS",
  "a2a": "A2A",
  "activity": "Activity",
};
const LEVEL_ORDER = ["beginner", "intermediate", "advanced"];
const PROTOCOL_ORDER = ["responses", "invocations", "invocations_ws", "a2a", "activity"];

/* ---------- tiny DOM helper ---------- */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/* ---------- app state ---------- */
const state = {
  meta: null,
  samples: [],
  byId: new Map(),
  tree: null,
  view: "guide",
  open: new Set(), // expanded block ids
  variantSel: new Map(), // family id -> selected variant sampleId
};

async function loadData() {
  let samplesDoc = window.HA_SAMPLES;
  let treeDoc = window.HA_TREE;
  if (!samplesDoc || !treeDoc) {
    const [s, t] = await Promise.all([
      fetch("data/samples.json").then((r) => r.json()),
      fetch("data/tree.json").then((r) => r.json()),
    ]);
    samplesDoc = s;
    treeDoc = t;
  }
  state.meta = samplesDoc.meta;
  state.samples = samplesDoc.samples;
  state.byId = new Map(state.samples.map((s) => [s.id, s]));
  state.tree = treeDoc;
}

function repoUrl(sample) {
  return state.meta.repoBaseUrl + sample.path;
}

/* ---------- "run this sample" actions ---------- */
const DOCS_QUICKSTART = "https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents";
const FOUNDRY_PORTAL = "https://ai.azure.com/";

/* azd `--runtime` short language token for the sample. */
function codeLang(sample) {
  return sample.language === "csharp" ? "dotnet" : "python";
}

/* The `azd ai agent init -m <url>` argument. Latest azd accepts the sample's
 * GitHub folder URL directly — no agent.manifest.yaml file is required. */
function initSampleUrl(sample) {
  return repoUrl(sample);
}

/* UTF-8-safe base64 (btoa alone breaks on non-ASCII). */
function b64utf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/* Build a generic vscode.dev "create hosted agent" deep link. We intentionally
 * embed only the sample reference (+ optional entry file) and let the visitor
 * pick their own tenant/subscription/project inside VS Code — no personal IDs. */
function vscodeCreatePayload(sample) {
  const variables = {
    agentType: "hostedAgent",
    agentManifestUrl: initSampleUrl(sample),
  };
  if (sample.runFile) variables.runFilePath = sample.runFile;
  return {
    baseUrl: "https://ai.azure.com/modelcache",
    indexUrl: "/agents/code/en/createHostedAgent-package/index.json",
    codeRoute: ["azd", codeLang(sample)],
    variables,
  };
}
function vscodeUrl(sample) {
  const payload = b64utf8(JSON.stringify(vscodeCreatePayload(sample)));
  const q = new URLSearchParams({
    "vscode-azure-exp": "foundry",
    "az-referer": "sample-finder",
  });
  return `https://vscode.dev/azure/?${q.toString()}&createHostedAgentPayload=${payload}`;
}

/* One row of actions shared by every sample card. */
function sampleActions(sample) {
  return el("div", { class: "card-actions" }, [
    el("a", { class: "action-link", href: repoUrl(sample), target: "_blank", rel: "noopener", text: "Open on GitHub ↗" }),
    el("button", {
      class: "action-btn",
      type: "button",
      title: "Show the azd commands to scaffold and deploy this sample",
      onclick: () => openCodeDialog(sample),
    }, "⚡ Code an agent"),
    el("a", { class: "action-link", href: vscodeUrl(sample), target: "_blank", rel: "noopener", title: "Open VS Code for the Web and scaffold this sample", text: "Open in VS Code ↗" }),
  ]);
}

/* ---------- "Code an agent" modal ---------- */
function copyRow(cmd) {
  const code = el("code", { text: cmd });
  const btn = el("button", { class: "copy-btn", type: "button", title: "Copy", "aria-label": "Copy command" }, "⧉");
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      const old = btn.textContent;
      btn.textContent = "✓";
      setTimeout(() => { btn.textContent = old; }, 1200);
    } catch { /* clipboard blocked — no-op */ }
  });
  return el("div", { class: "code-cmd" }, [code, btn]);
}

function codeStep(n, title, node, note) {
  return el("div", { class: "code-step" }, [
    el("h4", {}, [el("span", { class: "code-step-n", text: String(n) }), " " + title]),
    note ? el("p", { class: "code-step-note", html: note }) : null,
    node,
  ]);
}

let codeDialogEl = null;
function closeCodeDialog() {
  if (codeDialogEl) { codeDialogEl.remove(); codeDialogEl = null; }
  document.removeEventListener("keydown", onCodeDialogKey);
}
function onCodeDialogKey(e) { if (e.key === "Escape") closeCodeDialog(); }

function openCodeDialog(sample) {
  closeCodeDialog();
  const runtime = codeLang(sample) === "dotnet" ? "dotnet_10" : "python_3_13";
  const entry = sample.runFile ? sample.runFile.split("/").pop() : "main.py";
  const initCmd = `azd ai agent init -m "${initSampleUrl(sample)}" --deploy-mode code --runtime ${runtime} --entry-point ${entry}`;

  const dialog = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Code an agent" }, [
    el("button", { class: "modal-close", type: "button", "aria-label": "Close", onclick: closeCodeDialog }, "✕"),
    el("h2", { class: "modal-title", text: "Code an agent" }),
    el("p", { class: "modal-sub" }, [
      `Scaffold, provision, and deploy `,
      el("b", { text: sample.title }),
      ` as a Foundry hosted agent with the Azure Developer CLI. `,
      el("a", { href: DOCS_QUICKSTART, target: "_blank", rel: "noopener", text: "View quickstart guide ↗" }),
    ]),
    codeStep(1, "Install Azure Developer CLI", copyRow("winget install microsoft.azd"),
      "Windows (winget). Requires <code>azd &gt;= 1.25.1</code> and the <code>azure.ai.agents</code> extension. macOS/Linux: see the docs."),
    codeStep(2, "Initialize the agent from this sample", copyRow(initCmd),
      "Pulls this sample's source into <code>src/&lt;project&gt;/</code> and appends the agent service to <code>azure.yaml</code>."),
    codeStep(3, "Provision and deploy", copyRow("azd up"),
      "Automatically provisions any missing Foundry resources, then deploys the agent."),
    el("div", { class: "code-step" }, [
      el("h4", {}, [el("span", { class: "code-step-n", text: "4" }), " See and chat with your new agent"]),
      el("a", { class: "action-btn wide", href: FOUNDRY_PORTAL, target: "_blank", rel: "noopener", text: "Open Foundry portal ↗" }),
    ]),
  ]);

  const overlay = el("div", { class: "modal-overlay", onclick: (e) => { if (e.target === overlay) closeCodeDialog(); } }, [dialog]);
  document.body.appendChild(overlay);
  codeDialogEl = overlay;
  document.addEventListener("keydown", onCodeDialogKey);
  const closeBtn = dialog.querySelector(".modal-close");
  if (closeBtn) closeBtn.focus();
}

/* ---------- SDK helpers ---------- */
function sdkMeta(key) {
  return (state.meta.sdks && state.meta.sdks[key]) || { label: key, short: key, color: "#888888" };
}
function sdkOrder() {
  return (state.tree.meta && state.tree.meta.sdkOrder) || Object.keys(state.meta.sdks || {});
}
function sdkDot(key, solid, title) {
  const c = sdkMeta(key).color;
  const style = solid ? `background:${c};border-color:${c}` : `background:transparent;border-color:#cbd5e1`;
  return el("span", {
    class: "dot" + (solid ? "" : " hollow"),
    style,
    title: title || sdkMeta(key).label,
    "aria-hidden": "true",
  });
}
function countLabel(n) {
  return `${n} ${n === 1 ? "sample" : "samples"}`;
}
function sdkCounts(node) {
  const m = new Map();
  const add = (id) => {
    const s = state.byId.get(id);
    if (!s || !s.sdk) return;
    m.set(s.sdk, (m.get(s.sdk) || 0) + 1);
  };
  if (node.families) {
    for (const fam of node.families) for (const v of fam.variants || []) add(typeof v === "string" ? v : v.id);
  } else {
    for (const id of node.sampleIds || []) add(id);
  }
  return m;
}

/* ---------- sample card ---------- */
function sampleCard(sample) {
  if (!sample) return null;
  const sdkBadge = sample.sdk
    ? el("span", { class: "badge sdk" }, [sdkDot(sample.sdk, true), " " + sdkMeta(sample.sdk).label])
    : el("span", { class: `badge framework fw-${sample.framework}`, text: SHORT_FRAMEWORK[sample.framework] || sample.framework });
  const badges = el("div", { class: "badge-row" }, [
    sdkBadge,
    el("span", { class: "badge protocol", text: SHORT_PROTOCOL[sample.protocol] || sample.protocol }),
    el("span", { class: "badge category", text: state.meta.categories[sample.category] || sample.category }),
  ]);
  const tags = el(
    "div",
    { class: "tags" },
    (sample.tags || []).map((t) => el("span", { class: "tag", text: t }))
  );
  const foot = el("div", { class: "card-foot" }, [
    el("span", { class: "path", title: sample.path, text: sample.path }),
    sampleActions(sample),
  ]);
  return el("article", { class: "sample-card" }, [
    el("h3", { text: sample.title + (sample.kind === "client" ? " (client)" : "") }),
    badges,
    el("p", { class: "desc", text: sample.description || "" }),
    tags,
    foot,
  ]);
}

/* ---------- guide: Foundry base + stackable building blocks ---------- */
function toggleBlock(id) {
  if (state.open.has(id)) state.open.delete(id);
  else state.open.add(id);
  renderGuide();
}

function dotRow(node) {
  const counts = sdkCounts(node);
  const row = el("div", { class: "dot-row" });
  for (const key of sdkOrder()) {
    const n = counts.get(key) || 0;
    const label = sdkMeta(key).label;
    row.appendChild(sdkDot(key, n > 0, n > 0 ? `${label}: ${countLabel(n)}` : `${label}: no sample yet`));
  }
  return row;
}

/* a consolidated capability: one card, one chip per real framework·protocol variant */
function fwChipName(sdk) {
  return sdk === "native" ? "Native" : sdkMeta(sdk).label;
}
function variantButtonLabel(sample, note) {
  const fw = fwChipName(sample.sdk);
  const proto = SHORT_PROTOCOL[sample.protocol] || sample.protocol;
  return note ? `${fw} · ${proto} · ${note}` : `${fw} · ${proto}`;
}

function familyVariants(family) {
  return (family.variants || [])
    .map((v) => {
      const id = typeof v === "string" ? v : v.id;
      const note = typeof v === "string" ? null : v.note;
      return { id, note, sample: state.byId.get(id) };
    })
    .filter((v) => v.sample);
}

function familyCard(family) {
  const variants = familyVariants(family);
  if (!variants.length) return null;
  const selId = state.variantSel.get(family.id) || variants[0].id;

  // single-layer tile: capability title + in-card chips + the selected variant's fields
  const desc = el("p", { class: "desc" });
  const path = el("span", { class: "path" });
  const actions = el("div", { class: "card-actions-host" });
  const foot = el("div", { class: "card-foot" }, [path, actions]);
  const fill = (sample) => {
    desc.textContent = sample.description || "";
    path.textContent = sample.path;
    path.title = sample.path;
    actions.innerHTML = "";
    actions.appendChild(sampleActions(sample));
  };

  const btnRow = el("div", { class: "variant-toggle", role: "tablist" });
  variants.forEach((v) => {
    const active = v.id === selId;
    const btn = el(
      "button",
      {
        class: "variant-btn" + (active ? " active" : ""),
        type: "button",
        role: "tab",
        "aria-selected": String(active),
        title: variantButtonLabel(v.sample, v.note),
        onclick: () => {
          state.variantSel.set(family.id, v.id);
          btnRow.querySelectorAll(".variant-btn").forEach((b) => {
            b.classList.remove("active");
            b.setAttribute("aria-selected", "false");
          });
          btn.classList.add("active");
          btn.setAttribute("aria-selected", "true");
          fill(v.sample);
        },
      },
      [sdkDot(v.sample.sdk, true), variantButtonLabel(v.sample, v.note)]
    );
    btnRow.appendChild(btn);
  });

  const sel = variants.find((v) => v.id === selId) || variants[0];
  fill(sel.sample);

  return el("article", { class: "sample-card capability-card" }, [
    el("h3", { class: "cap-title", text: family.title }),
    btnRow,
    desc,
    foot,
  ]);
}

function familyCoverage(family) {
  const vs = familyVariants(family);
  return { variants: vs.length, frameworks: new Set(vs.map((v) => v.sample.sdk)).size };
}

function blockPanel(node) {
  const panel = el("div", { class: "block-panel" });
  if (node.description) panel.appendChild(el("p", { class: "block-longdesc", text: node.description }));
  const fams = (node.families || []).slice().sort((a, b) => {
    const ca = familyCoverage(a);
    const cb = familyCoverage(b);
    return cb.variants - ca.variants || cb.frameworks - ca.frameworks;
  });
  if (!fams.length) {
    panel.appendChild(el("div", { class: "empty", text: "No samples mapped to this block." }));
    return panel;
  }
  panel.appendChild(el("div", { class: "family-grid" }, fams.map((f) => familyCard(f))));
  return panel;
}

function blockCard(node, opts = {}) {
  const isOpen = state.open.has(node.id);
  const n = (node.families || node.sampleIds || []).length;
  const row = el(
    "button",
    { class: "block-row", "aria-expanded": String(isOpen), onclick: () => toggleBlock(node.id) },
    [
      el("span", { class: "caret" + (isOpen ? " open" : ""), "aria-hidden": "true", text: "▸" }),
      el("span", { class: "block-main" }, [
        el("span", { class: "block-title-row" }, [
          opts.base ? el("span", { class: "base-tag", text: "BASE" }) : null,
          el("b", { class: "block-title", text: node.title }),
          node.tagline ? el("span", { class: "block-tagline", text: node.tagline }) : null,
        ]),
        !isOpen && node.description ? el("span", { class: "block-desc", text: node.description }) : null,
      ]),
      el("span", { class: "block-right" }, [dotRow(node), el("span", { class: "block-count", text: countLabel(n) })]),
    ]
  );
  const card = el("section", { class: "block-card" + (opts.base ? " base" : ""), dataset: { open: String(isOpen) } }, [row]);
  if (isOpen) card.appendChild(blockPanel(node));
  return card;
}

function sdkLegend() {
  const items = sdkOrder().map((key) =>
    el("li", { class: "legend-item" }, [sdkDot(key, true), el("span", { text: sdkMeta(key).label })])
  );
  return el("div", { class: "sdk-legend" }, [
    el("span", { class: "legend-title", text: "SDK legend" }),
    el("ul", { class: "legend-list" }, items),
  ]);
}

function renderGuide() {
  const host = document.getElementById("guideTree");
  host.innerHTML = "";
  if (!state.tree || !state.tree.base) {
    host.appendChild(el("div", { class: "empty", text: "Guide failed to load." }));
    return;
  }
  host.appendChild(
    el("div", { class: "blocks-head" }, [
      el("div", { class: "blocks-head-text" }, [
        el("h2", { text: "Start with the Foundry base, then stack building blocks" }),
        el("p", {
          class: "blocks-sub",
          text: "Each block’s dots show which frameworks already have a sample for it. Open a block, then switch framework or protocol with the buttons on each card.",
        }),
      ]),
      sdkLegend(),
    ])
  );

  const stack = el("div", { class: "stack" });
  stack.appendChild(blockCard(state.tree.base, { base: true }));

  const blocks = state.tree.blocks || [];
  const groups = state.tree.groups;
  if (Array.isArray(groups) && groups.length) {
    const byId = new Map(blocks.map((b) => [b.id, b]));
    groups.forEach((group) => {
      stack.appendChild(
        el("div", { class: "stack-group-head" }, [
          el("span", { class: "stack-group-title", text: group.title }),
          group.tagline ? el("span", { class: "stack-group-tagline", text: group.tagline }) : null,
        ])
      );
      (group.blocks || []).forEach((id) => {
        const node = byId.get(id);
        if (node) stack.appendChild(blockCard(node));
      });
    });
  } else {
    stack.appendChild(el("div", { class: "stack-caption", text: "Stack building blocks on top ↓" }));
    blocks.forEach((b) => stack.appendChild(blockCard(b)));
  }
  host.appendChild(stack);
}

/* ---------- browse ---------- */
const browseState = { q: "", framework: "", protocol: "", category: "", level: "", smart: false, status: "idle", data: null, q0: "", error: "" };

function populateFilters() {
  const mk = (id, entries, allLabel) => {
    const sel = document.getElementById(id);
    sel.innerHTML = "";
    sel.appendChild(el("option", { value: "", text: allLabel }));
    for (const [value, label] of entries) sel.appendChild(el("option", { value, text: label }));
  };
  mk("f-framework", Object.keys(state.meta.frameworks).map((k) => [k, SHORT_FRAMEWORK[k] || k]), "All frameworks");
  mk("f-protocol", PROTOCOL_ORDER.filter((k) => state.meta.protocols[k]).map((k) => [k, SHORT_PROTOCOL[k] || k]), "All protocols");
  mk("f-category", Object.entries(state.meta.categories), "All categories");
  mk("f-level", LEVEL_ORDER.map((k) => [k, k[0].toUpperCase() + k.slice(1)]), "All levels");
}

function filterSamples() {
  const q = browseState.q.trim().toLowerCase();
  return state.samples.filter((s) => {
    if (browseState.framework && s.framework !== browseState.framework) return false;
    if (browseState.protocol && s.protocol !== browseState.protocol) return false;
    if (browseState.category && s.category !== browseState.category) return false;
    if (browseState.level && s.level !== browseState.level) return false;
    if (q) {
      const hay = [s.title, s.description, s.path, (s.tags || []).join(" ")].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderBrowse() {
  const grid = document.getElementById("browseGrid");
  const count = document.getElementById("browseCount");
  grid.innerHTML = "";
  grid.classList.toggle("smart-mode", browseState.smart);
  if (browseState.smart) { renderBrowseAgent(grid, count); return; }
  const results = filterSamples();
  count.textContent = `${results.length} of ${state.samples.length} samples`;
  if (!results.length) {
    grid.appendChild(el("div", { class: "empty", text: "No samples match those filters." }));
    return;
  }
  for (const s of results) grid.appendChild(sampleCard(s));
}

/* Smart-search results in the Browse grid — same single search box, agent-backed. */
function renderBrowseAgent(grid, count) {
  const st = browseState;
  if (st.status === "loading") {
    count.textContent = "";
    grid.appendChild(el("div", { class: "smart-badge", html: "⚡ Asking the Foundry agent…" }));
    grid.appendChild(el("p", { class: "kit-hint", text: `“${st.q0}”` }));
    return;
  }
  if (st.status === "error") {
    count.textContent = "";
    grid.appendChild(el("div", { class: "smart-badge err", html: "⚠️ Couldn’t reach the Foundry agent" }));
    grid.appendChild(el("p", { class: "kit-hint", html: `The smart-search proxy isn’t responding (<code>${st.error}</code>). Start it with <code>python tools/smart-search-proxy.py</code> (after <code>az login</code>), or turn off Smart search to use the keyword filter.` }));
    const offline = filterSamples();
    if (offline.length) {
      grid.appendChild(el("p", { class: "guided-alts-label", text: "Meanwhile, the keyword filter suggests:" }));
      const list = el("div", { class: "card-grid" });
      offline.slice(0, 6).forEach((s) => list.appendChild(sampleCard(s)));
      grid.appendChild(list);
    }
    return;
  }
  if (st.status === "ok" && st.data) {
    const { matches, understood } = st.data;
    const entries = matches.map((m) => { const s = sampleById(m.id); return s ? { sample: s, note: m.why } : null; }).filter(Boolean);
    count.textContent = `${entries.length} ${entries.length === 1 ? "pick" : "picks"} from the Foundry agent`;
    grid.appendChild(el("div", { class: "smart-badge", html: "⚡ Picked by your Foundry hosted agent" }));
    if (understood.length) {
      grid.appendChild(el("div", { class: "understood" }, [
        el("span", { class: "understood-label", text: "Understood as:" }),
        ...understood.map((l) => el("span", { class: "understood-chip", text: l })),
      ]));
    }
    if (!entries.length) {
      grid.appendChild(el("p", { class: "kit-hint", text: "The agent didn’t find a matching sample for that. Try describing the capability differently." }));
    } else {
      const list = el("div", { class: "kit-list" });
      entries.forEach((entry, i) => list.appendChild(kitSampleCard(entry, {
        recommended: i === 0,
        blockLabel: state.meta.categories[entry.sample.category] || entry.sample.category,
        showFw: true,
      })));
      grid.appendChild(list);
    }
    return;
  }
  // idle
  count.textContent = "";
  grid.appendChild(el("p", { class: "kit-hint", text: "Describe what you want to build and press Enter (or “Ask agent”). A deployed Foundry agent reads the whole catalog and picks the best sample." }));
}

/* Keep the single search box's chrome (placeholder + Ask button) in sync. */
function updateBrowseChrome() {
  const input = document.getElementById("search");
  const btn = document.getElementById("btnAskAgent");
  if (input) {
    input.placeholder = browseState.smart
      ? "✨ Ask the Foundry agent — describe what you want to build, then press Enter"
      : "Search samples (title, description, tags)…";
  }
  if (btn) btn.hidden = !browseState.smart;
}

function runBrowseSmart() {
  runSmartFor(browseState, browseState.q, renderBrowse, null);
}

function wireBrowse() {
  const searchEl = document.getElementById("search");
  searchEl.addEventListener("input", (e) => {
    browseState.q = e.target.value;
    if (browseState.smart) return; // smart mode searches on submit, not per keystroke
    renderBrowse();
  });
  searchEl.addEventListener("keydown", (e) => {
    if (browseState.smart && e.key === "Enter") { e.preventDefault(); runBrowseSmart(); }
  });
  document.getElementById("btnAskAgent").addEventListener("click", runBrowseSmart);
  document.getElementById("browseSmartToggle").addEventListener("change", (e) => {
    browseState.smart = e.target.checked;
    browseState.status = "idle";
    browseState.data = null;
    browseState.error = "";
    updateBrowseChrome();
    renderBrowse();
  });
  const bind = (id, key) =>
    document.getElementById(id).addEventListener("change", (e) => {
      browseState[key] = e.target.value;
      renderBrowse();
    });
  bind("f-framework", "framework");
  bind("f-protocol", "protocol");
  bind("f-category", "category");
  bind("f-level", "level");
  document.getElementById("btnClearFilters").addEventListener("click", () => {
    Object.assign(browseState, { q: "", framework: "", protocol: "", category: "", level: "", status: "idle", data: null, error: "" });
    document.getElementById("search").value = "";
    for (const id of ["f-framework", "f-protocol", "f-category", "f-level"]) document.getElementById(id).value = "";
    renderBrowse();
  });
  updateBrowseChrome();
}

/* ================================================================
 * Shared helpers for the two experimental "starter" prototypes.
 * Both consume the same building-blocks data (base + blocks/families/
 * variants) but reframe it around the user's real question:
 * "given MY framework, which sample(s) should I actually start from?"
 * ================================================================ */
function allBlocks() {
  return [state.tree.base, ...(state.tree.blocks || [])].filter(Boolean);
}
/* every {sample, note, family} in a block that matches the given sdk */
function blockSamplesFor(block, sdk) {
  const out = [];
  for (const fam of block.families || []) {
    for (const v of familyVariants(fam)) {
      if (!sdk || v.sample.sdk === sdk) out.push({ sample: v.sample, note: v.note, family: fam });
    }
  }
  return out;
}
function blockHasSdk(block, sdk) {
  return blockSamplesFor(block, sdk).length > 0;
}
/* pick the best single sample from a list: prefer 'responses', else protocol order, else first */
function bestSample(entries) {
  if (!entries.length) return null;
  const rank = (p) => {
    const i = PROTOCOL_ORDER.indexOf(p);
    return i === -1 ? 99 : i;
  };
  return entries.slice().sort((a, b) => rank(a.sample.protocol) - rank(b.sample.protocol))[0];
}
function frameworkChoices() {
  return sdkOrder().map((k) => ({ key: k, label: sdkMeta(k).label }));
}
/* compact result card used by both prototypes */
function kitSampleCard(entry, opts = {}) {
  const s = entry.sample;
  const fwName = s.sdk ? sdkMeta(s.sdk).label : (SHORT_FRAMEWORK[s.framework] || s.framework);
  const head = el("div", { class: "kit-card-head" }, [
    opts.step != null ? el("span", { class: "kit-step", text: String(opts.step) }) : null,
    sdkDot(s.sdk || "native", !!s.sdk),
    el("b", { class: "kit-card-title", text: s.title }),
    el("span", { class: "badge protocol", text: SHORT_PROTOCOL[s.protocol] || s.protocol }),
    entry.note ? el("span", { class: "kit-note", text: entry.note }) : null,
    opts.recommended ? el("span", { class: "kit-rec", text: "★ recommended" }) : null,
  ]);
  return el("article", { class: "kit-card" + (opts.recommended ? " rec" : "") }, [
    opts.blockLabel ? el("span", { class: "kit-block-label" }, [
      opts.blockLabel,
      opts.showFw ? el("span", { class: "kit-fw", text: " · " + fwName }) : null,
    ]) : null,
    head,
    el("p", { class: "kit-card-desc", text: s.description || "" }),
    el("div", { class: "kit-card-foot" }, [
      el("span", { class: "path", title: s.path, text: s.path }),
      sampleActions(s),
    ]),
  ]);
}

/* ================================================================
 * Prototype A — Compose a starter kit (compositional / stacking)
 * Pick ONE framework + the capabilities you need → get a tailored,
 * framework-filtered set of samples (base agent always included).
 * ================================================================ */
const composeState = { framework: null, blocks: new Set() };

function renderCompose() {
  const host = document.getElementById("composeApp");
  if (!host) return;
  if (!composeState.framework) composeState.framework = sdkOrder()[0];
  host.innerHTML = "";

  host.appendChild(
    el("div", { class: "proto-intro" }, [
      el("h2", { text: "Compose your starter kit" }),
      el("p", { text: "Pick the framework you’re building with, then check the capabilities you need. You’ll get a tailored set of samples to read — the base agent plus one per capability, all for your framework." }),
    ])
  );

  /* Step 1 — framework (single-select) */
  const fwRow = el("div", { class: "chip-row" });
  frameworkChoices().forEach((f) => {
    const active = composeState.framework === f.key;
    fwRow.appendChild(
      el("button", {
        class: "choice-chip" + (active ? " active" : ""),
        type: "button",
        onclick: () => { composeState.framework = f.key; renderCompose(); },
      }, [sdkDot(f.key, true), f.label])
    );
  });
  host.appendChild(el("div", { class: "proto-step" }, [el("span", { class: "step-label", text: "1 · Your framework" }), fwRow]));

  /* Step 2 — capabilities (multi-select), showing per-framework availability */
  const fw = composeState.framework;
  const capRow = el("div", { class: "chip-row wrap" });
  (state.tree.blocks || []).forEach((b) => {
    const n = blockSamplesFor(b, fw).length;
    const avail = n > 0;
    const sel = composeState.blocks.has(b.id);
    if (!avail && sel) composeState.blocks.delete(b.id);
    const chip = el("button", {
      class: "cap-chip" + (sel ? " active" : "") + (avail ? "" : " disabled"),
      type: "button",
      disabled: avail ? null : "true",
      title: avail ? "" : `No ${sdkMeta(fw).label} sample for this capability yet`,
      onclick: avail ? () => { sel ? composeState.blocks.delete(b.id) : composeState.blocks.add(b.id); renderCompose(); } : null,
    }, [
      el("span", { class: "cap-check", text: sel ? "✓" : "+" }),
      el("span", { text: b.title }),
      el("span", { class: "cap-count", text: avail ? String(n) : "—" }),
    ]);
    capRow.appendChild(chip);
  });
  host.appendChild(el("div", { class: "proto-step" }, [
    el("span", { class: "step-label", text: `2 · Capabilities to stack` }),
    capRow,
    el("div", { class: "step-actions" }, [
      el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { composeState.blocks = new Set((state.tree.blocks || []).filter((b) => blockHasSdk(b, fw)).map((b) => b.id)); renderCompose(); }, text: "Select all available" }),
      el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { composeState.blocks = new Set(); renderCompose(); }, text: "Clear" }),
    ]),
  ]));

  /* Step 3 — the resulting build path */
  const kit = el("div", { class: "kit-result" });
  const baseEntry = bestSample(blockSamplesFor(state.tree.base, fw));
  const chosen = (state.tree.blocks || []).filter((b) => composeState.blocks.has(b.id));
  const total = (baseEntry ? 1 : 0) + chosen.length;
  kit.appendChild(
    el("div", { class: "kit-summary" }, [
      el("b", { text: `Your kit: ${sdkMeta(fw).label}` }),
      el("span", { text: ` · ${chosen.length} ${chosen.length === 1 ? "capability" : "capabilities"} · ${total} ${total === 1 ? "sample" : "samples"}` }),
    ])
  );
  if (chosen.length) {
    kit.appendChild(
      el("p", { class: "kit-explainer", html: "No single sample combines these — each capability is its own sample. Read them in the order below, then <b>stack the patterns together in your own agent</b>." })
    );
  }
  const list = el("div", { class: "kit-list" });
  let step = 0;
  if (baseEntry) list.appendChild(kitSampleCard(baseEntry, { recommended: true, blockLabel: "Base · start here", step: ++step }));
  chosen.forEach((b) => {
    const entry = bestSample(blockSamplesFor(b, fw));
    if (entry) list.appendChild(kitSampleCard(entry, { blockLabel: b.title, step: ++step }));
  });
  if (!chosen.length) list.appendChild(el("p", { class: "kit-hint", text: "Check some capabilities above to build your path. The base agent is always step 1 — your starting point." }));
  kit.appendChild(list);
  host.appendChild(el("div", { class: "proto-step" }, [el("span", { class: "step-label", text: "3 · Your build path" }), kit]));
}

/* ================================================================
 * Prototype B — Guided path to ONE sample
 * Two short questions (framework → first capability) that narrow the
 * whole catalog down to a single recommended sample (+ alternates).
 * ================================================================ */
const guidedState = { framework: null, blockId: null, q: "", smart: false, smartStatus: "idle", smartData: null, smartQ: "", smartError: "" };

/* Optional Foundry-agent-backed "smart search".
 * The catalog app is static, so it can't call the Foundry hosted agent
 * directly (Entra auth + no CORS). A tiny local dev proxy
 * (tools/smart-search-proxy.py) injects the developer's az-login token and
 * forwards the query to the deployed agent. When the proxy isn't running we
 * silently fall back to the offline lexicon search. */
const SMART_PROXY_BASE = (typeof window !== "undefined" && window.SF_SMART_PROXY) || "http://localhost:8178";

function sampleById(id) {
  return (state.byId && state.byId.get(id)) || (state.samples || []).find((s) => s.id === id) || null;
}

/* Ask the Foundry agent (via the local proxy). Falls back to offline on error. */
async function runSmartSearch(query) {
  const q = (query || "").trim();
  if (q.length < 2) return;
  guidedState.smartStatus = "loading";
  guidedState.smartQ = q;
  guidedState.smartError = "";
  guidedState.smartData = null;
  renderGuided({ focusSearch: true });
  try {
    const ask = guidedState.framework
      ? `${q} — using the ${sdkMeta(guidedState.framework).label} framework`
      : q;
    const resp = await fetch(`${SMART_PROXY_BASE}/search?q=${encodeURIComponent(ask)}`, { method: "GET" });
    if (!resp.ok) throw new Error(`proxy returned HTTP ${resp.status}`);
    const data = await resp.json();
    guidedState.smartData = { matches: data.matches || [], understood: data.understood || [] };
    guidedState.smartStatus = "ok";
  } catch (e) {
    guidedState.smartStatus = "error";
    guidedState.smartError = String((e && e.message) || e);
  }
  renderGuided({ focusSearch: true });
}

function guidedReset() {
  guidedState.framework = null;
  guidedState.blockId = null;
  guidedState.q = "";
  guidedState.smartStatus = "idle";
  guidedState.smartData = null;
  guidedState.smartQ = "";
  guidedState.smartError = "";
  renderGuided();
}

/* ---- natural-language-ish query understanding (fully offline) ----
 * The app is static (works over file:// and GitHub Pages), so there's no
 * LLM to call. Instead we tokenize the phrase, drop filler words, and expand
 * it through an intent lexicon so everyday phrasing maps onto the concepts
 * that actually appear in the sample catalog. */
const GUIDED_STOPWORDS = new Set(
  ("a an the and or but so to of in on for with that this these those i we you my our your me us it its is are be am " +
    "want wants need needs would like just able can could should how do does make making add adding use using build " +
    "building create creating agent agents app apps application sample samples foundry hosted something anything " +
    "please help get got have has let lets when where what which who your over into from about then them they there here")
    .split(/\s+/)
);
const INTENT_RULES = [
  { label: "Memory", triggers: ["remember", "memory", "memories", "recall", "forget", "past conversation", "past chats", "history", "remembers", "persist", "long-term"], expand: ["memory"] },
  { label: "Knowledge / RAG", triggers: ["rag", "retrieval", "retrieve", "knowledge base", "knowledge", "document", "documents", "grounding", "ground", "index", "azure search", "look up", "lookup", "cite", "sources"], expand: ["rag", "search", "knowledge", "retrieval"] },
  { label: "Skills", triggers: ["skill", "skills", "reusable"], expand: ["skill"] },
  { label: "Tools", triggers: ["tool", "tools", "function", "functions", "call an api", "call external", "custom function"], expand: ["tool", "function"] },
  { label: "MCP", triggers: ["mcp", "model context protocol", "remote tool"], expand: ["mcp"] },
  { label: "Toolbox", triggers: ["toolbox", "hosted tool", "web search", "code interpreter", "managed tool"], expand: ["toolbox"] },
  { label: "Human-in-the-loop", triggers: ["human", "approve", "approval", "review", "confirm", "sign off", "in the loop", "hitl", "wait for", "permission"], expand: ["human", "approval", "loop"] },
  { label: "Teams / M365", triggers: ["teams", "microsoft teams", "m365", "microsoft 365", "channel", "chat app", "publish"], expand: ["teams", "activity", "channel"] },
  { label: "Orchestration", triggers: ["multi-agent", "multi agent", "orchestrate", "orchestration", "workflow", "workflows", "delegate", "delegation", "handoff", "hand off", "coordinate", "several agents", "multiple agents", "a2a", "agent to agent"], expand: ["workflow", "orchestration", "a2a", "delegation", "multi-agent"] },
  { label: "Observability", triggers: ["observability", "trace", "tracing", "monitor", "monitoring", "logging", "logs", "telemetry", "debug"], expand: ["observability", "tracing"] },
  { label: "Security & governance", triggers: ["security", "governance", "guardrail", "content safety", "moderation", "safe", "identity", "managed identity", "secret", "secrets", "credentials", "auth", "rbac"], expand: ["security", "content", "safety", "identity", "downstream", "env"] },
  { label: "Optimization", triggers: ["optimize", "optimization", "optimise", "improve", "evaluate", "evaluation", "tune", "tuning", "quality"], expand: ["optimization"] },
  { label: "Browser / computer use", triggers: ["browser", "web page", "scrape", "scraping", "automate browser", "computer use", "fill form", "navigate"], expand: ["browser"] },
  { label: "Files & documents", triggers: ["file", "files", "document upload", "upload", "pdf", "attachment", "attach"], expand: ["file", "document"] },
  { label: "Background / async", triggers: ["background", "async", "asynchronous", "long running", "long-running", "queue", "event", "trigger", "webhook", "scheduled"], expand: ["background", "async", "event"] },
  { label: "Notetaking", triggers: ["note", "notes", "notetaking", "note-taking"], expand: ["note"] },
  { label: "Sessions / multi-user", triggers: ["session", "sessions", "multiplex", "multi-user", "multiple users", "per user"], expand: ["session", "multiplex"] },
  { label: "Getting started", triggers: ["basic", "hello", "hello world", "get started", "getting started", "simple", "minimal", "chatbot", "starter"], expand: ["basic", "chat"] },
  { label: "Other SDKs", triggers: ["openai agents", "claude", "anthropic", "copilot", "github copilot", "pydantic", "ag-ui", "crewai", "adapter", "another framework"], expand: ["openai", "claude", "copilot", "pydantic", "ag-ui", "adapter"] },
];

function expandQuery(q) {
  const raw = q.toLowerCase();
  const tokens = new Set();
  const concepts = new Set();
  const labels = new Set();
  raw.split(/[^a-z0-9]+/).forEach((tok) => {
    if (tok && tok.length >= 3 && !GUIDED_STOPWORDS.has(tok)) tokens.add(tok);
  });
  for (const rule of INTENT_RULES) {
    if (rule.triggers.some((tr) => raw.includes(tr))) {
      rule.expand.forEach((e) => concepts.add(e));
      labels.add(rule.label);
    }
  }
  return { tokens, concepts, labels: [...labels] };
}

let _blockInfo = null;
function blockInfoFor(id) {
  if (!_blockInfo) {
    _blockInfo = new Map();
    for (const b of allBlocks()) {
      for (const fam of b.families || []) {
        for (const v of familyVariants(fam)) {
          _blockInfo.set(v.sample.id, { blockTitle: b.title, blockTagline: b.tagline || "", familyTitle: fam.title });
        }
      }
    }
  }
  return _blockInfo.get(id) || { blockTitle: "", blockTagline: "", familyTitle: "" };
}
function sampleDoc(s) {
  const bi = blockInfoFor(s.id);
  return {
    title: (s.title || "").toLowerCase(),
    tags: (s.tags || []).join(" ").toLowerCase(),
    cat: (state.meta.categories[s.category] || "").toLowerCase(),
    desc: (s.description || "").toLowerCase(),
    block: (bi.blockTitle + " " + bi.blockTagline + " " + bi.familyTitle).toLowerCase(),
  };
}

/* free-text search over the building-block samples (52 with an sdk)
   Exact keyword match: tokenize the query and require EVERY typed term to
   appear (as a substring) somewhere in the sample's text. This keeps offline
   results precise and predictable; when nothing matches we hand off to Smart
   search (the Foundry agent) which does the fuzzy/semantic understanding. */
function guidedSearch(q) {
  const { labels } = expandQuery(q);
  const fw = guidedState.framework;
  const rank = (p) => { const i = PROTOCOL_ORDER.indexOf(p); return i === -1 ? 99 : i; };
  const terms = (q || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && t.length >= 2 && !GUIDED_STOPWORDS.has(t));
  if (!terms.length) return { results: [], labels };
  const scored = [];
  for (const s of state.samples) {
    if (!s.sdk) continue; // stay within the building-block universe
    if (fw && s.sdk !== fw) continue;
    const d = sampleDoc(s);
    let score = 0;
    let matchedAll = true;
    for (const t of terms) {
      let hit = 0;
      if (d.title.includes(t)) hit += 10;
      if (d.tags.includes(t)) hit += 6;
      if (d.block.includes(t)) hit += 4;
      if (d.cat.includes(t)) hit += 3;
      if (d.desc.includes(t)) hit += 2;
      if (hit === 0) { matchedAll = false; break; } // exact match: every term must appear
      score += hit;
    }
    if (matchedAll) scored.push({ sample: s, score });
  }
  scored.sort((a, b) => b.score - a.score || rank(a.sample.protocol) - rank(b.sample.protocol));
  return { results: scored, labels };
}

function renderGuided(opts = {}) {
  const host = document.getElementById("guidedApp");
  if (!host) return;
  host.innerHTML = "";
  host.appendChild(
    el("div", { class: "proto-intro" }, [
      el("h2", { text: "Guide me to one sample" }),
      el("p", { text: "Answer two quick questions — or just type what you want to build — and land on the single best sample to start from." }),
    ])
  );

  /* persistent free-text search box */
  const searchInput = el("input", {
    type: "search",
    class: "search",
    value: guidedState.q,
    placeholder: guidedState.smart
      ? "✨ Ask the Foundry agent — e.g. “I want my agent to remember past chats”, then press Enter"
      : "🔎 Describe it in your own words — e.g. “I want my agent to remember past chats”",
    "aria-label": "Search samples",
    oninput: (e) => {
      guidedState.q = e.target.value;
      if (guidedState.smart) return; // smart mode searches on submit, not per keystroke
      renderGuided({ focusSearch: true, caret: e.target.selectionStart });
    },
    onkeydown: (e) => {
      if (guidedState.smart && e.key === "Enter") { e.preventDefault(); runSmartSearch(guidedState.q); }
    },
  });
  const searchRow = el("div", { class: "guided-search" }, [searchInput]);
  if (guidedState.smart) {
    searchRow.appendChild(el("button", {
      class: "btn btn-primary btn-sm", type: "button",
      onclick: () => runSmartSearch(guidedState.q),
      text: guidedState.smartStatus === "loading" ? "Asking…" : "Ask agent",
    }));
  }
  if (guidedState.framework) {
    searchRow.appendChild(el("span", { class: "guided-search-scope", text: `within ${sdkMeta(guidedState.framework).label}` }));
  }
  host.appendChild(searchRow);

  /* smart-search toggle */
  host.appendChild(el("label", { class: "smart-toggle" }, [
    el("input", {
      type: "checkbox", checked: guidedState.smart ? "checked" : null,
      onchange: (e) => {
        guidedState.smart = e.target.checked;
        guidedState.smartStatus = "idle";
        guidedState.smartData = null;
        guidedState.smartError = "";
        renderGuided({ focusSearch: true });
      },
    }),
    el("span", { class: "smart-toggle-text", html: "✨ <b>Smart search</b> — let a deployed Foundry agent pick the sample" }),
  ]));

  const restoreFocus = () => {
    if (opts.focusSearch) {
      const inp = host.querySelector(".guided-search input");
      if (inp) { inp.focus(); const c = opts.caret != null ? opts.caret : inp.value.length; try { inp.setSelectionRange(c, c); } catch (_) {} }
    }
  };

  /* SMART SEARCH MODE — results come from the Foundry hosted agent */
  if (guidedState.smart) {
    const body = el("div", { class: "guided-body" });
    if (guidedState.smartStatus === "loading") {
      body.appendChild(el("div", { class: "smart-badge", html: "⚡ Asking the Foundry agent…" }));
      body.appendChild(el("p", { class: "kit-hint", text: `“${guidedState.smartQ}”` }));
    } else if (guidedState.smartStatus === "error") {
      body.appendChild(el("div", { class: "smart-badge err", html: "⚠️ Couldn’t reach the Foundry agent" }));
      body.appendChild(el("p", { class: "kit-hint", html: `The smart-search proxy isn’t responding (<code>${guidedState.smartError}</code>). Start it with <code>python tools/smart-search-proxy.py</code> (after <code>az login</code>), or turn off Smart search to use the offline finder.` }));
      const { results } = guidedSearch(guidedState.smartQ || guidedState.q);
      if (results.length) {
        body.appendChild(el("p", { class: "guided-alts-label", text: "Meanwhile, the offline finder suggests:" }));
        const list = el("div", { class: "kit-list" });
        results.slice(0, 4).forEach((entry, i) => list.appendChild(kitSampleCard(entry, { recommended: i === 0, blockLabel: state.meta.categories[entry.sample.category] || entry.sample.category, showFw: !guidedState.framework })));
        body.appendChild(list);
      }
    } else if (guidedState.smartStatus === "ok" && guidedState.smartData) {
      const { matches, understood } = guidedState.smartData;
      body.appendChild(el("div", { class: "smart-badge", html: "⚡ Picked by your Foundry hosted agent" }));
      if (understood.length) {
        body.appendChild(el("div", { class: "understood" }, [
          el("span", { class: "understood-label", text: "Understood as:" }),
          ...understood.map((l) => el("span", { class: "understood-chip", text: l })),
        ]));
      }
      const entries = matches.map((m) => { const s = sampleById(m.id); return s ? { sample: s, note: m.why } : null; }).filter(Boolean);
      if (!entries.length) {
        body.appendChild(el("p", { class: "kit-hint", text: "The agent didn’t find a matching sample for that. Try describing the capability differently." }));
      } else {
        const list = el("div", { class: "kit-list" });
        entries.forEach((entry, i) => list.appendChild(kitSampleCard(entry, {
          recommended: i === 0,
          blockLabel: state.meta.categories[entry.sample.category] || entry.sample.category,
          showFw: !guidedState.framework,
        })));
        body.appendChild(list);
      }
    } else {
      body.appendChild(el("p", { class: "kit-hint", text: "Type what you want to build and press Enter (or “Ask agent”). A deployed Foundry agent reads the whole catalog and picks the best sample." }));
    }
    host.appendChild(body);
    restoreFocus();
    return;
  }

  /* SEARCH MODE — offline lexicon, overrides the step flow when typing */
  if (guidedState.q.trim().length >= 2) {
    const { results, labels } = guidedSearch(guidedState.q);
    const body = el("div", { class: "guided-body" });
    if (labels.length) {
      body.appendChild(el("div", { class: "understood" }, [
        el("span", { class: "understood-label", text: "Understood as:" }),
        ...labels.map((l) => el("span", { class: "understood-chip", text: l })),
      ]));
    }
    body.appendChild(el("p", { class: "guided-alts-label", text: `${results.length} ${results.length === 1 ? "match" : "matches"}${guidedState.framework ? " in " + sdkMeta(guidedState.framework).label : ""}` }));
    if (!results.length) {
      body.appendChild(el("p", { class: "kit-hint", text: "No samples matched your keywords." }));
      body.appendChild(el("div", { class: "smart-cta" }, [
        el("p", { class: "smart-cta-text", html: "Let a deployed <b>Foundry agent</b> read the whole catalog and find the best match for you." }),
        el("button", {
          class: "btn btn-primary smart-cta-btn", type: "button",
          onclick: () => { guidedState.smart = true; runSmartSearch(guidedState.q); },
          html: "✨ Ask the Foundry agent",
        }),
      ]));
      body.appendChild(el("p", { class: "kit-hint", text: "…or try different words (e.g. “remember past chats”, “let a human approve”, “connect my own tools”), or clear the box to use the guided questions." }));
    } else {
      const list = el("div", { class: "kit-list" });
      results.forEach((entry, i) => list.appendChild(kitSampleCard(entry, {
        recommended: i === 0,
        blockLabel: state.meta.categories[entry.sample.category] || entry.sample.category,
        showFw: !guidedState.framework,
      })));
      body.appendChild(list);
    }
    body.appendChild(el("div", { class: "step-actions" }, [
      el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { guidedState.q = ""; renderGuided(); }, text: "✕ Clear search & use questions" }),
    ]));
    host.appendChild(body);
    restoreFocus();
    return;
  }

  // progress / breadcrumb
  const crumbs = el("div", { class: "guided-crumbs" });
  if (guidedState.framework) {
    crumbs.appendChild(el("button", { class: "crumb", type: "button", onclick: () => { guidedState.blockId = null; renderGuided(); }, html: `Framework: <b>${sdkMeta(guidedState.framework).label}</b>` }));
  }
  if (guidedState.framework || guidedState.blockId) {
    crumbs.appendChild(el("button", { class: "crumb crumb-reset", type: "button", onclick: guidedReset, text: "↺ Start over" }));
  }
  if (crumbs.childNodes.length) host.appendChild(crumbs);

  /* Step 1 — framework */
  if (!guidedState.framework) {
    const q = el("div", { class: "guided-q" }, [el("h3", { text: "Which framework are you building with?" })]);
    const opts2 = el("div", { class: "guided-options" });
    frameworkChoices().forEach((f) => {
      opts2.appendChild(
        el("button", { class: "guided-opt", type: "button", onclick: () => { guidedState.framework = f.key; renderGuided(); } }, [
          sdkDot(f.key, true),
          el("span", { class: "guided-opt-label", text: f.label }),
        ])
      );
    });
    opts2.appendChild(
      el("button", { class: "guided-opt recommend", type: "button", onclick: () => { guidedState.framework = sdkOrder()[0]; renderGuided(); } }, [
        el("span", { class: "guided-opt-label", text: "Not sure — recommend one" }),
        el("span", { class: "guided-opt-sub", text: `We’ll start you on ${sdkMeta(sdkOrder()[0]).label}` }),
      ])
    );
    host.appendChild(q);
    host.appendChild(opts2);
    restoreFocus();
    return;
  }

  /* Step 2 — capability */
  if (!guidedState.blockId) {
    const fw = guidedState.framework;
    const q = el("div", { class: "guided-q" }, [el("h3", { text: "What do you want to add first?" })]);
    const opts2 = el("div", { class: "guided-options" });
    // "just the basics" → base
    opts2.appendChild(
      el("button", { class: "guided-opt recommend", type: "button", onclick: () => { guidedState.blockId = "__base__"; renderGuided(); } }, [
        el("span", { class: "guided-opt-label", text: "Just the basics" }),
        el("span", { class: "guided-opt-sub", text: "A minimal chat agent — the recommended first step" }),
      ])
    );
    (state.tree.blocks || []).forEach((b) => {
      const n = blockSamplesFor(b, fw).length;
      if (!n) return;
      opts2.appendChild(
        el("button", { class: "guided-opt", type: "button", onclick: () => { guidedState.blockId = b.id; renderGuided(); } }, [
          el("span", { class: "guided-opt-label", text: b.title }),
          el("span", { class: "guided-opt-sub", text: b.tagline || "" }),
          el("span", { class: "guided-opt-count", text: `${n} ${n === 1 ? "sample" : "samples"}` }),
        ])
      );
    });
    host.appendChild(q);
    host.appendChild(opts2);
    restoreFocus();
    return;
  }

  /* Result — one recommended sample + alternates */
  const fw = guidedState.framework;
  const block = guidedState.blockId === "__base__" ? state.tree.base : (state.tree.blocks || []).find((b) => b.id === guidedState.blockId);
  const entries = blockSamplesFor(block, fw);
  const best = bestSample(entries);
  const result = el("div", { class: "guided-result" });
  result.appendChild(el("h3", { class: "guided-result-head", text: best ? "Start here 👇" : "No exact match" }));
  if (best) {
    result.appendChild(kitSampleCard(best, { recommended: true, blockLabel: block.title }));
    const alts = entries.filter((e) => e.sample.id !== best.sample.id);
    if (alts.length) {
      result.appendChild(el("p", { class: "guided-alts-label", text: `Other ${sdkMeta(fw).label} options here:` }));
      const altList = el("div", { class: "kit-list" });
      alts.forEach((e) => altList.appendChild(kitSampleCard(e, { blockLabel: e.family.title })));
      result.appendChild(altList);
    }
  } else {
    result.appendChild(el("p", { class: "kit-hint", text: `There’s no ${sdkMeta(fw).label} sample for this yet. Try a different framework or capability.` }));
  }
  result.appendChild(el("div", { class: "step-actions" }, [
    el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { guidedState.blockId = null; renderGuided(); }, text: "← Pick another capability" }),
    el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: guidedReset, text: "↺ Start over" }),
  ]));
  host.appendChild(result);
  restoreFocus();
}

/* ================================================================
 * Smart search helpers (used by the Guided tab and the Browse tab).
 * The catalog site is static, so it can't call the Foundry hosted agent
 * directly; a small proxy injects auth and forwards the query.
 * ================================================================ */
/* Core call to the Foundry agent through the proxy. */
async function askAgentRaw(query, framework) {
  const ask = framework
    ? `${query} — using the ${sdkMeta(framework).label} framework`
    : query;
  const resp = await fetch(`${SMART_PROXY_BASE}/search?q=${encodeURIComponent(ask)}`, { method: "GET" });
  if (!resp.ok) throw new Error(`proxy returned HTTP ${resp.status}`);
  const data = await resp.json();
  return { matches: data.matches || [], understood: data.understood || [] };
}

/* Run a smart search into an arbitrary state object, re-rendering around it. */
async function runSmartFor(ss, query, rerender, framework) {
  const q = (query || "").trim();
  if (q.length < 2) return;
  ss.status = "loading";
  ss.q0 = q;
  ss.error = "";
  ss.data = null;
  rerender();
  try {
    ss.data = await askAgentRaw(q, framework);
    ss.status = "ok";
  } catch (e) {
    ss.status = "error";
    ss.error = String((e && e.message) || e);
  }
  rerender();
}

/* ---------- footer ---------- */
function setupFooter() {
  document.getElementById("sourceRepo").textContent = state.meta.source;
  document.getElementById("rootLink").href = state.meta.repoBaseUrl;
}

/* ================================================================
 * Landing — one blended page that merges the three ways of finding
 * a sample: keyword filter, scenario categories (progressive
 * disclosure), and agent-backed smart search. No tabs.
 * ================================================================ */
const home = { q: "", mode: "grid", cat: null, showAll: false };
const smart = { status: "idle", q0: "", data: null, error: "" };

function categoryList() {
  return (state.meta && state.meta.categoryList) || [];
}
function categoryLabel(id) {
  return (state.meta.categories && state.meta.categories[id]) || id;
}
function samplesInCat(id) {
  return state.samples.filter((s) => s.category === id);
}

/* ---- category grid (curated 6 + show all/less) ---- */
function categoryCard(c) {
  return el("button", { class: "cat-card", type: "button", onclick: () => openCategory(c.id) }, [
    el("h3", { class: "cat-card-title", text: c.title }),
    c.blurb ? el("p", { class: "cat-card-blurb", text: c.blurb }) : null,
    el("span", { class: "cat-card-count", text: countLabel(c.count != null ? c.count : samplesInCat(c.id).length) }),
  ]);
}

function renderCategoryGrid(host) {
  const cats = categoryList();
  const shown = home.showAll ? cats : cats.filter((c) => c.curated);
  host.appendChild(el("div", { class: "cat-grid" }, shown.map(categoryCard)));
  if (cats.some((c) => !c.curated)) {
    host.appendChild(el("div", { class: "cat-toggle-row" }, [
      el("button", {
        class: "cat-toggle", type: "button",
        text: home.showAll ? "Show less" : "Show all",
        onclick: () => { home.showAll = !home.showAll; renderHomeMain(); },
      }),
    ]));
  }
}

/* ---- category drill-in ---- */
function openCategory(id) {
  home.mode = "category"; home.cat = id; setHash("cat/" + id);
  renderHomeMain();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function backToGrid() {
  home.mode = "grid"; home.cat = null; setHash("");
  renderHomeMain();
}

function renderCategoryView(host) {
  const c = categoryList().find((x) => x.id === home.cat);
  const samples = samplesInCat(home.cat);
  host.appendChild(el("div", { class: "home-crumb" }, [
    el("button", { class: "crumb-back", type: "button", text: "← All categories", onclick: backToGrid }),
  ]));
  host.appendChild(el("div", { class: "home-section-head" }, [
    el("h2", { class: "home-section-title", text: c ? c.title : home.cat }),
    el("span", { class: "home-section-count", text: countLabel(samples.length) }),
    c && c.blurb ? el("p", { class: "home-section-blurb", text: c.blurb }) : null,
  ]));
  const grid = el("div", { class: "card-grid" });
  samples.forEach((s) => grid.appendChild(sampleCard(s)));
  host.appendChild(grid);
}

/* ---- keyword search (offline, across all samples) ---- */
function keywordResults(q) {
  const t = (q || "").trim().toLowerCase();
  if (!t) return [];
  return state.samples.filter((s) => {
    const hay = [s.title, s.description, s.path, (s.tags || []).join(" "), categoryLabel(s.category)].join(" ").toLowerCase();
    return hay.includes(t);
  });
}

function renderSearchView(host) {
  const res = keywordResults(home.q);
  host.appendChild(el("div", { class: "home-section-head" }, [
    el("h2", { class: "home-section-title", text: `Results for “${home.q.trim()}”` }),
    el("span", { class: "home-section-count", text: countLabel(res.length) }),
  ]));
  if (!res.length) {
    host.appendChild(el("div", { class: "home-empty" }, [
      el("p", { text: "No samples match those keywords." }),
      el("button", { class: "home-smart-btn inline", type: "button", text: "✨ Try Smart search", onclick: () => runSmart(home.q) }),
    ]));
    return;
  }
  const grid = el("div", { class: "card-grid" });
  res.forEach((s) => grid.appendChild(sampleCard(s)));
  host.appendChild(grid);
}

function renderHomeMain() {
  const host = document.getElementById("homeMain");
  if (!host) return;
  host.innerHTML = "";
  if (home.mode === "smart") renderSmartView(host);
  else if (home.mode === "search") renderSearchView(host);
  else if (home.mode === "category") renderCategoryView(host);
  else renderCategoryGrid(host);
}

/* ---- smart search (inline in the main window, agent-backed) ---- */
function exitSmart() {
  home.mode = home.q.trim() ? "search" : "grid";
  renderHomeMain();
}

async function runSmart(q) {
  const query = (q || "").trim();
  if (query.length < 2) { const i = document.getElementById("search"); if (i) i.focus(); return; }
  home.mode = "smart";
  smart.status = "loading"; smart.q0 = query; smart.error = ""; smart.data = null;
  renderHomeMain();
  window.scrollTo({ top: 0, behavior: "smooth" });
  try {
    smart.data = await askAgentRaw(query, null);
    smart.status = "ok";
  } catch (e) {
    smart.status = "error";
    smart.error = String((e && e.message) || e);
  }
  if (home.mode === "smart") renderHomeMain();
}

function renderSmartView(host) {
  host.appendChild(el("div", { class: "home-crumb" }, [
    el("button", { class: "crumb-back", type: "button", text: "← All categories", onclick: exitSmart }),
  ]));

  const nMatches = smart.status === "ok" && smart.data ? smart.data.matches.length : null;
  host.appendChild(el("div", { class: "home-section-head" }, [
    el("h2", { class: "home-section-title", text: "✨ Best-fit samples" }),
    el("span", { class: "home-section-count", text: nMatches != null ? countLabel(nMatches) : "" }),
    el("p", { class: "home-section-blurb", text: `Smart search for “${smart.q0}”` }),
  ]));

  if (smart.status === "loading") {
    host.appendChild(el("div", { class: "smart-loading" }, [
      el("div", { class: "smart-spinner", "aria-hidden": "true" }),
      el("p", { text: `Asking the Foundry agent about “${smart.q0}”…` }),
    ]));
    return;
  }
  if (smart.status === "error") {
    host.appendChild(el("div", { class: "smart-err" }, [
      el("p", { html: `⚠️ Couldn’t reach the Foundry agent (<code>${smart.error}</code>).` }),
      el("p", { class: "muted", text: "Showing keyword matches instead:" }),
    ]));
    const grid = el("div", { class: "card-grid" });
    keywordResults(smart.q0).slice(0, 6).forEach((s) => grid.appendChild(sampleCard(s)));
    host.appendChild(grid);
    return;
  }
  if (smart.status === "ok" && smart.data) {
    const { matches, understood } = smart.data;
    const entries = matches.map((m) => { const s = sampleById(m.id); return s ? { sample: s, note: m.why } : null; }).filter(Boolean);
    if (understood && understood.length) {
      host.appendChild(el("div", { class: "understood" }, [
        el("span", { class: "understood-label", text: "Understood as:" }),
        ...understood.map((l) => el("span", { class: "understood-chip", text: l })),
      ]));
    }
    if (!entries.length) {
      host.appendChild(el("p", { class: "muted", text: "The agent didn’t find a matching sample. Try describing the capability differently." }));
      return;
    }
    const grid = el("div", { class: "card-grid" });
    entries.forEach((entry, i) => grid.appendChild(kitSampleCard(entry, {
      recommended: i === 0,
      blockLabel: categoryLabel(entry.sample.category),
      showFw: true,
    })));
    host.appendChild(grid);
    return;
  }
}

/* ---- hash routing ---- */
function setHash(h) {
  const target = h ? "#" + h : location.pathname + location.search;
  if ((location.hash.replace(/^#/, "")) !== h) history.replaceState(null, "", target);
}
function applyHash() {
  const h = location.hash.replace(/^#/, "");
  if (h.indexOf("cat/") === 0) {
    const id = h.slice(4);
    if (categoryList().some((c) => c.id === id)) { home.mode = "category"; home.cat = id; renderHomeMain(); return; }
  }
  home.mode = "grid"; home.cat = null; renderHomeMain();
}

/* ---- wiring ---- */
function wireHome() {
  const input = document.getElementById("search");
  const clear = document.getElementById("btnClear");
  const syncClear = () => { if (clear) clear.hidden = !input.value; };
  input.addEventListener("input", (e) => {
    home.q = e.target.value;
    syncClear();
    if (home.q.trim() === "") applyHash();
    else { home.mode = "search"; renderHomeMain(); }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); runSmart(home.q); }
  });
  if (clear) clear.addEventListener("click", () => {
    input.value = ""; home.q = ""; syncClear();
    home.showAll = false; setHash(""); applyHash(); input.focus();
  });
  document.getElementById("btnSmart").addEventListener("click", () => runSmart(home.q));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && home.mode === "smart") exitSmart(); });
  window.addEventListener("hashchange", () => { if (home.mode !== "search") applyHash(); });
}

/* ---------- boot ---------- */
async function main() {
  try {
    await loadData();
  } catch (err) {
    const host = document.getElementById("homeMain");
    if (host) host.appendChild(
      el("div", { class: "empty", html: `Could not load data. If you opened this file directly and see this, run <code>python -m http.server</code> in this folder and reload.<br><br>${String(err)}` })
    );
    return;
  }
  setupFooter();
  wireHome();
  applyHash();
}

document.addEventListener("DOMContentLoaded", main);
