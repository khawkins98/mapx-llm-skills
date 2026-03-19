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

**Symptom**: `ready` fires but SDK calls hang or timeout.

- MapX app may still be loading views — call `map_wait_idle()` first
- Check network tab for failing requests to `app.mapx.org`

## view_add Does Nothing

**Symptom**: `view_add` returns without error but the view doesn't appear.

- **Most common cause**: The view ID belongs to a different project.
  Cross-project `view_add` fails silently.
- Verify the view ID is correct (check for typos in the MX-XXXXX format)
- Use `get_views()` to list all views in the current project
- Check that the view hasn't been unpublished or deleted from MapX

## Filters Don't Work

**Symptom**: `set_view_layer_filter_numeric` or `_text` has no visible effect.

- Only works on `vt` (vector tile) views — no effect on raster or cc
- For numeric: the `from`/`to`/`attribute` form worked in testing but the
  SDK source documents a `value` param -- try both if one doesn't work
- For text: values must exactly match the attribute data (case-sensitive)
- Call `map_wait_idle()` before applying filters
- Use `get_view_table_attribute` to verify what values actually exist

**Symptom**: `get_view_source_summary` returns empty or stale data.

- Call `map_wait_idle()` first — this is the most common fix
- The view must be added to the map before querying its data

## Click Events Not Firing

**Symptom**: `click_attributes` never fires when clicking features.

- Ensure `set_vector_highlight({enable: true})` is called after ready
- Only fires for MapX-managed views (not Mapbox passthrough layers)
- Check that the view is actually a vector type (`vt`) — raster clicks
  don't produce feature attributes

**Symptom**: Click events fire but `data.attributes` is empty.

- Some views don't have attribute data attached to their features
- For GeoJSON views, the click may hit the view but the properties
  weren't included in the GeoJSON data

## Custom Layers Don't Appear

**Symptom**: `addSource`/`addLayer` via passthrough don't show anything.

- Check that the source data is valid GeoJSON (`type: "FeatureCollection"`)
- Verify paint properties (e.g., `circle-radius` must be > 0)
- The layer may be underneath other layers — try adding a label layer
  to confirm the source data loaded
- Check console for errors — invalid Mapbox GL specs throw

**Symptom**: Layers appear but disappear after zooming or panning.

- Passthrough layers are stable — this is usually a MapX view reload
  covering them. Layer z-ordering is controlled by add order.

## Dashboard Issues

**Symptom**: `has_dashboard()` returns false even though the view has charts.

- Call `map_wait_idle()` first
- The dashboard may only be available at certain zoom levels
- Not all views with data have dashboards — dashboards are an optional
  MapX configuration

**Symptom**: Dashboard panel opens but is empty.

- The view's data may not have loaded yet — `map_wait_idle()` again
- Try removing and re-adding the view

## Map Composer / Share Modal

**Symptom**: Modal doesn't open.

- These calls may be blocked if MapX is still loading
- Try after `map_wait_idle()`
- Check if immersive mode is active — some modals require UI chrome

## SDK Call Hangs Forever

**Symptom**: `await mapx.ask(...)` never resolves — no result, no error.

- If the resolver throws an exception (rather than returning normally),
  the SDK's FrameManager drops the request without resolving the Promise.
  Wrap calls in a timeout — see
  [limitations-and-workarounds.md](limitations-and-workarounds.md) §9.
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
