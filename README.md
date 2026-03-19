# MapX LLM Skills

Claude Code skills for developing with the [MapX SDK](https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk), the JavaScript SDK for embedding maps from the [MapX platform](https://app.mapx.org) (UNEP/GRID-Geneva).

## Background

I built these while working on a [proof-of-concept demo](https://github.com/khawkins/mapx-demo-embed) that embeds MapX maps for disaster risk reduction work at UNDRR. The demo started as a simple iframe embed and grew into something more involved as I dug into the SDK.

The MapX SDK documentation is mostly in the [GitHub source](https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk). It's functional but thin. There's no method catalog, no public API for view discovery, and some features only work if you already know the resolver names. I spent a lot of time figuring things out by reading source code and testing, and these skills capture what I learned so the next person doesn't have to repeat it.

A few examples of the kind of things that tripped me up:
- `view_add` fails silently for views outside the current project (no error, no network request)
- `toggle_draw_mode` is referenced in wiki examples but was removed from the SDK
- The postMessage bridge can't pass callbacks, so click interaction on custom layers needs a coordinate-matching workaround
- `map_wait_idle()` has to come before dashboard or filter operations, but nothing tells you that

As of early 2026, MapX doesn't have any LLM skills or AI coding integrations. [Mapbox has some](https://github.com/mapbox/mapbox-agent-skills), so there's precedent for this kind of thing in the geospatial space.

## Skills

### `mapx-sdk-dev` — SDK Development Reference

Auto-invoked when working on code that uses the MapX SDK. Provides:

- Method catalog (48+ resolver methods with signatures and return types)
- SDK initialization patterns (Manager constructor, singleton, ready event)
- View management (add/remove, GeoJSON views, Mapbox passthrough, layer ordering)
- Navigation and display (fly-to, projections, 3D modes, country/region codes)
- Filtering and data (numeric/text filters, transparency, data introspection, export)
- UI controls (language, themes, dashboards, map composer, share modal)
- Known limitations and workarounds (cross-project scope, no native events, click fallbacks)
- Troubleshooting guide organized by symptom

**Example prompts:**
- "Add a new MapX view to the map and show its legend"
- "Filter this vector layer to show only high-risk areas"
- "Set up transparency blending between two raster layers"
- "Why isn't my view_add call doing anything?"

### `mapx-embed-scaffold` — Project Scaffolding

User-invoked (`/mapx-embed-scaffold`). Generates a starter MapX embed project with:

- HTML + CSS sidebar/map layout
- Vite dev server and build configuration
- Modular SDK wrapper files (client, views, filters, map-control, ui)
- State management (openViews tracking)
- View toggle buttons with active state

```
/mapx-embed-scaffold MX-2LD-FBB-58N-ROK-8RH
```

## Installation

### As a local plugin (development)

```bash
# Clone to your projects directory
cd ~/Documents/git
git clone https://github.com/khawkins/mapx-llm-skills.git

# Register as a local plugin in Claude Code
claude plugins add local ./mapx-llm-skills
```

### From GitHub (production)

```bash
claude plugins add github khawkins/mapx-llm-skills
```

## Technical Details

### MapX Platform

- **Platform**: https://app.mapx.org (UNEP/GRID-Geneva)
- **SDK source**: https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk
- **UMD script**: `https://app.mapx.org/sdk/mxsdk.umd.js`
- **Communication**: postMessage bridge (serialized JSON only)
- **Map engine**: Mapbox GL JS (wrapped by MapX, accessible via passthrough)

### SDK Architecture

The MapX SDK uses a **resolver pattern**:
1. Parent page loads `mxsdk.umd.js` and creates a `Manager` instance
2. Manager creates an iframe loading the MapX app for a specific project
3. All communication goes through `window.postMessage`
4. `mapx.ask("resolver_name", {params})` returns Promises
5. Non-serializable values (functions, DOM elements) cannot be passed

### View Types

| Code | Name | Description |
|------|------|-------------|
| `vt` | Vector Tiles | Polygons, points, lines — queryable, filterable |
| `rt` | Raster Tiles | Gridded/continuous data — display only |
| `cc` | Custom Coded | Dynamic/real-time views — JavaScript + API feeds |
| `sm` | Story Map | Narrative presentations with step-by-step navigation |

### Key Limitations

- **Cross-project scope**: `view_add` only works for views in the connected project
- **No native events**: Parent page can't listen to Mapbox `moveend`, `zoomend`, etc.
- **No click callbacks on passthrough layers**: `map.on("click", ...)` not possible
- **No `toggle_draw_mode`**: Was removed from the SDK after 2020; even when it existed, it returned only a boolean and couldn't pass drawn geometry back to the parent page
- **Serialization boundary**: Everything through postMessage must be JSON-serializable

## Resources

- [MapX Platform](https://app.mapx.org)
- [MapX SDK Source](https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk)
- [MapX GitHub](https://github.com/unep-grid/mapx)
- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/api/) (underlying map engine)
- [UNDRR Mangrove Component Library](https://unisdr.github.io/undrr-mangrove/) (UI components used in the demo)

## License

MIT
