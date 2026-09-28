# MapX Embed Scaffold Templates

## package.json

```json
{
  "name": "mapx-embed",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3001",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

## vite.config.js

```javascript
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3001,
    open: true,
  },
});
```

## index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MapX Embed</title>
    <!-- Optional: UNDRR Mangrove component library for consistent UI -->
    <!-- <link rel="stylesheet" href="https://assets.undrr.org/static/mangrove/1.3.3/css/style.css" /> -->
  </head>
  <body>
    <div class="app-body">
      <aside class="app-sidebar">
        <h2>Views</h2>
        <div id="view-buttons">Loading...</div>
      </aside>
      <div class="app-map">
        <div id="mapx"></div>
      </div>
    </div>

    <script src="https://app.mapx.org/sdk/mxsdk.umd.js"></script>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

## src/main.js

```javascript
import "./styles/app.css";
import { initSDK } from "./sdk/client.js";
import { buildViewButtons } from "./ui/view-buttons.js";
import * as store from "./state/store.js";

const mapx = initSDK(document.getElementById("mapx"));

// Event-driven state updates — automatically reflects active map layers
mapx.on("view_added", ({ idView }) => {
  store.openViews.add(idView);
  buildViewButtons();
});

mapx.on("view_removed", ({ idView }) => {
  store.openViews.delete(idView);
  buildViewButtons();
});

mapx.on("ready", async () => {
  console.log("MapX SDK ready");

  // Ensure map tiles and initial views finish loading
  await mapx.ask("map_wait_idle");

  // Enable feature spotlight click indicator
  await mapx.ask("set_vector_spotlight", { enable: true });

  buildViewButtons();
});
```

## src/sdk/client.js

```javascript
/**
 * SDK client — singleton Manager instance.
 * The UMD script tag loads the global `mxsdk` object.
 * (Alternatively: `import { Manager } from "https://app.mapx.org/sdk/mxsdk.modern.js";`)
 */
let _mapx = null;

export function initSDK(container) {
  _mapx = new mxsdk.Manager({
    container,
    url: "https://app.mapx.org/?project=PROJECT_ID_HERE",
    params: {
      closePanels: true,
      language: "en",
      theme: "color_light",
    },
    style: { width: "100%", height: "100%", border: "none" },
    maxSimultaneousRequest: 20,
  });
  return _mapx;
}

export function getSDK() {
  if (!_mapx) throw new Error("SDK not initialised");
  return _mapx;
}

/**
 * Defensive ask() wrapper with timeout to prevent hanging on resolver errors.
 */
export function askWithTimeout(method, data = {}, timeoutMs = 8000) {
  const sdk = getSDK();
  return Promise.race([
    sdk.ask(method, data),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`MapX ask("${method}") timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}
```

## src/sdk/views.js

```javascript
import { askWithTimeout } from "./client.js";

export function viewAdd(idView) {
  return askWithTimeout("view_add", { idView });
}

export function viewRemove(idView) {
  return askWithTimeout("view_remove", { idView });
}

export function getVisibleViews() {
  return askWithTimeout("get_views_with_visible_layer");
}
```

## src/sdk/map-control.js

```javascript
import { askWithTimeout } from "./client.js";

export function mapFlyTo(opts) {
  return askWithTimeout("map_fly_to", opts);
}

export function mapGetZoom() {
  return askWithTimeout("map_get_zoom");
}

export function mapWaitIdle() {
  return askWithTimeout("map_wait_idle");
}

export function commonLocFitBbox(code, param) {
  return askWithTimeout("common_loc_fit_bbox", { code, param });
}
```

## src/state/store.js

```javascript
/**
 * Track which views are currently displayed.
 * Synced automatically via mapx.on("view_added") and mapx.on("view_removed").
 */
export const openViews = new Set();
```

## src/config/views.js

```javascript
/**
 * Curated view IDs from your MapX project.
 * Discovered using get_views() or probe-views.html.
 *
 * Types: vt = vector tiles, rt = raster tiles,
 *        cc = custom coded, sm = story map
 */
export const CURATED_VIEWS = [
  // { id: "MX-XXXXX-XXXXX-XXXXX", label: "View Name", type: "vt" },
];
```

## src/ui/view-buttons.js

```javascript
import { CURATED_VIEWS } from "../config/views.js";
import * as store from "../state/store.js";
import { viewAdd, viewRemove } from "../sdk/views.js";

export function buildViewButtons() {
  const container = document.getElementById("view-buttons");
  if (!container) return;
  container.innerHTML = "";

  CURATED_VIEWS.forEach((v) => {
    const btn = document.createElement("button");
    btn.textContent = v.label;
    btn.title = v.id;
    if (store.openViews.has(v.id)) {
      btn.classList.add("is-active");
    }
    btn.addEventListener("click", () => toggleView(v.id));
    container.appendChild(btn);
  });
}

async function toggleView(idView) {
  try {
    if (store.openViews.has(idView)) {
      await viewRemove(idView);
    } else {
      await viewAdd(idView);
    }
  } catch (err) {
    console.error(`Failed to toggle view ${idView}:`, err);
  }
}
```

## src/styles/app.css

```css
html, body { margin: 0; }

.app-body {
  display: flex;
  height: 75vh;
  min-height: 500px;
}

.app-sidebar {
  width: 320px;
  min-width: 320px;
  background: #fff;
  border-right: 1px solid #ccc;
  padding: 1.5rem 1rem;
  overflow-y: auto;
}

.app-map {
  flex: 1;
  position: relative;
  min-width: 0;
}

#mapx {
  position: absolute;
  inset: 0;
}

#view-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

#view-buttons button {
  padding: 0.5rem;
  cursor: pointer;
  text-align: left;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 3px;
}

#view-buttons button.is-active {
  background: #004f91;
  color: #fff;
  border-color: #004f91;
}

@media (max-width: 768px) {
  .app-body { flex-direction: column; height: auto; }
  .app-sidebar { width: 100%; min-width: auto; max-height: 50vh; }
}
```
