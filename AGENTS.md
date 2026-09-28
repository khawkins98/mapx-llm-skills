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

1. **Resolver Pattern via postMessage**: All interactions with MapX run through `mapx.ask("resolver_name", { params })` and return Promises. Callbacks, functions, and DOM elements cannot be passed across the bridge.
2. **Underlying Engine**: MapX uses **MapLibre GL JS** (compatible with Mapbox GL JS v1 API). The `"map"` resolver exposes map instance methods (`mapx.ask("map", { method: "...", parameters: [...] })`).
3. **Sequencing & Idle**: Always await `mapx.on("ready")` before any `ask()` calls, and await `mapx.ask("map_wait_idle")` before data introspection, dashboards, or filtering.
4. **View Scope**: View IDs (`MX-...`) belong to specific projects. Calling `view_add` with an ID from a different project fails silently without throwing an error. Always verify using the `safeViewAdd` pattern or listen to `mapx.on("view_added")`.
5. **Request Concurrency**: The SDK defaults to `maxSimultaneousRequest: 10`. Calling `Promise.all` across more than 10 unresolved promises will trigger `too_many_request`. Batch or raise this option in `new Manager()`.
6. **Spotlight & Feature Highlighting**: Use `set_vector_spotlight` instead of the deprecated `set_vector_highlight`.
7. **Static Mode Differences**: With `static: true` (or `/static.html`), `get_views_id_open` does not exist. Use `get_views_with_visible_layer` instead.
