# MapX LLM Skills

Claude Code skills for developing with the [MapX SDK](https://github.com/unep-grid/mapx/tree/master/app/src/js/sdk) — the JavaScript SDK for embedding interactive geospatial maps from the [MapX platform](https://app.mapx.org) (UNEP/GRID-Geneva).

## Origin Story

These skills grew out of a hands-on exploration of what's possible with MapX embeddings. In early 2026, while investigating the capabilities of the MapX geospatial platform for disaster risk reduction (DRR) work at UNDRR, I built a proof-of-concept demo that embeds MapX maps using the SDK. The demo evolved from a simple iframe embed into a full-featured application with 11 curated DRR views, multi-layer scenario workflows, custom data overlays (both SDK-managed and Mapbox passthrough), analysis tools (filtering, spatial queries, statistics, export), and several SDK features that the platform itself barely documents.

Along the way, I discovered that while [Mapbox has published agent skills](https://github.com/mapbox/mapbox-agent-skills) and an [MCP DevKit](https://www.mapbox.com/blog/the-mapbox-mcp-devkit-equip-ai-coding-tools-with-geospatial-skills-for-mapbox-development) for AI coding tools, **MapX has zero LLM skills, plugins, or AI integrations of any kind**. The SDK documentation lives in the [GitHub source](https://github.com/unep-grid/mapx/tree/master/app/src/js/sdk) and is sparse — there's no public REST API for view discovery, no formal method catalog, and several features that only work if you already know the resolver names.

The knowledge captured in these skills was hard-won through trial and error:
- Discovering that cross-project `view_add` fails silently (no error, no network request, nothing)
- Learning that `toggle_draw_mode` doesn't exist despite being referenced in wiki examples
- Building coordinate matching fallbacks because the postMessage bridge can't pass click handler callbacks
- Figuring out that `map_wait_idle()` must precede any dashboard or filter operation
- Working out that `getLayer`/`getSource` return values are unreliable through postMessage serialization

Rather than letting this knowledge stay locked in one project, I packaged it as reusable Claude Code skills so any MapX embedding project can benefit.

The reference demo that generated this knowledge lives at [mapx-demo-embed](https://github.com/khawkins/mapx-demo-embed).

## Skills

### `mapx-sdk-dev` — SDK Development Reference

Auto-invoked when working on code that uses the MapX SDK. Provides:

- Complete method catalog (48+ resolver methods with signatures and return types)
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

User-invoked (`/mapx-embed-scaffold`). Generates a complete MapX embed project with:

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
- **SDK source**: https://github.com/unep-grid/mapx/tree/master/app/src/js/sdk
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
- **No `toggle_draw_mode`**: Referenced in docs but doesn't exist
- **Serialization boundary**: Everything through postMessage must be JSON-serializable

## Resources

- [MapX Platform](https://app.mapx.org)
- [MapX SDK Source](https://github.com/unep-grid/mapx/tree/master/app/src/js/sdk)
- [MapX GitHub](https://github.com/unep-grid/mapx)
- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/api/) (underlying map engine)
- [UNDRR Mangrove Component Library](https://unisdr.github.io/undrr-mangrove/) (UI components used in the demo)

## License

MIT
