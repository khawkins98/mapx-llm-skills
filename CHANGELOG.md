# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-09-28

### Added
- **Upstream MapX v1.14.0-fix.1 sync**: Resolver signatures and behaviour re-checked against the upstream source at tag `1.14.0-fix.1` (deployed August 2026). Behaviour that was read from source but not runtime-tested is marked as such in the skills.
- **MapLibre GL JS engine transition**: MapX moved from Mapbox GL JS v2 to MapLibre GL JS v5 in April 2026 (shipped in 1.14). Docs and passthrough examples now use MapLibre v5 signatures (e.g. `setProjection({ type: "globe" })`).
- **Events Catalog**: Every event MapX fires (all are forwarded to the SDK), with payloads taken from source: view lifecycle, filters/legends, spotlight, settings, session, story maps, plus the `message` channel for resolver errors.
- **Panels Resolver API**: Documented `MapxResolversPanels` (`panels_batch`, `panels_state`, `panels_list`, `panels_open_all`, `panels_close_all`, `panels_show_all`, `panels_hide_all`, `panels_is_open`, `panels_is_closed`, `panels_is_visible`, `panels_is_hidden`).
- **New & clarified resolvers**:
  - `set_vector_spotlight` (preferred over deprecated `set_vector_highlight`).
  - `set_highlighter`, `update_highlighter`, `reset_highlighter`, and `set_country_highlight`.
  - `set_project` lifecycle behavior and `get_views` response structure.
  - Static vs app mode parameter differences for the numeric, text and time filters and for transparency; portable call forms.
  - `get_sdk_methods`, `view_add` `zoomToView` and return values, `get_view_layer_filter_*`, `set_view_layer_filter_time`, legend state resolvers, `common_loc_get_bbox`, `get_views_id`/`get_views_title`, `get_immersive_mode`, `move_view_*`, `download_view_source_*`, `get_view_meta_vt_attribute`.
- **Scaffold resilience**:
  - `askWithTimeout` helper that also fails fast on `err_resolver_*` messages.
  - Static mode by default (upstream's recommendation), with a `STATIC_MODE` flag.
  - Store driven by `view_added` / `view_removed`, seeded from `get_views_with_visible_layer`; `view_add` result checked with `=== true`.
  - Added the previously missing `sdk/filters.js`, `sdk/ui.js` and `ui/log.js` templates, plus discovery mode when no views are configured.
- **Agent standard**: Added `AGENTS.md` machine-readable skill index at repository root and symlinked `CLAUDE.md`.
- **Security & limits**: Documented the `maxSimultaneousRequest` ceiling (including that rejected requests still execute), the `safeViewAdd` pattern, and Content-Security-Policy (CSP) header requirements.
- **Tooling**: `scripts/check-resolvers.sh` checks every documented resolver name against the upstream source.

### Fixed
- **API signatures**: Corrected `get_views_with_visible_layer` return type from object array to string array (`["MX-..."]`), `language_change` payload property to `new_language`, and `set_country_highlight` direct array argument signature.
- **Tool permissions**: `mapx-sdk-dev` `allowed-tools` lists only read-only tools (`Read`, `Grep`, `Glob`, scoped `WebFetch`). `allowed-tools` pre-approves tools while the skill is active, so an auto-invoked reference skill should not pre-approve `Edit`/`Write`.
- **Corrections from source review**: resolvers missing in static mode hang rather than reject; `map_wait_idle` only waits while the camera moves; `view_add` resolves `undefined` on failure and fetches unknown IDs remotely in 1.14 (cross-project claim marked for runtime re-test); `set_project` return values and dialogs; `map_set_bounds_array` semantics; spotlight is not required for `click_attributes`; invented `get_views` fields removed.
- **Promise lifecycle & memory**: Added `clearTimeout` cleanup in `askWithTimeout`, refactored `safeViewAdd` away from async promise executor anti-pattern, and eliminated DOM thrashing in scaffold `view-buttons.js`.

## [1.1.0] - 2026-04-08

### Added
- **GitHub Copilot CLI compatibility**: Added `allowed-tools` frontmatter and dual-format invocation instructions.
- Documented `click_attributes` batching payload structure (`part`, `nPart`, `idView`, `attributes`, `lngLat`).
- Documented `raster-as-VT` views and float32 GDAL no-data sentinel values.
- Documented `set_features_click_sdk_only` resolver.

## [1.0.0] - 2026-03-24

### Added
- Initial release of Claude Code plugin for MapX SDK.
- `mapx-sdk-dev`: Full reference skill covering initialization, view lifecycle, camera navigation, filtering, modals, and known limitations.
- `mapx-embed-scaffold`: Standalone project scaffolding for Vite-powered MapX embeds.
