# MapX SDK Method Catalog

Complete reference for all `mapx.ask()` resolver methods. Every method
returns a Promise. Parameters are passed as a single object.

## Map Navigation & Display

### map_fly_to

Animate the map camera. Accepts any Mapbox GL `AnimationOptions`.

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

### map_get_zoom

Returns the current zoom level as a number.

```javascript
const zoom = await mapx.ask("map_get_zoom");
// => 5.5
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
await mapx.ask("set_immersive_mode", { action: "toggle" });
// Actions: "show", "hide", "toggle"
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

Returns the full catalog of views in the current project.

```javascript
const views = await mapx.ask("get_views");
// => [{id, type, data: {title: {en: "..."}, ...}}, ...]
```

### get_views_id_open

Returns IDs of currently displayed views (async).

```javascript
const ids = await mapx.ask("get_views_id_open");
// => ["MX-XXXXX", "MX-YYYYY"]
```

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

Style a GeoJSON view using Mapbox GL paint/layout properties.

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

```javascript
await mapx.ask("set_view_layer_filter_numeric", {
  idView: "MX-XXXXX",
  attribute: "population",
  from: 1000000,
  to: 50000000,
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

Returns GeoJSON for a view. Only works for GeoJSON views created via
`view_geojson_create`, not native MapX vector/raster views.

```javascript
const geojson = await mapx.ask("download_view_source_geojson", {
  idView: viewId,
  mode: "data",  // "data" (raw) or "view" (with current filters)
});
```

---

## UI Controls

### set_language / get_language

```javascript
await mapx.ask("set_language", { lang: "fr" }); // ISO 639-1 code
const lang = await mapx.ask("get_language");     // => "fr"
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

### set_vector_highlight

Enable/disable the click highlight ring on vector features.

```javascript
await mapx.ask("set_vector_highlight", { enable: true });
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
```

### close_modal_all

Close all open MapX modals.

```javascript
await mapx.ask("close_modal_all");
```

---

## Mapbox GL JS Passthrough

The `"map"` resolver exposes the underlying Mapbox GL JS `Map` instance.
You can call any Mapbox method through it.

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

## Events

The SDK emits events that the parent page can listen to:

```javascript
mapx.on("ready", () => {
  // SDK connected, safe to call ask()
});

mapx.on("click_attributes", (data) => {
  // User clicked a feature
  // data.attributes: array of feature property objects
  // Only fires for MapX-managed views, NOT passthrough layers
});
```

**Known events**: `ready`, `click_attributes`

The SDK does not expose native Mapbox map events (`moveend`, `zoomend`, etc.)
to the parent page. For camera-tracking, use polling via
`map({method: "getCenter"})` and `map({method: "getZoom"})`.
