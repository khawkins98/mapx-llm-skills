---
name: mapx-sdk-dev
description: >
  Reference skill for developing with the MapX SDK (UNEP/GRID-Geneva).
  Auto-invoked when creating or modifying code that embeds MapX maps,
  manages views, queries geospatial data, or controls the map via the
  SDK's postMessage bridge. Covers the full SDK resolver API, the Mapbox
  GL JS passthrough pattern, GeoJSON overlays, filtering, data export,
  and known limitations.
allowed-tools:
  - WebFetch(domain:app.mapx.org)
  - WebFetch(domain:github.com)
  - WebFetch(domain:raw.githubusercontent.com)
  - WebFetch(domain:docs.mapbox.com)
---

# MapX SDK Development Guide

This skill is a reference for building applications that embed MapX maps
via the JavaScript SDK.

## SDK version context

This skill was developed and tested against the deployed MapX SDK at
`app.mapx.org/sdk/mxsdk.umd.js` (embedded version string **1.13.19**)
during **March 2026**. The SDK does not pin versions in its UMD URL, so
the deployed version may change without notice.

The GitHub source on the `main` branch (`@fxi/mxsdk` 1.9.40-alpha.1)
does not match the deployed build. Where method signatures or behavior
differ between the source and what was observed at runtime, this skill
documents the observed behavior and notes the discrepancy.

If a method documented here doesn't work as described, the deployed SDK
may have changed. Check the [SDK source](https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk)
(note: default branch is `main`, not `master`).

## What is MapX?

MapX is an open-source geospatial platform managed by UNEP/GRID-Geneva
for sustainable development and environmental monitoring. The SDK allows
embedding MapX maps in external websites with programmatic control over
views, layers, navigation, and data.

- Platform: https://app.mapx.org
- SDK source: https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk
- UMD script: `https://app.mapx.org/sdk/mxsdk.umd.js`

## Architecture

The SDK uses a **postMessage bridge**: the parent page loads `mxsdk.umd.js`,
creates a `Manager` that embeds an iframe, and all communication goes through
`window.postMessage` as serialized JSON. `mapx.ask("resolver_name", {params})`
returns Promises. See [initialization.md](initialization.md) for full details.

**Critical constraint**: You **cannot** pass functions, callbacks, DOM elements,
or any non-serializable value through the bridge. See
[limitations-and-workarounds.md](limitations-and-workarounds.md) for workarounds.

## Reference Files

- [sdk-methods.md](sdk-methods.md) — Resolver catalog with signatures, return types, and usage notes
- [initialization.md](initialization.md) — Manager constructor, project setup, iframe configuration
- [views-and-layers.md](views-and-layers.md) — View lifecycle, GeoJSON views, Mapbox passthrough, layer ordering
- [navigation-and-display.md](navigation-and-display.md) — Camera control, projections, 3D modes, country navigation
- [filtering-and-data.md](filtering-and-data.md) — Numeric/text filters, transparency, data introspection, export
- [ui-and-modals.md](ui-and-modals.md) — Language, themes, dashboards, modals, vector highlight
- [limitations-and-workarounds.md](limitations-and-workarounds.md) — Cross-project views, event limitations, click fallbacks, known quirks
- [troubleshooting.md](troubleshooting.md) — Common issues organized by symptom

## Key Rules

- Always wait for the `ready` event before making SDK calls
- Call `map_wait_idle()` before dashboard/filter/data operations
- View IDs must belong to the connected project (cross-project calls fail silently)
- View types and their capabilities are documented in [views-and-layers.md](views-and-layers.md)
