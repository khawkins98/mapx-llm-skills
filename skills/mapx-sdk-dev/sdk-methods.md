# MapX SDK Method Catalog

Reference for `mapx.ask()` resolver methods. Originally tested at runtime
against the deployed SDK v1.13.19 (March 2026); signatures re-checked
against the upstream source at tag `1.14.0-fix.1` (August 2026). MapX
uses MapLibre GL JS v5 under the hood. The SDK has additional methods not
yet documented here; see the [SDK source](https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk)
for the full list. Every method returns a Promise. Parameters are passed
as a single object (exception: `set_country_highlight`).

> **Static vs app mode matters.** Several resolvers read *different
> parameters* depending on the mode (notably the numeric and text filters),
> and app-only resolvers **hang forever** in static mode rather than
> rejecting. See [limitations-and-workarounds.md §14](limitations-and-workarounds.md).

### get_sdk_methods

Lists resolver names available in the current mode. Useful to check that a
method exists before calling it (a missing resolver hangs, it does not reject).

```javascript
const methods = await mapx.ask("get_sdk_methods");
// => ["add_theme", "close_modal_all", ..., "view_add", ...]
```

Caveat: the list is built from the static/app resolver prototypes only, so
the inherited `panels_*` resolvers are **not** included even though they work
(runtime-verified: 89 methods in static mode, 126 in app mode, no `panels_*`).

## Map Navigation & Display

### map_fly_to

Animate the map camera smoothly. Accepts standard MapLibre GL `AnimationOptions`.

```javascript
await mapx.ask("map_fly_to", {
  center: { lng: -72, lat: 18 },
  zoom: 5.5,
  bearing: 0,
  pitch: 0,
  duration: 2000,    // ms
  essential: true,   // not affected by prefers-reduced-motion
});
```

Resolves when the move ends. **Keep `duration` under 10 s**: the resolver
rejects internally after 10 s (`err_resolver_failed`, `msg: "timeout"`), and
because failed resolvers never settle, the `ask()` then **hangs**
(runtime-verified with a 12 s flight).

### map_jump_to

Move the camera instantaneously without animation transitions.

```javascript
await mapx.ask("map_jump_to", {
  center: { lng: 10, lat: 45 },
  zoom: 6,
  bearing: 0,
  pitch: 0,
});
```

### map_get_zoom

Returns the current zoom level as a floating-point number.

```javascript
const zoom = await mapx.ask("map_get_zoom");
// => 5.5
```

### map_get_center

Returns the current map center coordinates.

```javascript
const center = await mapx.ask("map_get_center");
// => { lng: -72.0, lat: 18.0 }
```

### map_get_bounds_array / map_set_bounds_array

Get the visible bounding box, or fit the camera to one, as
`[west, south, east, north]`.

```javascript
const bounds = await mapx.ask("map_get_bounds_array");
// => [-75.2, 17.5, -68.8, 19.9]

// Fits the camera to the bounds (MapLibre fitBounds). Returns a boolean:
const ok = await mapx.ask("map_set_bounds_array", {
  bounds: [-75.2, 17.5, -68.8, 19.9],
});
// ok === false when the bounds fall outside the current max bounds: the map
// does NOT move (MapX shakes the map and flashes an arrow instead).
```

### map_get_max_bounds_array / map_set_max_bounds_array

Constrain map panning to a specific bounding box. Pass `bounds: null` to
remove the constraint.

```javascript
await mapx.ask("map_set_max_bounds_array", {
  bounds: [-80, 15, -65, 25],
});
```

### map_wait_idle

Resolves once the camera has stopped moving. Internally it is
`if (map.isMoving()) await map.once("idle")`: if the map is **not moving**
when called, it resolves **immediately**, and it does **not** wait for tiles
or views to finish loading.

Use it between a camera move (`map_fly_to`, `common_loc_fit_bbox`) and
operations that depend on what is rendered (dashboards, filters,
`queryRenderedFeatures`, statistics):

```javascript
await mapx.ask("map_fly_to", { center: { lng: 85, lat: 28 }, zoom: 6 });
await mapx.ask("map_wait_idle");
// Camera has settled; safe to query rendered data
```

To wait for a view to finish loading, listen for the `view_added` event
instead (see Events Catalog below).

