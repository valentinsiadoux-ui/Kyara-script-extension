/*
 * Outils partagés par les scripts du dossier scripts/.
 *
 * Un script s'enregistre avec KyaraExt.register({ ... }) :
 *   id, name, icon, description
 *   params  : [{ key, label, type, default, help, group, min, max, step, options }]
 *             type = "number" | "boolean" | "select" | "text" | "rarityMap"
 *             group = "advanced" pour les ranger dans « Réglages avancés »
 *   preview(ctx, params)  -> { summary, warnings, columns, rows, canRun, state }
 *             rows : [{ id, cells: { [columnKey]: valeur }, selectable, note }]
 *             Rien n'est publié pendant l'aperçu.
 *   run(ctx, params, { excludedIds, state })
 *             excludedIds : lignes de l'aperçu décochées par l'utilisateur
 *             state       : ce que preview() a renvoyé dans `state`
 */
(() => {
  const K = (globalThis.KyaraExt ??= { scripts: [] });

  const RARITIES = ["M", "L", "E", "R", "U", "C"]; // de la plus rare à la plus commune
  const LABELS = { M: "Mythique", L: "Légendaire", E: "Épique", R: "Rare", U: "Peu commune", C: "Commune" };
  const rank = (r) => { const i = RARITIES.indexOf(r); return i === -1 ? RARITIES.length : i; };
  const fmt = (n) => (n == null ? "?" : n.toLocaleString("fr-FR"));
  const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
  // Même calcul que le site : taxe 5 % + frais d'annonce 2 % (min. 1).
  const netSale = (price) => price - Math.ceil(price * 0.05) - Math.max(1, Math.ceil(price * 0.02));

  // Firefox : le fetch d'un content script n'a pas l'origine de la page, content.fetch si.
  const pageFetch = typeof content !== "undefined" && content?.fetch ? content.fetch.bind(content) : fetch.bind(globalThis);

  const readPass = () => {
    try {
      const p = JSON.parse(localStorage.getItem("kyara_pass"));
      return p && p.expiresAt > Date.now() ? p.pass : null;
    } catch { return null; }
  };

  class StoppedError extends Error {
    constructor() { super("Arrêt demandé"); this.name = "StoppedError"; }
  }

  // Contexte passé aux scripts : API du site, pauses interruptibles, journal et statut affichés dans le popover.
  function createContext({ signal, log, status }) {
    const sleep = (ms) => new Promise((resolve) => {
      if (signal.aborted) return resolve();
      const timer = setTimeout(done, ms);
      function done() { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); }
      signal.addEventListener("abort", done, { once: true });
    });
    const checkStopped = () => { if (signal.aborted) throw new StoppedError(); };

    async function api(path, { method = "GET", body, withPass = false } = {}) {
      for (let attempt = 0; attempt < 5; attempt++) {
        checkStopped();
        const headers = { "x-device-id": localStorage.getItem("kyara_device") ?? "" };
        const token = localStorage.getItem("kyara_token");
        if (token) headers.authorization = `Bearer ${token}`;
        if (body !== undefined) headers["content-type"] = "application/json";
        const pass = withPass ? readPass() : null;
        if (pass) headers["x-pass"] = pass;
        const res = await pageFetch(`${location.origin}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
        const data = await res.json().catch(() => null);
        if (res.ok) return data;
        if ((res.status === 429 || res.status === 503) && attempt < 4) { await sleep(2000 * 2 ** attempt); continue; }
        throw new Error(`HTTP ${res.status} – ${data?.message ?? data?.error ?? path}`);
      }
    }

    return {
      api, sleep, log, status, signal, checkStopped,
      get stopped() { return signal.aborted; },
    };
  }

  function register(def) {
    if (K.scripts.some((s) => s.id === def.id)) throw new Error(`Script déjà enregistré : ${def.id}`);
    K.scripts.push(def);
  }

  Object.assign(K, { RARITIES, LABELS, rank, fmt, chunk, netSale, createContext, register, StoppedError });
})();
