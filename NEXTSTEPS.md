# Next Steps

## Testing the skills locally

1. **Register as a local plugin**
   ```bash
   claude plugins add local ~/Documents/git/mapx-llm-skills
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

- [ ] **`set_panel_left_visibility`** — mentioned in methodology but not
      included in the skills. Test and document.

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

- [ ] **Add `allowed-tools` to scaffold skill** — currently doesn't specify
      tools. Consider adding `Write, Bash(npm *), Read` so scaffolding
      runs without permission prompts.

- [ ] **Add settings.local.json** — like the Drupal plugin, define allowed
      web domains (app.mapx.org, github.com/unep-grid/mapx) and tool
      permissions for the plugin context.

- [ ] **Consider a third skill: `mapx-view-discovery`** — a task skill that
      connects to a MapX project, runs `get_views()`, and produces a
      formatted catalog of available views with types and titles. Would
      replace the manual probe-views.html workflow.

## Broader improvements

- [ ] **Cross-reference the demo** — add links from the skill reference
      files back to specific files in `mapx-demo-embed` as working
      examples (e.g., "see src/ui/scenarios.js for a multi-layer
      transparency stacking example").

- [ ] **Version tracking** — the MapX SDK doesn't version its UMD bundle.
      If methods change or break, we need a way to note which SDK
      version the skills were validated against. Consider adding a
      "last validated" date to each reference file.

- [ ] **Community contribution template** — if others start using this,
      add a CONTRIBUTING.md explaining how to add new methods or
      document new limitations they discover.
