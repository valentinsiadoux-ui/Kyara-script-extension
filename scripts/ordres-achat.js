/*
 * Pose des ordres d'achat sur les cartes qui me manquent, sous la médiane du marché.
 * Un vendeur qui met la carte en vente à ce prix ou moins me la vend tout de suite.
 *
 * API du site :
 *   GET  /me/market                       { buyOrders: [{ id, characterId, price, qty, filled, status, expiresAt }] }
 *   GET  /market/buy-orders?characterId=  [{ price, qty }] : ordres des autres joueurs, meilleur prix d'abord
 *   POST /market/buy-orders/:id/cancel    retrait (Kyara Plus)
 *
 * ⚠ ENDPOINT À VÉRIFIER : la création d'un ordre (endpoint / buildBody) est déduite. F12 > Réseau,
 * pose un ordre à la main sur le site, puis recopie l'URL et le corps de la requête.
 */
(() => {
  const K = globalThis.KyaraExt;
  const { LABELS, fmt } = K;

  const buildBody = (characterId, price, qty) => ({ characterId, price, qty }); // À VÉRIFIER

  K.register({
    id: "ordres-achat",
    name: "Ordres d'achat",
    icon: "🛒",
    category: "Marché",
    short: "Mes cartes manquantes, sous la médiane",
    description: "Pose des ordres d'achat sur les cartes qui me manquent, à un pourcentage de la médiane, dans la limite d'un budget.",
    params: [
      { key: "rarities", label: "Raretés", type: "raritySet", default: ["R", "E", "L"] },
      { key: "maxRarity", label: "Rareté max", type: "rarityMax", default: "L" },
      { key: "percent", label: "Prix (% de la médiane 7 j)", type: "number", default: 70, min: 1, max: 100, row: "prix" },
      { key: "outbid", label: "Au-dessus du meilleur ordre de (◆)", type: "number", default: 1, min: 0, max: 100000, row: "prix",
        title: "Si un autre joueur paie déjà plus que ton prix, l'ordre est ignoré ; sinon il passe juste devant lui, sans dépasser ton prix." },
      { key: "budget", label: "Budget total (◆)", type: "number", default: 5000, min: 1, max: 100000000, row: "budget" },
      { key: "maxOrders", label: "Ordres max", type: "number", default: 10, min: 1, max: 200, row: "budget" },
      { key: "maxPrice", label: "Prix max par carte (◆, 0 = aucun)", type: "number", default: 0, min: 0, max: 100000000, group: "advanced" },
      { key: "order", label: "Cartes en premier", type: "select", default: "rarest", group: "advanced",
        options: [["rarest", "Les plus rares"], ["cheapest", "Les moins chères"]] },
      { key: "delayMs", label: "Pause entre deux ordres (ms)", type: "number", default: 1500, min: 0, max: 60000, group: "advanced" },
      { key: "endpoint", label: "Endpoint de création (à vérifier)", type: "text", default: "/market/buy-orders", group: "advanced" },
    ],

    async preview(ctx, p) {
      if (!p.rarities.length) throw new Error("Choisis au moins une rareté.");
      ctx.status("Lecture de la collection, du catalogue et de mes ordres…");
      const [catalog, collection, busy, access] = await Promise.all([
        ctx.catalog(),
        ctx.api("/me/collection?lean=1"),
        ctx.busyCards(),
        ctx.api("/me/market/access").catch(() => null),
      ]);
      const owned = new Set(collection.filter((e) => e.qty > 0).map((e) => e.characterId));
      const ordered = new Set(busy.buyOrders.filter((o) => o.status === "open").map((o) => o.characterId));
      const missing = [...catalog.values()].filter(
        (c) => !owned.has(c.id) && !ordered.has(c.id) && p.rarities.includes(c.rarity) && K.atMost(c.rarity, p.maxRarity),
      );
      const prices = await ctx.loadPrices(missing.map((c) => c.id));
      const priced = missing
        .map((card) => ({ card, ref: prices.get(card.id)?.median7d ?? prices.get(card.id)?.value }))
        .filter((x) => x.ref)
        .map((x) => ({ ...x, target: Math.floor((x.ref * p.percent) / 100) }))
        .filter((x) => x.target > 0 && (!p.maxPrice || x.target <= p.maxPrice))
        .sort((a, b) => (p.order === "cheapest" ? a.target - b.target : K.rank(a.card.rarity) - K.rank(b.card.rarity) || b.ref - a.ref));

      const rows = [];
      let spent = 0, outbidded = 0;
      for (const x of priced) {
        if (rows.length >= p.maxOrders) break;
        ctx.status(`Ordres concurrents : ${rows.length + 1} — ${x.card.name}`);
        const best = (await ctx.api(`/market/buy-orders?characterId=${x.card.id}`).catch(() => []))[0]?.price ?? null;
        // Un autre joueur paie déjà plus : mon ordre ne serait jamais servi en premier.
        if (best != null && best + p.outbid > x.target) {
          outbidded++;
          continue;
        }
        const price = best == null ? x.target : Math.min(x.target, best + p.outbid);
        if (spent + price > p.budget) continue;
        spent += price;
        rows.push({ ...x, best, price });
      }

      const warnings = ["Endpoint de création déduit (non vérifié) : contrôle le premier ordre dans F12 > Réseau."];
      if (access && !access.allowed) warnings.unshift(`Le marché t'est fermé : ${(access.reasons ?? []).join(" ")}`);
      if (ordered.size) warnings.push(`${ordered.size} carte(s) ont déjà un ordre ouvert, ignorée(s).`);
      if (outbidded) warnings.push(`${outbidded} carte(s) ignorée(s) : un autre joueur paie déjà plus que ${p.percent} % de la médiane.`);
      if (missing.length - priced.length > 0) warnings.push(`${missing.length - priced.length} carte(s) sans prix de marché, ignorée(s).`);

      return {
        summary: rows.length
          ? `${rows.length} ordre(s) pour ${fmt(spent)} ◆ (budget ${fmt(p.budget)} ◆), sur ${missing.length} carte(s) manquante(s).`
          : "Aucun ordre à poser avec ces réglages.",
        warnings,
        columns: [
          { key: "card", label: "Carte" },
          { key: "ref", label: "Médiane 7 j", align: "end" },
          { key: "best", label: "Meilleur ordre", align: "end" },
          { key: "price", label: "Mon prix", align: "end", total: true },
        ],
        rows: rows.map((r) => ({
          id: r.card.id,
          rarity: r.card.rarity,
          selectable: true,
          values: { price: r.price, ref: r.ref, best: r.best },
          cells: {
            card: `${r.card.name} (${LABELS[r.card.rarity] ?? r.card.rarity})`,
            ref: fmt(r.ref),
            best: r.best == null ? "—" : fmt(r.best),
            price: fmt(r.price),
          },
        })),
        canRun: rows.length > 0 && access?.allowed !== false,
        state: { rows },
      };
    },

    async run(ctx, p, { excludedIds, state }) {
      const queue = state.rows.filter((r) => !excludedIds.has(r.card.id));
      let done = 0, failures = 0;
      for (const r of queue) {
        ctx.checkStopped();
        ctx.status(`Ordre ${done + 1}/${queue.length} : ${r.card.name}…`);
        try {
          await ctx.api(p.endpoint, { method: "POST", withPass: true, body: buildBody(r.card.id, r.price, 1) });
          done++;
          failures = 0;
          ctx.log(`🛒 ${r.card.name} — ordre à ${fmt(r.price)} ◆`, "success");
        } catch (e) {
          if (e instanceof K.StoppedError) throw e;
          ctx.log(`✖ ${r.card.name} refusé : ${e.message}`, "error");
          if (++failures >= 3) {
            ctx.log("Arrêt après 3 refus d'affilée. Vérifie l'endpoint de création ou ton chakra.", "error");
            break;
          }
        }
        await ctx.sleep(p.delayMs + Math.random() * 500);
      }
      ctx.status(`${done}/${queue.length} ordre(s) posé(s).`);
    },
  });
})();
