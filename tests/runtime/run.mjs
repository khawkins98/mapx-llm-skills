/**
 * Runtime verification of MapX SDK behaviour that the skills document from
 * reading the source. Runs every check in static and app mode against the
 * live app.mapx.org and writes results/<date>-<mode>.json plus a summary.
 *
 * Usage (from tests/runtime):
 *   npm install
 *   node run.mjs              # both modes, headless (falls back to headed if ready never fires)
 *   node run.mjs --headed     # force a visible browser
 *   node run.mjs --mode=app   # one mode only
 *   node run.mjs --host=staging  # test app.staging.mapx.org instead of prod
 *
 * Nothing is written to MapX: checks only read, toggle views, and set
 * filters/language inside the embedded session.
 */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const forceHeaded = args.includes("--headed");
const onlyMode = args.find((a) => a.startsWith("--mode="))?.split("=")[1];
// --host=staging tests app.staging.mapx.org (pre-release) instead of prod
const HOST = args.find((a) => a.startsWith("--host="))?.split("=")[1] === "staging"
  ? "app.staging.mapx.org"
  : "app.mapx.org";

// Test fixtures, taken from the undrr-risk-resilience-maps-pw catalogues.
const FX = {
  // Public MapX HOME project. (The UNDRR project MX-FC7-VJG-IKU-MCA-QXM is not
  // open to guests: requesting it silently loads HOME instead.)
  projectHome: "MX-YBJ-YYF-08R-UUR-QW6",
  // Not readable by guests: used to show set_project blocking on a dialog
  projectPrivate: "MX-FC7-VJG-IKU-MCA-QXM",
  // A different project, used for the cross-project view_add test
  projectEco: "MX-2LD-FBB-58N-ROK-8RH",
  // The filter views below belong to neither session's project, so every
  // filter check also exercises a cross-project (remotely fetched) view.
  // vt, styled numeric attribute aal_lower_bound_million; readers: public; owned by CDC project
  numericView: "MX-KEG0W-U2098-JKIYJ",
  numericAttr: "aal_lower_bound_million",
  otherAttr: "iso3cd",
  // vt, styled text attribute cfr_label
  textView: "MX-1QXAR-BQIQ6-2C685",
  textAttr: "cfr_label",
  // vt with mx_t0 (volcanic eruptions)
  timeView: "MX-V5P2U-N9C2O-OHMZY",
  // vt that belongs to the ECO-DRR project (in-project control)
  ecoView: "MX-FX1HT-Z7KXL-8X22K",
  // Well-formed but non-existent view ID
  bogusView: "MX-ZZZZZ-ZZZZZ-ZZZZZ",
};

const PAGE = `<!doctype html><html><body style="margin:0">
<div id="mapx" style="width:1024px;height:700px"></div>
<script src="https://${HOST}/sdk/mxsdk.umd.js"></script>
</body></html>`;
const HARNESS = readFileSync(join(HERE, "harness.js"), "utf8");

