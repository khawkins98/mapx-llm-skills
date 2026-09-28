# Runtime verification

Playwright checks that run against the **live** MapX SDK on app.mapx.org and
record what actually happens, in both static and app mode. They back the
"runtime-verified" statements in the skills. This folder is not part of the
plugin, and it is not run in CI, because it depends on MapX being up.

```bash
cd tests/runtime
npm install
node run.mjs              # both modes, headless (~4 min)
node run.mjs --mode=app   # one mode
node run.mjs --headed     # watch it
```

Results land in `results/<date>-<mode>.json`. Re-run after each MapX release
and diff against the previous files.

Nothing is saved to MapX. The checks read state, toggle views, set filters
and transparency, change the UI language, and switch projects inside the
embedded guest session.

## How it works

- `run.mjs` serves a one-line host page from `http://localhost`. It must be a
  secure context: from `about:blank` / `page.setContent()`, MapX crashes on
  `crypto.randomUUID` and `ready` never fires.
- `harness.js` is injected into that page. `H.ask()` wraps every call so it
  always settles (`resolved` / `rejected` / `pending` at timeout) and records
  the SDK `message` errors and events seen while it was in flight.
- Effects are measured, not eyeballed: layer filters and paint properties
  are read back through the `map` passthrough (`getStyle`); projections are
  checked by comparing `map.project()` output.

## Fixtures

Taken from the `undrr-risk-resilience-maps-pw` view catalogues:

| Fixture | ID | Why |
|---|---|---|
| HOME project (public) | `MX-YBJ-YYF-08R-UUR-QW6` | Session A |
| ECO-DRR project (public) | `MX-2LD-FBB-58N-ROK-8RH` | Session B, cross-project tests |
| UNDRR project (not guest-readable) | `MX-FC7-VJG-IKU-MCA-QXM` | Inaccessible-project behaviour |
| Numeric vt view | `MX-KEG0W-U2098-JKIYJ` | `aal_lower_bound_million`; public; owned by CDC |
| Text vt view | `MX-1QXAR-BQIQ6-2C685` | `cfr_label` |
| Time vt view | `MX-V5P2U-N9C2O-OHMZY` | has `mx_t0` / `mx_t1` |
| In-project vt view (ECO-DRR) | `MX-FX1HT-Z7KXL-8X22K` | Control |
| Bogus ID | `MX-ZZZZZ-ZZZZZ-ZZZZZ` | Non-existent view |

The filter views belong to neither session's project, so every filter check
also exercises a remotely-fetched (cross-project) view.

## Findings, 2026-09-28 (SDK 1.14.0-fix.1)

| Behaviour | Static | App |
|---|---|---|
| `ready` (headless, from localhost) | ~4.2 s | ~3.6 s |
| Public view from another project: `view_add` | `true`, `view_added`, visible | same |
| Bogus view ID: `view_add` | hangs, `err_resolver_failed` "View not found" | same |
| Already-open view: `view_add` | `true`, `view_added` fires again | same |
| Unknown / wrong-mode resolver | hangs, `err_resolver_not_found` | same |
| `get_views_id_open` | hangs | `[]` |
| `get_sdk_methods` | 89 names, no `panels_*` | 126 names, no `panels_*` |
| `too_many_request` (12th concurrent call) | rejected `too_many_request 11. Max= 10`, **still executed** | same |
| `map_fly_to` with `duration: 12000` | hangs, `err_resolver_failed` "timeout" | same |
| `map_wait_idle` on a still map | resolves (≤ 0.6 s) | resolves (~1 ms) |
| `getProjection()` on a fresh map | `undefined` | `undefined` |
| `setProjection({type:"globe"})` | works | works |
| `setProjection("globe")` (string) | silently ignored | silently ignored |
| Numeric filter `{from, to}` | applied | **ignored** |
| Numeric filter `{value}` | applied | applied, snapped to slider step `(min+max)/1000` |
| Numeric filter `attribute` | honoured | ignored (styled attribute) |
| Numeric filter `{from:null,to:null}` | writes `<= null` comparisons | no-op |
| `get_view_layer_filter_numeric` | numbers | strings (`"19927.70"`) |
| Text filter `{value}` | hangs (TDZ bug, no `attribute`) | applied |
| Text filter `{values, attribute}` | applied | **clears** the filter |
| Text filter `{values}` (no attribute) | hangs (TDZ bug) | clears |
| Text filter portable (`value`+`values`+`attribute`) | applied | applied |
| Time filter `{from, to}` only | applied | ignored (slider needs `value`) |
| Transparency `{value: 50}` | no opacity set (50 rejected) | opacity 0.5 |
| Transparency `{value: 50, opacity: 0.5}` | opacity 0.5 | opacity 0.5 |
| `set_project` | hangs (`err_resolver_not_found`) | public, no views open: `true` ~1.3 s; with views open: switched, promise pending, no `project_changed`; inaccessible: blocks on "project cannot be loaded" dialog |
| Inaccessible project in `project=` URL | loads HOME silently | loads HOME silently |

Not covered yet: a non-public view from another project, and logged-in
behaviour (see `NEXTSTEPS.md`).
