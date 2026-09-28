# MapX SDK Method Catalog

Reference for `mapx.ask()` resolver methods validated against the deployed
SDK (v1.14.0-fix.1, August 2026; originally tested on v1.13.19). MapX uses
MapLibre GL JS under the hood. The SDK has additional methods not yet
documented here; see the [SDK source](https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk)
for the full list. Every method returns a Promise. Parameters are passed
as a single object.

## Map Navigation & Display

### map_fly_to

Animate the map camera smoothly. Accepts standard MapLibre GL `AnimationOptions`.

```javascript
await mapx.ask("map_fly_to", {
  center: { lng: -72, lat: 18 },
  zoom: 5.5,
  bearing: 0,
  pitch: 0,
  duration: 2000,    // ms
  essential: true,   // not affected by prefers-reduced-motion
});
```

### map_jump_to

Move the camera instantaneously without animation transitions.

```javascript
await mapx.ask("map_jump_to", {
  center: { lng: 10, lat: 45 },
  zoom: 6,
  bearing: 0,
  pitch: 0,
});
```

### map_get_zoom

Returns the current zoom level as a floating-point number.

```javascript
const zoom = await mapx.ask("map_get_zoom");
// => 5.5
```

### map_get_center

Returns the current map center coordinates.

```javascript
const center = await mapx.ask("map_get_center");
// => { lng: -72.0, lat: 18.0 }
```

### map_get_bounds_array / map_set_bounds_array

Get or set the current visible bounding box as `[west, south, east, north]`.

```javascript
const bounds = await mapx.ask("map_get_bounds_array");
// => [-75.2, 17.5, -68.8, 19.9]

// Sets max/fit bounds immediately (accepts bounds array only):
await mapx.ask("map_set_bounds_array", {
  bounds: [-75.2, 17.5, -68.8, 19.9],
});
```

### map_get_max_bounds_array / map_set_max_bounds_array

Constrain map panning to a specific bounding box.

```javascript
await mapx.ask("map_set_max_bounds_array", {
  bounds: [-80, 15, -65, 25],
});
```

### map_wait_idle

Returns a Promise that resolves when the map finishes rendering all tiles.
**Call this before** dashboard operations, filter operations, or data queries
to avoid race conditions.

```javascript
await mapx.ask("map_wait_idle");
// Safe to query data now
```

### common_loc_fit_bbox

Fly to a country or region bounding box.

```javascript
// By ISO 3166-1 alpha-3 code
await mapx.ask("common_loc_fit_bbox", {
  code: "IND",
  param: { duration: 2000, maxZoom: 8 },
});

// By M49 region code
await mapx.ask("common_loc_fit_bbox", {
  code: "m49_029",  // Caribbean
  param: { duration: 2000 },
});
```

### common_loc_get_list_codes

Returns available location codes for `common_loc_fit_bbox`.

```javascript
const codes = await mapx.ask("common_loc_get_list_codes");
// => [{code: "AFG", label: "Afghanistan"}, {code: "m49_029", label: "Caribbean"}, ...]
```

### set_3d_terrain

Toggle elevation exaggeration on the basemap.

```javascript
await mapx.ask("set_3d_terrain", { action: "toggle" });
// Actions: "show", "hide", "toggle"
```

### set_mode_3d

Adjust pitch and bearing for a 3D perspective view.

```javascript
await mapx.ask("set_mode_3d", { action: "toggle" });
// Actions: "show", "hide", "toggle"
```

### set_mode_aerial

Switch between standard basemap and satellite imagery.

```javascript
await mapx.ask("set_mode_aerial", { action: "toggle" });
// Actions: "show", "hide", "toggle"
```

### set_immersive_mode

Hide all MapX UI chrome for a clean presentation view.

```javascript
await mapx.ask("set_immersive_mode", { toggle: true });
// Or: { enable: true } / { enable: false }
```

---

## View Management

### view_add

Display a view on the map. The idView must belong to the current project.

```javascript
const ok = await mapx.ask("view_add", { idView: "MX-XXXXX-XXXXX-XXXXX" });
// => true/false
```

**Warning**: If the view ID belongs to a different project, this call returns
without error but does nothing. No network requests, no thrown error, no
visual change. This is the most common gotcha.

