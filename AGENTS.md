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
3. **Underlying Engine**: MapX uses **MapLibre GL JS** (compatible with Mapbox GL JS v1 API). The `"map"` resolver exposes map instance methods (`mapx.ask("map", { method: "...", parameters: [...] })`).
4. **Sequencing & Idle**: Always await `mapx.on("ready")` before any `ask()` calls, and await `mapx.ask("map_wait_idle")` before data introspection, dashboards, or filtering.
5. **View Scope**: View IDs (`MX-...`) belong to specific projects. Calling `view_add` with an ID from a different project fails silently without throwing an error. Always verify using the `safeViewAdd` pattern or listen to `mapx.on("view_added")`.
6. **Request Concurrency**: The SDK defaults to `maxSimultaneousRequest: 10`. Calling `Promise.all` across more than 10 unresolved promises will trigger `too_many_request`. Batch or raise this option in `new Manager()`.
7. **Spotlight & Feature Highlighting**: Use `set_vector_spotlight` instead of the deprecated `set_vector_highlight`.
8. **Static Mode Differences**: With `static: true` (or `/static.html`), `get_views_id_open` does not exist. Use `get_views_with_visible_layer` instead.
9. **Unresolved Resolver Errors**: `FrameManager` never rejects failed requests on internal resolver errors; use `askWithTimeout` to guard against hanging promises.
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
- Keep examples compact and copy-pasteable.
- The `README.md` mirrors key facts from the skills; keep it in sync when skill content changes.
- Track updates in `CHANGELOG.md` under `[Unreleased]` or the release version heading.

