/*
 * SCRIPT 3 – Kyara : enchères avec ÉTUDE DE MARCHÉ
 *
 * But : vendre mes doublons au meilleur prix tout en restant attractif pour les joueurs qui
 * cherchent ces cartes. Avant toute publication, l'aperçu fait une étude de marché par carte :
 *
 *   - VALEUR   : médiane 7 j (à défaut 30 j, puis dernier prix), corrigée de la tendance 7 j / 30 j ;
 *   - DEMANDE  : joueurs qui cherchent la carte = offres d'échange ouvertes du tableau qui la
 *                demandent (le site n'expose pas les wishlists des autres joueurs, c'est le signal
 *                le plus proche), avec la valeur de ce qu'ils proposent en échange (= ce qu'ils sont
 *                prêts à mettre), + ventes des 7 derniers jours + mises sur les enchères concurrentes ;
 *   - OFFRE    : annonces actives des autres vendeurs sur la même carte (prix, achat immédiat, mises).
 *
 * Prix :
 *   - mise de départ ATTRACTIVE : sous la valeur et sous la concurrence ; plus la demande est forte,
 *     plus le départ est bas (les mises feront monter le prix) ;
 *   - ACHAT IMMÉDIAT = levier de gain : au-dessus de la valeur, d'autant plus que la demande est forte,
 *     plafonné par ce que les chercheurs semblent prêts à mettre et par l'achat immédiat concurrent ;
 *   - jamais sous le prix de recyclage (net après taxe et frais, par défaut).
 * Les cartes sont mises en vente dans l'ordre du gain attendu au-dessus du recyclage.
 *
 * ⚠ TROIS POINTS À VÉRIFIER (absents du code de Kyara Plus, donc déduits) :
 *   - le PRIX DE RECYCLAGE : cherché dans les données de la carte, de la collection et de /config.
 *     Si introuvable, l'aperçu le signale ; renseigne alors « Recyclage forcé par rareté ».
 *   - la LECTURE DES ANNONCES : /market/listings?q=<nom>&type=auction&sort=ending&page=1&pageSize=24.
 *   - la CRÉATION D'UNE ANNONCE (endpoint / buildBody) : mets une carte aux enchères à la main avec
 *     F12 ouvert et recopie l'URL et le corps de la requête POST.
 */
