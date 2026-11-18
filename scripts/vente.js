/*
 * Met mes doublons en vente au marché, à un prix choisi par rapport au marché :
 * chère, prix du marché, concurrentiel (sous l'annonce la moins chère), abordable, liquidation, personnalisé,
 * ou étude de marché (enchère guidée par la demande et la concurrence, voir scripts/lib/marche.js).
 *
 * API du site (formulaire « Mettre en vente », chunk 0gwOsErE.js) :
 *   POST /market/listings        { characterId, type: "fixed" | "auction", price, buyoutPrice, durationHours } -> { matched? }
 *                                un exemplaire par annonce ; code d'accès (x-pass) requis
 *   GET  /fair-play/bounds/:id   { min, max } : fourchette de prix acceptée pour la carte
 *   GET  /market/listings?characterId=&type=fixed&sort=price_asc   annonces concurrentes
 *   GET  /market/buy-orders?characterId=   [{ price, qty }] : une annonce ≤ un ordre part tout de suite
 *   GET  /me/market/access       { allowed, reasons }
 * Prix minimum du site = max(recyclage de la rareté, bounds.min, minimum appris sur un refus).
 */
(() => {
  const K = globalThis.KyaraExt;
  const M = K.marche;
  const { LABELS, fmt, netSale } = K;

  const POSITIONS = [
    ["chere", "💎 Chère"],
    ["marche", "⚖️ Marché"],
    ["concurrentiel", "🎯 Concurrentiel"],
    ["abordable", "💸 Abordable"],
    ["liquidation", "⚡ Liquidation"],
    ["perso", "✏️ Perso"],
    ["etude", "🧠 Étude de marché"],
  ];
  const FIXED_POSITIONS = POSITIONS.map(([v]) => v).filter((v) => v !== "etude");
  const pct = (x) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)} %`;
  const typeOf = (p) => (p.position === "etude" ? "auction" : p.type);

  const percentOf = (p) =>
    ({
      chere: p.pctChere,
      marche: p.pctMarche,
      abordable: p.pctAbordable,
      liquidation: p.pctLiquidation,
      perso: p.pctPerso,
    })[p.position];

  function reference(p, prices) {
    if (!prices) return null;
    const order = {
      median7d: ["median7d", "median30d", "lastPrice"],
      median30d: ["median30d", "median7d", "lastPrice"],
      lastPrice: ["lastPrice", "median7d", "median30d"],
    }[p.reference];
    for (const key of order) if (prices[key]) return prices[key];
    return null;
  }

  // Prix d'une carte selon la position choisie, borné par la fourchette du site.
  function priceFor(p, x) {
    const notes = [];
    let price;
    if (p.position === "concurrentiel") {
      const floor = Math.round((x.ref * p.floorPercent) / 100);
      if (x.lowest == null) {
        price = x.ref;
        notes.push("aucune annonce concurrente : prix de référence");
      } else if (x.lowest - p.undercut < floor) {
        price = floor;
        notes.push(`concurrence à ${fmt(x.lowest)} ◆, sous le plancher de ${p.floorPercent} %`);
      } else price = x.lowest - p.undercut;
    } else price = (x.ref * percentOf(p)) / 100;
    price = Math.round(price);
    if (price < x.min) {
      price = x.min;
      notes.push(`relevé au prix minimum du site (${fmt(x.min)} ◆)`);
    }
    if (x.max && price > x.max) {
      price = x.max;
      notes.push(`ramené au prix maximum du site (${fmt(x.max)} ◆)`);
    }
    let buyout = null;
    if (p.type === "auction" && p.buyoutPercent > 0) {
      buyout = Math.round((x.ref * p.buyoutPercent) / 100);
      if (x.max) buyout = Math.min(buyout, x.max);
      if (buyout <= price) buyout = null;
    }
    // Un ordre d'achat paie plus que le prix voulu : autant vendre à son prix, la vente est immédiate.
    if (p.type === "fixed" && x.bestOrder != null && x.bestOrder >= price && (!x.max || x.bestOrder <= x.max)) {
      if (x.bestOrder > price) notes.push(`relevé à l'ordre d'achat de ${fmt(x.bestOrder)} ◆`);
      price = x.bestOrder;
      notes.push("part tout de suite à un ordre d'achat");
    }
    return { price, buyout, hours: Number(p.durationHours), notes };
  }

  // Prix (et étude) d'une carte ; skip si elle ne doit pas partir.
  async function plan(ctx, p, demand, x) {
    if (p.position !== "etude") {
      const r = priceFor(p, x);
      if (r.price < p.minPrice) return { ...r, skip: `prix sous ${fmt(p.minPrice)} ◆` };
      // Recycler rapporterait autant ou plus que la vente, taxe et frais déduits.
      if (netSale(r.price) <= x.recycle) return { ...r, skip: "le net ne dépasse pas le recyclage", belowRecycle: true };
      return { ...r, gain: netSale(r.price) - x.recycle };
    }
    if (x.ref < p.minRecycleMultiple * x.recycle) return { skip: `valeur < ${p.minRecycleMultiple} × recyclage` };
    const s = await M.study(ctx, p, demand, x);
    return { ...s, price: s.start, notes: s.skip ? [s.skip] : s.hours !== Number(p.durationHours) ? [`forte demande : ${s.hours} h`] : [] };
  }

  // Les réglages de l'ancien script « Enchères (étude de marché) » sont repris par la position Étude de marché.
  const ETUDE_KEYS = [
    "strategy",
    "minGain",
    "minDemand",
    "minRecycleMultiple",
    "stayUnderRivals",
    "undercutPct",
    "useBuyout",
    "maxBuyoutPercent",
    "fastDurationHours",
    "netAboveRecycle",
    "maxActiveListings",
    "demandPages",
    "listingPages",
    "pollSec",
    "maxFailures",
    "recycleOverride",
    "minPriceOverride",
  ];

  K.register({
    id: "vente",
    name: "Vendre mes doublons",
    icon: "🏷️",
    category: "Marché",
    short: "Prix fixe, enchère ou étude de marché",
    description:
      "Met mes doublons en vente au marché, plus ou moins cher que le prix du marché, ou aux enchères guidées par une étude de la demande et de la concurrence.",
    legacy: {
      "encheres-concurrentiel": (old) => Object.fromEntries(ETUDE_KEYS.filter((k) => k in old).map((k) => [k, old[k]])),
    },
    params: [
      {
        key: "position",
        label: "Prix",
        type: "choice",
        default: "marche",
        options: POSITIONS,
        help: "Par rapport à la référence : Chère 125 %, Marché 100 %, Abordable 85 %, Liquidation 60 % (modifiables dans Réglages avancés). Concurrentiel : juste sous l'annonce la moins chère. Étude de marché : enchère dont le départ et l'achat immédiat suivent la demande.",
      },
      { key: "pctPerso", label: "Prix (% de la référence)", type: "number", default: 95, min: 1, max: 1000, enabledWhen: { position: "perso" } },
      {
        key: "undercut",
        label: "Sous la moins chère de (◆)",
        type: "number",
        default: 1,
        min: 0,
        max: 100000,
        enabledWhen: { position: "concurrentiel" },
        row: "conc",
      },
      {
        key: "floorPercent",
        label: "Jamais sous (% de la réf.)",
        type: "number",
        default: 70,
        min: 1,
        max: 100,
        title: "Évite de suivre une concurrence qui brade.",
        enabledWhen: { position: "concurrentiel" },
        row: "conc",
      },
      {
        key: "strategy",
        label: "Stratégie",
        type: "select",
        default: "equilibre",
        enabledWhen: { position: "etude" },
        options: [
          ["equilibre", "Équilibrée"],
          ["max", "Gain maximum"],
          ["rapide", "Vente rapide"],
        ],
        help: "Gain maximum : départ et achat immédiat plus hauts. Vente rapide : plus bas, part plus vite.",
      },
      { key: "useBuyout", label: "Proposer un achat immédiat", type: "boolean", default: true, enabledWhen: { position: "etude" } },
      { key: "rarities", label: "Raretés à vendre", type: "raritySet", default: ["C", "U", "R", "E", "L", "M"] },
      {
        key: "type",
        label: "Type d'annonce",
        type: "select",
        default: "fixed",
        enabledWhen: { position: FIXED_POSITIONS },
        row: "type",
        options: [
          ["fixed", "Prix fixe"],
          ["auction", "Enchère (le prix devient la mise de départ)"],
        ],
      },
      {
        key: "buyoutPercent",
        label: "Achat immédiat (% de la réf., 0 = aucun)",
        type: "number",
        default: 0,
        min: 0,
        max: 1000,
        enabledWhen: { type: "auction", position: FIXED_POSITIONS },
        row: "type",
      },
      {
        key: "durationHours",
        label: "Durée",
        type: "select",
        default: "24",
        row: "qty",
        options: [
          ["12", "12 h"],
          ["24", "24 h"],
          ["48", "48 h"],
          ["72", "72 h (abonnés)"],
          ["168", "7 jours (abonnés)"],
        ],
      },
      { key: "maxListings", label: "Annonces max par lancement", type: "number", default: 10, min: 1, max: 200, row: "qty" },

      // Réglages avancés : vente
      {
        key: "reference",
        label: "Référence",
        type: "select",
        default: "median7d",
        group: "advanced",
        options: [
          ["median7d", "Médiane 7 jours"],
          ["median30d", "Médiane 30 jours"],
          ["lastPrice", "Dernière vente"],
        ],
      },
      {
        key: "copiesPerCard",
        label: "Exemplaires par carte",
        type: "number",
        default: 1,
        min: 1,
        max: 50,
        help: "Une annonce par exemplaire.",
        group: "advanced",
      },
      { key: "keepCopies", label: "Exemplaires à toujours garder", type: "number", default: 1, min: 0, max: 50, group: "advanced" },
      {
        key: "minPrice",
        label: "Ignorer les cartes sous (◆)",
        type: "number",
        default: 0,
        min: 0,
        max: 1000000,
        help: "Garde les places d'annonce pour les cartes qui valent quelque chose.",
        group: "advanced",
        enabledWhen: { position: FIXED_POSITIONS },
      },
      {
        key: "pctChere",
        label: "Chère (%)",
        type: "number",
        default: 125,
        min: 1,
        max: 1000,
        group: "advanced",
        row: "pct",
        enabledWhen: { position: FIXED_POSITIONS },
      },
      {
        key: "pctMarche",
        label: "Marché (%)",
        type: "number",
        default: 100,
        min: 1,
        max: 1000,
        group: "advanced",
        row: "pct",
        enabledWhen: { position: FIXED_POSITIONS },
      },
      {
        key: "pctAbordable",
        label: "Abordable (%)",
        type: "number",
        default: 85,
        min: 1,
        max: 1000,
        group: "advanced",
        row: "pct",
        enabledWhen: { position: FIXED_POSITIONS },
      },
      {
        key: "pctLiquidation",
        label: "Liquidation (%)",
        type: "number",
        default: 60,
        min: 1,
        max: 1000,
        group: "advanced",
        row: "pct",
        enabledWhen: { position: FIXED_POSITIONS },
      },
      {
        key: "maxActiveListings",
        label: "Annonces actives max",
        type: "number",
        default: 10,
        min: 1,
        max: 100,
        group: "advanced",
        help: "Places d'annonce du site : au-delà, le script attend qu'une place se libère.",
      },
      { key: "pollSec", label: "Vérification d'une place libre (s)", type: "number", default: 60, min: 10, max: 3600, group: "advanced" },
      { key: "delayMs", label: "Pause entre deux annonces (ms)", type: "number", default: 1500, min: 0, max: 60000, group: "advanced" },
      { key: "maxFailures", label: "Arrêt après N refus d'affilée", type: "number", default: 3, min: 1, max: 20, group: "advanced" },

      // Réglages avancés : étude de marché
      {
        key: "minGain",
        label: "Gain minimum par carte (◆)",
        type: "number",
        default: 50,
        min: 0,
        max: 1000000,
        group: "advanced",
        enabledWhen: { position: "etude" },
        help: "Net attendu − recyclage. Les places d'annonces sont limitées : on les garde pour les cartes qui rapportent.",
      },
      {
        key: "minDemand",
        label: "Score de demande minimum",
        type: "number",
        default: 0,
        min: 0,
        max: 100,
        step: 0.5,
        group: "advanced",
        enabledWhen: { position: "etude" },
        help: "1 chercheur = 2 pts, 1 mise concurrente = 1 pt, ventes sur 7 j = 1,5 pt au plus.",
      },
      {
        key: "minRecycleMultiple",
        label: "Valeur ≥ X × recyclage",
        type: "number",
        default: 5,
        min: 1,
        max: 1000,
        step: 0.5,
        group: "advanced",
        enabledWhen: { position: "etude" },
      },
      {
        key: "stayUnderRivals",
        label: "Rester moins cher que la concurrence",
        type: "boolean",
        default: true,
        group: "advanced",
        enabledWhen: { position: "etude" },
      },
      {
        key: "undercutPct",
        label: "Sous le moins cher de (%)",
        type: "number",
        default: 2,
        min: 0,
        max: 90,
        step: 0.5,
        group: "advanced",
        enabledWhen: { position: "etude", stayUnderRivals: true },
      },
      {
        key: "maxBuyoutPercent",
        label: "Achat immédiat max (% de la valeur)",
        type: "number",
        default: 180,
        min: 100,
        max: 1000,
        group: "advanced",
        enabledWhen: { position: "etude", useBuyout: true },
      },
      {
        key: "netAboveRecycle",
        label: "Le net après taxe et frais doit dépasser le recyclage",
        type: "boolean",
        default: true,
        group: "advanced",
        enabledWhen: { position: "etude" },
      },
      {
        key: "fastDurationHours",
        label: "Durée si forte demande (h, 0 = normale)",
        type: "number",
        default: 12,
        min: 0,
        max: 168,
        group: "advanced",
        enabledWhen: { position: "etude" },
      },
      {
        key: "demandPages",
        label: "Pages du tableau d'échanges lues",
        type: "number",
        default: 10,
        min: 1,
        max: 40,
        group: "advanced",
        enabledWhen: { position: "etude" },
        help: "60 offres par page.",
      },
      {
        key: "listingPages",
        label: "Pages d'enchères lues par carte",
        type: "number",
        default: 2,
        min: 1,
        max: 20,
        group: "advanced",
        enabledWhen: { position: "etude" },
      },
      {
        key: "recycleOverride",
        label: "Recyclage forcé par rareté (◆)",
        type: "rarityMap",
        default: {},
        group: "advanced",
        help: `Vide : valeurs du site (${K.RARITIES_ASC.map((r) => `${r} ${K.RECYCLE[r]}`).join(", ")}).`,
      },
      {
        key: "minPriceOverride",
        label: "Prix minimum du site par rareté (◆)",
        type: "rarityMap",
        default: {},
        group: "advanced",
        help: "Vide : fourchette du site, ou minimum appris (et mémorisé) quand le site refuse une annonce trop basse.",
      },
    ],

    async preview(ctx, p) {
      if (!p.rarities.length) throw new Error("Choisis au moins une rareté à vendre.");
      ctx.status("Lecture de la collection, du catalogue et du marché…");
      const [access, catalog, collection, config, busy, me] = await Promise.all([
        ctx.api("/me/market/access").catch(() => null),
        ctx.catalog(),
        ctx.api("/me/collection?lean=1"),
        ctx.config(),
        ctx.busyCards(),
        ctx.me(),
      ]);
      // Cartes déjà en vente ou proposées dans une offre d'échange ouverte : on n'y touche pas.
      const spares = K.spares(collection, catalog, { keepCopies: p.keepCopies, rarities: p.rarities, busy: busy.ids }).map((x) => ({
        ...x,
        n: Math.min(x.n, p.copiesPerCard),
      }));

      const prices = await ctx.loadPrices(spares.map((x) => x.card.id));
      const learned = M.learnedMins();
      const recycle = (r) => p.recycleOverride?.[r] ?? K.recycleOf(r, config);
      // Les plus chères d'abord : ce sont elles qui méritent une place d'annonce.
      const ranked = spares
        .map((x) => ({ ...x, market: prices.get(x.card.id), ref: reference(p, prices.get(x.card.id)) }))
        .filter((x) => x.ref)
        .sort((a, b) => b.ref - a.ref);
      const noPrice = spares.length - ranked.length;
      const etude = p.position === "etude";
      const demand = etude ? await M.scanDemand(ctx, p, me.id, prices) : null;

      // Fourchette du site, concurrence et ordres d'achat : lus pour les cartes en tête seulement.
      // Étude de marché : on étudie deux fois plus de cartes que de places pour garder les meilleurs gains.
      const studyLimit = etude ? p.maxListings * 2 : Infinity;
      const rows = [],
        skipped = [];
      let slots = p.maxListings,
        belowRecycle = 0,
        studied = 0;
      for (const x of ranked) {
        if ((!etude && slots <= 0) || studied >= studyLimit) break;
        studied++;
        ctx.status(`Étude du marché : ${studied} — ${x.card.name}`);
        const [bounds, listings, orders] = await Promise.all([
          ctx.api(`/fair-play/bounds/${x.card.id}`).catch(() => null),
          ctx.api(`/market/listings?characterId=${x.card.id}&type=fixed&sort=price_asc&page=1&pageSize=5`).catch(() => null),
          ctx.api(`/market/buy-orders?characterId=${x.card.id}`).catch(() => []),
        ]);
        const rivals = (listings?.items ?? []).filter((l) => !l.isMine && l.character?.id === x.card.id && l.status === "active");
        const r = x.card.rarity;
        const y = {
          ...x,
          recycle: recycle(r),
          min: Math.max(recycle(r), bounds?.min ?? 0, p.minPriceOverride?.[r] ?? learned[r] ?? 0),
          max: bounds?.max ?? null,
          lowest: rivals[0]?.price ?? null,
          bestOrder: orders[0]?.price ?? null,
        };
        let pl;
        try {
          pl = await plan(ctx, p, demand, y);
        } catch (e) {
          if (e instanceof K.StoppedError) throw e;
          pl = { skip: `concurrence illisible (${e.message})`, notes: [] };
        }
        if (pl.skip) {
          if (pl.belowRecycle) belowRecycle++;
          else if (etude) skipped.push({ ...y, ...pl });
          continue;
        }
        if (!etude) {
          y.n = Math.min(y.n, slots);
          slots -= y.n;
        }
        rows.push({ ...y, ...pl });
      }
      if (etude) {
        // Meilleur gain attendu d'abord, dans la limite des annonces par lancement.
        rows.sort((a, b) => b.gain - a.gain);
        let left = p.maxListings;
        for (const row of rows) {
          row.n = Math.min(row.n, left);
          left -= row.n;
        }
        rows.splice(0, rows.length, ...rows.filter((r) => r.n > 0));
      }

      const warnings = [];
      if (access && !access.allowed) warnings.push(`Le marché t'est fermé : ${(access.reasons ?? []).join(" ")}`);
      if (noPrice) warnings.push(`${noPrice} carte(s) sans prix de référence, ignorée(s).`);
      if (belowRecycle) warnings.push(`${belowRecycle} carte(s) ignorée(s) : le net de la vente ne dépasse pas le recyclage.`);
      if (etude) {
        const sought = rows.filter((r) => r.seekers > 0).length;
        warnings.push(
          `Demande : ${demand.offers} offre(s) d'échange ouvertes demandent mes cartes ; ${sought}/${rows.length} carte(s) retenue(s) sont cherchées.`,
        );
        if (ranked.length > studyLimit) warnings.push(`${studyLimit} cartes les plus chères étudiées sur ${ranked.length}.`);
      }
      if (typeOf(p) === "auction") warnings.push("Une enchère qui a reçu des mises ne peut plus être retirée.");
      if (busy.listings.length >= p.maxActiveListings)
        warnings.push(`${busy.listings.length}/${p.maxActiveListings} annonces déjà en cours : la publication attendra qu'une place se libère.`);
      const total = rows.reduce((s, r) => s + r.n * netSale(etude ? r.expected : r.price), 0);
      const count = rows.reduce((s, r) => s + r.n, 0);
      const showBuyout = etude ? p.useBuyout : p.type === "auction" && p.buyoutPercent > 0;
      const all = [...rows, ...skipped];

      return {
        summary: rows.length
          ? `${count} annonce(s) sur ${spares.length} doublon(s) éligible(s), ${fmt(total)} ◆ net ${etude ? "attendu" : "si tout se vend"} (après taxe 5 % et frais 2 %).`
          : "Aucun doublon à mettre en vente avec ces réglages.",
        warnings,
        columns: [
          { key: "card", label: "Carte" },
          { key: "ref", label: "Référence", align: "end" },
          ...(etude
            ? [
                { key: "seekers", label: "Chercheurs", align: "end" },
                { key: "rivals", label: "Concurrence", align: "end" },
                { key: "pressure", label: "Pression", align: "end" },
              ]
            : [
                { key: "lowest", label: "Moins chère", align: "end" },
                { key: "order", label: "Ordre max", align: "end" },
              ]),
          { key: "price", label: typeOf(p) === "auction" ? "Départ" : "Prix", align: "end" },
          ...(showBuyout ? [{ key: "buyout", label: "Achat imm.", align: "end" }] : []),
          { key: "delta", label: "vs réf.", align: "end" },
          { key: "net", label: etude ? "Net attendu" : "Net", align: "end", total: true },
          ...(etude ? [{ key: "gain", label: "Gain vs recycl.", align: "end", total: true }] : []),
        ],
        rows: all.map((r) => ({
          id: r.card.id,
          rarity: r.card.rarity,
          selectable: !r.skip,
          note: r.skip ?? (r.notes.join(" · ") || null),
          values: {
            net: r.skip ? 0 : r.n * netSale(etude ? r.expected : r.price),
            gain: r.skip ? 0 : r.n * r.gain,
            ref: r.ref,
            price: r.price ?? null,
            delta: r.price ? r.price / r.ref : null,
          },
          cells: {
            card: `${r.card.name} (${LABELS[r.card.rarity] ?? r.card.rarity})${r.n > 1 ? ` ×${r.n}` : ""}`,
            ref: fmt(r.ref),
            lowest: r.lowest == null ? "—" : fmt(r.lowest),
            order: r.bestOrder == null ? "—" : fmt(r.bestOrder),
            seekers: r.seekers == null ? "?" : r.willingness ? `${r.seekers} · offrent ≤ ${fmt(r.willingness)}` : r.seekers,
            rivals: r.rivals == null ? "?" : `${r.rivals} / ${r.rivalBids} mise(s)${r.lowest != null ? ` · dès ${fmt(r.lowest)}` : ""}`,
            pressure: r.pressure == null ? "?" : r.pressure.toFixed(1),
            price: r.skip ? "ignorée" : fmt(r.price),
            buyout: r.skip || r.buyout == null ? "—" : fmt(r.buyout),
            delta: r.skip ? "—" : pct(r.price / r.ref - 1),
            net: r.skip ? "—" : fmt(netSale(etude ? r.expected : r.price)),
            gain: r.skip ? "—" : `${r.gain >= 0 ? "+" : ""}${fmt(r.gain)}`,
          },
        })),
        canRun: rows.length > 0 && access?.allowed !== false,
        state: { rows, demand },
      };
    },

    async run(ctx, p, { excludedIds, state }) {
      const etude = p.position === "etude";
      const type = typeOf(p);
      const queue = state.rows.filter((r) => !excludedIds.has(r.card.id)).map((r) => ({ ...r, left: r.n }));
      const total = queue.reduce((s, r) => s + r.n, 0);
      let done = 0,
        sold = 0,
        failures = 0,
        waiting = false;
      const mine = new Set(); // cartes mises en vente par ce lancement
      ctx.log(`Lancé : ${total} annonce(s), ${type === "auction" ? "enchères" : "prix fixe"}${etude ? `, stratégie « ${p.strategy} »` : ""}.`);

      // Publie une annonce ; un refus pour prix trop bas apprend le minimum de la rareté et recalcule une fois.
      async function publish(r) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await ctx.api("/market/listings", {
              method: "POST",
              withPass: true,
              body: { characterId: r.card.id, type, price: r.price, buyoutPrice: r.buyout ?? undefined, durationHours: r.hours },
            });
          } catch (e) {
            const min = M.minPriceFromError(e);
            if (!min || attempt > 0 || e instanceof K.StoppedError) throw e;
            M.learnMin(r.card.rarity, min);
            r.min = Math.max(r.min, min);
            ctx.log(
              `Prix minimum du site pour ${LABELS[r.card.rarity] ?? r.card.rarity} : ${fmt(min)} ◆ (retenu pour la suite). Nouveau calcul pour ${r.card.name}…`,
              "info",
            );
            const again = await plan(ctx, p, state.demand, r);
            if (again.skip) throw new Error(again.skip);
            Object.assign(r, again);
          }
        }
      }

      while (queue.some((r) => r.left > 0)) {
        ctx.checkStopped();
        const busy = await ctx.busyCards();
        let free = p.maxActiveListings - busy.listings.length;
        if (free <= 0) {
          if (!waiting) ctx.log(`${busy.listings.length}/${p.maxActiveListings} annonces en cours : en attente d'une place…`);
          waiting = true;
          ctx.status(`${done}/${total} annonce(s) publiée(s) · en attente d'une place…`);
          await ctx.sleep(p.pollSec * 1000 + Math.random() * 5000);
          continue;
        }
        waiting = false;
        for (const r of queue) {
          if (free <= 0) break;
          if (r.left <= 0) continue;
          // Mise en vente ou en offre ailleurs depuis l'aperçu (à la main ou par un autre script).
          if (busy.ids.has(r.card.id) && !mine.has(r.card.id)) {
            ctx.log(`⏭ ${r.card.name} : déjà en vente ou en offre d'échange, ignorée.`, "warn");
            r.left = 0;
            continue;
          }
          // Étude de marché : prix recalculé juste avant de publier, pour cette carte seulement.
          if (etude && !mine.has(r.card.id)) {
            ctx.status(`Étude de marché : ${r.card.name}…`);
            const fresh = await plan(ctx, p, state.demand, r);
            if (fresh.skip) {
              ctx.log(`⏭ ${r.card.name} ignorée : ${fresh.skip}.`, "warn");
              r.left = 0;
              continue;
            }
            Object.assign(r, fresh);
          }
          while (r.left > 0 && free > 0) {
            ctx.checkStopped();
            ctx.status(`Annonce ${done + 1}/${total} : ${r.card.name}…`);
            try {
              const res = await publish(r);
              done++;
              free--;
              r.left--;
              failures = 0;
              mine.add(r.card.id);
              if (res?.matched) sold++;
              ctx.log(
                `🏷️ ${r.card.name} — ${fmt(r.price)} ◆${r.buyout ? `, achat immédiat ${fmt(r.buyout)} ◆` : ""}, ${r.hours} h (net ${fmt(netSale(etude ? r.expected : r.price))} ◆${etude ? " attendu" : ""})${res?.matched ? " · vendue tout de suite à un ordre d'achat" : ""}`,
                "success",
              );
            } catch (e) {
              if (e instanceof K.StoppedError) throw e;
              failures++;
              r.left = 0;
              ctx.log(`✖ ${r.card.name} refusée : ${e.message}`, "error");
              // Plusieurs refus d'affilée : sans doute plus de place d'annonce ou un code d'accès manquant.
              if (failures >= p.maxFailures) {
                ctx.log(`Arrêt après ${failures} refus d'affilée (places d'annonce pleines ? code d'accès ?).`, "error");
                ctx.status(`${done}/${total} annonce(s) publiée(s).`);
                return;
              }
              break;
            }
            await ctx.sleep(p.delayMs + Math.random() * 500);
          }
        }
      }
      ctx.status(`${done}/${total} annonce(s) publiée(s)${sold ? `, ${sold} vendue(s) tout de suite` : ""}.`);
    },
  });
})();