// The parent page must be a secure context (http://localhost qualifies):
// MapX calls crypto.randomUUID(), which is undefined when the embedding page
// is about:blank / page.setContent(), and the iframe app then never gets to
// `ready`.
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(PAGE);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${server.address().port}/`;

async function openSession(browser, { project, isStatic }, iframeRequests) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 750 } });
  page.on("request", (req) => {
    const u = req.url();
    if (/\/get\/view\//.test(u)) iframeRequests.push(u.replace(/\?.*/, ""));
  });
  await page.goto(BASE, { waitUntil: "load" });
  await page.addScriptTag({ content: HARNESS });
  const info = await page.evaluate((o) => H.init(o), { project, isStatic, host: HOST, timeoutMs: 90000 });
  return { page, info };
}

const ev = (page, fn, arg) => page.evaluate(fn, arg);

// ---------------------------------------------------------------- checks

async function checkBasics(page, mode) {
  const out = {};
  out.version = await ev(page, () => window.mxsdk && H.mapx.version);
  // map_wait_idle on a still map
  out.map_wait_idle_still = await ev(page, () => H.ask("map_wait_idle", {}, 10000));
  // getProjection on a fresh map, then object vs string setProjection
  out.getProjection_fresh = await ev(page, () => H.ask("map", { method: "getProjection" }));
  out.setProjection_object = await ev(page, () =>
    H.ask("map", { method: "setProjection", parameters: [{ type: "globe" }] }));
  out.getProjection_after_object = await ev(page, () => H.ask("map", { method: "getProjection" }));
  out.setProjection_string = await ev(page, () =>
    H.ask("map", { method: "setProjection", parameters: ["mercator"] }));
  out.getProjection_after_string = await ev(page, () => H.ask("map", { method: "getProjection" }));
  // Does the string form actually change the projection? Compare where a
  // far-off point projects to on screen under each setting.
  out.projectionEffect = await ev(page, async () => {
    const probe = async (param) => {
      await H.ask("map_jump_to", { center: { lng: 0, lat: 0 }, zoom: 1.5 });
      await H.ask("map", { method: "setProjection", parameters: [param] });
      await H.sleep(1500);
      const r = await H.ask("map", { method: "project", parameters: [[80, 60]] });
      const v = r.value;
      return v ? [Math.round(v.x), Math.round(v.y)] : null;
    };
    return {
      mercatorObject: await probe({ type: "mercator" }),
      globeObject: await probe({ type: "globe" }),
      mercatorObjectAgain: await probe({ type: "mercator" }),
      globeString: await probe("globe"),
    };
  });
  await ev(page, () => H.ask("map", { method: "setProjection", parameters: [{ type: "mercator" }] }));
  // App-only resolvers (expected to hang in static mode)
  out.get_views_id_open = await ev(page, () => H.ask("get_views_id_open", {}, 8000));
  out.nonexistent_resolver = await ev(page, () => H.ask("definitely_not_a_resolver", {}, 8000));
  // get_sdk_methods: does it include panels_*?
  const m = await ev(page, () => H.ask("get_sdk_methods"));
  out.get_sdk_methods = {
    status: m.status,
    count: m.value?.length,
    includesPanels: m.value?.some?.((x) => x.startsWith("panels_")),
    includesSetProject: m.value?.includes?.("set_project"),
  };
  // map_fly_to longer than its internal 10 s timeout
  out.map_fly_to_12s = await ev(page, () =>
    H.ask("map_fly_to", { center: { lng: 30, lat: 0 }, zoom: 3, duration: 12000 }, 20000));
  return out;
}

async function checkTooManyRequest(page) {
  // Keep requests pending: a slow fly keeps map_wait_idle waiting for "idle".
  return ev(page, async () => {
    H.fired = [];
    await H.ask("set_language", { lang: "en" });
    H.fire("map_fly_to", { center: { lng: 100, lat: 20 }, zoom: 4, duration: 8000 });
    for (let i = 0; i < 10; i++) H.fire("map_wait_idle");
    // 12th concurrent call: side-effecting, should be rejected
    H.fire("set_language", { lang: "fr" });
    await H.sleep(12000);
    const lang = await H.ask("get_language");
    await H.ask("set_language", { lang: "en" });
    return { fired: H.fired, languageAfter: lang.value };
  });
}

async function checkViewAddCrossProject(page, iframeRequests) {
  const out = {};
  for (const [label, idView] of [
    ["inProject", FX.ecoView],
    ["otherProjectPublic", FX.numericView],
    ["bogus", FX.bogusView],
  ]) {
    const before = iframeRequests.length;
    const r = await ev(page, async (id) => {
      const t0 = H.now();
      const res = await H.ask("view_add", { idView: id }, 30000);
      const added = await H.waitEvent("view_added", id, t0, 5000);
      const vis = await H.ask("get_views_with_visible_layer");
      return { ...res, events: undefined, view_added: added, visible: vis.value?.includes?.(id) ?? null };
    }, idView);
    r.apiRequests = iframeRequests.slice(before).filter((u) => u.includes(idView)).length;
    out[label] = { idView, ...r };
  }
  // Already-open view: does view_added fire again?
  out.alreadyOpen = await ev(page, async (id) => {
    const t0 = H.now();
    const res = await H.ask("view_add", { idView: id }, 20000);
    return { status: res.status, value: res.value, view_added_again: await H.waitEvent("view_added", id, t0, 4000) };
  }, FX.ecoView);
  return out;
}

async function addAndWait(page, idView) {
  return ev(page, async (id) => {
    const t0 = H.now();
    const r = await H.ask("view_add", { idView: id }, 40000);
    const added = await H.waitEvent("view_added", id, t0, 20000);
    await H.sleep(1500);
    return { status: r.status, value: r.value, view_added: added };
  }, idView);
}

/** Apply a filter call and report what actually changed on the layers. */
async function filterProbe(page, resolver, idView, opt, getter) {
  return ev(page, async ({ resolver, idView, opt, getter }) => {
    const r = await H.ask(resolver, { idView, ...opt }, 12000);
    await H.sleep(1000);
    const layers = await H.viewLayers(idView);
    const got = getter ? await H.ask(getter, { idView }) : null;
    const filterEvents = (r.events || []).filter((e) => e.type === "view_filter" || e.type === "view_filtered");
    return {
      call: opt,
      status: r.status,
      value: r.value,
      ms: r.ms,
      messages: r.messages,
      filterEvents: filterEvents.map((e) => ({ type: e.type, filter: JSON.stringify(e.data?.filter)?.slice(0, 400) })),
      layerFilters: layers.map((l) => JSON.stringify(l.filter)?.slice(0, 400)),
      getter: got ? { status: got.status, value: got.value } : null,
    };
  }, { resolver, idView, opt, getter });
}

async function checkNumeric(page) {
  const N = FX.numericView;
  const out = { add: await addAndWait(page, N) };
  out.fromToOnly = await filterProbe(page, "set_view_layer_filter_numeric", N, { from: 1, to: 50 }, "get_view_layer_filter_numeric");
  out.valueOnly = await filterProbe(page, "set_view_layer_filter_numeric", N, { value: [2, 60] }, "get_view_layer_filter_numeric");
  out.valueWithOtherAttribute = await filterProbe(page, "set_view_layer_filter_numeric", N,
    { value: [3, 70], from: 3, to: 70, attribute: FX.otherAttr }, "get_view_layer_filter_numeric");
  out.valueWideRange = await filterProbe(page, "set_view_layer_filter_numeric", N, { value: [20000, 100000] }, "get_view_layer_filter_numeric");
  out.portable = await filterProbe(page, "set_view_layer_filter_numeric", N,
    { value: [30000, 90000], from: 30000, to: 90000 }, "get_view_layer_filter_numeric");
  out.nullClear = await filterProbe(page, "set_view_layer_filter_numeric", N, { from: null, to: null }, "get_view_layer_filter_numeric");
  const summary = await ev(page, (id) => H.ask("get_view_source_summary", { idView: id }, 30000), N);
  out.summary = { status: summary.status, attribute_stat: summary.value?.attribute_stat
    ? { min: summary.value.attribute_stat.min, max: summary.value.attribute_stat.max, attribute: summary.value.attribute_stat.attribute }
    : null, keys: summary.value ? Object.keys(summary.value) : null };
  return out;
}

async function checkTransparency(page) {
  const N = FX.numericView;
  const paint = (layers) => layers.map((l) => {
    const k = Object.keys(l.paint).find((p) => p.endsWith("-opacity"));
    return k ? { [k]: l.paint[k] } : {};
  });
  return ev(page, async ({ N }) => {
    const res = {};
    for (const [label, opt] of [["value50", { value: 50 }], ["value50_opacity05", { value: 50, opacity: 0.5 }], ["value0", { value: 0, opacity: 1 }]]) {
      const r = await H.ask("set_view_layer_transparency", { idView: N, ...opt }, 12000);
      await H.sleep(800);
      const layers = await H.viewLayers(N);
      const got = await H.ask("get_view_layer_transparency", { idView: N });
      res[label] = { status: r.status, messages: r.messages, getter: got.value,
        opacity: layers.map((l) => Object.fromEntries(Object.entries(l.paint).filter(([k]) => k.endsWith("-opacity")))) };
    }
    return res;
  }, { N });
}

async function checkText(page) {
  const T = FX.textView;
  const out = { add: await addAndWait(page, T) };
  const legend = await ev(page, (id) => H.ask("get_view_legend_values", { idView: id }), T);
  out.legendValues = legend.value;
  const v = Array.isArray(legend.value) && legend.value.length ? legend.value[0] : "High";
  out.valueOnly = await filterProbe(page, "set_view_layer_filter_text", T, { value: [v] }, "get_view_layer_filter_text");
  out.valuesWithAttribute = await filterProbe(page, "set_view_layer_filter_text", T, { values: [v], attribute: FX.textAttr }, "get_view_layer_filter_text");
  out.valuesNoAttribute = await filterProbe(page, "set_view_layer_filter_text", T, { values: [v] }, "get_view_layer_filter_text");
  out.portable = await filterProbe(page, "set_view_layer_filter_text", T, { value: [v], values: [v], attribute: FX.textAttr }, "get_view_layer_filter_text");
  out.clear = await filterProbe(page, "set_view_layer_filter_text", T, { value: [], values: [], attribute: FX.textAttr }, "get_view_layer_filter_text");
  return out;
}

async function checkTime(page) {
  const V = FX.timeView;
  const out = { add: await addAndWait(page, V) };
  const s = await ev(page, (id) => H.ask("get_view_source_summary", { idView: id }, 30000), V);
  const et = s.value?.extent_time;
  out.extent_time = et ?? null;
  out.attributes = s.value?.attributes ?? null;
  if (et?.min != null && et?.max != null) {
    const from = et.min * 1000;
    const to = from + (et.max * 1000 - from) / 2;
    const base = { hasT0: true, hasT1: Boolean(s.value?.attributes?.includes?.("mx_t1")) };
    out.fromToOnly = await filterProbe(page, "set_view_layer_filter_time", V, { ...base, from, to }, "get_view_layer_filter_time");
    out.withValue = await filterProbe(page, "set_view_layer_filter_time", V, { ...base, from, to, value: [from, to] }, "get_view_layer_filter_time");
  }
  return out;
}

async function checkSetProject(page) {
  // Session B is on ECO-DRR: switch to public HOME, then to a guest-inaccessible project
  const sw = (p, ms) => ev(page, async ({ p, ms }) => {
    const t0 = H.now();
    const r = await H.ask("set_project", { idProject: p }, ms);
    const changed = await H.waitEvent("project_changed", null, t0, 3000);
    const cur = await H.ask("get_project", {}, 5000);
    return { ...r, events: r.events.map((e) => e.type), project_changed: changed, currentProject: cur.value ?? cur.status };
  }, { p, ms });
  return { toPublic: await sw(FX.projectHome, 30000), toInaccessible: await sw(FX.projectPrivate, 20000) };
}

// ---------------------------------------------------------------- driver

async function runMode(browser, mode) {
  const isStatic = mode === "static";
  const results = { mode, startedAt: new Date().toISOString() };
  const step = async (name, fn) => {
    process.stdout.write(`  [${mode}] ${name} ... `);
    try {
      results[name] = await fn();
      console.log("done");
    } catch (e) {
      results[name] = { harnessError: String(e?.message ?? e) };
      console.log(`harness error: ${e?.message ?? e}`);
    }
  };

  // Session A: UNDRR project
  const reqA = [];
  const a = await openSession(browser, { project: FX.projectHome, isStatic }, reqA);
  results.readyMs = a.info.readyMs;
  results.landedProjectA = await a.page.evaluate(() => H.ask("get_project", {}, 5000).then((r) => r.value ?? r.status));
  await step("basics", () => checkBasics(a.page, mode));
  await step("tooManyRequest", () => checkTooManyRequest(a.page));
  await step("numericFilter", () => checkNumeric(a.page));
  await step("transparency", () => checkTransparency(a.page));
  await step("textFilter", () => checkText(a.page));
  await step("timeFilter", () => checkTime(a.page));
  results.messagesAll = await a.page.evaluate(() => H.messages.map(({ t, ...m }) => m).slice(-60));
  await a.page.close();

  // Session B: ECO-DRR project, cross-project view_add
  const reqB = [];
  const b = await openSession(browser, { project: FX.projectEco, isStatic }, reqB);
  results.landedProjectB = await b.page.evaluate(() => H.ask("get_project", {}, 5000).then((r) => r.value ?? r.status));
  await step("viewAddCrossProject", () => checkViewAddCrossProject(b.page, reqB));
  await step("setProject", () => checkSetProject(b.page));
  await b.page.close();
  return results;
}

async function launch(headless) {
  return chromium.launch({ headless });
}

const modes = onlyMode ? [onlyMode] : ["static", "app"];
mkdirSync(join(HERE, "results"), { recursive: true });
const stamp = new Date().toISOString().slice(0, 10) + (HOST === "app.mapx.org" ? "" : "-staging");

let headless = !forceHeaded;
let browser = await launch(headless);
for (const mode of modes) {
  console.log(`\n=== ${mode} mode (${headless ? "headless" : "headed"}) ===`);
  let res;
  try {
    res = await runMode(browser, mode);
  } catch (e) {
    if (headless && /ready not fired/.test(String(e))) {
      console.log("  ready never fired headless; retrying headed");
      await browser.close();
server.close();
      headless = false;
      browser = await launch(false);
      res = await runMode(browser, mode);
    } else {
      throw e;
    }
  }
  res.headless = headless;
  res.host = HOST;
  const file = join(HERE, "results", `${stamp}-${mode}.json`);
  writeFileSync(file, JSON.stringify(res, null, 2));
  console.log(`  wrote ${file}`);
}
await browser.close();
server.close();
