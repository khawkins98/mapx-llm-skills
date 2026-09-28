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
When using UMD, access the constructor via `window.mxsdk.Manager`. The
examples below write `new Manager(...)`; with UMD, add
`const { Manager } = window.mxsdk;` first.

Always load from `app.mapx.org` rather than npm. `@fxi/mxsdk` on npm lags
the deployed build (latest `1.13.14-alpha.10` vs deployed `1.14.0-fix.1`),
and the Manager logs `err_version_mismatch` when its version differs from
the worker inside the iframe.

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
  // static: true,  // Recommended by upstream for most embeds; see "Static Mode vs. App Mode"
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

> **Concurrency warning (`maxSimultaneousRequest`)**: a call made while *more than*
> `maxSimultaneousRequest` (default 10) requests are already pending is rejected with the
> string `too_many_request <n>. Max= <m>`, **but the request is still sent and executed** by
> MapX. Throttle batch calls (don't use an unbounded `Promise.all`), and don't blindly retry
> side-effecting calls. See [limitations-and-workarounds.md §13](limitations-and-workarounds.md).

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

MapX supports two runtime modes. The upstream SDK README calls **static
mode the primary usage**, so default to it unless you need an app-only
feature.

* **Static mode (`static: true`, recommended)**: Loads `/static.html`. A lighter,
  faster runtime without the Shiny websocket, user login, or editing tools.
  Suited to public dashboards and embeds where users view and filter
  curated layers.
  * App-only resolvers (`get_views_id_open`, `set_project`, `get_projects`, user/login,
    `move_view_*`, `table_editor_*`, …) **hang** rather than reject. Use
    `get_views_with_visible_layer` instead of `get_views_id_open`.
  * Filters read `from`/`to` (numeric) and `values` + `attribute` (text).
  * `view_add` on a story map view starts the story reader.
* **App mode (`static: false`, SDK default)**: Loads the full MapX application.
  Supports user accounts, project switching, the view list UI and
  attribute editing. Filters go through the view's UI widgets and read
  `value` only.

The full resolver and parameter differences are in
[limitations-and-workarounds.md §14](limitations-and-workarounds.md).

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
    static: true, // drop this if you need app-only features
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
  // Safe to call ask() from here on.
  const ids = await mapx.ask("get_views_id");
  console.log(`Project has ${ids.length} views`);
});
```

`ready` means the bridge is up, not that startup views have rendered.
Listen for `view_added` for that. `map_wait_idle` right after `ready`
usually resolves immediately, because it only waits while the camera is
moving.

## Finding Project IDs

Project IDs look like `MX-XXX-XXX-XXX-XXX-XXX`. If the project isn't readable
by the current (usually guest) user, MapX silently loads the public HOME
project instead: no error, just the wrong views. In app mode, confirm with
`await mapx.ask("get_project")` after `ready`. To find yours:

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
* `script-src https://app.mapx.org` is required to load the SDK at all, whether via the UMD `<script>` tag or an `import` of `mxsdk.modern.js`.
* `connect-src` is only needed if the host page calls the MapX API directly (the iframe's own requests are governed by MapX's policy, not yours).
