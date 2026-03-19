# Views and Layers

## MapX View Types

MapX organizes geospatial data into "views" — each view is a named,
styled layer with metadata, access control, and optional dashboards.

| Code | Name | Description | Data Format |
|------|------|-------------|-------------|
| `vt` | Vector Tiles | Polygons, lines, points | Tiled vector data served as PBF |
| `rt` | Raster Tiles | Gridded/continuous data | Tiled images (PNG/WebP) |
| `cc` | Custom Coded | Dynamic/real-time views | JavaScript + API feeds |
| `sm` | Story Map | Narrative presentations | Step-by-step map navigation |

## View Lifecycle

```
view_add(idView)          → View appears on map
  ↕ (user interacts)
view_remove(idView)       → View disappears from map
```

Track which views are open in a local `Set` — the SDK doesn't provide a
cheap synchronous check for "is this view displayed?":

```javascript
const openViews = new Set();

async function toggleView(idView) {
  if (openViews.has(idView)) {
    await mapx.ask("view_remove", { idView });
    openViews.delete(idView);
  } else {
    await mapx.ask("view_add", { idView });
    openViews.add(idView);
  }
}
```

## GeoJSON Views (SDK-Managed Custom Data)

The preferred approach for adding your own data to MapX. The view
integrates with MapX's layer system:

- Appears in the view list panel
- Native click interaction via `click_attributes` event
- Style control through the SDK
- Respects layer ordering

```javascript
// Create
const result = await mapx.ask("view_geojson_create", {
  data: featureCollection,
  title: { en: "DRR Field Offices" },
  abstract: "Fictional field office locations",
});
const viewId = result.id;

// Style (Mapbox GL paint properties)
await mapx.ask("view_geojson_set_style", {
  idView: viewId,
  paint: {
    "circle-color": "#e74c3c",
    "circle-radius": 8,
    "circle-opacity": 0.9,
  },
});

// Remove
await mapx.ask("view_geojson_delete", { idView: viewId });
```

## Mapbox GL JS Passthrough (Parent-Controlled)

For advanced styling or non-interactive overlays, use the `"map"` resolver
to call Mapbox GL JS methods directly.

```javascript
// Add source
await mapx.ask("map", {
  method: "addSource",
  parameters: ["stations", { type: "geojson", data: featureCollection }],
});

// Add circle layer
await mapx.ask("map", {
  method: "addLayer",
  parameters: [{
    id: "stations-circles",
    type: "circle",
    source: "stations",
    paint: {
      "circle-radius": 6,
      "circle-color": "#2ecc71",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff",
    },
  }],
});

// Add text labels
await mapx.ask("map", {
  method: "addLayer",
  parameters: [{
    id: "stations-labels",
    type: "symbol",
    source: "stations",
    layout: {
      "text-field": ["get", "name"],
      "text-offset": [0, 1.5],
      "text-size": 11,
    },
    paint: { "text-color": "#333" },
  }],
});
```

### Cleanup

Layers must be removed before sources. Use try/catch because removal of
non-existent layers throws.

```javascript
try {
  await mapx.ask("map", { method: "removeLayer", parameters: ["stations-labels"] });
  await mapx.ask("map", { method: "removeLayer", parameters: ["stations-circles"] });
  await mapx.ask("map", { method: "removeSource", parameters: ["stations"] });
} catch (e) {
  // Layer/source may already be removed
}
```

## Choosing Between GeoJSON Views and Passthrough

| Aspect | GeoJSON View | Mapbox Passthrough |
|--------|-------------|-------------------|
| Click interaction | Native `click_attributes` | Requires coordinate matching fallback |
| Styling | Limited (SDK paint props) | Full Mapbox GL expressions |
| View list integration | Yes | No — invisible to MapX |
| Layer ordering | Managed by MapX | You control z-order |
| Data-driven styling | No | Yes (expressions, interpolation) |
| Polygon support | Basic | Full (fill, line, extrusion) |
| Removal | Single `view_geojson_delete` | Must remove layers + source |
| Complexity | Low | Higher |

**Rule of thumb**: Use GeoJSON views when you need click interaction and
simple styling. Use passthrough when you need advanced Mapbox GL styling
or purely visual overlays.

## Polygon Overlays via Passthrough

```javascript
// Fill layer
await mapx.ask("map", {
  method: "addLayer",
  parameters: [{
    id: "zones-fill",
    type: "fill",
    source: "zones",
    paint: {
      "fill-color": "#3498db",
      "fill-opacity": 0.25,
    },
  }],
});

// Outline layer
await mapx.ask("map", {
  method: "addLayer",
  parameters: [{
    id: "zones-outline",
    type: "line",
    source: "zones",
    paint: {
      "line-color": "#2980b9",
      "line-width": 2,
    },
  }],
});
```

## Click Interaction on Passthrough Layers

The `click_attributes` event does NOT fire for passthrough layers. To
provide click interaction, use a coordinate matching fallback:

1. Store GeoJSON data locally when adding to the map
2. Listen for `click_attributes` — it includes click coordinates
3. Match the click coordinate against local data:
   - Points: nearest-neighbor with Euclidean distance + tolerance
   - Polygons: ray-casting point-in-polygon test
4. Display the matched feature's properties in your own UI

See [limitations-and-workarounds.md](limitations-and-workarounds.md) for
the full coordinate matching implementation.