### common_loc_fit_bbox

Fly to a country or region bounding box.

```javascript
// By ISO 3166-1 alpha-3 code
await mapx.ask("common_loc_fit_bbox", {
  code: "IND",
  param: { duration: 2000, maxZoom: 8 },
});

// By M49 region code
await mapx.ask("common_loc_fit_bbox", {
  code: "m49_029",  // Caribbean
  param: { duration: 2000 },
});
```

### common_loc_get_bbox

Get the bounding box of a country or region without moving the map.

```javascript
const bbox = await mapx.ask("common_loc_get_bbox", { code: "COD" });
// => [west, south, east, north]
// Also accepts an array of codes, or { name: "Bangladesh" } (less reliable)
```

### common_loc_get_list_codes

Returns available location codes for `common_loc_fit_bbox`.

```javascript
const codes = await mapx.ask("common_loc_get_list_codes");
// => [{code: "AFG", label: "Afghanistan"}, {code: "m49_029", label: "Caribbean"}, ...]
```

### set_3d_terrain

Toggle elevation exaggeration on the basemap.

```javascript
await mapx.ask("set_3d_terrain", { action: "toggle" });
// Actions: "show", "hide", "toggle"
```

### set_mode_3d

Adjust pitch and bearing for a 3D perspective view.

```javascript
await mapx.ask("set_mode_3d", { action: "toggle" });
// Actions: "show", "hide", "toggle"
```

### set_mode_aerial

Switch between standard basemap and satellite imagery.

```javascript
await mapx.ask("set_mode_aerial", { action: "toggle" });
// Actions: "show", "hide", "toggle"
```

### set_immersive_mode

Hide all MapX UI chrome for a clean presentation view.

```javascript
await mapx.ask("set_immersive_mode", { toggle: true });
// Or: { enable: true } / { enable: false }
const isImmersive = await mapx.ask("get_immersive_mode"); // => boolean
```

---

## View Management

### view_add

Display a view on the map.

```javascript
const ok = await mapx.ask("view_add", {
  idView: "MX-XXXXX-XXXXX-XXXXX",
  zoomToView: false, // optional: fit the map to the view's extent
});
// ok === true      → view added
// ok === undefined → add failed; MapX emits an "err_view_invalid" message
// (never settles)  → the view lookup threw (e.g. ID not found)
```

Always check `ok === true` rather than truthiness, and guard the call with a
timeout (see `askWithTimeout` in
[limitations-and-workarounds.md §9](limitations-and-workarounds.md)).

**Views outside the connected project** (runtime-verified 2026-09-28):
public views from other projects **load** on 1.14. `view_add` fetches them
from the MapX API and resolves `true`, and `view_added` fires. (On 1.13.19
they did nothing.) A non-existent ID never settles and emits
`err_resolver_failed` with `View not found`. `view_added` also fires again
when the view is already open. Details:
[limitations-and-workarounds.md §1](limitations-and-workarounds.md).

### view_remove

Remove a view from the map.

```javascript
const ok = await mapx.ask("view_remove", { idView: "MX-XXXXX-XXXXX-XXXXX" });
// => true/false
```

### get_view_meta

Returns metadata for a view: title, abstract, source, temporal extent, type.
Text fields are language objects (`{en, fr, es, ...}`).

```javascript
const meta = await mapx.ask("get_view_meta", { idView: "MX-XXXXX" });
// => { title: {en: "..."}, abstract: {en: "..."}, type: "vt", source: [...], temporal: {...} }
```

### get_view_legend_image

Returns a base64-encoded PNG of the view's legend, or null.

```javascript
const legend = await mapx.ask("get_view_legend_image", { idView: "MX-XXXXX" });
// => "data:image/png;base64,..." or base64 string or null
```

### get_views

Returns the full catalog of views in the current project as an array of view objects.

