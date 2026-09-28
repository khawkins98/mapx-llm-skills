# Potential Issues to Report Upstream

Notes for possible feedback to the MapX SDK maintainers (`unep-grid/mapx`).
Not filed yet — collecting evidence and refining before submitting.

> **Version context**: §1–§4 were observed at runtime against the deployed UMD at
> `app.mapx.org/sdk/mxsdk.umd.js` (embedded version string 1.13.19, March 2026).
> All sections were re-checked against the upstream **source** at tag
> `1.14.0-fix.1` (deployed August 2026). §1, §3 and §5–§11 were
> **reproduced at runtime on 2026-09-28** with `tests/runtime/` (Playwright,
> static and app mode); raw results are in `tests/runtime/results/`. Line references are to
> `app/src/js/sdk/src/` in `unep-grid/mapx` at that tag.

---

## 1. Bug: FrameManager never rejects on resolver failure

**Severity**: Bug — causes `ask()` to hang forever.

**Evidence**: Confirmed in `frameManager.js` source on GitHub `main` (`_handleMessageWorker`, lines 375–380 at tag `1.14.0-fix.1`). The same path swallows `err_resolver_not_found`, so calling an unknown or wrong-mode resolver also hangs.
The response handler only calls `req.onResponse(message.value)` when
`message.success` is `true`. There is no `else` branch and no `reject()`
call. When a resolver throws an exception, the request is removed from the
queue but the Promise is never settled.

```javascript
// Current code (frameManager.js):
if (message.success) {
  req.onResponse(message.value);
}
// No else — Promise hangs forever on failure
```

**Observed**: 2026-03-19, `get_view_source_summary` on raster views. The
WMS `GetCapabilities` call can throw on malformed responses, triggering
the unhandled path. Timeout wrapper added reactively in `mapx-demo-embed`
commit `e77a752`.

**Suggested fix**: Add an else branch that rejects the Promise:
```javascript
if (message.success) {
  req.onResponse(message.value);
} else {
  req.onReject(message.value);
}
```
(Requires adding `onReject` to the request object, wired to the Promise's
`reject` callback in `ask()`.)

**Format**: Standalone issue — clear bug with confirmed source path and fix.

---

## 2. Docs: toggle_draw_mode removed but still referenced

**Severity**: Documentation cleanup.

