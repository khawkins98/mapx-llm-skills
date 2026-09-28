# Limitations and Workarounds

> **SDK version context**: These limitations were first observed at
> runtime against the deployed SDK **1.13.19** (March 2026). They were
> re-checked against the upstream source at tag **1.14.0-fix.1** (deployed
> August 2026), and each section says whether a 1.14 statement comes from
> the source or from a runtime test. MapX switched from Mapbox GL JS v2 to
> MapLibre GL JS v5 in 1.14. The SDK does not pin versions in its CDN URLs,
> so behaviour may change without notice. The GitHub default branch is `main`.

## 1. Views Outside the Connected Project

**Observed on 1.13.19 (runtime)**: `view_add` with a view ID from a
different project returned without error and did nothing: no thrown error,
no visual change.

> *Evidence*: Observed 2026-03-19 when attempting to load Eco-DRR story maps
> from the HOME project. Documented in `mapx-demo-embed/methodology.md` §8.

**1.14 (runtime-verified 2026-09-28, static and app mode)**: `view_add`
now looks the ID up in the loaded project and, if it's missing, **fetches
it from the MapX API** (`getViewRemote`). Results:

| Case | `view_add` result | `view_added` | On map |
|---|---|---|---|
| View in the connected project | `true` | ✅ | ✅ |
| **Public view from another project** | `true` | ✅ | ✅ |
| Non-existent ID | **never settles**; `err_resolver_failed` message: `View not found: "MX-…"` | ❌ | ❌ |
| View already open | `true` | ✅ fires again | ✅ |

So **cross-project loading of public views works in 1.14**; the March 2026
limitation no longer applies. Filters, transparency and legends also
worked on those remotely-fetched views. Not tested: a view that exists but
is **not** readable by guests (no fixture was available). Expect the
"not found" hang, but verify.

> *Evidence*: `tests/runtime/` in this repo (`node run.mjs`), fixture
> `MX-KEG0W-U2098-JKIYJ` (public, owned by the CDC project) added while
> connected to ECO-DRR and HOME.

**Related gotcha: inaccessible projects fall back silently.** If the
Manager's `project=` URL param names a project the current user can't open,
MapX loads the public **HOME** project instead, with no error. Check
`await mapx.ask("get_project")` (app mode) after `ready` if it matters.

**Defensive verification pattern (`safeViewAdd`)**: combine the resolver's
return value, the `view_added` event, the `message` error channel, and a
timeout. (`view_added` fires even when the view was already open.)

```javascript
function safeViewAdd(mapx, idView, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok, why) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      mapx.off("view_added", onAdded);
      mapx.off("message", onMessage);
      if (!ok) console.warn(`view_add failed for ${idView}: ${why}`);
      resolve(ok);
    };
    const onAdded = (d) => d?.idView === idView && finish(true);
    const onMessage = (m) => {
      if (m?.level !== "error") return;
      const k = m.key;
      if (k === "err_view_invalid" ||
          (k === "err_resolver_failed" && m.vars?.idResolver === "view_add")) {
        finish(false, k);
      }
    };
    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);

    mapx.on("view_added", onAdded);
    mapx.on("message", onMessage);
    mapx.ask("view_add", { idView })
      .then((res) => { if (res !== true) finish(false, `resolved ${res}`); })
      .catch((err) => finish(false, String(err))); // e.g. too_many_request
  });
}
```

Notes:
- `view_add` resolves `true` just before `view_added` fires, so the event is
  the confirmation that the layers exist. The `true` return on its own is
  also a reasonable success signal.
- The `message` match is by resolver name, so two concurrent `view_add`
  calls can't be told apart there. The `view_added` payload check by
  `idView` still disambiguates successes.

**Workaround for story maps**: Load a second MapX instance in an overlay
iframe with the target project and `?storyAutoStart=true`:

```
https://app.mapx.org/?project=MX-TARGET-PROJECT&views=MX-STORY-VIEW-ID&storyAutoStart=true&language=en
```

