# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A Claude Code and GitHub Copilot CLI plugin providing skills for the MapX SDK. There is no build system, test suite, or runtime code — the deliverables are Markdown knowledge files consumed by the AI tool at prompt time.

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

- **`SKILL.md`** is the entry point for each skill. Its YAML frontmatter `description` field controls auto-detection — both Claude Code and Copilot CLI match user intent against this text to decide when to load the skill.
- Supporting `.md` files in each skill directory are referenced from `SKILL.md` and provide detailed reference material.
- **`plugin.json`** must have `name` in kebab-case and `version` in semver. Do **not** add a `skills` field — Claude Code rejects it with a validation error. Both tools auto-discover skills from the `skills/` directory.

## MapX Domain Knowledge

All content targets the MapX SDK deployed at `app.mapx.org/sdk/mxsdk.umd.js` (version string 1.13.19 as of March 2026). The SDK uses a postMessage bridge — all calls go through `mapx.ask("resolver_name", {params})` and return Promises.

Key facts to preserve in skill content:
- SDK uses a **resolver pattern** via postMessage — functions and DOM elements cannot be passed
- `view_add` fails silently for views outside the connected project
- `map_wait_idle()` must be called before dashboard, filter, or data operations
- `toggle_draw_mode` was removed from the SDK after 2020 — do not document it
- `get_view_source_summary` can hang forever on failure — the FrameManager never rejects on resolver failure (known bug)

## Editing Guidelines

- When editing skill content, verify all code examples against the patterns above — silent failures and removed methods are the primary defect vector.
- Keep examples compact and copy-pasteable.
- The README.md mirrors key facts from the skills; keep it in sync when skill content changes.
- Do not add a `skills` field to `plugin.json` — it must be omitted for Claude Code compatibility.
