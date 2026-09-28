# MapX Embed Scaffold Templates

## package.json

```json
{
  "name": "mapx-embed",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3001",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

## vite.config.js

```javascript
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3001,
    open: true,
  },
});
```

## index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MapX Embed</title>
    <!-- Optional: UNDRR Mangrove component library for consistent UI -->
    <!-- <link rel="stylesheet" href="https://assets.undrr.org/static/mangrove/1.3.3/css/style.css" /> -->
  </head>
  <body>
    <div class="app-body">
      <aside class="app-sidebar">
        <h2>Views</h2>
        <div id="view-buttons">Loading...</div>
      </aside>
      <div class="app-map">
        <div id="mapx"></div>
      </div>
    </div>

    <script src="https://app.mapx.org/sdk/mxsdk.umd.js"></script>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

## src/main.js

```javascript
import "./styles/app.css";
import { initSDK, askWithTimeout } from "./sdk/client.js";
import { buildViewButtons } from "./ui/view-buttons.js";
import { initLog, log } from "./ui/log.js";
import { CURATED_VIEWS } from "./config/views.js";
import * as store from "./state/store.js";

initLog();
const mapx = initSDK(document.getElementById("mapx"));

// Event-driven state: view_added / view_removed fire for EVERY add/remove
// (SDK calls, clicks inside MapX, startup `views` param), so the store
// always mirrors what is actually on the map.
mapx.on("view_added", ({ idView }) => {
  store.openViews.add(idView);
  buildViewButtons();
});

mapx.on("view_removed", ({ idView }) => {
  store.openViews.delete(idView);
  buildViewButtons();
});

// Surface MapX worker errors (err_resolver_failed, err_view_invalid, ...).
// Resolver failures never reject ask(); this is where they show up.
mapx.on("message", (m) => {
  if (m?.level === "error") log(`MapX error: ${m.key} ${JSON.stringify(m.vars ?? {})}`);
});

mapx.on("ready", async () => {
  log("MapX SDK ready");
  // Note: `ready` means the bridge is up. It does NOT mean startup views have
  // rendered (wait for view_added), and map_wait_idle would resolve
  // immediately here because it only waits while the camera is moving.

  // Seed state with anything already on the map (e.g. from the `views` param)
  const visible = await askWithTimeout("get_views_with_visible_layer").catch(() => []);
  visible.forEach((id) => store.openViews.add(id));

  if (CURATED_VIEWS.length === 0) {
    // Discovery mode: list the project's views so you can fill config/views.js
    const views = await askWithTimeout("get_views", {}, 20000);
    console.table(views.map((v) => ({ id: v.id, type: v.type, title: v.data?.title?.en })));
    log(`No curated views configured; logged ${views.length} project views to the console`);
  }

  buildViewButtons();
});
```

## src/sdk/client.js

```javascript
/**
 * SDK client: singleton Manager instance.
 *
 * The UMD script tag in index.html exposes the global `mxsdk`. Always load
 * the SDK from app.mapx.org: the npm package (@fxi/mxsdk) lags the deployed
 * build, and a Manager/worker version mismatch logs err_version_mismatch.
 * (ESM alternative: `import { Manager } from "https://app.mapx.org/sdk/mxsdk.modern.js";`)
 */
let _mapx = null;

/**
 * Static mode (/static.html) is upstream's recommended mode for embeds:
 * lighter, no login. Set to false only if you need app-only resolvers
 * (set_project, get_views_id_open, move_view_*, login, table editor);
 * those HANG in static mode instead of rejecting.
 */
export const STATIC_MODE = true;

export function initSDK(container) {
  const { Manager } = window.mxsdk;
  _mapx = new Manager({
    container,
    url: "https://app.mapx.org/?project=PROJECT_ID_HERE",
    params: {
      closePanels: true,
      language: "en",
      theme: "color_light",
    },
    style: { width: "100%", height: "100%", border: "none" },
    static: STATIC_MODE,
    // Default 10. A call made while more than this many are pending is
    // rejected ("too_many_request ...") but STILL EXECUTES in MapX, so
    // throttle batches instead of relying on a high ceiling.
    maxSimultaneousRequest: 20,
  });
  return _mapx;
}

export function getSDK() {
  if (!_mapx) throw new Error("SDK not initialised");
  return _mapx;
}

/**
 * Defensive ask() wrapper.
 *
 * FrameManager never settles a request whose resolver threw or doesn't
 * exist, so a bare ask() can hang forever. This wrapper:
 *  - rejects early when the worker reports err_resolver_failed /
 *    err_resolver_not_found for this resolver (via the "message" event)
 *  - otherwise rejects after timeoutMs
 * Caveat: the error message identifies the resolver, not the request, so a
 * failure can also reject a concurrent call to the SAME resolver.
 */