**Evidence**: The SDK README on `master` still documents
`mapxResolversStatic.toggle_draw_mode()` as an instance method. The
resolver was added in [commit aee274a (June 2020)](https://github.com/unep-grid/mapx/commit/aee274a)
but has since been removed from `mapx_resolvers/static.js`. Calling it
against the deployed SDK (v1.13.19) throws "unknown resolver". The
underlying `drawModeToggle()` still exists in `app/src/js/draw/helper.js`
but is no longer exposed through the SDK.

**Format**: Could be bundled into a discussion post or a small docs PR.

---

## 3. Observation: view_add fails silently for cross-project views

**Severity**: Developer experience — not a crash, but a confusing silent
failure.

**Evidence**: Observed 2026-03-19. Calling `view_add` with a view ID from
a different project returns without error — no network request, no thrown
error, no visual change. The MapX app inside the iframe only resolves views
from its loaded project. Cross-project references are silently ignored.

**1.14 update (runtime-verified 2026-09-28)**: this is largely fixed.
`view_add` now fetches IDs missing from the project via `getViewRemote`,
and a public view from another project loads (`true`, `view_added` fires).
What remains: a **non-existent** ID throws `View not found` inside the
resolver, so the promise never settles (§1). A falsy add result resolves
`undefined` rather than `false`, although the JSDoc says `Promise<Boolean>`.

**Suggestion**: Return `false` (or reject) for unknown IDs instead of
throwing, which would be fixed for free by §1.

**Format**: Discussion post or enhancement request.

---

## 4. Observation: getLayer/getSource returns unreliable values through postMessage

**Severity**: Minor — workaround exists (try/catch on remove instead of
pre-checking existence).

**Evidence**: Observed 2026-03-19 when implementing cleanup for spatial
query highlight layers. `map({method: "getLayer", parameters: [id]})` and
`map({method: "getSource", parameters: [id]})` sometimes return truthy
objects for layers/sources that don't exist. Likely caused by how the
structured clone algorithm serializes Mapbox GL's internal `StyleLayer`
objects through postMessage. No minimal reproduction case yet.

**Format**: Bundle into a discussion post with the other observations.

---

## 5. Bug: `too_many_request` rejection still sends the request

**Severity**: Bug — rejected calls still execute.

**Evidence** (source, tag `1.14.0-fix.1`, `frameManager.js` `ask()`): when
`nR > mR` the promise is rejected, but execution continues to
`fm._post(req); fm._req.push(req);`. MapX runs the request anyway, and a
caller that retries after the rejection runs it twice. The check also
compares the count *before* adding the new request, so the effective
ceiling is `maxSimultaneousRequest + 1`.

**Suggestion**: `return` after `reject(...)`, and compare `nR >= mR`.

---

## 6. Bug: static-mode text filter throws when `attribute` is omitted

**Evidence** (source, `map_helpers/view_filters.js` `viewSetTextFilter`):

```js
let { attribute, values, idView } = opt;
if (isEmpty(attribute)) {
  attribute = view?.data?.attribute?.name; // `view` is declared below → TDZ ReferenceError
}
...
const view = getView(idView);
```

Combined with §1, `set_view_layer_filter_text` without `attribute` in static
mode hangs.

**Suggestion**: move `const view = getView(idView)` above the fallback.

---

## 7. DX: filter/transparency resolvers read different params per mode

**Evidence** (source): in app mode, `set_view_layer_filter_numeric`,
`set_view_layer_filter_text`, `set_view_layer_filter_time` and
`set_view_layer_transparency` forward only `opt.value` to the view's UI
widget. In static mode they read `from`/`to`/`attribute`, `values`/`attribute`,
and `opacity` (a 0–1 MapLibre opacity, vs 0–100 transparency in app mode).
The JSDoc marks `value` as "Deprecated" for the numeric filter, yet it is
the *only* param app mode honours.

**Suggestion**: normalise the params in the resolver before branching on
mode, and document one scale for transparency.

---

## 8. DX: `get_sdk_methods` omits the panels resolvers

**Evidence**: it lists `Object.getOwnPropertyNames` of the static/app
prototypes only, so the inherited `MapxResolversPanels` methods
(`panels_*`) are missing even though they are callable.

---

## 9. Bug: `map_fly_to` longer than 10 s hangs the SDK call

**Evidence** (runtime, both modes): `_map_resolve_when` rejects with
`"timeout"` after a hard-coded 10 s. A `duration: 12000` flight produced
`err_resolver_failed` (`msg: "timeout"`), and, because of §1, the `ask()`
never settled even though the flight completed.

**Suggestion**: derive the timeout from `opt.duration` (e.g.
`duration + 5000`), or resolve on `moveend` without a fixed cap.

---

## 10. DX: `set_project` promise can stay pending

**Evidence** (runtime, app mode, guest):
- To a public project with views open: the project changed (`get_project`
  returned the target) but the promise never settled within 30 s and
  `project_changed` never fired. With no views open it resolved `true` in
  ~1.3 s. This looks like a race on `events.once("views_list_updated")`.
- To a project the guest can't open: the promise waits on the "The project
  cannot be loaded" dialog until a human closes it.

**Suggestion**: register the `views_list_updated` listener before
triggering the change, and don't block the SDK response on modal dialogs
(return `false` and let the dialog be informational).

---

## 11. DX: inaccessible `project=` silently loads HOME

**Evidence** (runtime): a Manager created with `?project=` set to a project
the guest can't read (`MX-FC7-VJG-IKU-MCA-QXM`) loaded the public HOME
project (`MX-YBJ-YYF-08R-UUR-QW6`) with no error or event. Embedders only
notice because the views are wrong.

**Suggestion**: emit an event or message (e.g. `project_fallback` or a
warning with the requested ID) so the host page can react.

---

## Suggested filing plan

1. **One focused issue** for the FrameManager Promise bug (§1) — clear,
   confirmed in source, has a straightforward fix.

2. **One focused issue** each for §5, §6 and §9: small, confirmed at
   runtime, one-line fixes.

3. **One discussion post** (they have `discussions/662` for API topics)
   bundling §2–§4, §7, §8, §10 and §11 as developer feedback from building an SDK embed project.
   Frame it as constructive observations, not complaints.
