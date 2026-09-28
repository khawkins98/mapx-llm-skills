---
name: mapx-embed-scaffold
disable-model-invocation: true
description: >
  Generate a complete MapX embed project scaffold. Creates HTML, CSS, and
  modular JavaScript files for embedding a MapX map with view management,
  SDK wrappers, and optional features (filtering, custom data, analysis).
  Invoke with a project ID and optional view IDs.
argument-hint: <project-id> [view-ids...]
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(npm *)
  - Bash(npx *)
  - Bash(ls *)
  - Bash(mkdir *)
---

# MapX Embed Scaffold Generator

Generate a production-ready MapX embed project from a project ID and
optional view configuration.

## What to generate

When invoked, create the following file structure:

```
project-root/
├── index.html              # Main page with sidebar + map layout
├── package.json            # Vite dev server + build config
├── vite.config.js          # Vite configuration
└── src/
    ├── main.js             # Entry point: SDK init, ready handler, event wiring
    ├── styles/
    │   └── app.css         # Sidebar + map layout, component styles
    ├── config/
    │   └── views.js        # View IDs, labels, and type metadata
    ├── state/
    │   └── store.js        # Global state (openViews set, custom data registry)
    ├── sdk/
    │   ├── client.js       # Manager singleton (initSDK / getSDK)
    │   ├── map-control.js  # Navigation, projection, 3D modes
    │   ├── views.js        # view_add, view_remove, GeoJSON views
    │   ├── filters.js      # Numeric/text filters, transparency
    │   └── ui.js           # Language, theme, dashboard, modals
    └── ui/
        ├── log.js          # Debug log overlay
        └── view-buttons.js # View toggle buttons with active state
```

## Architecture rules

1. **SDK wrappers are thin**: One function per resolver, returns the
   Promise directly. Group by theme (views, filters, ui, map-control).

2. **State lives in store.js**: Track openViews as a `Set`, custom data
   in an array registry. Use setter functions for live module bindings.

3. **UI modules are self-contained**: Each module owns its DOM elements
   and event listeners. Import SDK wrappers and store, export an
   `enable*()` or `init*()` function called from main.js.

4. **Comments are thorough**: Document SDK method names, parameter
   shapes, return types, and known gotchas inline. This codebase will
   be used as a reference for production implementations.

5. **Every `ask()` goes through `askWithTimeout`**: resolver failures and
   unknown resolvers never settle the SDK promise. The wrapper fails fast
   on the worker's `err_resolver_*` messages and times out otherwise.

6. **State follows events, not calls**: `openViews` is updated only from
   `view_added` / `view_removed`, and seeded from
   `get_views_with_visible_layer` on `ready`.

7. **Static mode by default** (`STATIC_MODE = true` in `client.js`), as
   upstream recommends. Filter and transparency wrappers send both the
   app-mode and static-mode parameter forms, so flipping the flag doesn't
   break them. Switch to app mode only if the user needs app-only
   resolvers (`set_project`, login, view-list management); those hang in
   static mode.

## Template

See [templates/embed-scaffold.md](templates/embed-scaffold.md) for the
complete file templates with boilerplate code.

## Steps

1. Read the user's project ID from `$ARGUMENTS`
2. If view IDs are provided, include them in `config/views.js`
3. If no views are given, leave `CURATED_VIEWS` empty: the template's
   `main.js` then runs in discovery mode and logs the project's views
4. Generate all files following the architecture rules above
5. Verify: `npm install && npm run build` should succeed
6. Tell the user to run `npm run dev` and open the local URL

## Configuration

The scaffold should use:
- Vite 6+ for dev server and build
- No framework — vanilla ES modules
- The UNDRR Mangrove CSS library for UI consistency (optional, suggest it)
- SDK loaded via `<script>` tag from `app.mapx.org/sdk/mxsdk.umd.js`