export function askWithTimeout(method, data = {}, timeoutMs = 8000) {
  const sdk = getSDK();
  let timer;
  let onMessage;
  const failFast = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`MapX ask("${method}") timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    onMessage = (m) => {
      const isErr = m?.level === "error" &&
        (m.key === "err_resolver_failed" || m.key === "err_resolver_not_found");
      if (isErr && m.vars?.idResolver === method) {
        reject(new Error(`MapX ask("${method}") failed: ${m.key}`));
      }
    };
    sdk.on("message", onMessage);
  });
  return Promise.race([sdk.ask(method, data), failFast]).finally(() => {
    clearTimeout(timer);
    sdk.off("message", onMessage);
  });
}
```

## src/sdk/views.js

```javascript
import { askWithTimeout } from "./client.js";

/**
 * view_add resolves true on success, undefined on failure (MapX emits
 * err_view_invalid), and never settles if the view lookup throws (the
 * timeout covers that). Adding a large view can take a while: it resolves
 * only after layers, legend and dashboard are built.
 */
export async function viewAdd(idView) {
  const res = await askWithTimeout("view_add", { idView }, 20000);
  if (res !== true) throw new Error(`view_add failed for ${idView} (resolved ${res})`);
  return true;
}

export function viewRemove(idView) {
  return askWithTimeout("view_remove", { idView });
}

/** View IDs with layers on the map, top-most first (static + app mode). */
export function getVisibleViews() {
  return askWithTimeout("get_views_with_visible_layer");
}
```

## src/sdk/map-control.js

```javascript
import { askWithTimeout } from "./client.js";

/** Keep opts.duration under 10 s: longer flights make the resolver fail (and hang). */
export function mapFlyTo(opts) {
  return askWithTimeout("map_fly_to", opts, 12000);
}

export function mapGetZoom() {
  return askWithTimeout("map_get_zoom");
}

/**
 * Resolves when the camera stops moving. Resolves IMMEDIATELY if the map is
 * not moving, and does not wait for tiles. Call it after a camera move,
 * before rendered-data queries.
 */
export function mapWaitIdle() {
  return askWithTimeout("map_wait_idle", {}, 30000);
}

export function commonLocFitBbox(code, param) {
  return askWithTimeout("common_loc_fit_bbox", { code, param });
}

/** MapLibre v5: projection is an object, not a string. */
export function setProjection(type /* "globe" | "mercator" */) {
  return askWithTimeout("map", { method: "setProjection", parameters: [{ type }] });
}
```

## src/state/store.js

```javascript
/**
 * Track which views are currently displayed.
 * Synced automatically via mapx.on("view_added") and mapx.on("view_removed").
 */
export const openViews = new Set();
```

## src/config/views.js

```javascript
/**
 * Curated view IDs from your MapX project.
 * Discovered using get_views() or probe-views.html.
 *
 * Types: vt = vector tiles, rt = raster tiles,
 *        cc = custom coded, sm = story map, gj = GeoJSON
 * Leave empty to run in discovery mode (main.js logs the project's views).
 */
export const CURATED_VIEWS = [
  // { id: "MX-XXXXX-XXXXX-XXXXX", label: "View Name", type: "vt" },
];
```

## src/ui/view-buttons.js

```javascript
import { CURATED_VIEWS } from "../config/views.js";
import * as store from "../state/store.js";
import { viewAdd, viewRemove } from "../sdk/views.js";

const buttonsByViewId = new Map();

export function buildViewButtons() {
  const container = document.getElementById("view-buttons");
  if (!container) return;

  if (CURATED_VIEWS.length === 0) {
    container.textContent = "No views configured. See src/config/views.js (IDs are logged to the console).";
    return;
  }

  // Initialize button elements once to avoid destroying DOM state
  if (buttonsByViewId.size === 0) {
    container.innerHTML = "";
    CURATED_VIEWS.forEach((v) => {
      const btn = document.createElement("button");
      btn.textContent = v.label;
      btn.title = v.id;
      btn.addEventListener("click", () => toggleView(v.id, btn));
      container.appendChild(btn);
      buttonsByViewId.set(v.id, btn);
    });
  }

  // Synchronize active states with store
  for (const [id, btn] of buttonsByViewId.entries()) {
    btn.classList.toggle("is-active", store.openViews.has(id));
  }
}

async function toggleView(idView, btn) {
  if (btn) btn.disabled = true;
  try {
    if (store.openViews.has(idView)) {
      await viewRemove(idView);
    } else {
      await viewAdd(idView);
    }
  } catch (err) {
    // Includes timeouts. Note the call may still complete later; the
    // view_added / view_removed listeners in main.js keep the store correct.
    console.error(`Failed to toggle view ${idView}:`, err);
  } finally {
    if (btn) btn.disabled = false;
  }
}
```

## src/sdk/filters.js

```javascript
import { askWithTimeout } from "./client.js";

/*
 * The filter resolvers read DIFFERENT parameters per mode:
 *   numeric: app mode -> `value` only (drives the view's slider, always on the
 *            styled attribute); static -> `from`/`to`/`attribute`
 *   text:    app mode -> `value` only; static -> `values` + `attribute`
 *            (static throws, so the call hangs, if `attribute` is omitted)
 * These wrappers send both forms so they work in either mode.
 * Filters only apply to `vt` views.
 */

export function setNumericFilter(idView, [min, max], attribute) {
  return askWithTimeout("set_view_layer_filter_numeric", {
    idView,
    value: [min, max],
    from: min,
    to: max,
    ...(attribute ? { attribute } : {}),
  });
}

/** There is no "clear" value: reset to the attribute's full range. */
export async function clearNumericFilter(idView, attribute) {
  const summary = await askWithTimeout(
    "get_view_source_summary",
    { idView, ...(attribute ? { idAttr: attribute } : {}) },
    20000
  );
  const { min, max } = summary.attribute_stat;
  return setNumericFilter(idView, [min, max], attribute);
}

export function setTextFilter(idView, selected, attribute) {
  const list = Array.isArray(selected) ? selected : [selected];
  return askWithTimeout("set_view_layer_filter_text", {
    idView,
    value: list,
    values: list,
    attribute, // required in static mode
  });
}

export function clearTextFilter(idView, attribute) {
  return setTextFilter(idView, [], attribute);
}

/**
 * transparency: 0 = opaque, 100 = invisible.
 * App mode reads `value` (0..100 transparency); static mode applies the
 * number directly as MapLibre opacity (0..1), preferring `opacity`.
 */
export function setTransparency(idView, transparency) {
  return askWithTimeout("set_view_layer_transparency", {
    idView,
    value: transparency,
    opacity: 1 - transparency / 100,
  });
}
```

## src/sdk/ui.js

```javascript
import { askWithTimeout } from "./client.js";

export function setLanguage(lang /* ISO 639-1, e.g. "fr" */) {
  return askWithTimeout("set_language", { lang });
}

export function setTheme(idTheme /* see get_themes_id */) {
  return askWithTimeout("set_theme", { idTheme });
}

export async function showDashboardIfAny() {
  // Call after the view's `view_added` event: the dashboard is built before it fires.
  const has = await askWithTimeout("has_dashboard");
  if (has) await askWithTimeout("set_dashboard_visibility", { show: true });
  return has;
}

export function openMapComposer() {
  return askWithTimeout("show_modal_map_composer");
}

export function openShareModal() {
  return askWithTimeout("show_modal_share");
}

export function closeAllModals() {
  return askWithTimeout("close_modal_all");
}

/** Array of ISO 3166-1 alpha-3 codes, passed DIRECTLY (not wrapped). [] clears. */
export function highlightCountries(iso3Codes) {
  return askWithTimeout("set_country_highlight", iso3Codes);
}
```

## src/ui/log.js

```javascript
/**
 * Minimal debug log overlay (bottom-left of the page). Also mirrors to console.
 */
let el = null;
const MAX_LINES = 50;

export function initLog() {
  el = document.createElement("pre");
  el.className = "app-log";
  el.setAttribute("aria-live", "polite");
  document.body.appendChild(el);
}

export function log(msg) {
  console.log(`[app] ${msg}`);
  if (!el) return;
  const line = `${new Date().toLocaleTimeString()}  ${msg}`;
  const lines = el.textContent ? el.textContent.split("\n") : [];
  lines.push(line);
  el.textContent = lines.slice(-MAX_LINES).join("\n");
  el.scrollTop = el.scrollHeight;
}
```

## src/styles/app.css

```css
html, body { margin: 0; }

.app-body {
  display: flex;
  height: 75vh;
  min-height: 500px;
}

.app-sidebar {
  width: 320px;
  min-width: 320px;
  background: #fff;
  border-right: 1px solid #ccc;
  padding: 1.5rem 1rem;
  overflow-y: auto;
}

.app-map {
  flex: 1;
  position: relative;
  min-width: 0;
}

#mapx {
  position: absolute;
  inset: 0;
}

#view-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

#view-buttons button {
  padding: 0.5rem;
  cursor: pointer;
  text-align: left;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 3px;
}

#view-buttons button.is-active {
  background: #004f91;
  color: #fff;
  border-color: #004f91;
}

.app-log {
  position: fixed;
  left: 0.5rem;
  bottom: 0.5rem;
  max-width: 40ch;
  max-height: 25vh;
  overflow: auto;
  margin: 0;
  padding: 0.5rem;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.75);
  color: #e6e6e6;
  border-radius: 3px;
  z-index: 10;
}

@media (max-width: 768px) {
  .app-body { flex-direction: column; height: auto; }
  .app-sidebar { width: 100%; min-width: auto; max-height: 50vh; }
}
```
