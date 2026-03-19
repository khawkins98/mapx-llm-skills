# MapX SDK Initialization

## Loading the SDK

The SDK is loaded as a UMD script that exposes the global `mxsdk` object.
It must be loaded **before** your application code.

```html
<script src="https://app.mapx.org/sdk/mxsdk.umd.js"></script>
<script type="module" src="/src/main.js"></script>
```

## Manager Constructor

The `Manager` creates an iframe inside the target container and loads the
MapX app with the specified project.

```javascript
const mapx = new mxsdk.Manager({
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
  // static: true,  // Use /static.html for fewer features but faster load
});
```

### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `container` | HTMLElement | DOM element where the iframe is inserted |
| `url` | string | MapX app URL with `?project=` query param |
| `params` | object | URL query params passed to the app |
| `style` | object | CSS applied to the iframe element |
| `static` | boolean | Load static.html (faster, fewer features) |

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

## Singleton Pattern

Use a singleton to ensure only one Manager instance exists:

```javascript
// sdk/client.js
let _mapx = null;

export function initSDK(container) {
  _mapx = new mxsdk.Manager({
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
  // NOW safe to call SDK methods
  await mapx.ask("set_vector_highlight", { enable: true });
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
