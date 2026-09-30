import {
  DEFAULT_STATE,
  countBy,
  displayUrl,
  filterAndSort,
  industryLabel,
  parseState,
  prepare,
  safeUrl,
  serializeState,
  summarize,
} from "./lib.js";

const $ = (id) => document.getElementById(id);
const els = {
  form: $("controls"),
  q: $("q"),
  industry: $("industry"),
  access: $("access"),
  list: $("list"),
  group: $("group"),
  sort: $("sort"),
  count: $("count"),
  reset: $("reset"),
  results: $("results"),
  error: $("error"),
  card: $("card"),
};
const FIELDS = ["q", "industry", "access", "list", "group", "sort"];

let all = [];
let state = { ...DEFAULT_STATE };
let valid = { industries: [], groups: [] };

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function option(value, text) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = text;
  return o;
}

function fillSelects(groups) {
  const byIndustry = countBy(all, "industry");
  const industries = [...byIndustry.keys()].sort((a, b) => industryLabel(a).localeCompare(industryLabel(b), "en"));
  for (const slug of industries) els.industry.append(option(slug, `${industryLabel(slug)} (${byIndustry.get(slug)})`));

  const byGroup = countBy(all, "parentGroup");
  const used = groups.filter((g) => byGroup.has(g.slug)).sort((a, b) => a.name.localeCompare(b.name, "en"));
  for (const g of used) els.group.append(option(g.slug, `${g.name} (${byGroup.get(g.slug)})`));

  valid = { industries, groups: used.map((g) => g.slug) };
}

function renderStats() {
  const s = summarize(all);
  for (const el of document.querySelectorAll("[data-stat]")) {
    el.textContent = s[el.dataset.stat].toLocaleString("en");
  }
}

function link(href, label, kind) {
  const a = document.createElement("a");
  a.href = href;
  a.className = `link ${kind}`;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  const strong = document.createElement("strong");
  strong.textContent = label;
  const small = document.createElement("span");
  small.className = "url";
  small.textContent = displayUrl(href);
  a.append(strong, small);
  a.setAttribute("aria-label", `${label}: ${displayUrl(href)} (opens in a new tab)`);
  return a;
}

function badge(text, cls, title) {
  const b = document.createElement("span");
  b.className = `badge ${cls}`;
  b.textContent = text;
  if (title) b.title = title;
  return b;
}

function renderCard(c) {
  const node = els.card.content.firstElementChild.cloneNode(true);
  node.querySelector(".name").textContent = c.name;

  const badges = node.querySelector(".badges");
  if (c.cseSymbol) badges.append(badge(c.cseSymbol, "cse", "Colombo Stock Exchange symbol"));
  if (c.sourceLists.includes("tech")) badges.append(badge("Tech", "tech", "On the Sri Lankan tech employers list"));

  const meta = node.querySelector(".meta");
  meta.append(document.createTextNode(industryLabel(c.industry)));
  if (c.parentGroup) {
    meta.append(document.createTextNode(" · "));
    const g = document.createElement("button");
    g.type = "button";
    g.className = "group-link";
    g.textContent = c.groupName;
    g.title = `Show all ${c.groupName} companies`;
    g.addEventListener("click", () => {
      update({ ...DEFAULT_STATE, group: c.parentGroup });
      els.results.focus();
    });
    meta.append(g);
  }

  const links = node.querySelector(".links");
  const careers = safeUrl(c.careersUrl);
  const website = safeUrl(c.website);
  if (careers) links.append(link(careers, "Careers page", "primary"));
  if (website) links.append(link(website, "Website", "secondary"));
  if (!careers) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = website
      ? "No careers page on record. Check the website for vacancies."
      : "No website on record yet.";
    links.append(p);
  }
  return node;
}

function render() {
  const list = filterAndSort(all, state);
  const frag = document.createDocumentFragment();
  let lastIndustry = null;
  for (const c of list) {
    if (state.sort === "industry" && c.industry !== lastIndustry) {
      lastIndustry = c.industry;
      const h = document.createElement("li");
      h.className = "section";
      h.setAttribute("role", "heading");
      h.setAttribute("aria-level", "2");
      h.textContent = industryLabel(c.industry);
      frag.append(h);
    }
    frag.append(renderCard(c));
  }
  els.results.replaceChildren(frag);

  const filtered = FIELDS.some((k) => k !== "sort" && state[k] !== DEFAULT_STATE[k]);
  els.reset.hidden = !filtered;
  const n = list.length;
  els.count.textContent =
    n === 0
      ? "No companies match these filters."
      : filtered
        ? `Showing ${n.toLocaleString("en")} of ${all.length.toLocaleString("en")} companies`
        : `${n.toLocaleString("en")} companies`;
}

function syncControls() {
  for (const k of FIELDS) if (els[k].value !== state[k]) els[k].value = state[k];
}

function update(next, { push = false } = {}) {
  state = next;
  syncControls();
  render();
  const url = `${location.pathname}${serializeState(state)}${location.hash}`;
  if (url !== `${location.pathname}${location.search}${location.hash}`) {
    history[push ? "pushState" : "replaceState"](null, "", url);
  }
}

function readControls() {
  return Object.fromEntries(FIELDS.map((k) => [k, els[k].value]));
}

function bind() {
  let timer;
  els.q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => update(readControls()), 120);
  });
  for (const k of FIELDS.filter((f) => f !== "q")) {
    els[k].addEventListener("change", () => update(readControls(), { push: true }));
  }
  els.reset.addEventListener("click", () => {
    update({ ...DEFAULT_STATE, sort: state.sort }, { push: true });
    els.q.focus();
  });
  window.addEventListener("popstate", () => update(parseState(location.search, valid)));
}

async function main() {
  try {
    const [companies, groups] = await Promise.all([loadJson("data/companies.json"), loadJson("data/groups.json")]);
    all = prepare(companies, groups);
    fillSelects(groups);
    renderStats();
    bind();
    update(parseState(location.search, valid));
  } catch (err) {
    console.error(err);
    els.count.textContent = "";
    els.error.textContent = "The company list couldn't be loaded. Please refresh the page to try again.";
    els.error.hidden = false;
  }
}

main();
