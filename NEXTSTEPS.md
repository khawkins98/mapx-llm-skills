# Next Steps

## Testing the skills locally

1. **Load as a local plugin**
   ```bash
   claude --plugin-dir ~/Documents/git/mapx-llm-skills
   ```

2. **Verify skills load** — open a new Claude Code session and check that
   `mapx-sdk-dev` and `mapx-embed-scaffold` appear in the available skills.
   Try `/mapx-embed-scaffold MX-2LD-FBB-58N-ROK-8RH` to confirm the
   scaffolding skill runs.

3. **Test auto-invocation** — open the `mapx-demo-embed` project and ask
   Claude something like "add a new raster view with transparency" or
   "why isn't my view_add working". The `mapx-sdk-dev` skill should
   auto-invoke and inform the response with SDK-specific knowledge.

4. **Test scaffold output** — run the scaffold skill in an empty directory,
   then `npm install && npm run build` to verify the generated project
   compiles. Try `npm run dev` and confirm the iframe loads.

## Runtime verification needed (from the 1.14 source review)

These were derived from reading the `1.14.0-fix.1` source and should be
confirmed against the live SDK, in **both** static and app mode:

- [ ] **Cross-project `view_add`**: the source now fetches unknown IDs via
      `getViewRemote`. Test a public view from another project, a private
      one, and a bogus ID. Record: resolves `true` / `undefined` / hangs?
      Then update limitations §1, AGENTS.md rule 5 and README.
- [ ] **Numeric filter**: confirm `{from, to}` alone is a no-op in app mode
      and `value` works in both.
- [ ] **Text filter**: confirm `values` + `attribute` in static mode, and
      the hang when `attribute` is omitted (potential-issues §6).
- [ ] **Transparency**: confirm static mode treats the number as 0–1 opacity.
- [ ] **`too_many_request`**: confirm the rejected request still executes.
- [ ] **Time filter in app mode**: confirm the slider needs `value`.
- [ ] **`getProjection()` on a fresh map**: `undefined` or `{ type: "mercator" }`?

## Content gaps to fill

- [x] **`set_project` method** — documented in sdk-methods.md and limitations-and-workarounds.md (app mode only, closes views, fires `project_changed`).

- [x] **Event catalog** — full events catalog added to sdk-methods.md (`view_added`, `view_removed`, `view_filter`, `layers_ordered`, `language_change`, `project_changed`, `mapx_connected`, etc.).

- [x] **`get_views` response shape** — documented with full example object structure in sdk-methods.md.

- [x] **`set_panel_left_visibility` & Panels API** — documented in sdk-methods.md and ui-and-modals.md.

- [x] **Static mode** — documented in initialization.md and limitations-and-workarounds.md (loads `/static.html`, no user auth or Shiny, `get_views_with_visible_layer` instead of `get_views_id_open`).

- [x] **Additional MapLibre passthrough methods** — documented in sdk-methods.md.

## Skill refinements

- [ ] **Test with a fresh project** — the skills were written from one
      project's perspective (Eco-DRR). Validate the patterns hold for
      other MapX projects with different view types and configurations.

- [x] **Add `allowed-tools` to scaffold skill** — added Write, Edit, Read,
      Bash(npm/npx/ls/mkdir).

- [ ] **Add settings.local.json** — like the Drupal plugin, define allowed
      web domains (app.mapx.org, github.com/unep-grid/mapx) and tool
      permissions for the plugin context.

- [ ] **Consider a third skill: `mapx-view-discovery`** — a task skill that
      connects to a MapX project, runs `get_views()`, and produces a
      formatted catalog of available views with types and titles. Would
      replace the manual probe-views.html workflow.

## Architecture improvements

- [ ] **Split `mapx-sdk-dev` into smaller skills** — the single auto-invoked
      skill loads ~2,300 lines of reference material into context. Consider
      splitting into focused skills (e.g., `mapx-sdk-init`, `mapx-sdk-views`,
      `mapx-sdk-filters`, `mapx-sdk-nav`, `mapx-sdk-troubleshoot`) with more
      targeted auto-invocation descriptions so only the relevant subset loads.

