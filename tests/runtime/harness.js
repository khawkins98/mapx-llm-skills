/**
 * In-page harness for runtime verification of MapX SDK behaviour.
 *
 * Injected into a blank page that has loaded https://app.mapx.org/sdk/mxsdk.umd.js.
 * Exposes window.H, driven by run.mjs through page.evaluate().
 *
 * Every ask() goes through H.ask(), which never hangs: it records whether the
 * promise resolved, rejected, or was still pending at the timeout, plus the
 * SDK "message" errors and events seen while it was in flight.
 */
(() => {
  const H = {
    mapx: null,
    events: [], // { t, type, data }
    messages: [], // { t, level, key, vars }
  };

  const now = () => performance.now();
  const clone = (x) => {
    try {
      return JSON.parse(JSON.stringify(x));
    } catch {
      return String(x);
    }
  };

  // Events worth recording (the full catalog is noisy, e.g. settings_change)
  const EVENTS = [
    "view_add", "view_added", "view_remove", "view_removed",
    "view_filter", "view_filtered", "layers_ordered", "language_change",
    "project_changed", "spotlight_update", "mapx_ready",
  ];

  H.init = ({ project, isStatic, host = "app.mapx.org", timeoutMs = 90000 }) =>
    new Promise((resolve, reject) => {
      const t0 = now();
      const timer = setTimeout(() => reject(new Error(`ready not fired after ${timeoutMs}ms`)), timeoutMs);
      H.mapx = new window.mxsdk.Manager({
        container: document.getElementById("mapx"),
        url: `https://${host}/?project=${project}`,
        params: { closePanels: true, language: "en", theme: "color_light" },
        style: { width: "100%", height: "100%", border: "none" },
        static: isStatic,
      });
      H.mapx.on("message", (m) => {
        if (m?.level === "error" || m?.level === "warning") {
          H.messages.push({ t: now(), level: m.level, key: m.key, vars: clone(m.vars) });
        }
      });
      for (const type of EVENTS) {
        H.mapx.on(type, (data) => {
          // view_add/view_remove carry the whole view JSON: keep it small
          const d = data && data.view ? { idView: data.idView } : clone(data);
          H.events.push({ t: now(), type, data: d });
        });
      }
      H.mapx.on("ready", () => {
        clearTimeout(timer);
        resolve({ readyMs: Math.round(now() - t0) });
      });
    });

  /**
   * ask() that always settles. Returns
   * { status: "resolved"|"rejected"|"pending", value|error, ms, messages, events }
   */
  H.ask = (resolver, opt, timeoutMs = 15000) => {
    const t0 = now();
    const p = H.mapx.ask(resolver, opt).then(
      (value) => ({ status: "resolved", value: clone(value) }),
      (err) => ({ status: "rejected", error: String(err?.message ?? err), errorType: typeof err }),
    );
    const timeout = new Promise((r) => setTimeout(() => r({ status: "pending" }), timeoutMs));
    return Promise.race([p, timeout]).then((res) => ({
      ...res,
      ms: Math.round(now() - t0),
      messages: H.messages.filter((m) => m.t >= t0).map(({ t, ...m }) => m),
      events: H.events.filter((e) => e.t >= t0).map(({ t, ...e }) => e),
    }));
  };

  /** Fire an ask() without waiting; the outcome lands in H.fired[i]. */
  H.fired = [];
  H.fire = (resolver, opt) => {
    const i = H.fired.length;
    H.fired[i] = { resolver, status: "pending" };
    H.mapx.ask(resolver, opt).then(
      (value) => (H.fired[i] = { resolver, status: "resolved", value: clone(value) }),
      (err) => (H.fired[i] = { resolver, status: "rejected", error: String(err?.message ?? err), errorType: typeof err }),
    );
    return i;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  H.sleep = sleep;

  /** Wait until an event of `type` (optionally matching idView) is recorded after t0. */
  H.waitEvent = async (type, idView, t0, timeoutMs = 30000) => {
    const end = now() + timeoutMs;
    while (now() < end) {
      const e = H.events.find((x) => x.t >= t0 && x.type === type && (!idView || x.data?.idView === idView));
      if (e) return true;
      await sleep(100);
    }
    return false;
  };
  H.now = now;

  /** Map layers belonging to a view, read through the "map" passthrough. */
  H.viewLayers = async (idView) => {
    const r = await H.ask("map", { method: "getStyle" }, 15000);
    if (r.status !== "resolved") return [];
    return (r.value?.layers ?? [])
      .filter((l) => l.id === idView || l.id.startsWith(idView) || l.metadata?.idView === idView)
      .map((l) => ({ id: l.id, type: l.type, filter: l.filter ?? null, paint: l.paint ?? {} }));
  };

  window.H = H;
})();