Add a "Close" button over the overlay to dismiss it.

**Alternative**: Use `set_project({idProject})` to switch projects, but
this reloads the entire MapX app state (you lose all current views/filters).

**Best solution**: Ask the MapX data administrators to add the needed views
to your project.

## 2. No Native Map Events

**Problem**: The parent page cannot listen to native MapLibre GL events
(`moveend`, `zoomend`, `click`, `mousemove`, etc.). The SDK's postMessage
bridge only forwards MapX's own events (`ready`, `click_attributes`,
`view_added`, … see the Events Catalog in [sdk-methods.md](sdk-methods.md)).

> *Evidence*: This follows directly from the SDK's architecture — the `map`
> resolver only supports calling methods with serializable arguments. The
> SDK README documents the `on()` method for SDK events but not for
> MapLibre GL native events. Confirmed by postMessage serialization constraint.

**Why**: `map.on("moveend", callback)` requires passing a function through
postMessage, which only accepts serializable data.

**Workaround**: Poll for camera state:

```javascript
setInterval(async () => {
  const center = await mapx.ask("map", { method: "getCenter" });
  const zoom = await mapx.ask("map", { method: "getZoom" });
  updateCoordinateDisplay(center, zoom);
}, 2000);
```

## 3. No Click Handlers on Passthrough Layers

**Problem**: Layers added via the `"map"` passthrough (`addSource`/`addLayer`)
do not trigger `click_attributes` events. The `map.on("click", layerId, cb)`
pattern doesn't work because callbacks can't be serialized.

> *Evidence*: Observed 2026-03-19 when adding custom point/polygon overlays
> via passthrough. The `click_attributes` event only fires for MapX-managed
> views (those added via `view_add` or `view_geojson_create`). This is
> consistent with the SDK architecture — `click_attributes` is wired to
> MapX's internal click handler, not to MapLibre GL's event system.

**Workaround**: Coordinate matching fallback:

1. Store GeoJSON data locally when adding to the map
2. Listen for `click_attributes` — it includes click coordinates even when
   no MapX feature is hit
3. Match click coordinates against local data:

```javascript
// For points: nearest-neighbor search
// Note on tolerance: value is in geographic degrees (~0.5° is ~55 km at the equator).
// For calibrated precision across zoom levels, scale with zoom:
// const tolerance = 20 / (2 ** zoom);
function findNearestFeature(clickLng, clickLat, features, tolerance = 0.5) {
  let nearest = null;
  let minDist = Infinity;

  for (const f of features) {
    const [fLng, fLat] = f.geometry.coordinates;
    const dist = Math.sqrt((fLng - clickLng) ** 2 + (fLat - clickLat) ** 2);
    if (dist < minDist && dist < tolerance) {
      minDist = dist;
      nearest = f;
    }
  }
  return nearest;
}

// For polygons: ray-casting point-in-polygon test
// Limitations:
// - Only checks the outer ring (polygon[0]). Points inside holes
//   (interior rings) will incorrectly return true. To handle holes,
//   check the outer ring, then exclude if inside any subsequent ring.
// - Handles Polygon geometry only. For MultiPolygon, iterate over
//   each polygon in geometry.coordinates and test each one.
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  const ring = polygon[0]; // outer ring

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
```

## 4. toggle_draw_mode Not Available for Spatial Queries