```javascript
const views = await mapx.ask("get_views");
/*
Abbreviated, illustrative element. Only the fields the SDK source itself
reads are shown; other keys exist and vary by view type. Inspect a real
response before depending on anything else.
{
  id: "MX-XXXXX-XXXXX-XXXXX",
  type: "vt",           // "vt" vector tiles, "rt" raster, "cc" custom code,
                        // "sm" story map, "gj" GeoJSON
  project: "MX-PROJECT-ID",
  date_modified: "...",
  data: {
    title:     { en: "...", fr: "..." },   // language object
    abstract:  { en: "..." },              // language object
    attribute: { name: "status_year", ... }, // vt: styled attribute
    source:    { ... },                     // shape varies by type
  },
}
*/

// Lighter alternatives:
const ids = await mapx.ask("get_views_id");               // => ["MX-...", ...]
const titles = await mapx.ask("get_views_title", {
  views: ids,
  lang: "en",
});                                                        // => ["Title", ...]
```

### get_views_id_open (App Mode Only)

Returns IDs of currently displayed views.

```javascript
const ids = await mapx.ask("get_views_id_open");
// => ["MX-XXXXX", "MX-YYYYY"]
```

> **Static mode warning**: `get_views_id_open` only exists in app mode.
> With `static: true` (or `/static.html`) the worker answers
> `err_resolver_not_found`, and the promise **never settles**: it hangs
> rather than rejecting (runtime-verified). Use
> `get_views_with_visible_layer` instead.

### get_views_with_visible_layer (Static & App Mode)

Returns the IDs of views that currently have layers on the map, top-most
first. (`get_views_layer_order` is an alias with the same output.)

```javascript
const visibleIds = await mapx.ask("get_views_with_visible_layer");
// => ["MX-XXXXX", "MX-YYYYY"]
```

This reflects rendered map layers, not the view list UI. A view that is
"open" but has not produced a layer yet will not appear.

### set_views_layer_order

Reorders the visual stacking of view layers. The first ID is drawn on top.

```javascript
await mapx.ask("set_views_layer_order", {
  order: ["MX-TOP-VIEW", "MX-BOTTOM-VIEW"],
});
// Fires "layers_ordered" with { layers: order }
```

### move_view_top / move_view_bottom / move_view_up / move_view_down / move_view_before / move_view_after (App Mode Only)

Reorder a view in the MapX view list (and therefore on the map).

```javascript
await mapx.ask("move_view_top", { idView: "MX-XXXXX" });
await mapx.ask("move_view_after", { idView: "MX-XXXXX", idViewAfter: "MX-YYYYY" });
```

### set_project (App Mode Only)

Switches the active MapX project without reloading the parent page.

```javascript
// Don't trust the promise alone (see below): guard it and verify
const target = "MX-TARGET-PROJECT-ID";
await askWithTimeout(mapx, "set_project", { idProject: target }, 15000).catch(() => {});
const switched = (await mapx.ask("get_project")) === target;
```

**Runtime behaviour** (verified 2026-09-28 as a guest):
- Switching to a **public** project with no views open resolved `true` in
  ~1.3 s and fired `project_changed`.
- Switching to a public project **with views open**: the project did change
  (`get_project` returned the target), but the promise never settled and
  `project_changed` never fired.
- Switching to a project the user **can't open**: MapX shows a "The project
  cannot be loaded. Please log in and try again." dialog inside the iframe,
  and the promise stays pending until someone closes it.

**Behavior & Constraints** (from `setProject` in `map_helpers/index.js`):
- **App mode only**: the resolver does not exist in static mode, so the call
  **hangs** (`err_resolver_not_found`). In app mode without a live Shiny
  session it returns `undefined` and logs "Project change requires a valid
  app session".
- **Returns `undefined`** for an invalid project ID, and **`false`** if the
  ID is already the current project.
- **UI side effects inside the iframe**: if any MapX modal is open, MapX
  asks the user to confirm (declining returns `false`). If the server
  refuses the change or doesn't answer within **10 s**, MapX shows a
  failure dialog and only returns `false` **after the user closes it**.
  Project access is decided server-side.
- **State reset**: closes all displayed views and clears initial query
  parameters, then reconnects the websocket and waits for the view list.
- **Event**: fires `project_changed` with `{ new_project, old_project }`.
  The `ready` event does **not** fire again.

---

## GeoJSON Views (Custom Data)

### view_geojson_create

Create a native MapX view from GeoJSON. Integrates with the view system
(layer ordering, click events, view list).

