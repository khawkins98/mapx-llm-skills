# Navigation and Display

## Camera Control

### Fly to coordinates

```javascript
await mapx.ask("map_fly_to", {
  center: { lng: -72, lat: 18 },
  zoom: 5.5,
  duration: 2000,
});
```

### Fly to a country (ISO 3166-1 alpha-3)

```javascript
await mapx.ask("common_loc_fit_bbox", {
  code: "NPL",                    // Nepal
  param: { duration: 2000 },
});
```

### Fly to an M49 region

```javascript
await mapx.ask("common_loc_fit_bbox", {
  code: "m49_029",                 // Caribbean
  param: { duration: 2000 },
});
```

### Get available location codes

```javascript
const codes = await mapx.ask("common_loc_get_list_codes");
// Mix of ISO country codes and M49 region codes
```

### Read current state

```javascript
const zoom = await mapx.ask("map_get_zoom");
const center = await mapx.ask("map", { method: "getCenter" });
// center => {lng: -72.00, lat: 18.00}
```

## Projections

Toggle between Mercator (default) and Globe projections via the MapLibre
GL JS v5 passthrough. MapLibre takes a **projection object**
(`{ type: "globe" }`), not the string form Mapbox GL v2 used. MapX itself
calls `map.setProjection({ type: projName })` (`map_helpers/index.js`).

```javascript
// Set globe
await mapx.ask("map", { method: "setProjection", parameters: [{ type: "globe" }] });

// Read current
const proj = await mapx.ask("map", { method: "getProjection" });
// => { type: "globe" } or { type: "mercator" }; undefined on a fresh map (= mercator)

// Toggle
const current = await mapx.ask("map", { method: "getProjection" });
const next = current?.type === "globe" ? "mercator" : "globe";
await mapx.ask("map", { method: "setProjection", parameters: [{ type: next }] });
```

> **Pre-1.14 note**: up to MapX 1.13.x (Mapbox GL JS v2) the string form
> `setProjection("globe")` and `getProjection().name` were correct. On 1.14
> the string form is **silently ignored**: no error, and the map stays
> mercator (runtime-verified 2026-09-28). Code written against earlier
> versions needs updating.

## 3D Modes

Three independent 3D controls, each with show/hide/toggle actions:

```javascript
// Terrain: elevation exaggeration on the basemap
await mapx.ask("set_3d_terrain", { action: "toggle" });

// 3D tilt: pitch + bearing for perspective view
await mapx.ask("set_mode_3d", { action: "toggle" });

// Combine both for full 3D effect
await mapx.ask("set_3d_terrain", { action: "show" });
await mapx.ask("set_mode_3d", { action: "show" });
```

## Aerial/Satellite Imagery

```javascript
await mapx.ask("set_mode_aerial", { action: "toggle" });
```

## Immersive Mode

Hides all MapX UI panels for a clean, full-map view. Good for screenshots,
presentations, or embedding without the MapX chrome.

```javascript
await mapx.ask("set_immersive_mode", { toggle: true });
// Or: { enable: true } / { enable: false }
```

## Waiting for the Map

`map_wait_idle()` resolves once the camera stops moving. If the map is not
moving it resolves **immediately**, and it never waits for tiles or views
to load. Call it between a camera move and anything that depends on the
final viewport:
- Dashboard operations
- `queryRenderedFeatures` / other rendered-data queries
- Filters applied right after a fly-to

To wait for a view to finish loading, use the `view_added` event instead.

```javascript
await mapx.ask("map_fly_to", { center: { lng: 85, lat: 28 }, zoom: 6 });
await mapx.ask("map_wait_idle");
// Camera settled: safe to query rendered features or filter
const features = await mapx.ask("map", { method: "queryRenderedFeatures" });
```

## Common Navigation Patterns

### Scenario: Multi-layer + fly + transparency

```javascript
// Clear map
for (const id of openViews) {
  await mapx.ask("view_remove", { idView: id });
}

// Add layers
await mapx.ask("view_add", { idView: floodViewId });
await mapx.ask("view_add", { idView: landslideViewId });

// Fly to area of interest
await mapx.ask("common_loc_fit_bbox", { code: "NPL", param: { duration: 2000 } });

// Blend layers with transparency (value = app mode 0..100, opacity = static mode 0..1)
await mapx.ask("set_view_layer_transparency", { idView: floodViewId, value: 40, opacity: 0.6 });
await mapx.ask("set_view_layer_transparency", { idView: landslideViewId, value: 50, opacity: 0.5 });
```

### Scenario: View + dashboard

```javascript
await mapx.ask("view_add", { idView: firesViewId });
await mapx.ask("common_loc_fit_bbox", { code: "IND" });
await mapx.ask("map_wait_idle");

const hasDash = await mapx.ask("has_dashboard");
if (hasDash) {
  await mapx.ask("set_dashboard_visibility", { show: true });
}
```
