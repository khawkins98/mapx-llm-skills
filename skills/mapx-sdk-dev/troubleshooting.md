# Troubleshooting

Common issues organized by symptom.

## SDK Won't Connect

**Symptom**: `ready` event never fires, no iframe appears.

- Verify the SDK script loads before your code:
  `<script src="https://app.mapx.org/sdk/mxsdk.umd.js"></script>`
- Check the container element exists in the DOM before `initSDK()`
- Check browser console for CORS or CSP errors
- Verify the project ID is valid (visit the URL directly in a browser)
- Ensure you're not calling `new mxsdk.Manager()` more than once

**Symptom**: `ready` never fires in headless Chromium (Playwright/Puppeteer).

- MapX requires WebGL to render the map. Headless Chromium doesn't
  provide a real GPU context, so the MapX app inside the iframe never
  finishes initializing and `ready` never fires.
- **Fix**: use `headless: false` (headed mode). The browser window can
  be off-screen or minimized, but it needs a real rendering context.
- The SDK script loads fine in headless (you can verify `typeof mxsdk`
  is `"object"`), and the Manager is created, but the iframe app stalls.

> *Evidence*: Tested April 2026 with Playwright 1.58 on macOS. In
> headless mode, `window._status` stayed at "manager created" for 90s
> before timeout. Switching to `headless: false` with the same code
> produced `ready` in ~4 seconds and returned 85 views.

**Symptom**: `ready` fires but SDK calls hang or timeout.

- The resolver may not exist in this mode (e.g. an app-only resolver with
  `static: true`) or may have thrown. Both make `ask()` hang; see
  "SDK Call Hangs Forever" below.
- Listen to `mapx.on("message", m => console.log(m.key, m.vars))` to see
  `err_resolver_not_found` / `err_resolver_failed`
- Check network tab for failing requests to `app.mapx.org`

**Symptom**: SDK call rejects with `too_many_request <nR>. Max= 10`.

- The SDK rejects a call made while more than `maxSimultaneousRequest` (default 10) requests are pending.
- **The rejected request still executes inside MapX**. Don't blindly retry side-effecting calls.
- **Fix**: throttle (sequential loop or small pool) instead of unbounded `Promise.all`, or raise `maxSimultaneousRequest` in `new Manager({...})`. See [limitations §13](limitations-and-workarounds.md).

## view_add Does Nothing

**Symptom**: `view_add` returns without error but the view doesn't appear.

- Check the return value: `true` = added, `undefined` = failed (look for an
  `err_view_invalid` message). A call that **never** returns means the view
  lookup threw.