### view_remove

Remove a view from the map.

```javascript
const ok = await mapx.ask("view_remove", { idView: "MX-XXXXX-XXXXX-XXXXX" });
// => true/false
```

### get_view_meta

Returns metadata for a view: title, abstract, source, temporal extent, type.
Text fields are language objects (`{en, fr, es, ...}`).

```javascript
const meta = await mapx.ask("get_view_meta", { idView: "MX-XXXXX" });
// => { title: {en: "..."}, abstract: {en: "..."}, type: "vt", source: [...], temporal: {...} }
```

### get_view_legend_image

Returns a base64-encoded PNG of the view's legend, or null.

```javascript
const legend = await mapx.ask("get_view_legend_image", { idView: "MX-XXXXX" });
// => "data:image/png;base64,..." or base64 string or null
```

### get_views

Returns the full catalog of views in the current project as an array of view objects.

```javascript
const views = await mapx.ask("get_views");
/*
Sample element:
{
  id: "MX-XXXXX-XXXXX-XXXXX",
  type: "vt", // "vt" (vector), "rt" (raster), "cc" (custom coded), "sm" (story map)
  data: {
    title: { en: "Protected Areas", fr: "Aires protégées" },
    abstract: { en: "National and international protected areas..." },
    source: { name: "WDPA", url: "https://..." },
    attribute: { name: "status_year", type: "number" },
    style: { ... }
  },
  project: "MX-PROJECT-ID",
  date_modified: "2024-05-12T10:14:00.000Z"
}
*/
```

### get_views_id_open (App Mode Only)

Returns IDs of currently displayed views.

```javascript
const ids = await mapx.ask("get_views_id_open");
// => ["MX-XXXXX", "MX-YYYYY"]
```

> **Static mode warning**: `get_views_id_open` is an `App`-only method. When running with
> `static: true` (or `/static.html`), calling it will reject with `err_resolver_not_found`.
> Use `get_views_with_visible_layer` below instead.

### get_views_with_visible_layer (Static & App Mode)

Returns an array of view ID strings that currently have active, visible layers on the map.

```javascript
const visibleIds = await mapx.ask("get_views_with_visible_layer");
// => ["MX-XXXXX", "MX-YYYYY"]
```

### set_views_layer_order

Reorders the visual stacking of view layers on the map.

```javascript
await mapx.ask("set_views_layer_order", {
  order: ["MX-TOP-VIEW", "MX-BOTTOM-VIEW"],
});
```

### set_project (App Mode Only)

Switches the active MapX project dynamically without reloading the parent page.

```javascript
const ok = await mapx.ask("set_project", { idProject: "MX-TARGET-PROJECT-ID" });
```

**Behavior & Constraints**:
- **App mode only**: Requires an active Shiny websocket session; fails with a console warning in static mode (`static: true`).
- **State reset**: Closes all currently displayed views and clears initial query parameters.
- **Event**: Fires a `project_changed` event with payload `{ new_project, old_project }` when complete. The `ready` event does **not** fire again.

---

## GeoJSON Views (Custom Data)

### view_geojson_create

Create a native MapX view from GeoJSON. Integrates with the view system
(layer ordering, click events, view list).

```javascript
const result = await mapx.ask("view_geojson_create", {
  data: featureCollection,      // GeoJSON FeatureCollection
  title: { en: "My Points" },   // or plain string
  abstract: "Description",
  random: false,                 // randomize styling?
});
const viewId = result.id;
```

### view_geojson_set_style

Style a GeoJSON view using MapLibre GL paint and layout properties.

```javascript
await mapx.ask("view_geojson_set_style", {
  idView: viewId,
  paint: {
    "circle-color": "#e74c3c",
    "circle-radius": 8,
    "circle-opacity": 0.9,
  },
});
```

### view_geojson_delete

Remove a GeoJSON view entirely.

```javascript
await mapx.ask("view_geojson_delete", { idView: viewId });
```

---

## Filtering & Transparency

### set_view_layer_filter_numeric

Filter a vector tile view by numeric attribute range. Only works on `vt` views.

Both `{ idView, from, to }` and `{ idView, value: [min, max] }` syntax are supported. When `value` is provided, the SDK internally derives `from = Math.min(...value)` and `to = Math.max(...value)`.

