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

## Content gaps to fill

- [ ] **`set_project` method** — we know it exists but haven't tested it.
      Document the behavior (does it preserve state? how long does reload
      take? does `ready` fire again?). Add to sdk-methods.md and
      limitations-and-workarounds.md.

- [ ] **Event catalog** — we only documented `ready` and `click_attributes`.
      The SDK likely has more events (`view_added`, `view_removed`,
      `language_change`, etc.). Probe the SDK source or test empirically
      and expand the events section in sdk-methods.md.

- [ ] **`get_views` response shape** — we use this in probe-views.html but
      haven't documented the full return object structure. Add example
      output to sdk-methods.md.

- [x] **`set_panel_left_visibility`** — now documented in sdk-methods.md.

- [ ] **Static mode** — the Manager constructor accepts `static: true` to
      load a lighter MapX page. Document what features are available/missing
      in static mode.

- [ ] **Additional Mapbox passthrough methods** — we wrap a handful but the
      full Mapbox GL JS API is available. Consider documenting the most
      useful ones: `setCenter`, `setBearing`, `setPitch`, `fitBounds`,
      `querySourceFeatures`, `getStyle`, `setPaintProperty`.

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

- [x] **Add `"skills": "./skills/"` to plugin.json** — done.

- [x] **Add `homepage` and `repository` fields to plugin.json** — done.

- [x] **Add top-level `description` to marketplace.json** — done.

- [x] **Consider `"source": "github"` + `"repo"` in marketplace.json** — not
      needed. `"source": "./"` is correct for a single-plugin repo where the
      marketplace and plugin live together. Remote install works because
      `/plugin marketplace add owner/repo` clones the repo first.

- [ ] **Add `keywords` to marketplace.json plugins array** — currently only
      in plugin.json, which may not be picked up for marketplace search.

- [ ] **Add AGENTS.md at repo root** — Mapbox uses this as an AI-readable
      index of all skills. Helps agents understand what's available without
      reading every SKILL.md.

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

- [ ] **Document `click_attributes` payload shape** — the event payload
      description is too vague for an LLM to extract coordinates. Add at
      minimum the property names for coordinates (e.g., `point`, `lngLat`).

- [ ] **Add concrete numeric filter fallback example** — the dual-parameter
      ambiguity (`from`/`to` vs `value`) needs a commented-out alternative
      form so the LLM can generate either pattern.

- [x] **Fix `toCleanGeoJSON` function** — renamed to `cleanFeatures` with
      a note about wrapping in FeatureCollection if needed.

- [x] **Add MultiPolygon note to point-in-polygon** — added comment noting
      Polygon-only and how to handle MultiPolygon.

- [ ] **Document `findNearestFeature` tolerance units** — the default `0.5`
      is in degrees (~55km at equator). Add a comment explaining this and
      that it should be calibrated to zoom level.

- [ ] **Add `askWithTimeout` to scaffold template** — the scaffold's
      `client.js` is missing this resilience pattern that the reference
      skill documents as essential.

- [ ] **Add `map_wait_idle()` to scaffold's `main.js`** — the scaffold
      template doesn't include this critical sequencing call.

- [ ] **Add CSP/iframe guidance to initialization.md** — if the embedding
      page has restrictive Content-Security-Policy headers, the MapX iframe
      won't load. Note that `frame-src https://app.mapx.org` is needed.

- [ ] **Clarify `set_vector_highlight` vs `set_vector_spotlight`** — the
      skill mentions the newer name but doesn't provide an example. Show
      both or recommend one.

## Broader improvements

- [ ] **Version tracking** — the MapX SDK doesn't version its UMD bundle.
      If methods change or break, we need a way to note which SDK
      version the skills were validated against. Consider adding a
      "last validated" date to each reference file.

- [ ] **Community contribution template** — if others start using this,
      add a CONTRIBUTING.md explaining how to add new methods or
      document new limitations they discover.

- [ ] **Add `safeViewAdd` verification pattern** — `view_add` silent failures
      are the most common gotcha but there's no defensive pattern documented.
      Add a helper that calls `get_views_id_open` after `view_add` to verify
      the view actually loaded.