```javascript
const result = await mapx.ask("view_geojson_create", {
  data: featureCollection,      // GeoJSON FeatureCollection
  title: { en: "My Points" },   // or plain string
  abstract: "Description",
  random: false,                 // randomize styling?
});
const viewId = result.id;
```

### view_geojson_set_style

Style a GeoJSON view using MapLibre GL paint and layout properties.

```javascript
await mapx.ask("view_geojson_set_style", {
  idView: viewId,
  paint: {
    "circle-color": "#e74c3c",
    "circle-radius": 8,
    "circle-opacity": 0.9,
  },
});
```

### view_geojson_delete

Remove a GeoJSON view entirely.

```javascript
await mapx.ask("view_geojson_delete", { idView: viewId });
```

---

## Filtering & Transparency

### set_view_layer_filter_numeric

Filter a vector tile view by numeric attribute range. Only works on `vt` views.

**The parameters that take effect depend on the mode:**

| Param | App mode (default) | Static mode |
|---|---|---|
| `value: [min, max]` | ✅ Sent to the view's numeric slider | ✅ Converted to `from`/`to` |
| `from` / `to` | ❌ Ignored | ✅ Used |
| `attribute` | ❌ Ignored (slider uses the view's styled attribute) | ✅ Used (defaults to the styled attribute) |

In app mode the resolver passes **only `opt.value`** to the slider. Sending
`{ from, to }` without `value` does nothing (runtime-verified). **Always
send `value`**.

App-mode caveats (runtime-verified):
- The range **snaps to the slider step**, `(min + max) / 1000` of the
  attribute's range: `[20000, 100000]` became `19927.70–99945.08`, and
  `[2, 60]` on a 0–153 290 attribute collapsed to `0..0`.
- `get_view_layer_filter_numeric` returns **strings** in app mode
  (`["19927.70", "99945.08"]`) and numbers in static mode.

To write code that works in either mode, send both forms:

```javascript
// Portable: works in app and static mode
const range = [1000000, 50000000];
await mapx.ask("set_view_layer_filter_numeric", {
  idView: "MX-XXXXX",
  value: range,          // app mode reads this
  from: range[0],        // static mode reads these
  to: range[1],
});

// Read back the current range
const current = await mapx.ask("get_view_layer_filter_numeric", { idView: "MX-XXXXX" });
```

**Clearing**: there is no "clear" value. `null` is a no-op for the app-mode
slider, and in static mode `from: null, to: null` writes
`<= null` / `>= null` comparisons into the layer filter. Reset to the
attribute's full range instead:

```javascript
// Default stats include the styled attribute's min/max
const summary = await mapx.ask("get_view_source_summary", { idView: "MX-XXXXX" });
const { min, max } = summary.attribute_stat;
await mapx.ask("set_view_layer_filter_numeric", {
  idView: "MX-XXXXX",
  value: [min, max],
  from: min,
  to: max,
});
```

### set_view_layer_filter_text

Filter a vector tile view by text/category values.

**Same mode split as the numeric filter:**

| Param | App mode (default) | Static mode |
|---|---|---|
| `value` (string or array) | ✅ Sent to the view's search box | ❌ Ignored |
| `values` (string or array) | ❌ Ignored | ✅ Used |
| `attribute` | ❌ Ignored | ⚠️ **Required in practice**: omitting it throws `Cannot access '…' before initialization` (upstream bug), so the call hangs |

Runtime-verified 2026-09-28. Also: in app mode, a call carrying only
`values` (no `value`) **clears** the current text filter.

```javascript
// Portable: works in app and static mode
const selected = ["Significant increase", "Moderate increase"];
await mapx.ask("set_view_layer_filter_text", {
  idView: "MX-XXXXX",
  value: selected,       // app mode
  values: selected,      // static mode
  attribute: "trend",    // static mode (must be explicit)
});

// Clear: empty selection
await mapx.ask("set_view_layer_filter_text", {
  idView: "MX-XXXXX",
  value: [],
  values: [],
  attribute: "trend",
});

// Read back
const vals = await mapx.ask("get_view_layer_filter_text", { idView: "MX-XXXXX" });
```

Values must exactly match the attribute data (case-sensitive).

### set_view_layer_filter_time

Filter by time for views whose source has `mx_t0` and/or `mx_t1` (POSIX
seconds) attributes. Times passed in are **milliseconds**. As with the other
filters, app mode routes through the view's time slider.

```javascript
// Default stats include the time extent and attribute list
const summary = await mapx.ask("get_view_source_summary", { idView: "MX-XXXXX" });
const from = summary.extent_time.min * 1000;
const to = summary.extent_time.max * 1000;
await mapx.ask("set_view_layer_filter_time", {
  idView: "MX-XXXXX",
  from,
  to,
  value: [from, to], // app mode (slider) reads value
  hasT0: summary.attributes.includes("mx_t0"),
  hasT1: summary.attributes.includes("mx_t1"),
});
```

The upstream JSDoc example passes only `from`/`to`, which **does nothing in
app mode**: the time slider only reads `value` (runtime-verified). Send both.

### get_view_legend_values / get_view_legend_state / set_view_legend_state

Filter a `vt` view through its legend checkboxes.

```javascript
const all = await mapx.ask("get_view_legend_values", { idView: "MX-XXXXX" });
// => ["value1", "value2", ...]  or, for numeric rules, [[0, 10], [10, 20], ...]
const checked = await mapx.ask("get_view_legend_state", { idView: "MX-XXXXX" });
await mapx.ask("set_view_legend_state", { idView: "MX-XXXXX", values: [all[0]] });
```

### set_view_layer_transparency

Set a layer's transparency. **The scale depends on the mode**: in app mode
`value` is 0–100 transparency (0 = opaque); in static mode the number is
applied directly as MapLibre opacity, 0–1 (1 = opaque), read from
`opacity` or else `value`. Runtime-verified: in static mode `value: 50` set
no opacity at all (MapLibre rejects 50), while `opacity: 0.5` gave
`circle-opacity: 0.5`. In app mode `value: 50` gave `0.5`.

```javascript
// Portable: 50% transparent in either mode
await mapx.ask("set_view_layer_transparency", {
  idView: "MX-XXXXX",
  value: 50,     // app mode: transparency 0..100
  opacity: 0.5,  // static mode: opacity 0..1
});
```

### get_view_layer_transparency

Returns the stored transparency/opacity value for the view (in static mode,
the 0–1 opacity that was set).

```javascript
const t = await mapx.ask("get_view_layer_transparency", {
  idView: "MX-XXXXX",
});
// => 50
```

---

## Data Introspection & Export

### get_view_table_attribute_config

Returns the view's data schema. Only works on `vt` views.

```javascript
const config = await mapx.ask("get_view_table_attribute_config", {
  idView: "MX-XXXXX",
});
// => { attributes: ["col1", "col2"], idSource: "...", labels: {...} }
```

### get_view_table_attribute

Returns actual row data for the view's attribute table.

```javascript
const rows = await mapx.ask("get_view_table_attribute", {
  idView: "MX-XXXXX",
});
// => [{col1: "value", col2: 42}, ...]
```

### get_view_source_summary

Returns statistical summary for a view's attribute.

```javascript
const summary = await mapx.ask("get_view_source_summary", {
  idView: "MX-XXXXX",
  idAttr: "population",
  stats: ["base", "attributes"],
});
// => { count, min, max, mean, ... }
```

**Important**: Call `map_wait_idle()` first to avoid stale/empty results.

### download_view_source_geojson

Returns GeoJSON for a view. Intended for GeoJSON views created via
`view_geojson_create`.

```javascript
const geojson = await mapx.ask("download_view_source_geojson", {
  idView: viewId,
  mode: "data",  // "data" (raw) or "view" (with current filters)
});
```

### download_view_source_vector / download_view_source_external / download_view_source_raster

```javascript
// vt views: opens MapX's own download modal inside the iframe (no data returned)
await mapx.ask("download_view_source_vector", { idView: "MX-XXXXX" });

// rt / cc views (or any view with download links in its metadata):
const dl = await mapx.ask("download_view_source_external", { idView: "MX-XXXXX" });
// => { idView, url, urlItems: [{ url, label, is_download_link }, ...] }
// download_view_source_raster is an alias of download_view_source_external
```

### get_view_meta_vt_attribute

Returns the styled attribute's metadata for a `vt` view (`view.data.attribute`).

```javascript
const attr = await mapx.ask("get_view_meta_vt_attribute", { idView: "MX-XXXXX" });
// => { name: "population", ... }
```

---

## UI Controls

### set_language / get_language / get_languages

```javascript
await mapx.ask("set_language", { lang: "fr" }); // ISO 639-1 code
const lang = await mapx.ask("get_language");     // => "fr"
const langs = await mapx.ask("get_languages");
// => ["en", "fr", "es", "ru", "zh", "ar", "de", "pt", "fa", "ps"]
```

### set_theme / get_themes_id / get_theme_id

```javascript
const themes = await mapx.ask("get_themes_id");    // => ["color_default", "color_dark", ...]
const current = await mapx.ask("get_theme_id");     // => "color_default"
await mapx.ask("set_theme", { idTheme: "color_dark" });
```

### has_dashboard / set_dashboard_visibility

```javascript
const hasDash = await mapx.ask("has_dashboard");
if (hasDash) {
  await mapx.ask("set_dashboard_visibility", { show: true });
}
// Also supports: { toggle: true }
```

### set_vector_spotlight (Preferred) / set_vector_highlight (Deprecated)

Toggle MapX's vector "spotlight" overlay. `set_vector_highlight` is a
deprecated alias: it logs `"Deprecated. Use set_vector_spotlight instead"`
and calls the same code.

```javascript
await mapx.ask("set_vector_spotlight", { enable: true });
// Omit `enable` to toggle. Optional: nLayers (number), calcArea (boolean)
// Fires "spotlight_update" with { enable }
```

The spotlight is independent of `click_attributes`: that event fires on
map clicks whether or not the spotlight is enabled.

### set_highlighter / update_highlighter / reset_highlighter

Highlight features of one or more views that match a MapLibre filter
expression. `set_highlighter` and `update_highlighter` return the number of
highlighted features.

```javascript
const count = await mapx.ask("set_highlighter", {
  filters: [
    {
      id: "MX-XXXXX-XXXXX-XXXXX",           // view ID
      filter: [">=", ["get", "population"], 500000],
    },
  ],
});

await mapx.ask("update_highlighter"); // re-run the last config (e.g. after panning)
await mapx.ask("reset_highlighter");  // clear
```

### set_country_highlight

Highlights the given countries on the basemap by greying out every other
country.

> [!NOTE]
> Unlike most resolvers, `set_country_highlight` takes the array of
> ISO 3166-1 alpha-3 codes **directly** as its argument, not wrapped in an
> options object.

```javascript
await mapx.ask("set_country_highlight", ["KEN", "UGA", "TZA"]);
await mapx.ask("set_country_highlight", []);      // clear
// Including "WLD" in the list also clears the highlight
```

### set_features_click_sdk_only

Redirect `click_attributes` events exclusively to the SDK listener, suppressing
MapX's own native feature popup. Use this when building a custom inspection panel.

```javascript
// Suppress MapX's feature panel so only your listener receives click_attributes
mapx.ask("set_features_click_sdk_only", { enable: true }).catch(() => {});

// Restore default MapX behavior on deactivation
mapx.ask("set_features_click_sdk_only", { enable: false }).catch(() => {});
```

**Important:** Fire-and-forget — do **not** `await` this call. The SDK `ask()` can
sometimes hang if the internal resolver throws (see §9 in
[limitations-and-workarounds.md](limitations-and-workarounds.md)). The UI should
not depend on the response. Appending `.catch(() => {})` prevents unhandled rejection
warnings.

Note: Initialising MapX with `closePanels: true` typically already suppresses the
native feature panel. Calling this method in inspection mode is belt-and-suspenders.

### set_panel_left_visibility

Show or hide the MapX left panel (view list sidebar).

```javascript
await mapx.ask("set_panel_left_visibility", { show: true });
await mapx.ask("set_panel_left_visibility", { show: false });
```

### Panels API (MapxResolversPanels)

Upstream MapX provides a full panel management suite via `MapxResolversPanels`:

```javascript
// Batch update panel visibility and drawer states
await mapx.ask("panels_batch", {
  controls_panel: { show: true, open: true },
});

// Query panel state and list
const state = await mapx.ask("panels_state");
const panelList = await mapx.ask("panels_list"); // => ['controls_panel', ...]

// Global bulk actions
await mapx.ask("panels_close_all");
await mapx.ask("panels_open_all");
await mapx.ask("panels_hide_all");
await mapx.ask("panels_show_all");

// Status checks
const isOpen = await mapx.ask("panels_is_open", { id: "controls_panel" });
const isClosed = await mapx.ask("panels_is_closed", { id: "controls_panel" });
const isVisible = await mapx.ask("panels_is_visible", { id: "controls_panel" });
const isHidden = await mapx.ask("panels_is_hidden", { id: "controls_panel" });
```

Available in both static and app mode. Call `panels_list` for the real panel
IDs rather than hard-coding them.

### show_modal_map_composer

Open the MapX map export tool modal (layout, legend, scale bar, etc.).
MapX provides the entire UI.

```javascript
await mapx.ask("show_modal_map_composer");
```

### show_modal_share

Open the MapX sharing modal (link, embed code, social).

```javascript
await mapx.ask("show_modal_share");
// Optionally pre-select views to share:
await mapx.ask("show_modal_share", { idView: "MX-XXXXX" });
```

### close_modal_all

Close all open MapX modals.

```javascript
await mapx.ask("close_modal_all");
```

---

## MapLibre GL JS Passthrough

The `"map"` resolver exposes the underlying MapLibre GL JS **v5** `Map`
instance. You can call any MapLibre map method through it, using the
MapLibre v5 signatures. Most camera, source and layer methods match the
older Mapbox GL JS API, but some don't: projections are the main one (see
below). When in doubt, check the
[MapLibre API docs](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/)
rather than the Mapbox docs.