```javascript
// Form 1: Explicit from/to
await mapx.ask("set_view_layer_filter_numeric", {
  idView: "MX-XXXXX",
  attribute: "population",
  from: 1000000,
  to: 50000000,
});

// Form 2: Array value range [min, max]
await mapx.ask("set_view_layer_filter_numeric", {
  idView: "MX-XXXXX",
  attribute: "population",
  value: [1000000, 50000000],
});

// Clear the filter:
await mapx.ask("set_view_layer_filter_numeric", {
  idView: "MX-XXXXX",
  attribute: "population",
  from: null,
  to: null,
});
```

### set_view_layer_filter_text

Filter a vector tile view by text/category values.

```javascript
// Single value
await mapx.ask("set_view_layer_filter_text", {
  idView: "MX-XXXXX",
  value: "High stress",
});

// Multiple values
await mapx.ask("set_view_layer_filter_text", {
  idView: "MX-XXXXX",
  value: ["Significant increase", "Moderate increase"],
});

// Clear: pass empty string or empty array
await mapx.ask("set_view_layer_filter_text", {
  idView: "MX-XXXXX",
  value: "",
});
```

### set_view_layer_transparency

Set a layer's transparency (0 = opaque, 100 = invisible).

```javascript
await mapx.ask("set_view_layer_transparency", {
  idView: "MX-XXXXX",
  value: 50,
});
```

### get_view_layer_transparency

Returns the current transparency value (0-100).

```javascript
const t = await mapx.ask("get_view_layer_transparency", {
  idView: "MX-XXXXX",
});
// => 50
```

---

## Data Introspection & Export

### get_view_table_attribute_config

Returns the view's data schema. Only works on `vt` views.

```javascript
const config = await mapx.ask("get_view_table_attribute_config", {
  idView: "MX-XXXXX",
});
// => { attributes: ["col1", "col2"], idSource: "...", labels: {...} }
```

### get_view_table_attribute

Returns actual row data for the view's attribute table.

```javascript
const rows = await mapx.ask("get_view_table_attribute", {
  idView: "MX-XXXXX",
});
// => [{col1: "value", col2: 42}, ...]
```

### get_view_source_summary

Returns statistical summary for a view's attribute.

```javascript
const summary = await mapx.ask("get_view_source_summary", {
  idView: "MX-XXXXX",
  idAttr: "population",
  stats: ["base", "attributes"],
});
// => { count, min, max, mean, ... }
```

**Important**: Call `map_wait_idle()` first to avoid stale/empty results.

### download_view_source_geojson

Returns GeoJSON for a view. Intended for GeoJSON views created via
`view_geojson_create`. For native vector/raster views, the SDK also
provides `download_view_source_vector` and `download_view_source_external`
(not yet documented in this skill).

```javascript
const geojson = await mapx.ask("download_view_source_geojson", {
  idView: viewId,
  mode: "data",  // "data" (raw) or "view" (with current filters)
});
```

---

## UI Controls

### set_language / get_language / get_languages

```javascript
await mapx.ask("set_language", { lang: "fr" }); // ISO 639-1 code
const lang = await mapx.ask("get_language");     // => "fr"
const langs = await mapx.ask("get_languages");
// => ["en", "fr", "es", "ru", "zh", "ar", "de", "pt", "fa", "ps"]
```

### set_theme / get_themes_id / get_theme_id

```javascript
const themes = await mapx.ask("get_themes_id");    // => ["color_default", "color_dark", ...]
const current = await mapx.ask("get_theme_id");     // => "color_default"
await mapx.ask("set_theme", { idTheme: "color_dark" });
```

### has_dashboard / set_dashboard_visibility

```javascript
const hasDash = await mapx.ask("has_dashboard");
if (hasDash) {
  await mapx.ask("set_dashboard_visibility", { show: true });
}
// Also supports: { toggle: true }
```

### set_vector_spotlight (Preferred) / set_vector_highlight (Deprecated)

Enable or disable the visual spotlight ring when clicking vector features. `set_vector_spotlight` is the active upstream method; `set_vector_highlight` is retained as a deprecated alias that logs a warning in the console.

