# MapX SDK Initialization

## Loading the SDK

The SDK can be loaded either as a modern ES6 module (recommended for Vite/Webpack/Rollup) or via a UMD script tag exposing the global `mxsdk` object:

### Option A: ES6 Module (Modern)

```javascript
import { Manager } from "https://app.mapx.org/sdk/mxsdk.modern.js";
```

### Option B: UMD Script Tag

```html
<script src="https://app.mapx.org/sdk/mxsdk.umd.js"></script>
<script type="module" src="/src/main.js"></script>
```
When using UMD, access the constructor via `window.mxsdk.Manager`.

## Manager Constructor

The `Manager` creates an iframe inside the target container and loads the
MapX app with the specified project.

```javascript
const mapx = new Manager({
  container: document.getElementById("mapx"),
  url: "https://app.mapx.org/?project=MX-XXXXX-XXX-XXX-XXX-XXX",
  params: {
    closePanels: true,     // Hide sidebar/panels on load
    language: "en",        // Initial UI language
    theme: "color_light",  // Initial theme
    // Optional: initial camera position
    // lat: 20,
    // lng: 0,
    // zoom: 2,
    // Optional: restrict project switching
    // lockProject: true,
    // Optional: views to display at startup
    // views: ["MX-VIEW-ID-1", "MX-VIEW-ID-2"],
  },
  style: {
    width: "100%",
    height: "100%",
    border: "none",
  },
  // static: true,  // Use /static.html for faster, lightweight embedding
  // maxSimultaneousRequest: 20, // Default 10; raise if batching concurrent ask() calls
  // verbose: false, // Set true to log SDK postMessage traffic to console
});
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | HTMLElement \| string | `"body"` | DOM element or selector where the iframe is inserted |
| `url` | string \| URL \| object | — | MapX app URL with `?project=` query param |
| `params` | object | `{}` | URL query params passed to the app |
| `style` | object | `{ width: "100%", ... }` | CSS applied to the iframe element |
| `static` | boolean | `false` | Load `/static.html` (faster, lighter, see below) |
| `maxSimultaneousRequest` | number | `10` | Concurrency ceiling for pending `ask()` promises |
| `verbose` | boolean | `false` | Enable color-coded console logs of SDK postMessage events |

> **Concurrency warning (`maxSimultaneousRequest`)**: If your application fires more than
> `maxSimultaneousRequest` (default 10) unresolved `ask()` calls simultaneously (e.g. via an
> unthrottled `Promise.all`), the SDK immediately rejects excess calls with
> `too_many_request <n>. Max= 10`. Either raise this limit or throttle batch calls.

### Params Object

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `closePanels` | boolean | false | Hide sidebar on load |
| `language` | string | "en" | ISO 639-1 language code |
| `theme` | string | "color_default" | Theme ID |
| `lat` | number | — | Initial latitude |
| `lng` | number | — | Initial longitude |
| `zoom` | number | — | Initial zoom level |
| `lockProject` | boolean | false | Prevent project switching |
| `views` | string[] | — | View IDs to show at startup |
| `hidePrivacyModal` | boolean | true | Suppress the MapX privacy consent modal in embed |

## Static Mode vs. App Mode

MapX supports two runtime modes:

* **Static mode (`static: true`)**: Loads `/static.html`. A stripped-down, high-performance runtime without Shiny websockets, user login, or editing tools. Ideal for public dashboards and embeds where users only view and filter curated layers.
  * *Important limitation*: `get_views_id_open` does not exist in static mode. Use `get_views_with_visible_layer()` instead.
  * Project switching (`set_project`) is not supported in static mode.
* **App mode (`static: false`, default)**: Loads the full MapX single-page application. Supports user accounts, project switching, full panel suites, and collaborative attribute editing.

## Singleton Pattern

Use a singleton to ensure only one Manager instance exists:

```javascript
// sdk/client.js
import { Manager } from "https://app.mapx.org/sdk/mxsdk.modern.js";

let _mapx = null;

export function initSDK(container) {
  _mapx = new Manager({
    container,
    url: "https://app.mapx.org/?project=MX-YOUR-PROJECT-ID",
    params: { closePanels: true, language: "en", theme: "color_light" },
    style: { width: "100%", height: "100%", border: "none" },
  });
  return _mapx;
}

export function getSDK() {
  if (!_mapx) throw new Error("SDK not initialised -- call initSDK() first");
  return _mapx;
}
```

## Ready Event

The SDK fires a `ready` event when the iframe has loaded and the MapX app
is ready to accept commands. **Never call `ask()` before ready**.

```javascript
const mapx = initSDK(document.getElementById("mapx"));

mapx.on("ready", async () => {
  // Wait for initial tile rendering to finish
  await mapx.ask("map_wait_idle");

  // Enable feature spotlight click rings (preferred over deprecated set_vector_highlight)
  await mapx.ask("set_vector_spotlight", { enable: true });
});
```

## Finding Project IDs

Project IDs look like `MX-XXX-XXX-XXX-XXX-XXX`. To find yours:

1. Go to https://app.mapx.org
2. Open or create a project
3. The URL will contain `?project=MX-XXXXX-XXX-XXX-XXX-XXX`
4. Copy that ID

## Discovering Views in a Project

Use `get_views` to enumerate all views available in the connected project:

```javascript
mapx.on("ready", async () => {
  const views = await mapx.ask("get_views");
  for (const v of views) {
    console.log(v.id, v.type, v.data?.title?.en);
  }
});
```

Or build a probe page that connects to multiple projects and dumps their
view catalogs (see the probe-views.html pattern in the demo project).

## Container Layout

The container must have explicit dimensions. The SDK iframe fills it with
`position: absolute; inset: 0;` inside a `position: relative` parent.

```css
/* Parent: flex or grid with explicit height */
.map-area {
  flex: 1;
  position: relative;
  min-width: 0;
}

/* SDK creates the iframe here */
#mapx {
  position: absolute;
  inset: 0;
}
```

A common layout is sidebar (fixed width) + map area (flex: 1) inside a
flex container with a fixed height (e.g. `75vh`).

## Content-Security-Policy (CSP) Guidance

If your parent web application enforces strict Content-Security-Policy (CSP) headers, ensure the following directives allow the MapX iframe and CDN assets:

```http
Content-Security-Policy:
  frame-src 'self' https://app.mapx.org;
  script-src 'self' https://app.mapx.org;
  connect-src 'self' https://app.mapx.org https://api.mapx.org;
```

* `frame-src https://app.mapx.org` allows embedding the MapX application inside the iframe.
* `script-src` and `connect-src` are required if dynamically importing `mxsdk.modern.js` or querying the MapX API directly from the host page.