```javascript
// Generic pattern
await mapx.ask("map", {
  method: "methodName",
  parameters: [arg1, arg2],  // positional args
});
```

### Common passthrough calls

```javascript
// Set projection (MapLibre v5 takes an object, NOT a string)
await mapx.ask("map", { method: "setProjection", parameters: [{ type: "globe" }] });
const proj = await mapx.ask("map", { method: "getProjection" });
// => { type: "globe" } / { type: "mercator" }; undefined on a fresh map (= mercator)
// setProjection("globe") (string) is silently ignored: the map stays mercator
// (runtime-verified by comparing map.project() output)

// Get center/zoom
const center = await mapx.ask("map", { method: "getCenter" });
const zoom = await mapx.ask("map", { method: "getZoom" });

// Add custom source + layer
await mapx.ask("map", {
  method: "addSource",
  parameters: ["my-source", { type: "geojson", data: featureCollection }],
});

await mapx.ask("map", {
  method: "addLayer",
  parameters: [{
    id: "my-layer",
    type: "circle",
    source: "my-source",
    paint: { "circle-radius": 6, "circle-color": "#e74c3c" },
  }],
});

// Remove
await mapx.ask("map", { method: "removeLayer", parameters: ["my-layer"] });
await mapx.ask("map", { method: "removeSource", parameters: ["my-source"] });

// Spatial query
const features = await mapx.ask("map", {
  method: "queryRenderedFeatures",
  parameters: [[[x1, y1], [x2, y2]]],  // pixel bbox
});

// Unproject pixel to geo
const lngLat = await mapx.ask("map", {
  method: "unproject",
  parameters: [{ x: 400, y: 300 }],
});
```

