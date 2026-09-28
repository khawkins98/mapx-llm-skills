# AGENTS.md

Instructions and index for AI coding assistants (Claude Code, GitHub Copilot CLI, Antigravity, Cursor, etc.) working with this repository and MapX SDK embeds.

## Repository Purpose

This repository provides agent skills and developer documentation for the **MapX JavaScript SDK** (developed by UNEP/GRID-Geneva, hosted at `app.mapx.org`). MapX is an open-source platform for environmental geospatial visualizations.

There is no runtime code or build suite in this repository — all deliverables are Markdown knowledge files consumed at prompt time by LLM coding agents.

## Skill Catalog

| Skill Name | Directory | Trigger Mode | Purpose |
|---|---|---|---|
| `mapx-sdk-dev` | `skills/mapx-sdk-dev` | Auto-invoked | Full reference for developing with the MapX SDK: initialization, resolver catalog, MapLibre GL passthrough, layer management, filtering, and troubleshooting. |
| `mapx-embed-scaffold` | `skills/mapx-embed-scaffold` | User-invoked (`/mapx-embed-scaffold`) | Scaffolds a complete standalone MapX embedding application using Vite, ES6 modules, and event-driven state. |

## Key Technical Domain Rules for Agents

When generating code or advising users on MapX SDK development:

1. **Target SDK Build**: Targets `app.mapx.org/sdk/mxsdk.umd.js` and `mxsdk.modern.js` (`v1.14.0-fix.1`).
2. **Resolver Pattern via postMessage**: All interactions with MapX run through `mapx.ask("resolver_name", { params })` and return Promises. Callbacks, functions, and DOM elements cannot be passed across the bridge.
3. **Underlying Engine**: MapX uses **MapLibre GL JS v5** (since 1.14; it was Mapbox GL JS v2 through 1.13.x). Passthrough calls must use MapLibre v5 signatures — e.g. `setProjection({ type: "globe" })`, not `setProjection("globe")`. The `"map"` resolver exposes map instance methods (`mapx.ask("map", { method: "...", parameters: [...] })`).
4. **Sequencing & Idle**: Always wait for `mapx.on("ready")` before any `ask()` call. `map_wait_idle` only waits while the camera is **moving** (it resolves immediately otherwise, and does not wait for tiles), so call it after a camera move and before rendered-data queries. To wait for a view to load, listen for `view_added`.
5. **View Scope & `view_add` results**: `view_add` resolves `true` on success, `undefined` on failure (with an `err_view_invalid` message), and **never settles** if the view lookup throws. On 1.13.19, cross-project IDs did nothing; the 1.14 source fetches unknown IDs from the API, so the outcome is not yet re-verified. Check `=== true`, guard with a timeout, and confirm with `safeViewAdd` / `view_added`.
6. **Request Concurrency**: `maxSimultaneousRequest` defaults to 10. A call made while more than 10 requests are pending (i.e. the 12th) is rejected with the string `too_many_request <n>. Max= <m>`, **but the request is still sent and executed**. Never blindly retry side-effecting calls after this rejection. Throttle, or raise the option in `new Manager()`.
7. **Spotlight & Feature Highlighting**: Use `set_vector_spotlight` instead of the deprecated `set_vector_highlight`.
8. **Static vs App Mode**: Upstream recommends `static: true` for most embeds. App-only resolvers (`get_views_id_open`, `set_project`, `get_projects`, `table_editor_*`, `move_view_*`, …) **hang** in static mode (they don't reject). The numeric/text filters and transparency read **different params per mode**: app mode reads `value`; static reads `from`/`to` (numeric), `values` + `attribute` (text), or `opacity` 0–1 (transparency; app mode's `value` is 0–100 transparency). Send both forms for portable code.
9. **Unresolved Resolver Errors**: `FrameManager` never settles a request whose resolver failed or doesn't exist. Use `askWithTimeout` (which also listens on `mapx.on("message")` for `err_resolver_*` to fail fast) to guard against hanging promises.
10. **Removed Resolvers**: `toggle_draw_mode` was removed from the SDK after 2020 — do not document or use it.

## Plugin Architecture

```
.claude-plugin/plugin.json       ← Plugin manifest (name, version, description)
.claude-plugin/marketplace.json  ← Required for plugin discovery
skills/
  mapx-sdk-dev/                  ← Skill 1: SDK development reference (auto-invoked)
    SKILL.md                     ← Entry point; YAML frontmatter drives auto-detection
    sdk-methods.md
    initialization.md
    views-and-layers.md
    navigation-and-display.md
    filtering-and-data.md
    ui-and-modals.md
    limitations-and-workarounds.md
    troubleshooting.md
  mapx-embed-scaffold/           ← Skill 2: project scaffolding (user-invoked)
    SKILL.md                     ← Entry point; disable-model-invocation: true
    templates/
      embed-scaffold.md
```

- **`SKILL.md`** is the entry point for each skill. Its YAML frontmatter `description` field controls auto-detection.
- **`plugin.json`** must have `name` in kebab-case and `version` in semver. Do **not** add a `skills` field — Claude Code rejects it with a validation error. Both tools auto-discover skills from the `skills/` directory.

## Editing Guidelines

- When editing skill content, verify all code examples against the patterns above — silent failures and removed methods are the primary defect vector.
- Verify resolver behaviour against the upstream source (`unep-grid/mapx`, `app/src/js/sdk/src/mapx_resolvers/`), and say explicitly whether a claim was **runtime-tested** or **read from source**.
- Run `scripts/check-resolvers.sh` after adding or renaming any `ask("…")` call; it fails if a documented resolver doesn't exist upstream.
- Keep examples compact and copy-pasteable.
- The `README.md` mirrors key facts from the skills; keep it in sync when skill content changes.
- Track updates in `CHANGELOG.md` under `[Unreleased]` or the release version heading.

