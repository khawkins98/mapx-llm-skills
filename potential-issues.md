# Potential Issues to Report Upstream

Notes for possible feedback to the MapX SDK maintainers (`unep-grid/mapx`).
Not filed yet — collecting evidence and refining before submitting.

> **Version context**: All observations are against the deployed UMD at
> `app.mapx.org/sdk/mxsdk.umd.js` (embedded version string 1.13.19),
> March 2026. The GitHub `master` branch has `@fxi/mxsdk` at 1.9.40-alpha.1
> and npm `latest` at 1.13.14-alpha.10 — none of these match. Line
> references to the source may not correspond to the maintainers' working
> tree.

---

## 1. Bug: FrameManager never rejects on resolver failure

**Severity**: Bug — causes `ask()` to hang forever.

**Evidence**: Confirmed in `frameManager.js` source on GitHub `master`.
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

## Suggested filing plan

1. **One focused issue** for the FrameManager Promise bug (§1) — clear,
   confirmed in source, has a straightforward fix.

2. **One discussion post** (they have `discussions/662` for API topics)
   bundling §2–§4 as developer feedback from building an SDK embed project.
   Frame it as constructive observations, not complaints.
