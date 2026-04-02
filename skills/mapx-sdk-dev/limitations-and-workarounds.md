# Limitations and Workarounds

> **SDK version context**: These limitations were observed against the
> deployed MapX SDK at `app.mapx.org/sdk/mxsdk.umd.js` (embedded version
> string 1.13.19) during March 2026. The SDK does not pin versions in its
> UMD URL, so behavior may change without notice. The GitHub `main`
> branch (`@fxi/mxsdk` 1.9.40-alpha.1) does not match the deployed build.
> Note: the default branch is `main`, not `master` (the `master` branch
> is stale). Where a limitation contradicts the SDK source or docs, the
> evidence and reasoning are noted inline.

## 1. Cross-Project View Scope

**Problem**: `view_add` only works for views in the currently loaded project.
If you pass a view ID from a different project, the call returns without
error but does nothing — no network requests, no thrown error, no visual
change.

> *Evidence*: Observed 2026-03-19 when attempting to load Eco-DRR story maps
> from the HOME project. Documented in `mapx-demo-embed/methodology.md` §8.
> The SDK source does not document this behavior — the resolver accepts any
> `idView` string without validation.

**Why**: The MapX app inside the iframe only resolves views from its loaded
project. Cross-project references are silently ignored.

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

**Problem**: The parent page cannot listen to native Mapbox GL events
(`moveend`, `zoomend`, `click`, `mousemove`, etc.). The SDK's postMessage
bridge only supports SDK-defined events (`ready`, `click_attributes`).

> *Evidence*: This follows directly from the SDK's architecture — the `map`
> resolver only supports calling methods with serializable arguments. The
> SDK README documents the `on()` method for SDK events but not for
> Mapbox GL native events. Confirmed by postMessage serialization constraint.

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
> MapX's internal click handler, not to Mapbox GL's event system.

**Workaround**: Coordinate matching fallback:

1. Store GeoJSON data locally when adding to the map
2. Listen for `click_attributes` — it includes click coordinates even when
   no MapX feature is hit
3. Match click coordinates against local data:

```javascript
// For points: nearest-neighbor search
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

> *Note*: This is standard Mapbox GL JS behavior, not a MapX limitation.
> The `layers` option can filter results to specific layer IDs.

**Workaround**: Filter results by layer ID prefix. MapX view layers follow
naming conventions; basemap layers use Mapbox default names:

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
> structured clone algorithm serializes Mapbox GL's internal `StyleLayer`
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

**Problem**: If a resolver throws an exception (as opposed to returning
normally), the SDK's `FrameManager` error-handling path removes the
request from its queue but **never resolves or rejects the Promise**.
Your `await mapx.ask(...)` call hangs forever.

> *Evidence*: Confirmed in the SDK source (`frameManager.js` on GitHub
> `master`). The hang was observed in practice on 2026-03-19 when calling
> `get_view_source_summary` on raster views — a timeout was added
> reactively in commit `e77a752` of `mapx-demo-embed` with message
> *"Timeouts on SDK calls that hang for raster views"*. The SDK source
> shows `rt` views make a WMS call with a 20s internal timeout, so the
> hang likely occurs when that call throws rather than timing out cleanly.

**Why**: In `frameManager.js`, the response handler only calls
`req.onResponse(message.value)` when `message.success` is `true`. When
`success` is `false`, the request is cleaned up but the Promise callback
is never invoked.

**Workaround**: Wrap any `ask()` call that might trigger an exception
with a timeout:

```javascript
function askWithTimeout(mapx, resolver, opt, ms = 15000) {
  return Promise.race([
    mapx.ask(resolver, opt),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${resolver} timed out`)), ms)
    ),
  ]);
}
```

This is especially relevant for:
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
full project catalogue programmatically, load the SDK in a headless
browser (Playwright), wait for `ready`, and call `get_views`:

```javascript
// In a Playwright test or script:
await page.setContent(`
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
`);
await page.waitForFunction(() => window._done, { timeout: 90000 });
const views = await page.evaluate(() => window._views);
// views = [{id, type, data: {title: {en: "..."}, abstract: {en: "..."}}}, ...]
```

This is the only reliable way to enumerate views without API credentials.
