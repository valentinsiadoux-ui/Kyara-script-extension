/*
 * Met mes doublons en vente au marché, à un prix choisi par rapport au marché :
 * chère, prix du marché, concurrentiel (sous l'annonce la moins chère), abordable, liquidation, personnalisé.
 *
 * API du site (formulaire « Mettre en vente », chunk 0gwOsErE.js) :
 *   POST /market/listings        { characterId, type: "fixed" | "auction", price, buyoutPrice, durationHours } -> { matched? }
 *                                un exemplaire par annonce ; code d'accès (x-pass) requis
 *   GET  /fair-play/bounds/:id   { min, max } : fourchette de prix acceptée pour la carte
 *   GET  /market/listings?characterId=&type=fixed&sort=price_asc   annonces concurrentes
 *   GET  /market/buy-orders?characterId=   [{ price, qty }] : une annonce ≤ un ordre part tout de suite
 *   GET  /me/market/access       { allowed, reasons }
 * Prix minimum du site = max(recyclage de la rareté, bounds.min).
 */
(() => {
  const K = globalThis.KyaraExt;
  const { LABELS, fmt, chunk, netSale } = K;

  const POSITIONS = [
    ["chere", "💎 Chère"],
    ["marche", "⚖️ Marché"],
    ["concurrentiel", "🎯 Concurrentiel"],
    ["abordable", "💸 Abordable"],
    ["liquidation", "⚡ Liquidation"],
    ["perso", "✏️ Perso"],
  ];
  // Valeurs du client du site si /config ne les donne pas.
  const RECYCLE = { C: 1, U: 1, R: 3, E: 10, L: 40, M: 150 };
  const pct = (x) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)} %`;

  const percentOf = (p) => ({
    chere: p.pctChere, marche: p.pctMarche, abordable: p.pctAbordable,
    liquidation: p.pctLiquidation, perso: p.pctPerso,
  })[p.position];

  function reference(p, prices) {
    if (!prices) return null;
    const order = { median7d: ["median7d", "median30d", "lastPrice"], median30d: ["median30d", "median7d", "lastPrice"], lastPrice: ["lastPrice", "median7d", "median30d"] }[p.reference];
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
    return { price, buyout, notes };
  }

  K.register({
    id: "vente",
    name: "Vendre mes doublons",
    icon: "🏷️",
    category: "Marché",
    short: "Prix fixe ou enchère, selon le marché",
    description: "Met mes doublons en vente au marché, plus ou moins cher que le prix du marché.",
    params: [
      {
        key: "position", label: "Prix", type: "choice", default: "marche", options: POSITIONS,
        help: "Par rapport à la référence : Chère 125 %, Marché 100 %, Abordable 85 %, Liquidation 60 % (modifiables dans Réglages avancés). Concurrentiel : juste sous l'annonce la moins chère.",
      },
      { key: "pctPerso", label: "Prix (% de la référence)", type: "number", default: 95, min: 1, max: 1000, enabledWhen: { position: "perso" } },
      { key: "undercut", label: "Sous la moins chère de (◆)", type: "number", default: 1, min: 0, max: 100000, enabledWhen: { position: "concurrentiel" } },
      {
        key: "floorPercent", label: "Jamais sous (% de la référence)", type: "number", default: 70, min: 1, max: 100,
        help: "Évite de suivre une concurrence qui brade.", enabledWhen: { position: "concurrentiel" },
      },
      {
        key: "reference", label: "Référence", type: "select", default: "median7d",
        options: [["median7d", "Médiane 7 jours"], ["median30d", "Médiane 30 jours"], ["lastPrice", "Dernière vente"]],
      },
      { key: "rarities", label: "Raretés à vendre", type: "raritySet", default: ["C", "U", "R", "E", "L", "M"] },
      { key: "type", label: "Type d'annonce", type: "select", default: "fixed", options: [["fixed", "Prix fixe"], ["auction", "Enchère (le prix devient la mise de départ)"]] },
      {
        key: "buyoutPercent", label: "Achat immédiat (% de la référence, 0 = aucun)", type: "number", default: 0, min: 0, max: 1000,
        enabledWhen: { type: "auction" },
      },
      { key: "durationHours", label: "Durée", type: "select", default: "24", options: [["12", "12 h"], ["24", "24 h"], ["48", "48 h"], ["72", "72 h (abonnés)"], ["168", "7 jours (abonnés)"]] },
      { key: "maxListings", label: "Annonces max par lancement", type: "number", default: 10, min: 1, max: 200 },
      { key: "copiesPerCard", label: "Exemplaires par carte", type: "number", default: 1, min: 1, max: 50, help: "Une annonce par exemplaire." },
      { key: "keepCopies", label: "Exemplaires à toujours garder", type: "number", default: 1, min: 0, max: 50 },
      { key: "minPrice", label: "Ignorer les cartes sous (◆)", type: "number", default: 0, min: 0, max: 1000000, help: "Garde les places d'annonce pour les cartes qui valent quelque chose." },
      { key: "pctChere", label: "Chère (%)", type: "number", default: 125, min: 1, max: 1000, group: "advanced" },
      { key: "pctMarche", label: "Marché (%)", type: "number", default: 100, min: 1, max: 1000, group: "advanced" },
      { key: "pctAbordable", label: "Abordable (%)", type: "number", default: 85, min: 1, max: 1000, group: "advanced" },
      { key: "pctLiquidation", label: "Liquidation (%)", type: "number", default: 60, min: 1, max: 1000, group: "advanced" },
      { key: "delayMs", label: "Pause entre deux annonces (ms)", type: "number", default: 1500, min: 0, max: 60000, group: "advanced" },
    ],

    async preview(ctx, p) {
      ctx.status("Lecture de la collection, du catalogue et du marché…");
      const [access, characters, collection, config, mine, myOffers] = await Promise.all([
        ctx.api("/me/market/access").catch(() => null),
        ctx.api("/characters"),
        ctx.api("/me/collection?lean=1"),
        ctx.api("/config").catch(() => null),
        ctx.api("/me/market"),
        ctx.api("/trades/offers/mine").catch(() => []),
      ]);
      const catalog = new Map(characters.map((c) => [c.id, c]));
      // Cartes déjà en vente ou proposées dans une offre d'échange ouverte : on n'y touche pas.
      const busy = new Set([
        ...(mine.listings ?? []).filter((l) => l.status === "active").map((l) => l.character?.id),
        ...myOffers.filter((o) => o.status === "open").map((o) => o.characterId),
      ]);
      const spares = collection
        .filter((e) => !e.pinned && !busy.has(e.characterId))
        .map((e) => ({ card: catalog.get(e.characterId), n: Math.min(e.listable ?? e.qty, e.qty - p.keepCopies, p.copiesPerCard) }))
        .filter((x) => x.card && x.n > 0 && p.rarities.includes(x.card.rarity));

      const prices = new Map();
      for (const part of chunk(spares.map((x) => x.card.id), 300)) {
        ctx.status(`Lecture des prix : ${prices.size}/${spares.length} cartes…`);
        for (const r of await ctx.api(`/me/collection/prices?ids=${part.join(",")}`)) prices.set(r.characterId, r);
        await ctx.sleep(250);
      }
      const recycle = (r) => config?.recycle?.[r] ?? RECYCLE[r] ?? 1;
      // Les plus chères d'abord : ce sont elles qui méritent une place d'annonce.
      const ranked = spares
        .map((x) => ({ ...x, prices: prices.get(x.card.id), ref: reference(p, prices.get(x.card.id)) }))
        .filter((x) => x.ref)
        .sort((a, b) => b.ref - a.ref);
      const noPrice = spares.length - ranked.length;

      // Fourchette du site, concurrence et ordres d'achat : lus pour les cartes retenues seulement.
      const rows = [];
      let slots = p.maxListings, belowRecycle = 0;
      for (const x of ranked) {
        if (slots <= 0) break;
        ctx.status(`Étude du marché : ${rows.length + 1} — ${x.card.name}`);
        const [bounds, listings, orders] = await Promise.all([
          ctx.api(`/fair-play/bounds/${x.card.id}`).catch(() => null),
          ctx.api(`/market/listings?characterId=${x.card.id}&type=fixed&sort=price_asc&page=1&pageSize=5`).catch(() => null),
          ctx.api(`/market/buy-orders?characterId=${x.card.id}`).catch(() => []),
        ]);
        const rivals = (listings?.items ?? []).filter((l) => !l.isMine && l.character?.id === x.card.id && l.status === "active");
        const y = {
          ...x,
          recycle: recycle(x.card.rarity),
          min: Math.max(recycle(x.card.rarity), bounds?.min ?? 0),
          max: bounds?.max ?? null,
          lowest: rivals[0]?.price ?? null,
          bestOrder: orders[0]?.price ?? null,
        };
        const plan = priceFor(p, y);
        await ctx.sleep(150);
        if (plan.price < p.minPrice) continue;
        // Recycler rapporterait autant ou plus que la vente, taxe et frais déduits.
        if (netSale(plan.price) <= y.recycle) {
          belowRecycle++;
          continue;
        }
        y.n = Math.min(y.n, slots);
        slots -= y.n;
        rows.push({ ...y, ...plan });
      }

      const warnings = [];
      if (access && !access.allowed) warnings.push(`Le marché t'est fermé : ${(access.reasons ?? []).join(" ")}`);
      if (noPrice) warnings.push(`${noPrice} carte(s) sans prix de référence, ignorée(s).`);
      if (belowRecycle) warnings.push(`${belowRecycle} carte(s) ignorée(s) : le net de la vente ne dépasse pas le recyclage.`);
      if (p.type === "auction") warnings.push("Une enchère qui a reçu des mises ne peut plus être retirée.");
      const total = rows.reduce((s, r) => s + r.n * netSale(r.price), 0);
      const count = rows.reduce((s, r) => s + r.n, 0);

      return {
        summary: rows.length
          ? `${count} annonce(s) sur ${spares.length} doublon(s) éligible(s), ${fmt(total)} ◆ net si tout se vend (après taxe 5 % et frais 2 %).`
          : "Aucun doublon à mettre en vente avec ces réglages.",
        warnings,
        columns: [
          { key: "card", label: "Carte" },
          { key: "ref", label: "Référence", align: "end" },
          { key: "lowest", label: "Moins chère", align: "end" },
          { key: "order", label: "Ordre max", align: "end" },
          { key: "price", label: p.type === "auction" ? "Départ" : "Prix", align: "end" },
          ...(p.type === "auction" && p.buyoutPercent > 0 ? [{ key: "buyout", label: "Achat imm.", align: "end" }] : []),
          { key: "delta", label: "vs réf.", align: "end" },
          { key: "net", label: "Net", align: "end" },
        ],
        rows: rows.map((r) => ({
          id: r.card.id,
          selectable: true,
          note: r.notes.join(" · ") || null,
          cells: {
            card: `${r.card.name} (${LABELS[r.card.rarity] ?? r.card.rarity})${r.n > 1 ? ` ×${r.n}` : ""}`,
            ref: fmt(r.ref),
            lowest: r.lowest == null ? "—" : fmt(r.lowest),
            order: r.bestOrder == null ? "—" : fmt(r.bestOrder),
            price: fmt(r.price),
            buyout: r.buyout == null ? "—" : fmt(r.buyout),
            delta: pct(r.price / r.ref - 1),
            net: fmt(netSale(r.price)),
          },
        })),
        canRun: rows.length > 0 && access?.allowed !== false,
        state: { rows },
      };
    },

    async run(ctx, p, { excludedIds, state }) {
      const queue = state.rows.filter((r) => !excludedIds.has(r.card.id));
      const total = queue.reduce((s, r) => s + r.n, 0);
      let done = 0, sold = 0, failures = 0;
      ctx.log(`Lancé : ${total} annonce(s), ${p.type === "auction" ? "enchères" : "prix fixe"} ${p.durationHours} h.`);
      for (const r of queue) {
        for (let i = 0; i < r.n; i++) {
          ctx.checkStopped();
          ctx.status(`Annonce ${done + 1}/${total} : ${r.card.name}…`);
          try {
            const res = await ctx.api("/market/listings", {
              method: "POST",
              withPass: true,
              body: { characterId: r.card.id, type: p.type, price: r.price, buyoutPrice: r.buyout, durationHours: Number(p.durationHours) },
            });
            done++;
            failures = 0;
            if (res?.matched) sold++;
            ctx.log(`🏷️ ${r.card.name} — ${fmt(r.price)} ◆${r.buyout ? `, achat immédiat ${fmt(r.buyout)} ◆` : ""} (net ${fmt(netSale(r.price))} ◆)${res?.matched ? " · vendue tout de suite à un ordre d'achat" : ""}`, "success");
          } catch (e) {
            if (e instanceof K.StoppedError) throw e;
            failures++;
            ctx.log(`✖ ${r.card.name} refusée : ${e.message}`, "error");
            // Plusieurs refus d'affilée : sans doute plus de place d'annonce ou un code d'accès manquant.
            if (failures >= 3) {
              ctx.log("Arrêt après 3 refus d'affilée (places d'annonce pleines ? code d'accès ?).", "error");
              ctx.status(`${done}/${total} annonce(s) publiée(s).`);
              return;
            }
            break;
          }
          await ctx.sleep(p.delayMs + Math.random() * 500);
        }
      }
      ctx.status(`${done}/${total} annonce(s) publiée(s)${sold ? `, ${sold} vendue(s) tout de suite` : ""}.`);
    },
  });
})();