```javascript
await mapx.ask("set_vector_spotlight", { enable: true });
// Optional parameters: nLayers (number), calcArea (boolean)
```

### set_highlighter / update_highlighter / reset_highlighter

Apply dynamic highlighting to vector features matching MapLibre GL filter expressions or at specific coordinates.

```javascript
// Highlight features matching criteria:
await mapx.ask("set_highlighter", {
  filters: [
    {
      id: "MX-XXXXX-XXXXX-XXXXX",
      filter: [">=", ["get", "population"], 500000],
    },
  ],
});

// Update or reset:
await mapx.ask("update_highlighter");
await mapx.ask("reset_highlighter");
```

### set_country_highlight

Highlights specified countries on the basemap by graying out all other countries.

> [!NOTE]
> Unlike most resolvers that accept an options object, `set_country_highlight` expects the array of ISO 3166-1 alpha-3 country code strings passed directly as its argument.

```javascript
// Accepts ISO 3166-1 alpha-3 country codes directly as an Array<string>:
await mapx.ask("set_country_highlight", ["KEN", "UGA", "TZA"]);
```

### set_features_click_sdk_only

Redirect `click_attributes` events exclusively to the SDK listener, suppressing
MapX's own native feature popup. Use this when building a custom inspection panel.

```javascript
// Suppress MapX's feature panel so only your listener receives click_attributes
mapx.ask("set_features_click_sdk_only", { enable: true }).catch(() => {});

// Restore default MapX behavior on deactivation
mapx.ask("set_features_click_sdk_only", { enable: false }).catch(() => {});
```

**Important:** Fire-and-forget — do **not** `await` this call. The SDK `ask()` can
sometimes hang if the internal resolver throws (see §9 in
[limitations-and-workarounds.md](limitations-and-workarounds.md)). The UI should
not depend on the response. Appending `.catch(() => {})` prevents unhandled rejection
warnings.

Note: Initialising MapX with `closePanels: true` typically already suppresses the
native feature panel. Calling this method in inspection mode is belt-and-suspenders.

### set_panel_left_visibility

Show or hide the MapX left panel (view list sidebar).

```javascript
await mapx.ask("set_panel_left_visibility", { show: true });
await mapx.ask("set_panel_left_visibility", { show: false });
```

### Panels API (MapxResolversPanels)

Upstream MapX provides a full panel management suite via `MapxResolversPanels`:

```javascript
// Batch update panel visibility and drawer states
await mapx.ask("panels_batch", {
  controls_panel: { show: true, open: true },
});

// Query panel state and list
const state = await mapx.ask("panels_state");
const panelList = await mapx.ask("panels_list"); // => ['controls_panel', ...]

// Global bulk actions
await mapx.ask("panels_close_all");
await mapx.ask("panels_open_all");
await mapx.ask("panels_hide_all");
await mapx.ask("panels_show_all");

// Status checks
const isOpen = await mapx.ask("panels_is_open", { id: "controls_panel" });
const isVisible = await mapx.ask("panels_is_visible", { id: "controls_panel" });
```

### show_modal_map_composer

Open the MapX map export tool modal (layout, legend, scale bar, etc.).
MapX provides the entire UI.

```javascript
await mapx.ask("show_modal_map_composer");
```

### show_modal_share

Open the MapX sharing modal (link, embed code, social).

```javascript
await mapx.ask("show_modal_share");
// Optionally pre-select views to share:
await mapx.ask("show_modal_share", { idView: "MX-XXXXX" });
```

### close_modal_all

Close all open MapX modals.

```javascript
await mapx.ask("close_modal_all");
```

---

## MapLibre GL JS Passthrough

The `"map"` resolver exposes the underlying MapLibre GL JS `Map` instance (MapX uses MapLibre GL JS, retaining drop-in API compatibility with Mapbox GL JS v1). You can call any MapLibre map method through it.

```javascript
// Generic pattern
await mapx.ask("map", {
  method: "methodName",
  parameters: [arg1, arg2],  // positional args
});
```

### Common passthrough calls

