# MapX LLM Skills

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) that provides skills for developing with the [MapX SDK](https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk), the JavaScript SDK for embedding maps from the [MapX platform](https://app.mapx.org) (UNEP/GRID-Geneva).

This is primarily built for [Claude Code](https://code.claude.com), but the skill content is plain markdown with code examples. If you use another AI coding tool that supports loading markdown context files (Cursor rules, Windsurf, Copilot instructions, etc.), you can point it at the files in `skills/mapx-sdk-dev/` to get the same SDK reference material.

## Background

I put these skills together while embedding MapX maps for disaster risk reduction work at UNDRR. The project started as a simple iframe embed and grew more involved as I explored the SDK.

The MapX SDK has [documentation in the GitHub source](https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk), including a README and inline code comments. That said, there are some gaps — there's no standalone method catalog, no public API for view discovery, and some features are easier to find if you already know the resolver names. These skills try to fill in those gaps based on what I've learned from reading the source and testing.

A few examples of things I had to figure out by experimentation:
- `view_add` fails silently for views outside the current project (no error, no network request)
- `toggle_draw_mode` is referenced in older wiki examples but was removed from the SDK
- The postMessage bridge can't pass callbacks, so click interaction on custom layers needs a coordinate-matching workaround
- `map_wait_idle()` has to come before dashboard or filter operations, but this isn't always obvious from the docs

**A note on accuracy:** I'm relatively new to MapX, and the MapX developers at UNEP/GRID-Geneva will know the platform far better than I do. If you spot something wrong or outdated in these skills, please open an issue — corrections are very welcome.

As of early 2026, MapX doesn't have its own LLM skills or AI coding integrations. [Mapbox has agent skills](https://github.com/mapbox/mapbox-agent-skills) (MapX uses Mapbox GL JS under the hood), so there's precedent for this kind of thing in the geospatial space.

## Skills

### `mapx-sdk-dev` — SDK Development Reference

Auto-invoked when working on code that uses the MapX SDK. Provides:

- Method catalog (30+ resolver methods with signatures and return types)
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

### From GitHub (recommended)

Inside Claude Code, register this repo as a marketplace and install:

```
/plugin marketplace add khawkins98/mapx-llm-skills
/plugin install mapx-llm-skills@khawkins98-mapx-llm-skills
```

Or equivalently from the shell:

```bash
claude plugin install mapx-llm-skills@khawkins98-mapx-llm-skills
```

### Local development

If you've cloned this repo locally, you can load it for a single session:

```bash
claude --plugin-dir /path/to/mapx-llm-skills
```

Or register it as a local marketplace so it persists:

```
/plugin marketplace add /path/to/mapx-llm-skills
/plugin install mapx-llm-skills@khawkins98-mapx-llm-skills
```

### Team/project configuration

To enable this plugin for all collaborators on a project, add both the marketplace and plugin to the project's `.claude/settings.json` and commit it:

```json
{
  "extraKnownMarketplaces": {
    "khawkins98-mapx-llm-skills": {
      "source": {
        "source": "github",
        "repo": "khawkins98/mapx-llm-skills"
      }
    }
  },
  "enabledPlugins": {
    "mapx-llm-skills@khawkins98-mapx-llm-skills": true
  }
}
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

## Making your own Claude Code plugin

If you're thinking about building a skills plugin for another SDK or platform, here's what I learned putting this one together. The plugin system is relatively new (as of March 2026) and the documentation is still catching up, so this may save you some time.

### What's what

Claude Code uses the word "plugin" for the package format and "skill" for the individual pieces of knowledge inside it. A plugin can also contain agents, commands, hooks, and MCP server configs — but skills are the most common thing. A skill is just a markdown file that gets loaded into Claude's context when it's relevant.

### File structure

```
your-plugin/
├── .claude-plugin/
│   ├── plugin.json            # Plugin identity
│   └── marketplace.json       # Required for discovery — easy to miss
├── skills/
│   └── your-skill/
│       ├── SKILL.md           # Skill definition (frontmatter + instructions)
│       └── reference-file.md  # Optional supporting docs
├── agents/                    # Optional
├── commands/                  # Optional
└── README.md
```

The `skills/`, `agents/`, and `commands/` directories go at the repo root, not inside `.claude-plugin/`.

### plugin.json

Minimal version:

```json
{
  "name": "your-plugin-name"
}
```

The `name` field is the plugin identifier. It shows up in `enabledPlugins` settings and gets used as a namespace for skills (e.g. `/your-plugin-name:skill-name`).

### marketplace.json

This is the file I didn't know I needed. Without it, Claude Code finds your directory but can't resolve the plugins inside it. It goes in `.claude-plugin/` alongside `plugin.json`:

```json
{
  "name": "your-marketplace-id",
  "owner": {
    "name": "Your Name"
  },
  "plugins": [
    {
      "name": "your-plugin-name",
      "source": "./",
      "description": "What this plugin does",
      "version": "1.0.0"
    }
  ]
}
```

The `name` here is the marketplace ID. If your repo is `github.com/you/my-plugin`, a reasonable convention is `you-my-plugin` for the marketplace name. The plugin `name` in the array must match the `name` in your `plugin.json`.

### SKILL.md format

```markdown
---
name: your-skill
description: >
  When Claude should use this skill. Be specific — this text
  determines whether the skill gets auto-invoked.
---

# Your Skill

Instructions and reference material go here. Claude reads this
when the skill is active.
```

Set `disable-model-invocation: true` in the frontmatter if the skill should only be triggered manually (via `/plugin-name:skill-name`), not auto-invoked.

### Testing locally

The fastest way to test during development:

```bash
claude --plugin-dir /path/to/your-plugin
```

This loads the plugin for a single session without any registration.

### Gotchas I hit

- **marketplace.json is not optional.** Even for a single-plugin repo. Claude Code needs it to resolve plugin names within a marketplace.
- **Names must align across files.** The plugin `name` in `plugin.json`, the plugin `name` in the `marketplace.json` plugins array, and the reference in `enabledPlugins` settings all need to match.
- **`--plugin-dir` is your friend.** Use it for quick iteration. Don't bother with marketplace registration until you're ready to share.
- **Skills go at the repo root.** Putting `skills/` inside `.claude-plugin/` doesn't work — Claude Code won't find them.
- **The plugin cache can go stale.** If you're changing structure and things aren't updating, check `~/.claude/plugins/cache/` — you may need to clear your plugin's cached copy and `/reload-plugins`.

### Sources

As of March 2026, the plugin system is still evolving. Here's where to find current documentation:

- [Plugins overview](https://code.claude.com/docs/en/plugins) — creating and using plugins
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference) — `plugin.json` and `marketplace.json` schemas
- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) — distribution and registration
- [claude-plugins-official](https://github.com/anthropics/claude-plugins-official) — Anthropic's official plugins, good structural reference

## Resources

- [MapX Platform](https://app.mapx.org)
- [MapX SDK Source](https://github.com/unep-grid/mapx/tree/main/app/src/js/sdk)
- [MapX GitHub](https://github.com/unep-grid/mapx)
- [Mapbox GL JS Docs](https://docs.mapbox.com/mapbox-gl-js/api/) (underlying map engine)
- [Mapbox Agent Skills](https://github.com/mapbox/mapbox-agent-skills) (similar plugin for the Mapbox ecosystem)

## License

MIT
