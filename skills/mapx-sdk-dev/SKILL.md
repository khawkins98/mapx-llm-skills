---
name: mapx-sdk-dev
description: >
  Reference skill for developing with the MapX SDK (UNEP/GRID-Geneva).
  Auto-invoked when creating or modifying code that embeds MapX maps,
  manages views, queries geospatial data, or controls the map via the
  SDK's postMessage bridge. Covers the full SDK resolver API, the MapLibre
  GL JS passthrough pattern, GeoJSON overlays, filtering, data export,
  and known limitations.
allowed-tools:
  - Read
  - Grep
  - Glob
  - WebFetch(domain:app.mapx.org)
  - WebFetch(domain:github.com)
  - WebFetch(domain:raw.githubusercontent.com)
  - WebFetch(domain:maplibre.org)
  - WebFetch(domain:docs.mapx.org)
  - WebFetch(domain:docs.mapbox.com)
---

# MapX SDK Development Guide

This skill is a reference for building applications that embed MapX maps
via the JavaScript SDK.

## SDK version context

This skill was first runtime-tested against the deployed MapX SDK
**1.13.19** (March 2026). It was then re-checked against the upstream
source at tag **1.14.0-fix.1**, which is the version deployed at
`app.mapx.org/sdk/mxsdk.umd.js` / `mxsdk.modern.js` as of September 2026.
The key 1.14 behaviours (static vs app parameters, cross-project views,
hanging resolvers, request ceiling, projections, `set_project`) were then
**runtime-verified on 2026-09-28** in both modes with `tests/runtime/`.
Anything still based only on the source is marked as such. The SDK does not pin versions in its CDN
URLs, so the deployed version may change without notice. The npm package
`@fxi/mxsdk` lags behind (latest `1.13.14-alpha.10`); load the SDK from
`app.mapx.org` so the Manager matches the deployed worker.

The SDK is developed in the `unep-grid/mapx` repository on GitHub (`main`
branch) under `app/src/js/sdk`.

**Coming in the next release** (seen on `staging` 1.14.1-alpha.17,
runtime-checked 2026-09-28): failed or unknown resolvers **reject** with a
`MapxSdkError` instead of hanging, the Manager gets a `requestTimeoutMs`
option (default 120 s), and a call over `maxSimultaneousRequest` is rejected
with an `Error` and **not** executed. Code that guards calls with
`askWithTimeout` works on both. Check the deployed version with
`mapx.version`, and don't rely on the prod-only hang behaviour.

**Map engine**: MapX switched from Mapbox GL JS v2 to **MapLibre GL JS v5**
in April 2026 (shipped in 1.14). Passthrough (`"map"` resolver) calls must use
MapLibre v5 signatures. Most camera/source/layer calls are unchanged, but
some differ, e.g. `setProjection({ type: "globe" })` instead of
`setProjection("globe")`.

If a method documented here doesn't work as described, check the
[SDK source](https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk)
(default branch `main`).

## What is MapX?

MapX is an open-source geospatial platform managed by UNEP/GRID-Geneva
for sustainable development and environmental monitoring. The SDK allows
embedding MapX maps in external websites with programmatic control over
views, layers, navigation, and data.

- Platform: https://app.mapx.org
- Documentation: https://docs.mapx.org
- SDK source: https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk
- ES6 module: `https://app.mapx.org/sdk/mxsdk.modern.js`
- UMD script: `https://app.mapx.org/sdk/mxsdk.umd.js`
- Catalogue search: `search.mapx.org` (MeiliSearch, requires API key -- see limitations §12)

## Architecture

The SDK uses a **postMessage bridge**: the parent page loads `mxsdk.umd.js`,
creates a `Manager` that embeds an iframe, and all communication goes through
`window.postMessage` as serialized JSON. `mapx.ask("resolver_name", {params})`
returns Promises. See [initialization.md](initialization.md) for full details.

**Critical constraint**: You **cannot** pass functions, callbacks, DOM elements,
or any non-serializable value through the bridge. See
[limitations-and-workarounds.md](limitations-and-workarounds.md) for workarounds.

## Reference Files

- [sdk-methods.md](sdk-methods.md) — Resolver catalog with signatures, return types, static/app differences, and the events catalog
- [initialization.md](initialization.md) — Manager constructor, project setup, iframe configuration
- [views-and-layers.md](views-and-layers.md) — View lifecycle, GeoJSON views, MapLibre passthrough, layer ordering
- [navigation-and-display.md](navigation-and-display.md) — Camera control, projections, 3D modes, country navigation
- [filtering-and-data.md](filtering-and-data.md) — Numeric/text filters, transparency, data introspection, export
- [ui-and-modals.md](ui-and-modals.md) — Language, themes, dashboards, modals, spotlight/highlighter, panels
- [limitations-and-workarounds.md](limitations-and-workarounds.md) — Hanging promises (`askWithTimeout`), static vs app mode, cross-project views, request ceiling, event limitations, click fallbacks, REST API auth, MeiliSearch catalogue API
- [troubleshooting.md](troubleshooting.md) — Common issues organized by symptom

## Key Rules

- Always wait for the `ready` event before making SDK calls
- A failing or unknown resolver makes `ask()` **hang**, never reject: wrap calls with `askWithTimeout` (limitations §9)
- Filters read different params in static vs app mode: send `value` **and** `from`/`to` (numeric) or `value` **and** `values` + `attribute` (text)
- Prefer `static: true` unless you need app-only features (login, `set_project`, view list management)
- Call `map_wait_idle()` after camera moves and before rendered-data queries (it does not wait for tiles)
- Check `view_add` returned `=== true`, and confirm with the `view_added` event (public views from other projects load on 1.14; bogus IDs hang)
- Passthrough uses MapLibre v5: `setProjection({ type: "globe" })`; the string form is silently ignored
- Keep `map_fly_to` durations under 10 s (longer flights make the call hang)
- View types and their capabilities are documented in [views-and-layers.md](views-and-layers.md)