- [x] **Reduce content duplication** — SKILL.md condensed to a concise index.
      Architecture, view types table, SDK wrapper pattern, and verification
      checklist removed from SKILL.md (canonical in sub-files).

- [x] **Add `allowed-tools` to both skills** — `mapx-sdk-dev` has WebFetch for
      relevant domains; scaffold has Write, Edit, Read, Bash for npm/file ops.

- [x] **Add `.gitignore`** — added (.DS_Store, node_modules/, *.log).

- [ ] **Clean up `.claude/settings.local.json`** — contains author-specific curl
      permissions and a reference to an external `humanizer` skill. Plugin
      settings should be self-contained. Move needed permissions to `allowed-tools`
      in skill frontmatter or `.claude/settings.json`.

## Plugin conventions (inspired by mapbox-agent-skills)

- [x] **Add `"skills": "./skills/"` to plugin.json** — added then removed. Claude Code rejects it with a validation error; Copilot CLI defaults to `skills/` when the field is absent. The field must be omitted for dual compatibility.

- [x] **Add `homepage` and `repository` fields to plugin.json** — done.

- [x] **Add top-level `description` to marketplace.json** — done.

- [x] **Consider `"source": "github"` + `"repo"` in marketplace.json** — not
      needed. `"source": "./"` is correct for a single-plugin repo where the
      marketplace and plugin live together. Remote install works because
      `/plugin marketplace add owner/repo` clones the repo first.

- [x] **Add `keywords` to marketplace.json plugins array** — added matching plugin.json keywords.

- [x] **Add AGENTS.md at repo root** — added machine-readable agent index.

## Documentation fixes

- [x] **Fix installation instructions** — rewrote to use
      `/plugin marketplace add` + `/plugin install` (in-app) and
      `claude plugin install` (CLI). Added `extraKnownMarketplaces`
      for team config.

- [x] **Remove `known_marketplaces.json` manual editing** — replaced with
      `/plugin marketplace add /path` for local and `extraKnownMarketplaces`
      in settings for team configuration.

- [x] **Fix NEXTSTEPS.md local plugin command** — corrected to
      `claude --plugin-dir`.

- [x] **Remove `version` from SKILL.md frontmatter** — removed from both
      skill files.

## Prompt and code quality fixes

- [x] **Document `click_attributes` payload shape** — confirmed from MapX source
      (`app/src/js/map_helpers/index.js`). The event fires **once per open VT view**
      per click with `{part, nPart, idView, attributes, point, lngLat}`. Batch-collect
      until `parts.size === nPart`. Updated in sdk-methods.md Events section.

- [x] **Add concrete numeric filter fallback example** — documented `{from, to}` vs `{value}` dual support in sdk-methods.md and filtering-and-data.md.

- [x] **Fix `toCleanGeoJSON` function** — renamed to `cleanFeatures` with
      a note about wrapping in FeatureCollection if needed.

- [x] **Add MultiPolygon note to point-in-polygon** — added comment noting
      Polygon-only and how to handle MultiPolygon.

- [x] **Document `findNearestFeature` tolerance units** — added comment explaining tolerance is in geographic degrees (~55km at equator).

- [x] **Add `askWithTimeout` to scaffold template** — added defensive timeout wrapper to client.js in embed-scaffold.md.

- [x] **Add `map_wait_idle()` to scaffold's `main.js`** — added sequencing call in embed-scaffold.md.

- [x] **Add CSP/iframe guidance to initialization.md** — documented required CSP headers (`frame-src https://app.mapx.org`).

- [x] **Clarify `set_vector_highlight` vs `set_vector_spotlight`** — documented `set_vector_spotlight` as preferred, noting `set_vector_highlight` as deprecated.

## Broader improvements

- [x] **Version tracking** — updated across files to validate against deployed `v1.14.0-fix.1` (August 2026).

- [x] **Community contribution template** — added CONTRIBUTING.md.

- [x] **Add `safeViewAdd` verification pattern** — added helper using `mapx.on("view_added")` with timeout in limitations-and-workarounds.md.
