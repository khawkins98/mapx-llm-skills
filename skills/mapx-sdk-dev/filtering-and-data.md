# Filtering and Data

## Numeric Range Filters

Only works on `vt` (vector tile) views. Raster and custom-coded views
don't have queryable attribute tables.

### Workflow: Discover attributes → Get range → Apply filter

```javascript
// Step 1: Discover what attributes exist
const config = await mapx.ask("get_view_table_attribute_config", {
  idView: "MX-XXXXX",
});
// => { attributes: ["population", "area_km2", "risk_score"], ... }

// Step 2: Get min/max range for an attribute
await mapx.ask("map_wait_idle");
const summary = await mapx.ask("get_view_source_summary", {
  idView: "MX-XXXXX",
  idAttr: "population",
  stats: ["base"],
});
// => { count: 245, min: 1200, max: 48000000 }

// Step 3: Apply filter
await mapx.ask("set_view_layer_filter_numeric", {
  idView: "MX-XXXXX",
  attribute: "population",
  from: 1000000,
  to: 50000000,
});

// Step 4: Clear filter
await mapx.ask("set_view_layer_filter_numeric", {
  idView: "MX-XXXXX",
  attribute: "population",
  from: null,
  to: null,
});
```

**Important**: Use `from`/`to` params, not the deprecated `value` array.

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

// Step 2: Filter to specific categories
await mapx.ask("set_view_layer_filter_text", {
  idView: "MX-XXXXX",
  value: ["Significant increase", "Moderate increase"],
});

// Clear filter
await mapx.ask("set_view_layer_filter_text", {
  idView: "MX-XXXXX",
  value: "",
});
```

## Transparency

0 = fully opaque, 100 = fully invisible. Essential for multi-layer
stacking (overlaying hazard maps on top of each other).

```javascript
// Set
await mapx.ask("set_view_layer_transparency", {
  idView: "MX-XXXXX",
  value: 50,
});

// Read current
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
await mapx.ask("map_wait_idle"); // REQUIRED first

const summary = await mapx.ask("get_view_source_summary", {
  idView: "MX-XXXXX",
  idAttr: "population",       // optional: specific attribute
  stats: ["base", "attributes"],
});
// Base: { count, min, max, mean }
// Attributes: category distributions, histograms
```

## Data Export

Only works for GeoJSON views created via `view_geojson_create`.
Native MapX vector/raster views cannot be bulk-exported — they are
served as tiled data.

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

Use the Mapbox GL passthrough to query rendered features:

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
- Use the Mapbox GL `filter` option to narrow results:
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
| Numeric filter | Yes | No | No | No |
| Text filter | Yes | No | No | No |
| Transparency | Yes | Yes | Yes | Yes |
| Attribute config | Yes | No | No | No |
| Row data | Yes | No | No | Local only |
| Source summary | Yes | No | No | Local only |
| GeoJSON export | No | No | No | Yes |
| Spatial query | Yes | No | No | Yes |
| Legend image | Yes | Yes | Varies | No |
| Dashboard | Sometimes | No | Sometimes | No |
