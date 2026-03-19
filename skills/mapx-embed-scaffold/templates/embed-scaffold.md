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

const mapx = initSDK(document.getElementById("mapx"));

mapx.on("ready", async () => {
  console.log("MapX SDK ready");
  await mapx.ask("set_vector_highlight", { enable: true });
  buildViewButtons();
});
```

## src/sdk/client.js

```javascript
/**
 * SDK client — singleton Manager instance.
 * The UMD script tag loads the global `mxsdk` object.
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
  });
  return _mapx;
}

export function getSDK() {
  if (!_mapx) throw new Error("SDK not initialised");
  return _mapx;
}
```

## src/sdk/views.js

```javascript
import { getSDK } from "./client.js";

export function viewAdd(idView) {
  return getSDK().ask("view_add", { idView });
}

export function viewRemove(idView) {
  return getSDK().ask("view_remove", { idView });
}
```

## src/sdk/map-control.js

```javascript
import { getSDK } from "./client.js";

export function mapFlyTo(opts) {
  return getSDK().ask("map_fly_to", opts);
}

export function mapGetZoom() {
  return getSDK().ask("map_get_zoom");
}

export function mapWaitIdle() {
  return getSDK().ask("map_wait_idle");
}

export function commonLocFitBbox(code, param) {
  return getSDK().ask("common_loc_fit_bbox", { code, param });
}
```

## src/state/store.js

```javascript
/**
 * Track which views are currently displayed.
 * view_add/view_remove are fire-and-forget — there's no
 * synchronous "is this view open?" check in the SDK.
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
  container.innerHTML = "";

  CURATED_VIEWS.forEach((v) => {
    const btn = document.createElement("button");
    btn.textContent = v.label;
    btn.title = v.id;
    btn.addEventListener("click", () => toggleView(v.id, btn));
    container.appendChild(btn);
  });
}

async function toggleView(idView, btn) {
  if (store.openViews.has(idView)) {
    await viewRemove(idView);
    store.openViews.delete(idView);
    btn.classList.remove("is-active");
  } else {
    await viewAdd(idView);
    store.openViews.add(idView);
    btn.classList.add("is-active");
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
