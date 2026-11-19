/*
 * Outils partagés par les scripts du dossier scripts/.
 *
 * Un script s'enregistre avec KyaraExt.register({ ... }) :
 *   id, name, icon, description
 *   category, short : rubrique du menu et ligne courte affichée dessous (description en infobulle)
 *   skipPreview : true pour lancer directement depuis les réglages
 *   params  : [{ key, label, type, default, help, title, group, row, min, max, step, options, optional,
 *                enabledWhen, inactiveWhen }]
 *             type = "number" | "boolean" | "select" | "choice" | "modeToggle" | "text" | "textarea"
 *                  | "rarityMap" | "raritySet" | "rarityMax"
 *             enabledWhen  = { autreClé: valeur | [valeurs] } : champ masqué sinon
 *             inactiveWhen = { autreClé: valeur | [valeurs] } : si enabledWhen est faux mais que cette
 *                            condition est vraie, le champ reste visible, grisé
 *             row   = "nom" : les champs d'un même row sont regroupés sur une ligne
 *             group = "advanced" pour les ranger dans « Réglages avancés »
 *   preview(ctx, params)  -> { summary, warnings, columns, rows, canRun, state }
 *             columns : [{ key, label, align: "end", total: true }]
 *             rows    : [{ id, cells, values, rarity, selectable, note }]
 *             excluded : ids des lignes décochées d'office
 *                       values : nombres par colonne (tri et totaux), sinon on lit cells
 *             Rien n'est publié pendant l'aperçu.
 *   run(ctx, params, { excludedIds, state })
 *             excludedIds : lignes de l'aperçu décochées par l'utilisateur
 *             state       : ce que preview() a renvoyé dans `state`
 */