```javascript
// Set projection
await mapx.ask("map", { method: "setProjection", parameters: ["globe"] });
const proj = await mapx.ask("map", { method: "getProjection" });

// Get center/zoom
const center = await mapx.ask("map", { method: "getCenter" });
const zoom = await mapx.ask("map", { method: "getZoom" });

// Add custom source + layer
await mapx.ask("map", {
  method: "addSource",
  parameters: ["my-source", { type: "geojson", data: featureCollection }],
});

await mapx.ask("map", {
  method: "addLayer",
  parameters: [{
    id: "my-layer",
    type: "circle",
    source: "my-source",
    paint: { "circle-radius": 6, "circle-color": "#e74c3c" },
  }],
});

// Remove
await mapx.ask("map", { method: "removeLayer", parameters: ["my-layer"] });
await mapx.ask("map", { method: "removeSource", parameters: ["my-source"] });

// Spatial query
const features = await mapx.ask("map", {
  method: "queryRenderedFeatures",
  parameters: [[[x1, y1], [x2, y2]]],  // pixel bbox
});

// Unproject pixel to geo
const lngLat = await mapx.ask("map", {
  method: "unproject",
  parameters: [{ x: 400, y: 300 }],
});
```

**Limitation**: You cannot pass callbacks through `addLayer` event handlers
or `map.on()`. The postMessage bridge only accepts serializable data.
For click interaction on passthrough layers, use coordinate matching
(see [limitations-and-workarounds.md](limitations-and-workarounds.md)).

---

## Events Catalog

MapX routes internal lifecycle and application events across the postMessage bridge. Listen with `mapx.on(eventName, callback)`:

```javascript
// --- 1. Ready & Connection ---
mapx.on("ready", () => {
  // SDK connected and FrameWorker initialized. Safe to make ask() calls.
});

mapx.on("mapx_connected", () => {
  // Shiny websocket connection established (App mode).
});

mapx.on("mapx_disconnected", () => {
  // Shiny websocket connection dropped.
});

// --- 2. View Lifecycle & safeViewAdd ---
mapx.on("view_added", ({ idView, time }) => {
  // Fires when a view layer finishes loading and renders on the map.
  // Use this to reliably confirm view_add succeeded!
  console.log(`View ${idView} active on map`);
});

mapx.on("view_removed", ({ idView }) => {
  // Fires when a view layer is closed/removed.
  console.log(`View ${idView} removed`);
});

mapx.on("views_list_updated", () => {
  // Fires when the view catalog finishes loading or updating.
});

mapx.on("layers_ordered", () => {
  // Fires when layer display stacking order changes.
});

// --- 3. Filtering & Legends ---
mapx.on("view_filtered", (data) => {
  // Fires when a layer filter is updated.
});

mapx.on("view_legend_updated", () => {
  // Fires when view legend graphic/rules update.
});

// --- 4. Feature Inspection ---
// Fires ONCE PER OPEN VT VIEW per map click.
// Use a Map to aggregate feature attributes across all open views:
const clickBatch = new Map();

mapx.on("click_attributes", ({ part, nPart, idView, attributes, lngLat, point }) => {
  // Payload:
  //   part:       number,       // 1-indexed position in batch
  //   nPart:      number,       // total open VT views expected
  //   idView:     string,       // view ID
  //   attributes: [],           // feature attributes at click point
  //   point:      { x, y },     // pixel coordinates
  //   lngLat:     { lng, lat }  // geographic coordinates
  if (attributes && attributes.length > 0) {
    clickBatch.set(idView, attributes);
  }
  if (part === nPart) {
    // All view parts for this click have arrived
    console.log("All click attributes collected:", clickBatch, lngLat);
    clickBatch.clear();
  }
});

// --- 5. Application State ---
mapx.on("language_change", ({ new_language }) => {
  // Fires when the UI language changes (payload: { new_language: string }).
  console.log("Language updated:", new_language);
});

mapx.on("project_changed", ({ new_project, old_project }) => {
  // Fires when set_project completes successfully.
});

mapx.on("spotlight_update", (data) => {
  // Fires when vector spotlight feature changes.
});

mapx.on("story_step", (data) => {
  // Fires when a story map advances to a new step.
});
```

The SDK does not expose native MapLibre map events (`moveend`, `zoomend`, etc.)
to the parent page. For camera-tracking, use polling via
`map({method: "getCenter"})` and `map({method: "getZoom"})`.