(() => {
  const { register, RARITIES, LABELS, fmt, chunk, netSale } = KyaraExt;

  const buildBody = (characterId, price, buyoutPrice, hours) => ({ // À VÉRIFIER
    characterId,
    type: "auction",
    price,
    ...(buyoutPrice ? { buyoutPrice } : {}),
    durationHours: hours,
  });
  // Requête réelle du site : /market/listings?q=Faust&type=auction&sort=ending&page=1&pageSize=24
  const listingsPath = (card, type, page) =>
    `/market/listings?q=${encodeURIComponent(card.name)}${type ? `&type=${type}` : ""}&sort=ending&page=${page}&pageSize=24`;

  // Stratégies : départ (× valeur), achat immédiat de base (× valeur) et bonus par point de pression.
  const STRATEGIES = {
    rapide: { start: 0.85, buyout: 1.05, perPressure: 0.03 },
    equilibre: { start: 0.9, buyout: 1.15, perPressure: 0.05 },
    max: { start: 0.95, buyout: 1.25, perPressure: 0.08 },
  };
  const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
  const pct = (x) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)} %`;

  // ---------- Prix de recyclage (détection) ----------
  const RECYCLE_KEY = /recycl|dust|scrap/i;
  const MIN_PRICE_KEY = /min.*(price|prix)|(price|prix).*min|floor/i;
  function deepFind(obj, keyRe = RECYCLE_KEY, path = [], out = [], depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 4) return out;
    for (const [key, value] of Object.entries(obj)) {
      const here = [...path, key];
      if (keyRe.test(key) && (typeof value === "number" || (value && typeof value === "object"))) out.push({ path: here.join("."), value });
      if (value && typeof value === "object") deepFind(value, keyRe, here, out, depth + 1);
    }
    return out;
  }
  const rarityTable = (hits) => hits.map((h) => h.value).find((v) => v && typeof v === "object" && RARITIES.some((r) => typeof v[r] === "number")) ?? null;

  // Le site refuse une annonce sous un prix minimum par rareté : « Prix minimum pour cette rareté : 100 ◆ ».
  const MIN_PRICE_ERROR = /prix minimum[^0-9]*([\d\s\u202f\u00a0.,]+)/i;
  // Minimums appris lors d'un refus, gardés d'un lancement à l'autre.
  const LEARNED_KEY = "kx_min_price_by_rarity";
  const readLearnedMins = () => { try { return JSON.parse(localStorage.getItem(LEARNED_KEY)) ?? {}; } catch { return {}; } };
  const learnMin = (rarity, min) => { try { localStorage.setItem(LEARNED_KEY, JSON.stringify({ ...readLearnedMins(), [rarity]: min })); } catch { /* non mémorisé */ } };
  const minPriceFromError = (error) => {
    const m = MIN_PRICE_ERROR.exec(error?.message ?? "");
    return m ? Number(m[1].replace(/[^\d]/g, "")) || null : null;
  };

  // ---------- Prix du marché ----------
  // id -> { value, median7d, median30d, sales7d }
  async function loadPrices(ctx, ids, into = new Map()) {
    const todo = [...new Set(ids)].filter((id) => id != null && !into.has(id));
    let read = 0;
    for (const part of chunk(todo, 300)) {
      ctx.status(`Lecture des prix : ${read}/${todo.length} cartes…`);
      const rows = await ctx.api(`/me/collection/prices?ids=${part.join(",")}`);
      for (const r of rows) {
        into.set(r.characterId, {
          value: r.median7d || r.median30d || r.lastPrice || null,
          median7d: r.median7d || null,
          median30d: r.median30d || null,
          sales7d: typeof r.sales7d === "number" ? r.sales7d : null,
        });
      }
      read += part.length;
      await ctx.sleep(250);
    }
    return into;
  }

  // Tout ce qui ne dépend que des réglages et du catalogue : calculé à l'aperçu, réutilisé à l'exécution.
  async function prepare(ctx, p) {
    ctx.status("Chargement du catalogue, de la collection et de la configuration…");
    const [characters, bootstrap, rows0, config] = await Promise.all([
      ctx.api("/characters"),
      ctx.api("/me/bootstrap"),
      ctx.api("/me/collection?lean=1"),
      ctx.api("/config").catch(() => null),
    ]);
    const catalog = new Map(characters.map((c) => [c.id, c]));
    const myId = bootstrap.me.id;

    const configHits = deepFind(config);
    // Table "rareté -> montant" trouvée dans /config (ex. recycle: { C: 5, U: 10, ... }).
    const configByRarity = rarityTable(configHits);
    const recycleOf = (card, entry) => {
      if (p.recycleOverride?.[card.rarity] != null) return p.recycleOverride[card.rarity];
      for (const source of [entry, card]) {
        const hit = deepFind(source).find((h) => typeof h.value === "number");
        if (hit) return hit.value;
      }
      if (configByRarity && typeof configByRarity[card.rarity] === "number") return configByRarity[card.rarity];
      return null;
    };
    const entryOf = new Map(rows0.map((e) => [e.characterId, e]));
    const recycleFound = characters.some((c) => recycleOf(c, entryOf.get(c.id)) != null);
    const recycleDebug = recycleFound ? null : {
      card: Object.keys(characters[0] ?? {}).join(", "),
      entry: Object.keys(rows0[0] ?? {}).join(", "),
      config: config ? Object.keys(config).join(", ") : "illisible",
    };

    const spareRows = (rows, excludedIds = new Set()) =>
      rows
        .filter((e) => !e.pinned && e.qty > 0 && !excludedIds.has(e.characterId))
        .map((e) => ({ card: catalog.get(e.characterId), entry: e, n: Math.min(e.listable ?? 0, e.qty - p.keepCopies) }))
        .filter((x) => x.card && x.n > 0);

    const prices = await loadPrices(ctx, spareRows(rows0).map((x) => x.card.id));

    const eligible = (x) => {
      const market = prices.get(x.card.id);
      const recycle = recycleOf(x.card, x.entry);
      if (!market?.value || recycle == null || recycle <= 0) return null;
      if (market.value < p.minRecycleMultiple * recycle) return null;
      return { ...x, market, recycle, multiple: market.value / recycle };
    };

    // Prix minimum d'une annonce par rareté.
    const configMin = rarityTable(deepFind(config, MIN_PRICE_KEY)) ?? {};
    const learned = readLearnedMins();
    const minPrice = new Map(RARITIES.map((r) => [r, p.minPriceOverride?.[r] ?? configMin[r] ?? learned[r] ?? null]).filter(([, v]) => v != null));

    return { minPrice, catalog, myId, recycleFound, recycleDebug, configHits: configHits.map((h) => h.path), spareRows, eligible, prices };
  }

  // ---------- Demande : joueurs qui cherchent mes cartes ----------
  // takeable=1 renvoie les offres ouvertes du tableau que je peux prendre, c.-à-d. celles dont les
  // cartes demandées (wantIds) incluent au moins une carte que je possède.
  async function scanDemand(ctx, p, prep) {
    const offers = [];
    for (let page = 1; page <= p.demandPages; page++) {
      ctx.status(`Étude de la demande : tableau des échanges, page ${page}…`);
      const { items = [], more } = (await ctx.api(`/trades/offers/search?page=${page}&pageSize=60&takeable=1`)) ?? {};
      offers.push(...items.filter((o) => o.status === "open" && o.user?.id !== prep.myId));
      if (!more || items.length === 0) break;
      await ctx.sleep(250);
    }
    // Valeur de ce que chaque chercheur propose en échange = ce qu'il est prêt à « payer ».
    await loadPrices(ctx, offers.map((o) => o.characterId), prep.prices);
    const byCard = new Map(); // id -> { seekers: Set, offered: [valeurs] }
    for (const o of offers) {
      const offered = prep.prices.get(o.characterId)?.value ?? null;
      for (const id of o.wantIds ?? []) {
        const d = byCard.get(id) ?? { seekers: new Set(), offered: [] };
        d.seekers.add(o.user?.id ?? o.id);
        if (offered) d.offered.push(offered);
        byCard.set(id, d);
      }
    }
    return { byCard, offers: offers.length };
  }

  // ---------- Concurrence ----------
  // La recherche du site se fait par nom : elle peut renvoyer d'autres cartes au nom proche,
  // donc on ne garde que les annonces dont la carte a exactement le même identifiant.
  async function competitors(ctx, p, myId, card) {
    const types = p.competitorTypes.trim() === "*" ? [null] : p.competitorTypes.split(",").map((t) => t.trim()).filter(Boolean);
    const found = [];
    for (const type of types) {
      for (let page = 1; page <= p.listingPages; page++) {
        const data = await ctx.api(listingsPath(card, type, page));
        const items = Array.isArray(data) ? data : data?.items ?? data?.listings ?? [];
        for (const l of items) {
          const sameCard = (l.character?.id ?? l.characterId) === card.id;
          const active = l.status == null || l.status === "active";
          if (sameCard && active && l.seller?.id !== myId && typeof (l.currentBid ?? l.price) === "number") {
            found.push({ price: l.currentBid ?? l.price, buyout: l.buyoutPrice ?? null, type: l.type, bids: l.bidCount ?? 0 });
          }
        }
        const more = Array.isArray(data) ? items.length >= 24 : data?.more ?? items.length >= 24;
        if (!more || items.length === 0) break;
        await ctx.sleep(250);
      }
    }
    return found;
  }

  // Plus petit prix de départ dont le net dépasse le recyclage (ou simplement > recyclage).
  const floorFor = (p, recycle) => {
    let x = recycle + 1;
    if (p.netAboveRecycle) while (netSale(x) <= recycle) x++;
    return x;
  };

  // ---------- Étude de marché + prix d'une carte ----------
  async function study(ctx, p, prep, demand, x) {
    const S = STRATEGIES[p.strategy] ?? STRATEGIES.equilibre;
    const { median7d, median30d, sales7d, value } = x.market;
    const siteMin = prep.minPrice.get(x.card.rarity) ?? 0;
    const floor = Math.max(floorFor(p, x.recycle), siteMin);
    const rivals = await competitors(ctx, p, prep.myId, x.card);

    const d = demand.byCard.get(x.card.id);
    const seekers = d?.seekers.size ?? 0;
    // Ce que le chercheur le plus offrant propose en échange.
    const willingness = d?.offered.length ? Math.max(...d.offered) : null;
    const rivalBids = rivals.reduce((sum, r) => sum + r.bids, 0);
    const lowest = rivals.length ? Math.min(...rivals.map((r) => r.price)) : null;
    const rivalBuyouts = rivals.map((r) => r.buyout).filter((b) => typeof b === "number");
    const lowestBuyout = rivalBuyouts.length ? Math.min(...rivalBuyouts) : null;

    // Demande pondérée : un chercheur actif = 2 pts, une mise concurrente = 1 pt. Les ventes de la semaine
    // montrent que la carte se vend, pas qu'elle manque : échelle logarithmique, 1,5 pt au plus
    // (une carte courante se vend des centaines de fois par semaine).
    const salesPts = Math.min(1.5, Math.log2(1 + (sales7d ?? 0)) / 4);
    const demandScore = seekers * 2 + rivalBids + salesPts;
    // Pression = demande rapportée à l'offre concurrente.
    const pressure = demandScore / (1 + rivals.length);
    const trend = median7d && median30d ? median7d / median30d : 1;
    const fair = value * clamp(trend, 0.85, 1.15);

    const facts = { seekers, willingness, rivals: rivals.length, rivalBids, lowest, lowestBuyout, sales7d, trend, demandScore, pressure, fair, floor };
    if (siteMin && siteMin > (value * p.maxBuyoutPercent) / 100) return { ...facts, skip: `prix minimum du site (${fmt(siteMin)} ◆) au-dessus de la valeur` };
    if (demandScore < p.minDemand) return { ...facts, skip: `demande trop faible (score ${demandScore.toFixed(1)} < ${p.minDemand})` };

    // Départ attractif : forte demande -> départ plus bas, les mises feront monter le prix.
    let start = fair * (S.start - (pressure >= 2 ? 0.1 : pressure >= 1 ? 0.05 : 0));
    if (p.stayUnderRivals && lowest != null) {
      const underRivals = lowest - Math.max(1, Math.round((lowest * p.undercutPct) / 100));
      if (underRivals < floor) return { ...facts, skip: `concurrence trop basse (${fmt(lowest)} ◆) pour rester au-dessus ${siteMin >= floorFor(p, x.recycle) ? "du prix minimum du site" : "du recyclage"} (≥ ${fmt(floor)} ◆)` };
      start = Math.min(start, underRivals);
    }
    start = Math.max(Math.round(start), floor);

    // Achat immédiat : levier de gain, monte avec la pression de la demande.
    let buyout = null;
    if (p.useBuyout) {
      buyout = fair * (S.buyout + S.perPressure * Math.min(pressure, 5));
      // Ne pas dépasser ce que les chercheurs semblent prêts à mettre (avec 10 % de marge).
      if (willingness) buyout = Math.min(buyout, Math.max(fair * 1.05, willingness * 1.1));
      // Rester moins cher que l'achat immédiat concurrent.
      if (p.stayUnderRivals && lowestBuyout != null) buyout = Math.min(buyout, lowestBuyout - 1);
      buyout = Math.min(buyout, (value * p.maxBuyoutPercent) / 100);
      buyout = Math.max(Math.round(buyout), start + 1);
    }

    // Prix de vente attendu : de la valeur juste vers l'achat immédiat selon la pression.
    const expected = Math.round(clamp(fair * (0.9 + 0.05 * Math.min(pressure, 4)), start, buyout ?? Math.max(start, fair * 1.2)));
    const hours = pressure >= 2 && p.fastDurationHours ? p.fastDurationHours : p.durationHours;
    const gain = netSale(expected) - x.recycle;
    // Les places d'annonces sont limitées : pas de carte qui rapporte trop peu.
    if (gain < p.minGain) return { ...facts, skip: `gain attendu trop faible (${fmt(gain)} ◆ < ${fmt(p.minGain)} ◆)`, start, buyout, expected, gain };
    return { ...facts, start, buyout, expected, hours, gain };
  }

  // ---------- Cartes déjà prises (annonces, offres d'échange) ----------
  async function readBlockers(ctx, myId) {
    const [rows, market, myOffers] = await Promise.all([
      ctx.api("/me/collection?lean=1"),
      ctx.api("/me/market"),
      ctx.api("/trades/offers/mine").catch(() => []),
    ]);
    const active = (market.listings ?? []).filter((l) => l.status === "active");
    const excluded = new Set([
      ...active.map((l) => l.character?.id),
      ...myOffers.filter((o) => o.status === "open" && (!o.user || o.user.id === myId)).map((o) => o.characterId),
    ]);
    return { rows, active, excluded };
  }

  register({
    id: "encheres-concurrentiel",
    name: "Enchères (étude de marché)",
    icon: "🔨",
    description: "Étudie la demande, les ventes et la concurrence de mes doublons, puis les met aux enchères au meilleur prix tout en restant attractif.",
    params: [
      { key: "strategy", label: "Stratégie", type: "select", default: "equilibre",
        options: [["equilibre", "Équilibrée"], ["max", "Gain maximum"], ["rapide", "Vente rapide"]],
        help: "Gain maximum : départ et achat immédiat plus hauts. Vente rapide : plus bas, part plus vite." },
      { key: "minRecycleMultiple", label: "Valeur ≥ X × recyclage", type: "number", default: 5, min: 1, max: 1000, step: 0.5 },
      { key: "minGain", label: "Gain minimum par carte (◆)", type: "number", default: 50, min: 0, max: 1000000,
        help: "Net attendu − recyclage. Les places d'annonces sont limitées : on les garde pour les cartes qui rapportent." },
      { key: "minDemand", label: "Score de demande minimum", type: "number", default: 0, min: 0, max: 100, step: 0.5,
        help: "0 : toutes les cartes. 1 chercheur = 2 pts, 1 mise concurrente = 1 pt, ventes sur 7 j = 1,5 pt au plus." },
      { key: "stayUnderRivals", label: "Rester moins cher que la concurrence", type: "boolean", default: true },
      { key: "undercutPct", label: "Sous le moins cher de (%)", type: "number", default: 2, min: 0, max: 90, step: 0.5 },
      { key: "useBuyout", label: "Proposer un achat immédiat", type: "boolean", default: true },
      { key: "maxBuyoutPercent", label: "Achat immédiat max (% de la valeur)", type: "number", default: 180, min: 100, max: 1000 },
      { key: "netAboveRecycle", label: "Le net après taxe et frais doit dépasser le recyclage", type: "boolean", default: true },
      { key: "totalAuctions", label: "Enchères max par lancement", type: "number", default: 0, min: 0, max: 1000, help: "0 : toutes les cartes retenues." },
      { key: "maxActiveListings", label: "Annonces actives max (à vérifier)", type: "number", default: 10, min: 1, max: 100 },
      { key: "durationHours", label: "Durée de l'enchère (h, à vérifier)", type: "number", default: 24, min: 1, max: 168 },
      { key: "fastDurationHours", label: "Durée si forte demande (h)", type: "number", default: 12, min: 0, max: 168, help: "0 : toujours la durée normale." },
      { key: "keepCopies", label: "Exemplaires à toujours garder", type: "number", default: 1, min: 0, max: 50 },
      { key: "recycleOverride", label: "Recyclage forcé par rareté (◆)", type: "rarityMap", default: {}, group: "advanced",
        help: "Vide : détection automatique. À remplir si l'aperçu ne trouve pas le prix de recyclage." },
      { key: "minPriceOverride", label: "Prix minimum du site par rareté (◆)", type: "rarityMap", default: {}, group: "advanced",
        help: "Vide : appris automatiquement (et mémorisé) quand le site refuse une annonce trop basse." },
      { key: "demandPages", label: "Pages du tableau d'échanges lues", type: "number", default: 10, min: 1, max: 40, group: "advanced",
        help: "60 offres par page." },
      { key: "competitorTypes", label: "Types d'annonces observés", type: "text", default: "auction", group: "advanced",
        help: "Séparés par des virgules. « * » : sans filtre de type." },
      { key: "listingPages", label: "Pages d'annonces lues par carte", type: "number", default: 5, min: 1, max: 20, group: "advanced" },
      { key: "pollSec", label: "Vérification d'une place libre (s)", type: "number", default: 60, min: 10, max: 3600, group: "advanced" },
      { key: "delayMs", label: "Pause entre deux publications (ms)", type: "number", default: 1500, min: 0, max: 60000, group: "advanced" },
      { key: "maxFailures", label: "Arrêt après N cycles en échec", type: "number", default: 3, min: 1, max: 20, group: "advanced" },
      { key: "endpoint", label: "Endpoint de création (à vérifier)", type: "text", default: "/market/listings", group: "advanced" },
    ],

    async preview(ctx, p) {
      const prep = await prepare(ctx, p);
      if (!prep.recycleFound) {
        return {
          summary: "Prix de recyclage introuvable automatiquement : renseigne « Recyclage forcé par rareté » dans les réglages avancés (montants affichés par le bouton Recycler du site).",
          warnings: [`Champs carte : ${prep.recycleDebug.card}`, `Champs collection : ${prep.recycleDebug.entry}`, `Clés /config : ${prep.recycleDebug.config}`],
          columns: [], rows: [], canRun: false, state: prep,
        };
      }

      ctx.status("Lecture des annonces et offres en cours…");
      const first = await readBlockers(ctx, prep.myId);
      const candidates = prep.spareRows(first.rows, first.excluded).map(prep.eligible).filter(Boolean);
      const demand = await scanDemand(ctx, p, prep);

      const studied = [];
      for (const x of candidates) {
        ctx.status(`Étude de marché : ${studied.length + 1}/${candidates.length} — ${x.card.name}`);
        let s;
        try { s = await study(ctx, p, prep, demand, x); } catch (e) {
          if (e instanceof KyaraExt.StoppedError) throw e;
          s = { skip: `concurrence illisible (${e.message})` };
        }
        studied.push({ x, s });
        await ctx.sleep(300);
      }
      // Meilleur gain attendu d'abord ; les cartes ignorées à la fin.
      studied.sort((a, b) => (a.s.skip ? 1 : 0) - (b.s.skip ? 1 : 0) || (b.s.gain ?? 0) - (a.s.gain ?? 0));
      const limit = p.totalAuctions || studied.length;
      const kept = studied.filter((r) => !r.s.skip);
      const totalGain = kept.slice(0, limit).reduce((sum, r) => sum + r.s.gain, 0);
      const sought = studied.filter((r) => r.s.seekers > 0).length;

      const warnings = [
        `Demande : ${demand.offers} offre(s) d'échange ouvertes demandent mes cartes ; ${sought}/${studied.length} doublon(s) sont cherchés par au moins un joueur.`,
        "Les wishlists des autres joueurs ne sont pas lisibles : la demande est estimée par les offres d'échange qui demandent la carte, les ventes de la semaine et les mises concurrentes.",
        "Endpoint de création déduit (non vérifié) : contrôle la première publication dans F12 > Réseau.",
        "Une enchère qui a reçu des mises ne peut plus être retirée.",
      ];
      if (prep.configHits.length) warnings.unshift(`Recyclage détecté dans /config : ${prep.configHits.join(", ")}`);
      if (studied.some((r) => r.s.sales7d === null && !r.s.skip)) warnings.push("Nombre de ventes sur 7 jours absent des prix : il ne compte pas dans le score de demande.");

      return {
        summary: candidates.length === 0
          ? `Aucun doublon n'a une valeur ≥ ${p.minRecycleMultiple} × son prix de recyclage : rien à mettre aux enchères.`
          : `${Math.min(kept.length, limit)} enchère(s) retenue(s) sur ${studied.length} doublon(s) étudié(s), gain attendu ≈ ${fmt(totalGain)} ◆ au-dessus du recyclage. ${first.active.length}/${p.maxActiveListings} annonces déjà actives. Les prix sont recalculés juste avant chaque publication.`,
        warnings,
        columns: [
          { key: "card", label: "Carte" },
          { key: "value", label: "Valeur (tend.)", align: "end" },
          { key: "sales", label: "Ventes 7 j", align: "end" },
          { key: "seekers", label: "Chercheurs", align: "end" },
          { key: "rivals", label: "Concurrence", align: "end" },
          { key: "pressure", label: "Pression", align: "end" },
          { key: "start", label: "Départ", align: "end" },
          { key: "buyout", label: "Achat imm.", align: "end" },
          { key: "expected", label: "Attendu (net)", align: "end" },
          { key: "gain", label: "Gain vs recycl.", align: "end" },
        ],
        rows: studied.map(({ x, s }, i) => ({
          id: x.card.id,
          selectable: !s.skip,
          note: s.skip ?? (i >= limit ? "au-delà du maximum par lancement" : s.hours !== p.durationHours ? `forte demande : ${s.hours} h` : null),
          cells: {
            card: `${x.card.name} (${LABELS[x.card.rarity] ?? x.card.rarity}) ×${x.n}`,
            value: s.fair == null ? fmt(x.market.value) : `${fmt(Math.round(s.fair))} (${pct(s.trend - 1)})`,
            sales: s.sales7d ?? "?",
            seekers: s.seekers == null ? "?" : s.willingness ? `${s.seekers} · offrent ≤ ${fmt(s.willingness)}` : s.seekers,
            rivals: s.rivals == null ? "?" : `${s.rivals} / ${s.rivalBids} mise(s)${s.lowest != null ? ` · dès ${fmt(s.lowest)}` : ""}`,
            pressure: s.pressure == null ? "?" : s.pressure.toFixed(1),
            start: s.skip ? "ignorée" : fmt(s.start),
            buyout: s.skip || s.buyout == null ? "—" : fmt(s.buyout),
            expected: s.skip ? "—" : `${fmt(s.expected)} (${fmt(netSale(s.expected))})`,
            gain: s.skip ? "—" : `${s.gain >= 0 ? "+" : ""}${fmt(s.gain)}`,
          },
        })),
        canRun: kept.length > 0,
        state: { ...prep, limit },
      };
    },

    async run(ctx, p, { excludedIds, state: prep }) {
      const { myId, limit } = prep;
      const handled = new Set(excludedIds); // publiées, ignorées ou décochées pendant ce lancement
      const st = { active: 0, published: 0, skipped: 0, cycles: 0, gain: 0 };
      let lastStatus = "";
      const refreshStatus = () =>
        ctx.status(`${st.active}/${p.maxActiveListings} annonces actives · ${st.published}/${limit} lancée(s) · ${st.skipped} ignorée(s) · gain attendu ≈ ${fmt(st.gain)} ◆`);

      async function cycle() {
        if (st.published >= limit) return true;
        const { rows, active, excluded } = await readBlockers(ctx, myId);
        st.active = active.length;
        const queue = prep.spareRows(rows, excluded).map(prep.eligible).filter(Boolean).filter((x) => !handled.has(x.card.id));
        if (queue.length === 0) {
          ctx.log("Plus de doublon à mettre aux enchères. Arrêt.", "warn");
          return true;
        }
        const freeSlots = p.maxActiveListings - active.length;
        if (freeSlots <= 0) {
          const status = `${active.length}/${p.maxActiveListings} annonces actives : en attente d'une place…`;
          if (status !== lastStatus) ctx.log(status);
          lastStatus = status;
          return false;
        }
        // Demande et concurrence relues juste avant de publier, meilleur gain d'abord.
        const demand = await scanDemand(ctx, p, prep);
        const studied = [];
        for (const x of queue) {
          if (ctx.stopped) break;
          ctx.status(`Étude de marché : ${x.card.name}…`);
          studied.push({ x, s: await study(ctx, p, prep, demand, x) });
        }
        studied.sort((a, b) => (a.s.skip ? 1 : 0) - (b.s.skip ? 1 : 0) || (b.s.gain ?? 0) - (a.s.gain ?? 0));

        let used = 0;
        for (let { x, s } of studied) {
          if (ctx.stopped || used >= freeSlots || st.published >= limit) break;
          handled.add(x.card.id);
          // Prix calculé avant qu'un refus n'apprenne le minimum de cette rareté : on recalcule.
          if (!s.skip && (prep.minPrice.get(x.card.rarity) ?? 0) > s.start) s = await study(ctx, p, prep, demand, x);
          // Une annonce refusée pour prix trop bas : on retient le minimum de la rareté et on recalcule une fois.
          for (let attempt = 0; !s.skip; attempt++) {
            try {
              await ctx.api(p.endpoint, { method: "POST", body: buildBody(x.card.id, s.start, s.buyout, s.hours), withPass: true });
              break;
            } catch (e) {
              if (e instanceof KyaraExt.StoppedError) throw e;
              const min = minPriceFromError(e);
              if (min && attempt === 0) {
                prep.minPrice.set(x.card.rarity, min);
                learnMin(x.card.rarity, min);
                ctx.log(`Prix minimum du site pour ${LABELS[x.card.rarity] ?? x.card.rarity} : ${fmt(min)} ◆ (retenu pour la suite). Nouveau calcul pour ${x.card.name}…`, "info");
                s = await study(ctx, p, prep, demand, x);
                continue;
              }
              s = { ...s, skip: `refusée par le site (${e.message})` };
            }
          }
          if (s.skip) {
            st.skipped++;
            ctx.log(`⏭ ${x.card.name} ignorée : ${s.skip}.`, "warn");
            continue;
          }
          used++;
          st.published++;
          st.gain += s.gain;
          refreshStatus();
          ctx.log(`🔨 ${x.card.name} — départ ${fmt(s.start)} ◆${s.buyout ? `, achat immédiat ${fmt(s.buyout)} ◆` : ""}, ${s.hours} h · ${s.seekers} chercheur(s), ${s.rivals} concurrent(s), pression ${s.pressure.toFixed(1)} · attendu ≈ ${fmt(s.expected)} ◆ (net ${fmt(netSale(s.expected))} ◆, recyclage ${fmt(x.recycle)} ◆)`, "success");
          await ctx.sleep(p.delayMs + Math.random() * 1000);
        }
        lastStatus = "";
        const left = queue.filter((x) => !handled.has(x.card.id)).length;
        return st.published >= limit || left === 0 || ctx.stopped;
      }

      ctx.log(`Lancé : ${limit} enchère(s) maximum, stratégie « ${p.strategy} ».`);
      let failures = 0;
      while (!ctx.stopped) {
        try {
          const finished = await cycle();
          st.cycles++;
          refreshStatus();
          failures = 0;
          if (finished) break;
        } catch (e) {
          if (e instanceof KyaraExt.StoppedError) break;
          failures++;
          ctx.log(`✖ Cycle en échec (${failures}/${p.maxFailures}) : ${e.message}`, "error");
          if (failures >= p.maxFailures) {
            ctx.log("Arrêt. Vérifie la lecture des annonces, l'endpoint de création ou ta connexion.", "error");
            break;
          }
        }
        await ctx.sleep(p.pollSec * 1000 + Math.random() * 5000);
      }
      ctx.log(`Terminé : ${st.published} enchère(s) lancée(s), ${st.skipped} ignorée(s), gain attendu ≈ ${fmt(st.gain)} ◆ au-dessus du recyclage.`, "success");
    },
  });
})();