(() => {
  const K = (globalThis.KyaraExt ??= { scripts: [] });

  // ---------- Raretés ----------
  const RARITIES = ["M", "L", "E", "R", "U", "C"]; // de la plus rare à la plus commune
  const RARITIES_ASC = [...RARITIES].reverse(); // ordre de l'interface
  const LABELS = { M: "Mythique", L: "Légendaire", E: "Épique", R: "Rare", U: "Peu commune", C: "Commune" };
  const COLORS = { C: "#B5B1BB", U: "#3FBF7F", R: "#4D9BFF", E: "#B072FF", L: "#F5C518", M: "#FF4D2E" };
  // Pastilles utilisées par les joueurs du comptoir.
  const DOTS = { C: "⚪", U: "🟢", R: "🔵", E: "🟣", L: "🟡", M: "🔴" };
  // Recyclage du client du site, si /config ne le donne pas.
  const RECYCLE = { C: 1, U: 1, R: 3, E: 10, L: 40, M: 150 };
  const rank = (r) => {
    const i = RARITIES.indexOf(r);
    return i === -1 ? RARITIES.length : i;
  };
  // « au plus Épique » : C, U, R, E.
  const atMost = (r, max) => !max || rank(r) >= rank(max);
  const atLeast = (r, min) => !min || rank(r) <= rank(min);
  const recycleOf = (rarity, config) => config?.recycle?.[rarity] ?? RECYCLE[rarity] ?? 1;

  // ---------- Petits outils ----------
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
    } catch {
      return null;
    }
  };

  class StoppedError extends Error {
    constructor() {
      super("Arrêt demandé");
      this.name = "StoppedError";
    }
  }
  class ApiError extends Error {
    constructor(status, code, message) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  }

  // ---------- Débit des requêtes ----------
  // File commune à tous les scripts : 250 ms au moins entre deux requêtes (× x-kyara-rush quand le site
  // est chargé), comme Kyara Plus. Le site limite à 300 requêtes par minute.
  const MIN_GAP_MS = 250,
    JITTER_MS = 150;
  let nextSlot = 0,
    rush = 1;
  function takeTurn() {
    const now = Date.now();
    const at = Math.max(now, nextSlot);
    nextSlot = at + MIN_GAP_MS * rush + Math.random() * JITTER_MS;
    return at - now;
  }

  function describe(status, data, path, withPass) {
    if (status === 401) return "Session expirée : recharge la page Kyara puis relance.";
    if (withPass && status === 403 && !readPass())
      return "Code d'accès requis : entre-le sur le site (n'importe quelle action protégée le demande), puis relance.";
    return `HTTP ${status} – ${data?.message ?? data?.error ?? path}`;
  }

  // ---------- Cache de la page ----------
  const CACHE_MS = 10 * 60 * 1000;
  const cache = new Map(); // clé -> { at, promise }
  function cached(key, load) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
    const promise = load().catch((e) => {
      cache.delete(key);
      throw e;
    });
    cache.set(key, { at: Date.now(), promise });
    return promise;
  }

  // Contexte passé aux scripts : API du site, pauses interruptibles, journal et statut affichés dans le popover.
  function createContext({ signal, log, status }) {
    const sleep = (ms) =>
      new Promise((resolve) => {
        if (signal.aborted) return resolve();
        const timer = setTimeout(done, ms);
        function done() {
          clearTimeout(timer);
          signal.removeEventListener("abort", done);
          resolve();
        }
        signal.addEventListener("abort", done, { once: true });
      });
    const checkStopped = () => {
      if (signal.aborted) throw new StoppedError();
    };

    async function api(path, { method = "GET", body, withPass = false, retries = 4, timeoutMs } = {}) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        checkStopped();
        const wait = takeTurn();
        if (wait > 0) await sleep(wait);
        checkStopped();
        const headers = { "x-device-id": localStorage.getItem("kyara_device") ?? "" };
        const token = localStorage.getItem("kyara_token");
        if (token) headers.authorization = `Bearer ${token}`;
        if (body !== undefined) headers["content-type"] = "application/json";
        const pass = withPass ? readPass() : null;
        if (pass) headers["x-pass"] = pass;
        let res;
        const timeout = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
        try {
          res = await pageFetch(`${location.origin}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: timeout });
        } catch {
          if (timeout?.aborted) throw new ApiError(0, "timeout", "Kyara tarde à répondre. Actualise la liste pour vérifier le statut.");
          throw new ApiError(0, "network", "Réseau injoignable : vérifie ta connexion.");
        }
        rush = Number(res.headers.get("x-kyara-rush")) || 1;
        const data = await res.json().catch(() => null);
        if (timeout?.aborted) throw new ApiError(0, "timeout", "Kyara tarde à répondre. Actualise la liste pour vérifier le statut.");
        if (res.ok) return data;
        if ((res.status === 429 || res.status === 503) && attempt < retries) {
          await sleep(2000 * 2 ** attempt);
          continue;
        }
        throw new ApiError(res.status, data?.error ?? `http_${res.status}`, describe(res.status, data, path, withPass));
      }
    }

    const ctx = {
      api,
      sleep,
      log,
      status,
      signal,
      checkStopped,
      get stopped() {
        return signal.aborted;
      },
      // Catalogue (Map id -> carte) et joueur connecté, gardés 10 min pour toute la page.
      catalog: () => cached("catalog", async () => new Map((await api("/characters")).map((c) => [c.id, c]))),
      me: () => cached("me", async () => (await api("/me/bootstrap")).me),
      config: () => cached("config", () => api("/config").catch(() => null)),
      loadPrices: (ids, into) => loadPrices(ctx, ids, into),
      busyCards: (opts) => busyCards(ctx, opts),
    };
    return ctx;
  }

  // ---------- Prix du marché ----------
  // id -> { value, median7d, median30d, lastPrice, sales7d }
  async function loadPrices(ctx, ids, into = new Map()) {
    const todo = [...new Set(ids)].filter((id) => id != null && !into.has(id));
    let read = 0;
    for (const part of chunk(todo, 300)) {
      ctx.status(`Lecture des prix : ${read}/${todo.length} cartes…`);
      for (const r of await ctx.api(`/me/collection/prices?ids=${part.join(",")}`)) {
        into.set(r.characterId, {
          value: r.median7d || r.median30d || r.lastPrice || null,
          median7d: r.median7d || null,
          median30d: r.median30d || null,
          lastPrice: r.lastPrice || null,
          sales7d: typeof r.sales7d === "number" ? r.sales7d : null,
        });
      }
      read += part.length;
    }
    return into;
  }

  // ---------- Cartes occupées ----------
  // Une annonce bloque la carte tant qu'elle n'est pas terminée (vendue, expirée ou retirée).
  const FINISHED = new Set(["sold", "expired", "cancelled"]);
  // Annonces en cours, offres du tableau ouvertes et, sur demande, cartes que je demande dans un échange en attente.
  async function busyCards(ctx, { pendingTrades = false } = {}) {
    const me = await ctx.me();
    const [market, offers, trades] = await Promise.all([
      // Si les annonces sont illisibles, on échoue : on ne publie jamais sans savoir ce qui est en vente.
      ctx.api("/me/market"),
      ctx.api("/trades/offers/mine"),
      pendingTrades ? ctx.api("/me/trades") : null,
    ]);
    const listings = (market?.listings ?? []).filter((l) => !FINISHED.has(l.status));
    const openOffers = (offers ?? []).filter((o) => o.status === "open" && (!o.user || o.user.id === me.id));
    const ids = new Set([...listings.map((l) => l.character?.id ?? l.characterId), ...openOffers.map((o) => o.characterId)]);
    const requested = new Set();
    for (const t of (trades?.outgoing ?? []).filter((t) => t.status === "pending"))
      for (const c of t.want?.cards ?? []) if (c.characterId != null) requested.add(c.characterId);
    return { ids, listings, openOffers, buyOrders: market?.buyOrders ?? market?.orders ?? [], requested };
  }

  // ---------- Doublons ----------
  // Règle unique : hors épinglées et occupées, n = min(exemplaires vendables, exemplaires − à garder).
  function spares(rows, catalog, { keepCopies = 1, rarities = null, maxRarity = null, busy = null } = {}) {
    return rows
      .filter((e) => !e.pinned && e.qty > 0 && !busy?.has(e.characterId))
      .map((e) => ({ card: catalog.get(e.characterId), entry: e, n: Math.min(e.listable ?? e.qty, e.qty - keepCopies) }))
      .filter((x) => x.card && x.n > 0 && (!rarities || rarities.includes(x.card.rarity)) && atMost(x.card.rarity, maxRarity));
  }

  function register(def) {
    if (K.scripts.some((s) => s.id === def.id)) throw new Error(`Script déjà enregistré : ${def.id}`);
    K.scripts.push(def);
  }

  Object.assign(K, {
    RARITIES,
    RARITIES_ASC,
    LABELS,
    COLORS,
    DOTS,
    RECYCLE,
    rank,
    atMost,
    atLeast,
    recycleOf,
    fmt,
    chunk,
    netSale,
    readPass,
    createContext,
    loadPrices,
    busyCards,
    spares,
    register,
    StoppedError,
    ApiError,
  });
})();
