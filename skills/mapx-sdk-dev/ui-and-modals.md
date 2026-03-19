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

**Important**: Always call `map_wait_idle()` before checking `has_dashboard()`
or opening a dashboard. The dashboard state depends on which views are
loaded and rendered.

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

## Vector Highlight

Enable or disable the visual highlight ring that appears when clicking
vector features. When enabled, clicking a feature shows a highlight and
triggers `click_attributes` events.

```javascript
await mapx.ask("set_vector_highlight", { enable: true });
```

Best practice: enable this during SDK initialization (in the `ready` handler).

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

## Panel Visibility

Control the MapX left panel (view list sidebar):

```javascript
// Show the left panel
await mapx.ask("set_panel_left_visibility", { show: true });

// Hide it
await mapx.ask("set_panel_left_visibility", { show: false });
```

Most embeds use `closePanels: true` in the constructor to hide this panel
by default, since the parent page provides its own UI.
