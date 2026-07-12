/* Foundry Hosted-Agent Sample Finder — vanilla JS, no build step.
 *
 * Guide view: a single-page accordion. The whole decision tree stays on one
 * page; expanding a choice reveals the next question (nested) or the matching
 * samples inline. Every choice shows how many distinct samples sit beneath it.
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
  open: new Set(), // expanded accordion path keys
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

/* ---------- sample counts (distinct, deduped, memoized) ---------- */
const _reachMemo = new Map();
function reachSet(nodeId, stack) {
  if (_reachMemo.has(nodeId)) return _reachMemo.get(nodeId);
  if (stack.has(nodeId)) return new Set(); // cycle guard (tree has none, but be safe)
  const node = state.tree.nodes[nodeId];
  let s;
  if (!node) {
    s = new Set();
  } else if (node.type === "result") {
    s = new Set(node.sampleIds || []);
  } else {
    s = new Set();
    const next = new Set(stack);
    next.add(nodeId);
    for (const o of node.options) for (const id of reachSet(o.next, next)) s.add(id);
  }
  _reachMemo.set(nodeId, s);
  return s;
}
function countFor(nodeId) {
  return reachSet(nodeId, new Set()).size;
}
function countLabel(n) {
  return `${n} ${n === 1 ? "sample" : "samples"}`;
}

/* ---------- sample card ---------- */
function sampleCard(sample) {
  if (!sample) return null;
  const badges = el("div", { class: "badge-row" }, [
    el("span", { class: `badge framework fw-${sample.framework}`, text: SHORT_FRAMEWORK[sample.framework] || sample.framework }),
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
    el("a", { class: "open-link", href: repoUrl(sample), target: "_blank", rel: "noopener", text: "Open on GitHub ↗" }),
  ]);
  return el("article", { class: "sample-card" }, [
    el("h3", { text: sample.title + (sample.kind === "client" ? " (client)" : "") }),
    badges,
    el("p", { class: "desc", text: sample.description || "" }),
    tags,
    foot,
  ]);
}

/* ---------- guide accordion ---------- */
function toggle(key) {
  if (state.open.has(key)) state.open.delete(key);
  else state.open.add(key);
  renderTree();
}

function renderOptions(questionNode, depth, pathKey) {
  const list = el("div", { class: "acc-list" });
  questionNode.options.forEach((opt, i) => {
    const childKey = `${pathKey}>${i}`;
    const childNode = state.tree.nodes[opt.next];
    const isOpen = state.open.has(childKey);
    const isResult = childNode && childNode.type === "result";
    const isRec = !!opt.recommended;
    const count = countFor(opt.next);

    const row = el(
      "button",
      { class: "acc-row", "aria-expanded": String(isOpen), onclick: () => toggle(childKey) },
      [
        el("span", { class: "caret" + (isOpen ? " open" : ""), "aria-hidden": "true", text: "▸" }),
        el("span", { class: "acc-label" }, [
          el("span", { class: "acc-title" }, [
            el("b", { text: opt.label }),
            isRec
              ? el("span", { class: "badge rec" }, [
                  el("span", { class: "star", "aria-hidden": "true", text: "★" }),
                  " Recommended",
                ])
              : null,
          ]),
          opt.description ? el("span", { class: "acc-desc", text: opt.description }) : null,
        ]),
        el("span", { class: "badge count" + (isResult ? " leaf" : ""), text: countLabel(count) }),
      ]
    );

    const item = el("div", { class: "acc-item", dataset: { depth: String(depth) } }, [row]);

    if (isOpen && childNode) {
      const panel = el("div", { class: "acc-panel" });
      if (childNode.type === "question") {
        if (childNode.title) panel.appendChild(el("p", { class: "nested-q", text: childNode.title }));
        if (childNode.help) panel.appendChild(el("p", { class: "help", text: childNode.help }));
        panel.appendChild(renderOptions(childNode, depth + 1, childKey));
      } else {
        if (childNode.intro) panel.appendChild(el("p", { class: "result-intro", text: childNode.intro }));
        const samples = (childNode.sampleIds || []).map((id) => state.byId.get(id)).filter(Boolean);
        const grid = el("div", { class: "card-grid" }, samples.map(sampleCard));
        if (!samples.length) grid.appendChild(el("div", { class: "empty", text: "No samples mapped to this result." }));
        panel.appendChild(grid);
      }
      item.appendChild(panel);
    }
    list.appendChild(item);
  });
  return list;
}

function renderTree() {
  const host = document.getElementById("guideTree");
  host.innerHTML = "";
  const root = state.tree.nodes[state.tree.meta.rootId];
  if (!root) {
    host.appendChild(el("div", { class: "empty", text: "Decision tree failed to load." }));
    return;
  }
  host.appendChild(
    el("div", { class: "tree-question-head" }, [
      el("h2", { text: root.title }),
      root.help ? el("p", { class: "help", text: root.help }) : null,
    ])
  );
  host.appendChild(renderOptions(root, 0, "root"));
}

/* ---------- browse ---------- */
const browseState = { q: "", framework: "", protocol: "", category: "", level: "" };

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
  const results = filterSamples();
  grid.innerHTML = "";
  count.textContent = `${results.length} of ${state.samples.length} samples`;
  if (!results.length) {
    grid.appendChild(el("div", { class: "empty", text: "No samples match those filters." }));
    return;
  }
  for (const s of results) grid.appendChild(sampleCard(s));
}

function wireBrowse() {
  document.getElementById("search").addEventListener("input", (e) => {
    browseState.q = e.target.value;
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
    Object.assign(browseState, { q: "", framework: "", protocol: "", category: "", level: "" });
    document.getElementById("search").value = "";
    for (const id of ["f-framework", "f-protocol", "f-category", "f-level"]) document.getElementById(id).value = "";
    renderBrowse();
  });
}

/* ---------- tabs ---------- */
function setView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.view === view)));
  document.getElementById("view-guide").hidden = view !== "guide";
  document.getElementById("view-browse").hidden = view !== "browse";
  if (view === "browse") renderBrowse();
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));
}

/* ---------- footer ---------- */
function setupFooter() {
  document.getElementById("sourceRepo").textContent = state.meta.source;
  document.getElementById("rootLink").href = state.meta.repoBaseUrl;
}

/* ---------- boot ---------- */
async function main() {
  try {
    await loadData();
  } catch (err) {
    document.getElementById("guideTree").appendChild(
      el("div", { class: "empty", html: `Could not load data. If you opened this file directly and see this, run <code>python -m http.server</code> in this folder and reload.<br><br>${String(err)}` })
    );
    return;
  }
  setupFooter();
  populateFilters();
  wireBrowse();
  wireTabs();
  renderTree();
  setView("guide");
}

document.addEventListener("DOMContentLoaded", main);