**Limitation**: You cannot pass callbacks through `addLayer` event handlers
or `map.on()`. The postMessage bridge only accepts serializable data.
For click interaction on passthrough layers, use coordinate matching
(see [limitations-and-workarounds.md](limitations-and-workarounds.md)).

---

## Events Catalog

Every event MapX fires internally is forwarded across the postMessage bridge
(the worker registers a passthrough on MapX's event bus). Listen with
`mapx.on(type, cb)`, stop with `mapx.off(type, cb)`, or `await mapx.once(type)`.
The callback receives the event's `data` object, or `undefined` for events
that carry none.

Source of truth: `grep -rn "events.fire(" app/src/js` in `unep-grid/mapx`.
The list below reflects tag `1.14.0-fix.1`.

### SDK / connection

| Event | Payload | Notes |
|---|---|---|
| `ready` | — | SDK handshake done; safe to call `ask()` |
| `message` | `{ level, key, text, vars, emitter }` | SDK log/warning/error channel (see below) |
| `mapx_ready` | — | MapX map initialised |
| `mapx_connected` / `mapx_disconnected` | — | App-mode websocket state |
| `session_start` / `session_end` | — | App session lifecycle |

### Views

| Event | Payload | Notes |
|---|---|---|
| `view_add` | `{ idView, view }` | Fired **before** rendering; `view` is the full view JSON |
| `view_added` | `{ idView, time }` | Fired when the view is fully added (layers, legend, dashboard) |
| `view_remove` | `{ idView, view }` | Fired before removal |
| `view_removed` | `{ idView, time, duration }` | After removal; `duration` = ms the view was open |
| `view_created` / `view_deleted` | — | A view was created / deleted in the project |
| `views_list_updated` | — | View list (re)loaded, e.g. after `set_project` |
| `layers_ordered` | `{ layers }` | Array of view IDs in the new order |
| `view_ui_open` / `view_ui_close` | `{ idView }` | View item expanded/collapsed in the MapX list (app mode) |
| `view_panel_click` | `{ idView, idAction }` | Action button clicked in a view item (app mode) |

`view_added` / `view_removed` fire for **every** add/remove: SDK calls,
user clicks in the MapX UI, startup `views` params, story maps. They are
the reliable way to keep parent-page state in sync.

### Filters and legends

| Event | Payload |
|---|---|
| `view_filter` | `{ idView, filter }` (a filter was set) |
| `view_filtered` | `{ idView, filter }` (the combined filter was applied to the layer) |
| `view_legend_updated` | — |

### Feature inspection

| Event | Payload |
|---|---|
| `click_attributes` | `{ part, nPart, idView, attributes, point, lngLat }` |
| `spotlight_update` | `{ enable }` (spotlight toggled on/off) |
| `spotlight_progress` | `{ progress }` |

### Application state

| Event | Payload |
|---|---|
| `language_change` | `{ new_language }` |
| `project_changed` | `{ new_project, old_project }` (after `set_project` completes) |
| `settings_change` | `{ delta, old_settings, new_settings }` |
| `settings_project_change` | `{ delta, old_project, new_project }` |
| `settings_user_change` | `{ delta, old_user, new_user }` |

### Story maps

`story_start`, `story_step`, `story_update`, `story_lock`, `story_close` carry
no payload. `story_read` carries `{ idView }` (the story view being read).

### Example

```javascript
mapx.on("ready", () => { /* safe to call ask() */ });

mapx.on("view_added", ({ idView }) => openViews.add(idView));
mapx.on("view_removed", ({ idView }) => openViews.delete(idView));

// click_attributes fires ONCE PER OPEN VT VIEW per map click, in order
// (part 1..nPart). Collect the batch, then act on the last part:
const clickBatch = new Map();
mapx.on("click_attributes", ({ part, nPart, idView, attributes, lngLat }) => {
  if (part === 1) clickBatch.clear();
  if (attributes?.length) clickBatch.set(idView, attributes);
  if (part === nPart) renderInspection(clickBatch, lngLat);
});
// attributes is [] (not absent) when no feature of that view was hit.
// If no VT view is open, nPart === 0 and the event never fires.

mapx.on("language_change", ({ new_language }) => updateLabels(new_language));
```

### The `message` channel: catching resolver errors

Resolver failures never reject the `ask()` promise (see limitations §9), but
the worker **does** send an error message. Subscribe to it to fail fast or
to log:

```javascript
mapx.on("message", (m) => {
  if (m.level !== "error") return;
  // m.key examples:
  //   "err_resolver_not_found"  vars: { idResolver }   (unknown / wrong-mode resolver)
  //   "err_resolver_failed"     vars: { idResolver, msg } (resolver threw)
  //   "err_view_invalid"        (view_add / filter on an invalid view)
  console.warn("[MapX]", m.key, m.vars, m.text);
});
```

`askWithTimeout` in limitations §9 uses this channel to reject early.

The SDK does not expose native MapLibre map events (`moveend`, `zoomend`, etc.)
to the parent page. For camera tracking, poll
`map({method: "getCenter"})` and `map({method: "getZoom"})`.
