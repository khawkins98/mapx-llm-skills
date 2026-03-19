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

Toggle between Mercator (default) and Globe projections via the Mapbox
GL JS passthrough:

```javascript
// Set globe
await mapx.ask("map", { method: "setProjection", parameters: ["globe"] });

// Read current
const proj = await mapx.ask("map", { method: "getProjection" });
// => {name: "globe", ...} or {name: "mercator", ...}

// Toggle
const current = await mapx.ask("map", { method: "getProjection" });
const next = current?.name === "globe" ? "mercator" : "globe";
await mapx.ask("map", { method: "setProjection", parameters: [next] });
```

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

`map_wait_idle()` is essential before operations that depend on rendered
data. Always call it between navigation and:
- Dashboard operations
- Filter operations
- Data queries / statistics
- Attribute introspection

```javascript
await mapx.ask("map_fly_to", { center: { lng: 85, lat: 28 }, zoom: 6 });
await mapx.ask("map_wait_idle");
// NOW safe to query or filter
const summary = await mapx.ask("get_view_source_summary", { ... });
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

// Blend layers with transparency
await mapx.ask("set_view_layer_transparency", { idView: floodViewId, value: 40 });
await mapx.ask("set_view_layer_transparency", { idView: landslideViewId, value: 50 });
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
