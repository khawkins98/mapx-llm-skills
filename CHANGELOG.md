# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-09-28

### Added
- **Upstream MapX v1.14.0-fix.1 sync**: Validated against deployed SDK release (August 2026).
- **MapLibre GL JS engine transition**: Updated documentation and code annotations to MapLibre GL JS, with Mapbox GL v1 API compatibility guidance.
- **Events Catalog**: Full reference for all postMessage events emitted by MapX (`view_added`, `view_removed`, `view_filter`, `layers_ordered`, `language_change`, `project_changed`, `mapx_connected`, `mapx_disconnected`, `spotlight_update`, `story_step`).
- **Panels Resolver API**: Documented `MapxResolversPanels` (`panels_batch`, `panels_state`, `panels_list`, `panels_open_all`, `panels_close_all`, `panels_show_all`, `panels_hide_all`, `panels_is_open`, `panels_is_visible`).
- **New & clarified resolvers**:
  - `set_vector_spotlight` (preferred over deprecated `set_vector_highlight`).
  - `set_highlighter`, `update_highlighter`, `reset_highlighter`, and `set_country_highlight`.
  - `set_project` lifecycle behavior and `get_views` response structure.
  - Clarified numeric filter dual syntax (`{from, to}` vs `{value: [min, max]}`).
- **Scaffold resilience**:
  - Added `askWithTimeout` helper in `embed-scaffold.md` to prevent hanging on resolver drops.
  - Added `map_wait_idle()` sequencing after `ready`.
  - Replaced optimistic store mutations with `view_added` / `view_removed` listeners.
- **Agent standard**: Added `AGENTS.md` machine-readable skill index at repository root and symlinked `CLAUDE.md`.
- **Security & limits**: Documented `maxSimultaneousRequest: 10` queue limits, `safeViewAdd` pattern, and Content-Security-Policy (CSP) header requirements.

### Fixed
- **API signatures**: Corrected `get_views_with_visible_layer` return type from object array to string array (`["MX-..."]`), `language_change` payload property to `new_language`, and `set_country_highlight` direct array argument signature.
- **Tool permissions**: Added `Read`, `Edit`, `Write`, `Grep`, `Glob` to `mapx-sdk-dev/SKILL.md` `allowed-tools` to prevent agent tool lockout.
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