- **Common cause**: the view ID belongs to a different project. On 1.13.19
  this did nothing at all. The 1.14 source fetches unknown IDs from the API,
  so it may now load or hang instead (not yet re-tested). See
  [Limitation §1](limitations-and-workarounds.md#1-views-outside-the-connected-project).
- Verify the view ID is correct (check for typos in the MX-XXXXX format)
- Use `get_views()` to list all views in the current project
- Check that the view hasn't been unpublished or deleted from MapX
- **Verification**: Use the `safeViewAdd` pattern or listen to `mapx.on("view_added")`
  to confirm when the view actually renders.

## Filters Don't Work

**Symptom**: `set_view_layer_filter_numeric` or `_text` has no visible effect.

- Only works on `vt` (vector tile) views — no effect on raster or cc
- **Wrong params for the mode** (most likely): app mode (default) reads only
  `value`; static mode reads `from`/`to` (numeric) or `values` + `attribute`
  (text). `{from, to}` alone does nothing in app mode. Send both forms.
- In app mode the numeric filter always applies to the view's **styled**
  attribute; `attribute` is ignored
- In static mode, a text filter without `attribute` throws and hangs
- For text: values must exactly match the attribute data (case-sensitive)
- `null` does not clear a numeric filter; reset to the full min/max range
- Use `get_view_table_attribute` to verify what values actually exist

**Symptom**: `get_view_source_summary` returns empty or stale data.

- Stats are computed server-side from the source, so rendering state isn't the cause
- Check `idAttr` exists (`get_view_table_attribute_config`)
- For `rt` views the summary does a WMS call that can be slow or throw (hang); use `askWithTimeout`

## Click Events Not Firing

**Symptom**: `click_attributes` never fires when clicking features.

- It is independent of the spotlight: `set_vector_spotlight` is **not**
  required for `click_attributes`
- Only fires for MapX-managed views (not MapLibre passthrough layers)
- Check that the view is actually a vector type (`vt`) — **true raster tile**
  views (gridded imagery) don't produce feature attributes; however, some
  views typed as `rt` in the MapX metadata are actually stored internally
  as vector tiles with a single `GRAY_INDEX` attribute (the pixel value)
  and **do** fire `click_attributes`. Treat `nPart` / batch count as the
  definitive signal of queryability — not the view type code.

**Symptom**: Click events fire but `data.attributes` is empty.

- Some views don't have attribute data attached to their features
- For GeoJSON views, the click may hit the view but the properties
  weren't included in the GeoJSON data
- A `GRAY_INDEX` value of `-3.4028234663852886e38` is the float32
  GDAL/MapX "no data" sentinel — treat this as missing data, not a
  real pixel value

## Custom Layers Don't Appear

**Symptom**: `addSource`/`addLayer` via passthrough don't show anything.

- Check that the source data is valid GeoJSON (`type: "FeatureCollection"`)
- Verify paint properties (e.g., `circle-radius` must be > 0)
- The layer may be underneath other layers — try adding a label layer
  to confirm the source data loaded
- Check console for errors — invalid MapLibre / Mapbox GL style specs throw

**Symptom**: Layers appear but disappear after zooming or panning.

- Passthrough layers are stable — this is usually a MapX view reload
  covering them. Layer z-ordering is controlled by add order.

## Dashboard Issues

**Symptom**: `has_dashboard()` returns false even though the view has charts.

- Call it after the `view_added` event for that view: the dashboard is
  created before `view_added` fires
- The dashboard may only be available at certain zoom levels
- Not all views with data have dashboards — dashboards are an optional
  MapX configuration

**Symptom**: Dashboard panel opens but is empty.

- The view's data may not have loaded yet. Wait for `view_added`, and after a camera move call `map_wait_idle()`
- Try removing and re-adding the view

## Map Composer / Share Modal

**Symptom**: Modal doesn't open.

- These calls may be blocked if MapX is still loading. Try again after `ready`
  and after startup views have fired `view_added`
- App-only modals (`show_modal_login`, `show_modal_view_meta`, …) hang in static mode
- Check if immersive mode is active — some modals require UI chrome

## SDK Call Hangs Forever

**Symptom**: `await mapx.ask(...)` never resolves — no result, no error.

- If the resolver throws, **or doesn't exist in the current mode** (e.g.
  `get_views_id_open`, `set_project` with `static: true`), the SDK's
  FrameManager drops the request without settling the Promise. Wrap calls
  with `askWithTimeout`, which also fails fast on `err_resolver_*` messages.
  See [limitations-and-workarounds.md](limitations-and-workarounds.md) §9 and §14.
- Check the method exists: `await mapx.ask("get_sdk_methods")` (omits `panels_*`)
- Check that `ready` has fired before calling `ask()`
- Check browser console for iframe errors or postMessage failures
- For `get_view_source_summary` on `rt` views, the WMS call has a 20s
  internal timeout — it will eventually return, but may be slow

## Performance Issues

**Symptom**: Map is slow or unresponsive with many layers active.

- Each active view adds network requests and rendering load
- Raster layers are heavier than vector layers at high zoom
- Remove unused views rather than hiding them with transparency
- Passthrough layers with large GeoJSON sources can cause lag —
  consider simplifying geometry or using clustering

**Symptom**: `queryRenderedFeatures` is slow or returns too many features.

- The result set is serialized through postMessage — large results
  are slow to transfer
- Use a bounding box to limit the query area
- Filter by layer ID to reduce result volume

## Common Code Mistakes

```javascript
// WRONG: wrapper omits parameters when they're undefined
function mapMethod(method, parameters) {
  const opts = { method };
  if (parameters) opts.parameters = parameters; // skips when undefined/null
  return mapx.ask("map", opts);
}

// RIGHT: always include parameters when provided
function mapMethod(method, parameters) {
  const opts = { method };
  if (parameters !== undefined) opts.parameters = parameters;
  return mapx.ask("map", opts);
}

// WRONG: calling ask() before ready
const mapx = initSDK(container);
await mapx.ask("view_add", { idView: "..." }); // Will hang!

// RIGHT: wait for ready
mapx.on("ready", async () => {
  await mapx.ask("view_add", { idView: "..." });
});

// WRONG: querying before idle
await mapx.ask("view_add", { idView: "..." });
const summary = await mapx.ask("get_view_source_summary", { ... }); // Stale!

// RIGHT: wait for idle
await mapx.ask("view_add", { idView: "..." });
await mapx.ask("map_wait_idle");
const summary = await mapx.ask("get_view_source_summary", { ... });

// WRONG: removing source before layers
await mapx.ask("map", { method: "removeSource", parameters: ["src"] }); // Error!
await mapx.ask("map", { method: "removeLayer", parameters: ["layer"] });

// RIGHT: layers first, then source
await mapx.ask("map", { method: "removeLayer", parameters: ["layer"] });
await mapx.ask("map", { method: "removeSource", parameters: ["src"] });
```
