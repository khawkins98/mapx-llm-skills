# Filtering and Data

## Numeric Range Filters

Only works on `vt` (vector tile) views. Raster and custom-coded views
don't have queryable attribute tables.

> **Mode matters.** In app mode (the default) the filter resolvers drive the
> view's own filter widgets and read only `value`. In static mode they build
> the filter directly from `from`/`to` (numeric) or `values` + `attribute`
> (text). The examples below send both forms so they work in either mode.
> See [sdk-methods.md](sdk-methods.md#set_view_layer_filter_numeric) for the
> full table.

### Workflow: Discover attributes → Get range → Apply filter

```javascript
// Step 1: Discover what attributes exist
const config = await mapx.ask("get_view_table_attribute_config", {
  idView: "MX-XXXXX",
});
// => { attributes: ["population", "area_km2", "risk_score"], ... }

// Step 2: Get min/max for an attribute
const summary = await mapx.ask("get_view_source_summary", {
  idView: "MX-XXXXX",
  idAttr: "population",
});
const { min, max } = summary.attribute_stat;

// Step 3: Apply filter (portable form)
const range = [1000000, 50000000];
await mapx.ask("set_view_layer_filter_numeric", {
  idView: "MX-XXXXX",
  value: range,          // app mode
  from: range[0],        // static mode
  to: range[1],
  attribute: "population", // static mode only
});

// Step 4: "Clear" = reset to the full range (null is not a clear)
await mapx.ask("set_view_layer_filter_numeric", {
  idView: "MX-XXXXX",
  value: [min, max],
  from: min,
  to: max,
  attribute: "population",
});
```

**App-mode limitation**: the app-mode slider always filters the view's
**styled** attribute (`view.data.attribute.name`). `attribute` is ignored,
so filtering a *different* numeric column only works in static mode. In app
mode, use `set_highlighter` with a MapLibre expression to emphasise features
by another attribute instead.

## Text/Category Filters

Filter vector tile views by categorical text values.

### Workflow: Get categories → Filter

```javascript
// Step 1: Get all row data to discover categories
const data = await mapx.ask("get_view_table_attribute", {
  idView: "MX-XXXXX",
});
// => [{category: "High", ...}, {category: "Low", ...}, ...]

// Extract unique categories
const categories = [...new Set(data.map(row => row.category))];

// Step 2: Filter to specific categories (portable form)
const selected = ["Significant increase", "Moderate increase"];
await mapx.ask("set_view_layer_filter_text", {
  idView: "MX-XXXXX",
  value: selected,        // app mode
  values: selected,       // static mode
  attribute: "category",  // static mode: must be explicit (upstream bug otherwise)
});

// Clear filter
await mapx.ask("set_view_layer_filter_text", {
  idView: "MX-XXXXX",
  value: [],
  values: [],
  attribute: "category",
});
```

Alternatively, filter through the legend with `get_view_legend_values` /
`set_view_legend_state` (see [sdk-methods.md](sdk-methods.md)).

## Transparency

Essential for multi-layer stacking (overlaying hazard maps on top of each
other). **The scale depends on the mode:**

- **App mode**: `value` drives the view's transparency slider:
  0 = fully opaque, 100 = fully invisible.
- **Static mode**: the resolver writes the number straight into the
  layers' MapLibre `*-opacity` paint properties, so it is an **opacity
  from 0 to 1** (1 = opaque). It reads `opacity` if present, otherwise
  `value`. Sending `value: 50` in static mode is not "50% transparent".

```javascript
// Portable: 40% transparent in either mode
const transparency = 40; // 0..100
await mapx.ask("set_view_layer_transparency", {
  idView: "MX-XXXXX",
  value: transparency,             // app mode (0..100 transparency)
  opacity: 1 - transparency / 100, // static mode (0..1 opacity)
});

// Read current (returns the stored value; in static mode that's the 0..1 opacity)
const t = await mapx.ask("get_view_layer_transparency", {
  idView: "MX-XXXXX",
});
```

## Data Introspection

### Attribute schema

```javascript
const config = await mapx.ask("get_view_table_attribute_config", {
  idView: "MX-XXXXX",
});
// => {
//   attributes: ["col1", "col2", "col3"],
//   idSource: "mx_source_id",
//   labels: { col1: "Column One", ... }
// }
```

### Row data

```javascript
const rows = await mapx.ask("get_view_table_attribute", {
  idView: "MX-XXXXX",
});
// => [{col1: "value", col2: 42}, ...]
```

### Statistical summary

```javascript
// Source statistics are computed server-side from the view's source, so
// they don't depend on what is rendered.
const summary = await mapx.ask("get_view_source_summary", {
  idView: "MX-XXXXX",
  idAttr: "population",       // optional: specific attribute
  stats: ["base", "attributes"],
});
// Base: { count, min, max, mean }
// Attributes: category distributions, histograms
```

## Data Export

`download_view_source_geojson` is intended for GeoJSON views created via
`view_geojson_create`. For native views, the SDK provides
`download_view_source_vector` and `download_view_source_external`
(not yet documented in this skill).

```javascript
const geojson = await mapx.ask("download_view_source_geojson", {
  idView: viewId,
  mode: "data",    // "data" = raw, "view" = with current filters
});

// Create a file download
const blob = new Blob([JSON.stringify(geojson, null, 2)], {
  type: "application/geo+json",
});
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "export.geojson";
a.click();
URL.revokeObjectURL(url);
```

## Spatial Queries

Use the MapLibre GL passthrough to query rendered features:

```javascript
// Query everything in the viewport
const features = await mapx.ask("map", {
  method: "queryRenderedFeatures",
});

// Query a bounding box (pixel coordinates)
const features = await mapx.ask("map", {
  method: "queryRenderedFeatures",
  parameters: [[[x1, y1], [x2, y2]]],
});
```

**Notes**:
- Returns features from ALL rendered layers, not just the selected view
- Only returns vector features — raster layers produce no results
- Results are serialized through postMessage, so very large result sets
  may be slow or truncated
- Results include MapLibre-internal fields (`layer`, `source`, `sourceLayer`,
  `state`) that are not part of standard GeoJSON. Strip them before exporting:
  ```javascript
  function cleanFeatures(features) {
    return features.map(({ layer, source, sourceLayer, state, ...rest }) => rest);
  }
  // Note: returns an array of cleaned feature objects, not a FeatureCollection.
  // Wrap if needed: { type: "FeatureCollection", features: cleanFeatures(raw) }
  ```
- Use the MapLibre GL `filter` option to narrow results:
  ```javascript
  parameters: [geometry, { layers: ["my-layer-id"] }]
  ```

### Pixel to geographic coordinates

```javascript
const lngLat = await mapx.ask("map", {
  method: "unproject",
  parameters: [{ x: pixelX, y: pixelY }],
});
// => {lng: -72.5, lat: 18.3}
```

## View Type Capabilities Matrix

| Capability | `vt` | `rt` | `cc` | GeoJSON |
|-----------|------|------|------|---------|
| Numeric filter | Yes | No | No | Client-side* |
| Text filter | Yes | No | No | No |
| Transparency | Yes | Yes | Yes | Yes |
| Attribute config | Yes | No | No | No |
| Row data | Yes | No | No | Local only |
| Source summary | Yes | No | No | Local only |
| GeoJSON export | No | No | No | Yes |
| Spatial query | Yes | No | No | Yes |
| Legend image | Yes | Yes | Varies | No |
| Dashboard | Sometimes | No | Sometimes | No |

*\* GeoJSON views don't support `set_view_layer_filter_numeric`. As a
client-side alternative, use `view_geojson_set_style` to dim non-matching
features via a MapLibre paint expression (e.g. `"circle-opacity": 0.08`)
while keeping matching features at full opacity. Store the original paint
so you can restore it on "clear".*