**Problem**: The SDK once had a `toggle_draw_mode` resolver (added in
[commit aee274a, June 2020](https://github.com/unep-grid/mapx/commit/aee274a)),
but it has since been removed from the deployed SDK. Calling it throws
"unknown resolver."

> *Evidence*: Observed 2026-03-19 against the deployed UMD (v1.13.19).
> The resolver is absent from `mapx_resolvers/static.js` on the `main`
> branch (the active default branch). It is still present on the stale
> `master` branch, which may cause confusion when reading source code.
> The underlying `drawModeToggle()` function exists internally
> (`app/src/js/draw/helper.js`) but is not exposed through the SDK.
>
> Even when `toggle_draw_mode` existed, it would not have been useful for
> spatial queries: it toggled the internal MapboxDraw UI and returned only
> a boolean. There was no SDK method to retrieve drawn geometry — the
> drawn shapes were saved as internal MapX views, never sent back to the
> parent page via postMessage. It also had no rectangle drawing mode.

**Workaround**: Use transparent overlay divs positioned over the map for
box select and polygon select tools:

1. Create a transparent div with `cursor: crosshair` over the map
2. Capture click coordinates on the overlay
3. Draw visual feedback (rectangles, polygon vertices) using DOM elements
4. Pass pixel coordinates to `queryRenderedFeatures`
5. Remove the overlay when done

Key implementation detail: distinguish clicks from drags by measuring
mouse movement between mousedown/mouseup (5px threshold). Pass drag
and wheel events through to the iframe for pan/zoom.

## 5. queryRenderedFeatures Returns All Layers

**Problem**: `queryRenderedFeatures` returns features from all rendered
vector layers, including basemap layers (roads, labels, water boundaries).

> *Note*: This is standard MapLibre GL JS behavior, not a MapX limitation.
> The `layers` option can filter results to specific layer IDs.

**Workaround**: Filter results by layer ID prefix. MapX view layers follow
naming conventions; basemap layers use MapLibre / OpenMapTiles default names:

```javascript
function filterBasemapFeatures(features) {
  return features.filter(f => {
    const id = f.layer?.id || "";
    // Keep features from MapX view layers, filter out basemap
    return id.startsWith("MX-") || id.startsWith("demo-") || id.startsWith("custom-");
  });
}
```

## 6. getLayer/getSource Return Values Unreliable

**Problem**: Calling `map({method: "getLayer"})` or `map({method: "getSource"})`
sometimes returns truthy objects for non-existent layers when serialized
through postMessage.

> *Evidence*: Observed 2026-03-19 when implementing cleanup for spatial
> query highlight layers. Pre-checking with `getLayer` before `removeLayer`
> was abandoned because the serialized return was unreliable. The try/catch
> approach below was adopted instead. This may be related to how the
> structured clone algorithm serializes MapLibre GL's internal `StyleLayer`
> objects.

**Workaround**: Don't pre-check existence. Instead, use try/catch around
`removeLayer`/`removeSource` and swallow errors:

```javascript
async function safeRemoveLayer(id) {
  try {
    await mapx.ask("map", { method: "removeLayer", parameters: [id] });
  } catch {
    // Already removed or never existed
  }
}
```

## 7. Raster Views Are Not Queryable

`vt` views have discrete features that can be filtered, queried spatially,
and exported. Raster (`rt`) and custom-coded (`cc`) views do not — they're
gridded image data without individual features.

Your UI should detect view type and disable incompatible tools:

```javascript
function isQueryable(viewType) {
  return viewType === "vt";
}
```

## 8. Story Map Cross-Project Iframe Approach

For story maps in a different project, the overlay iframe approach:

```javascript
function playStoryMap(viewId, title) {
  const projectId = "MX-TARGET-PROJECT-ID";
  const url = `https://app.mapx.org/?project=${projectId}&views=${viewId}&storyAutoStart=true&language=en`;

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:absolute;inset:0;z-index:20;background:#000;";

  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.cssText = "width:100%;height:100%;border:none;";
  overlay.appendChild(iframe);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close Story Map";
  closeBtn.style.cssText = "position:absolute;top:1rem;right:1rem;z-index:21;";
  closeBtn.addEventListener("click", () => overlay.remove());
  overlay.appendChild(closeBtn);

  document.querySelector(".app-map").appendChild(overlay);
}
```

Trade-offs:
- Loads a full second MapX instance
- The story map runs independently (not SDK-controllable)
- The SDK map underneath preserves state

## 9. SDK Promise Hangs on Resolver Exceptions

**Problem**: If a resolver throws, or **doesn't exist** (typo, removed
method, or an app-only resolver called in static mode), the worker replies
`success: false`. The SDK's `FrameManager` removes the request from its
queue but **never resolves or rejects the Promise**. Your
`await mapx.ask(...)` call hangs forever.

> *Evidence*: Confirmed in the SDK source (`frameManager.js`, lines 375–380 on
> GitHub `main` branch). The hang was observed in practice on 2026-03-19 when calling
> `get_view_source_summary` on raster views — a timeout was added
> reactively in commit `e77a752` of `mapx-demo-embed` with message
> *"Timeouts on SDK calls that hang for raster views"*. The SDK source
> shows `rt` views make a WMS call with a 20s internal timeout, so the
> hang likely occurs when that call throws rather than timing out cleanly.

**Why**: In `frameManager.js`, the response handler only calls
`req.onResponse(message.value)` when `message.success` is `true`. When
`success` is `false`, the request is cleaned up from internal state but
`req.onError` is never invoked, leaving the Promise unfulfilled.

The worker *does* send an error message alongside the failed response
(`err_resolver_failed` with `vars.idResolver` and `vars.msg`, or
`err_resolver_not_found` with `vars.idResolver`). The Manager re-emits it as
a `"message"` event, so a wrapper can reject early instead of waiting out
the full timeout.

**Workaround**: Wrap any `ask()` call that might fail with a timeout that
also listens for the error message and cleans up on settlement:

```javascript
function askWithTimeout(mapx, resolver, opt = {}, ms = 15000) {
  let timer;
  let onMessage;
  const failFast = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${resolver} timed out after ${ms}ms`)), ms);
    onMessage = (m) => {
      const isErr = m?.level === "error" &&
        (m.key === "err_resolver_failed" || m.key === "err_resolver_not_found");
      if (isErr && m.vars?.idResolver === resolver) {
        reject(new Error(`${resolver}: ${m.key}${m.vars?.msg ? ` (${m.vars.msg})` : ""}`));
      }
    };
    mapx.on("message", onMessage);
  });
  return Promise.race([mapx.ask(resolver, opt), failFast]).finally(() => {
    clearTimeout(timer);
    mapx.off("message", onMessage);
  });
}
```

The error message carries the resolver name but not your request, so if
two calls to the *same* resolver are in flight, one failure rejects both
wrappers. That's usually acceptable, and the timeout remains the backstop.

This is especially relevant for:
- Any resolver that might not exist in the current mode (see §14)
- `get_view_source_summary` on `rt` views — the WMS `GetCapabilities`
  call can throw on malformed responses, triggering the hang
- Calls that pass user-supplied or dynamic arguments to resolvers,
  where an invalid value could cause the resolver to throw

## 10. Statistics on Custom GeoJSON Views

`get_view_source_summary` may not return useful data for GeoJSON views
created via `view_geojson_create`. Compute statistics locally instead:

```javascript
function computeLocalStats(features, attribute) {
  const values = features
    .map(f => f.properties[attribute])
    .filter(v => v != null);

  if (values.length === 0) return null;

  if (typeof values[0] === "number") {
    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }

  // Categorical: frequency counts
  const counts = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  return { count: values.length, categories: counts };
}
```

## 11. MapX REST API requires authentication

**Problem**: MapX has a REST API at `app.mapx.org/get/...` but all
view-listing and search endpoints require authentication parameters
(`idUser`, `idProject`, `token`). There is no public/anonymous access.

> *Evidence*: Tested April 2026. The API source is at
> `github.com/unep-grid/mapx/tree/main/api`. Route definitions are in
> `api/index.js`. The endpoint `/get/views/list/global/public/` exists
> and returns HTTP 200, but responds with
> `{"type":"error","message":"Missing parameter: [\"idUser\",\"idProject\",\"token\"]"}`.
> The `/get/search/key` endpoint returns 404 without auth.

**Known API routes** (from source inspection, all require auth):

| Route | Method | Purpose |
|---|---|---|
| `/get/view/item/:id` | GET | Single view details |
| `/get/views/list/project/` | GET/POST | Views in a project |
| `/get/views/list/global/public/` | POST | Public views (needs idUser, idProject, token) |
| `/get/search/key` | GET | Keyword search |
| `/get/source/summary/` | GET | Source data summary |
| `/get/source/table/attribute/` | GET | Attribute table |

**Workaround**: Use the SDK's `get_views` method through the iframe,
which authenticates automatically via the MapX app session. To dump a
full project catalogue programmatically, load the SDK in a browser
(Playwright), wait for `ready`, and call `get_views`. The host page must be
a **secure context** (serve it from `http://localhost`, not
`page.setContent()`/`about:blank`); see the note below.

```javascript
// In a Playwright test or script. Serve this HTML from http://localhost
// (e.g. a tiny node:http server) and page.goto() it:
await page.goto("http://localhost:PORT/probe.html");
/* probe.html:
  <div id="c"></div>
  <script src="https://app.mapx.org/sdk/mxsdk.umd.js"></script>
  <script>
    const mgr = new mxsdk.Manager({
      container: document.getElementById("c"),
      url: "https://app.mapx.org/?project=MX-PROJECT-ID&language=en",
      style: { width: "1px", height: "1px", border: "none" },
    });
    mgr.on("ready", async () => {
      window._views = await mgr.ask("get_views");
      window._done = true;
    });
  </script>
*/
await page.waitForFunction(() => window._done, { timeout: 90000 });
const views = await page.evaluate(() => window._views);
// views = [{id, type, data: {title: {en: "..."}, abstract: {en: "..."}}}, ...]
```

**Important**: `ready` never fires when the host page is `about:blank`
(e.g. Playwright `page.setContent()`). MapX calls `crypto.randomUUID()`,
which only exists in secure contexts, and the iframe app crashes during
startup. Serve the page from `http://localhost`; **headless Chromium then
works** (ready in about 4 s, verified 2026-09-28). See
[troubleshooting.md](troubleshooting.md).

This is the only reliable way to enumerate views within a single project
without API credentials.

## 12. MeiliSearch catalogue API (cross-project search)

MapX exposes a [MeiliSearch](https://www.meilisearch.com/) index at
`search.mapx.org` that covers all public views across all projects.
This is the only way to search the full ~2,100-view catalogue without
probing projects one by one.

> *Evidence*: Tested April 2026. The index `views_en` returns view IDs,
> titles, project IDs, and abstracts. Requires an API key passed via
> the `X-Meili-API-Key` header. A key can be obtained from the MapX
> team (contact Pierre at GRID-Geneva).

**Endpoint**: `POST https://search.mapx.org:443/indexes/views_en/search`

**Headers**: `X-Meili-API-Key: <your-key>`, `Content-Type: application/json`

**Body**: `{"q": "search terms", "limit": 20}`

```javascript
const https = require("https");

function searchMapX(query, apiKey, limit = 20) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ q: query, limit });
    const req = https.request({
      hostname: "search.mapx.org",
      port: 443,
      path: "/indexes/views_en/search",
      method: "POST",
      headers: {
        "X-Meili-API-Key": apiKey,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const result = await searchMapX("flood hazard", API_KEY);
// result.hits = [{view_id, title, project_id, ...}, ...]
```

**Response shape** (per hit):

- `view_id` -- MapX view ID (e.g. `MX-V07LO-829XA-4BIZ8`)
- `title` -- English title
- `project_id` -- which MapX project hosts this view
- `abstract` -- description text (may contain HTML)

Other language indexes may be available (e.g. `views_fr`). The
`views_en` index is the most complete.

**When to use this vs SDK probe**:
- MeiliSearch: searching for a dataset by keyword across all projects
- SDK `get_views`: dumping the full catalogue of a specific project

## 13. Concurrent Request Queue Ceiling (`maxSimultaneousRequest`)

**Problem**: `FrameManager.ask()` counts pending requests *before* adding
the new one, and rejects when that count is **greater than**
`maxSimultaneousRequest` (default 10). With the default, the first call
rejected is the one made while 11 are already pending, i.e. the 12th
concurrent call:

```
too_many_request 11. Max= 10
```

The rejection value is a **plain string**, not an `Error`.

**The rejected request still runs.** After calling `reject()`, `ask()`
carries on: it posts the request to the iframe and queues it. MapX executes
it, and only your promise was rejected. A rejected `view_add` may still add
the view, and a naive retry runs it twice.

> *Evidence*: `frameManager.js` `ask()` at tag `1.14.0-fix.1`:
> `if (nR > mR) { …; reject(`too_many_request ${nR}. Max= ${mR}`); }` is
> followed unconditionally by `fm._post(req); fm._req.push(req);`.
> **Runtime-verified 2026-09-28** (both modes): with 11 requests pending, a
> 12th `set_language {lang:"fr"}` was rejected with
> `too_many_request 11. Max= 10`, and `get_language` afterwards returned `"fr"`.

**Workarounds**:
1. **Throttle** (preferred): use sequential loops (`for … of`) or a small
   concurrency pool instead of unbounded `Promise.all`.
2. **Raise the ceiling**: e.g. `maxSimultaneousRequest: 20` in `new Manager({ … })`.
3. **Never blindly retry** side-effecting calls (`view_add`, `view_remove`,
   filters, `set_project`) after `too_many_request`. Check the resulting
   state (e.g. `get_views_with_visible_layer`) first.

## 14. Static Mode vs. App Mode

Upstream's SDK README calls **static mode the primary, recommended usage**:
lighter and faster, with no login or user roles. Pick app mode only when you
need its extra features.

With `static: true` (or `/static.html`) MapX uses `MapxResolversStatic`
instead of `MapxResolversApp`. Resolvers that only exist in app mode do not
reject in static mode: the worker answers `err_resolver_not_found` and the
promise **hangs** (§9).

| Resolver | Static mode | App mode | Workaround in static mode |
|---|---|---|---|
| `get_views_id_open` | ⏳ Hangs (`err_resolver_not_found`) | ✅ | `get_views_with_visible_layer` |
| `set_project`, `get_project`, `get_projects` | ⏳ Hangs | ✅ | Recreate the Manager with another `project` URL param |
| `get_user_id` / `get_user_email` / `get_user_roles` / `is_user_guest` / `get_token` / `set_token` / `show_modal_login` | ⏳ Hangs | ✅ | N/A (static mode is unauthenticated). `get_user_ip` **does** work in static. |
| `move_view_*`, `get_views_list_*`, `set_views_list_*`, `get_views_order` | ⏳ Hangs | ✅ | `set_views_layer_order` works in both |
| `show_modal_view_meta`, `show_modal_view_edit`, `show_modal_tool` | ⏳ Hangs | ✅ | `get_view_meta` and render it yourself |
| `table_editor_*` | ⏳ Hangs | ✅ | N/A |

**Behavioural differences for resolvers that exist in both modes**:

| Resolver | App mode | Static mode |
|---|---|---|
| `set_view_layer_filter_numeric` | Reads `value` only (via the view's slider) | Reads `from`/`to`/`attribute` (`value` is converted) |
| `set_view_layer_filter_text` | Reads `value` only (via the search box) | Reads `values` + `attribute` (`attribute` effectively required) |
| `set_view_layer_filter_time` | Reads `value` (slider) | Reads `from`/`to`/`hasT0`/`hasT1` |
| `set_view_layer_transparency` | `value` = transparency 0–100 (slider) | `opacity` (or `value`) = MapLibre opacity 0–1 |
| `view_add` on a story map (`sm`) view | Adds it to the view list | Starts the story reader (`storyRead`, autostart) |

Call `get_sdk_methods` to list what the current mode supports. Note that it
omits the `panels_*` resolvers, which are available in both modes.
