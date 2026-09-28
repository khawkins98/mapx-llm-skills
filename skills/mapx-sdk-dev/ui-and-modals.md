# UI Controls and Modals

## Language Switching

MapX supports multiple interface languages. Changing the language updates
labels, legends, metadata, and UI text inside the MapX iframe.

```javascript
// Set language
await mapx.ask("set_language", { lang: "fr" }); // ISO 639-1

// Get current
const lang = await mapx.ask("get_language");

// Get available languages
const langs = await mapx.ask("get_languages");
// => ["en", "fr", "es", "ru", "zh", "ar", "de", "pt", "fa", "ps"]
```

Common language codes: `en`, `fr`, `es`, `ru`, `zh`, `ar`

## Theme Switching

Themes change the map's visual appearance (basemap colors, UI styling).

```javascript
// List available themes
const themes = await mapx.ask("get_themes_id");
// => ["color_default", "color_dark", "color_light", ...]

// Get current theme
const current = await mapx.ask("get_theme_id");

// Switch theme
await mapx.ask("set_theme", { idTheme: "color_dark" });
```

Theme IDs typically follow the pattern `color_*`. Strip the `color_`
prefix and title-case for display labels.

## Dashboards

Some views (usually `vt` and `cc` types) have attached dashboards with
charts and graphs. The dashboard panel slides out from the right.

```javascript
// Check if a dashboard is available
const hasDash = await mapx.ask("has_dashboard");

// Open dashboard
if (hasDash) {
  await mapx.ask("set_dashboard_visibility", { show: true });
}

// Close dashboard
await mapx.ask("set_dashboard_visibility", { show: false });

// Toggle
await mapx.ask("set_dashboard_visibility", { toggle: true });
```

**Important**: check `has_dashboard()` only after the view is fully added,
i.e. after `view_add` resolves `true` or its `view_added` event fires. The
dashboard is built before `view_added`. `map_wait_idle()` does **not** wait
for views.

## Map Composer

Opens the MapX map export modal — a full-featured tool for creating
publication-ready map images with title, legend, scale bar, and north arrow.

```javascript
await mapx.ask("show_modal_map_composer");
```

The entire UI is provided by MapX. No custom layout needed.

## Share Modal

Opens the MapX sharing modal with options for direct link, embed code,
and social sharing.

```javascript
await mapx.ask("show_modal_share");
```

## Close All Modals

```javascript
await mapx.ask("close_modal_all");
```

## Vector Spotlight & Highlighting

### Vector Spotlight (`set_vector_spotlight`)

Toggle MapX's vector spotlight overlay. `set_vector_spotlight` replaces
`set_vector_highlight`, which still works but logs a deprecation warning.

```javascript
await mapx.ask("set_vector_spotlight", { enable: true });
// Omit `enable` to toggle. Optional: nLayers (number), calcArea (boolean)
```

The spotlight is **not** needed for `click_attributes`: that event fires on
map clicks whether or not the spotlight is on. Only enable it if you want
the visual effect.

### Feature Highlighter (`set_highlighter`)

Apply programmatically styled highlight outlines to features matching a MapLibre GL filter expression:

```javascript
// Highlight features with population >= 500,000
await mapx.ask("set_highlighter", {
  filters: [
    {
      id: "MX-XXXXX-XXXXX-XXXXX",
      filter: [">=", ["get", "population"], 500000],
    },
  ],
});

// Re-run the last config (e.g. after panning), or clear
await mapx.ask("update_highlighter");
await mapx.ask("reset_highlighter");
```

### Country Basemap Highlighting (`set_country_highlight`)

Highlight specific countries on the basemap by graying out all other countries. Unlike resolvers expecting an options dictionary, `set_country_highlight` accepts an `Array<string>` of ISO 3166-1 alpha-3 codes directly:

```javascript
await mapx.ask("set_country_highlight", ["FRA", "DEU", "ESP"]);
await mapx.ask("set_country_highlight", []); // clear
```

## Legends

Fetch a view's legend as a base64 PNG image:

```javascript
const legendData = await mapx.ask("get_view_legend_image", {
  idView: "MX-XXXXX",
});

if (legendData) {
  const img = document.createElement("img");
  img.src = legendData.startsWith("data:")
    ? legendData
    : `data:image/png;base64,${legendData}`;
  legendContainer.appendChild(img);
}
```

Not all views have legends — the call returns `null` for views without one.
Raster and vector views typically have legends; custom-coded views vary.

## View Metadata

Fetch a view's catalog information:

```javascript
const meta = await mapx.ask("get_view_meta", { idView: "MX-XXXXX" });
```

The metadata object includes:
- `title` — `{en: "...", fr: "..."}` language object
- `abstract` — description text (language object)
- `type` — "vt", "rt", "cc", or "sm"
- `source` — data source attribution
- `temporal` — temporal extent (`{range: {from, to}}`)
- `id` — the view ID

Text fields are language objects. Extract the user's language or fall back:

```javascript
function getLocalText(obj, lang = "en") {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  return obj[lang] || obj.en || obj.fr || Object.values(obj).find(v => typeof v === "string");
}

const title = getLocalText(meta.title);
const abstract = getLocalText(meta.abstract);
```

## Panel Controls & Visibility

### Modern Panels API (`MapxResolversPanels`)

MapX provides fine-grained control over sidebar and control panel drawers:

```javascript
// Batch update panel visibility and drawer state
await mapx.ask("panels_batch", {
  controls_panel: {
    show: true,
    open: true,
  },
});

// Inspect current panel state
const state = await mapx.ask("panels_state");
// => { controls_panel: { hide: false, open: true } }

// List all registered panels
const panelIds = await mapx.ask("panels_list");
// => ["controls_panel", "views_panel", ...]

// Bulk drawer controls
await mapx.ask("panels_close_all");
await mapx.ask("panels_open_all");
await mapx.ask("panels_hide_all");
await mapx.ask("panels_show_all");

// Status inspection
const isOpen = await mapx.ask("panels_is_open", { id: "controls_panel" });
const isVisible = await mapx.ask("panels_is_visible", { id: "controls_panel" });
// Also: panels_is_closed, panels_is_hidden
```

Panel IDs vary; call `panels_list` rather than hard-coding them. Works in
both static and app mode.

### Legacy Left Panel Visibility

For quick control of the view list left drawer:

```javascript
// Show the left panel
await mapx.ask("set_panel_left_visibility", { show: true });

// Hide it
await mapx.ask("set_panel_left_visibility", { show: false });
```

Most embeds pass `closePanels: true` in the constructor options to hide all panels by default, since the embedding application supplies its own custom UI.
