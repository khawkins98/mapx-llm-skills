# Potential Issues to Report Upstream

Notes for possible feedback to the MapX SDK maintainers (`unep-grid/mapx`).
Not filed yet — collecting evidence and refining before submitting.

> **Version context**: §1–§4 were observed at runtime against the deployed UMD at
> `app.mapx.org/sdk/mxsdk.umd.js` (embedded version string 1.13.19, March 2026).
> All sections were re-checked against the upstream **source** at tag
> `1.14.0-fix.1` (deployed August 2026); §5–§8 come from that source reading
> and have not been reproduced at runtime. Line references are to
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

**1.14 update (source reading, not re-tested)**: `view_add` → `getViewAuto`
now fetches IDs missing from the project via `getViewRemote`. A view the API
returns may therefore load; an ID it can't return throws, which hangs the
promise (§1). When the add itself fails, the resolver emits `err_view_invalid`
and resolves `undefined` instead of `false`, although the JSDoc says
`Promise<Boolean>`. Needs a runtime re-test before filing.

**Suggestion**: The resolver could validate the view ID against the loaded
project's view list and either reject the Promise or log a console warning.

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

## Suggested filing plan

1. **One focused issue** for the FrameManager Promise bug (§1) — clear,
   confirmed in source, has a straightforward fix.

2. **One focused issue** each for §5 and §6 — small, confirmed in source,
   one-line fixes.

3. **One discussion post** (they have `discussions/662` for API topics)
   bundling §2–§4, §7 and §8 as developer feedback from building an SDK embed project.
   Frame it as constructive observations, not complaints.
