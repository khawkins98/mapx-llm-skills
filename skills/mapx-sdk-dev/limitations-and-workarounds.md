# Limitations and Workarounds

## 1. Cross-Project View Scope

**Problem**: `view_add` only works for views in the currently loaded project.
If you pass a view ID from a different project, the call returns without
error but does nothing — no network requests, no thrown error, no visual
change.

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

## 4. toggle_draw_mode Does Not Exist

**Problem**: Some SDK docs and wiki examples reference `toggle_draw_mode`
for drawing shapes on the map. This method does not exist in the current
SDK — calling it throws "unknown resolver."

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

## 9. Statistics on Custom GeoJSON Views

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
