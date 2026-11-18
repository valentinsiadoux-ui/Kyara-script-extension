/*
 * Tableau de bord : mes annonces en cours, ordres d'achat et offres du tableau ouvertes.
 * L'aperçu les liste ; coche ce que tu veux retirer, puis « Confirmer et lancer » les retire.
 *
 * API du site (Kyara Plus) :
 *   POST /market/listings/:id/cancel     retire une annonce (la carte revient)
 *   POST /market/buy-orders/:id/cancel   retire un ordre d'achat (le chakra revient)
 *   POST /trades/offers/:id/cancel       retire une offre du tableau
 * Une enchère qui a reçu des mises ne peut plus être retirée.
 */
(() => {
  const K = globalThis.KyaraExt;
  const { LABELS, fmt } = K;

  const KINDS = {
    listing: { label: "Vente", cancel: (id) => `/market/listings/${encodeURIComponent(id)}/cancel` },
    auction: { label: "Enchère", cancel: (id) => `/market/listings/${encodeURIComponent(id)}/cancel` },
    order: { label: "Ordre d'achat", cancel: (id) => `/market/buy-orders/${encodeURIComponent(id)}/cancel` },
    offer: { label: "Offre d'échange", cancel: (id) => `/trades/offers/${encodeURIComponent(id)}/cancel` },
  };
  const ago = (date) => {
    if (!date) return "—";
    const h = Math.round((new Date(date) - Date.now()) / 3600000);
    return h >= 48 ? `${Math.round(h / 24)} j` : h >= 0 ? `${h} h` : "terminé";
  };

  K.register({
    id: "tableau-de-bord",
    name: "Tableau de bord",
    icon: "📋",
    category: "Suivi",
    short: "Mes annonces, ordres et offres en cours",
    description: "Liste mes annonces, ordres d'achat et offres d'échange en cours ; ceux que je coche sont retirés.",
    params: [
      { key: "kinds", label: "Afficher", type: "choice", default: "all",
        options: [["all", "Tout"], ["market", "Ventes et enchères"], ["orders", "Ordres d'achat"], ["offers", "Offres d'échange"]] },
      { key: "olderThan", label: "Seulement ce qui est en ligne depuis plus de (h, 0 = tout)", type: "number", default: 0, min: 0, max: 720 },
    ],

    async preview(ctx, p) {
      ctx.status("Lecture de mes annonces, ordres et offres…");
      const [catalog, busy] = await Promise.all([ctx.catalog(), ctx.busyCards()]);
      const show = (k) => p.kinds === "all" || p.kinds === k;
      const oldEnough = (created) => !p.olderThan || !created || Date.now() - new Date(created) >= p.olderThan * 3600000;
      const items = [];
      if (show("market"))
        for (const l of busy.listings.filter((l) => l.status === "active" && oldEnough(l.createdAt)))
          items.push({
            kind: l.type === "auction" ? "auction" : "listing",
            id: l.id,
            card: catalog.get(l.character?.id ?? l.characterId),
            price: l.currentBid ?? l.price,
            detail: l.type === "auction" ? `${l.bidCount ?? 0} mise(s)${l.buyoutPrice ? ` · achat imm. ${fmt(l.buyoutPrice)}` : ""}` : "",
            ends: l.endsAt,
            locked: l.type === "auction" && (l.bidCount ?? 0) > 0,
          });
      if (show("orders"))
        for (const o of busy.buyOrders.filter((o) => o.status === "open" && oldEnough(o.createdAt)))
          items.push({
            kind: "order",
            id: o.id,
            card: catalog.get(o.characterId),
            price: o.price,
            detail: `${o.filled ?? 0}/${o.qty} servi(s)`,
            ends: o.expiresAt,
          });
      if (show("offers"))
        for (const o of busy.openOffers.filter((o) => oldEnough(o.createdAt)))
          items.push({
            kind: "offer",
            id: o.id,
            card: catalog.get(o.characterId),
            price: null,
            detail: `contre l'une de : ${(o.wantIds ?? []).map((id) => catalog.get(id)?.name ?? id).join(", ")}`,
            ends: o.expiresAt,
          });

      const locked = items.filter((i) => i.locked).length;
      return {
        summary: items.length
          ? `${items.length} élément(s) en cours. Rien n'est retiré par défaut : coche ce que tu veux retirer.`
          : "Rien en cours.",
        warnings: locked ? [`${locked} enchère(s) avec des mises : elles ne peuvent plus être retirées.`] : [],
        columns: [
          { key: "kind", label: "Type" },
          { key: "card", label: "Carte" },
          { key: "price", label: "Prix", align: "end" },
          { key: "detail", label: "Détail" },
          { key: "ends", label: "Fin dans", align: "end" },
        ],
        rows: items.map((i) => ({
          id: `${i.kind}:${i.id}`,
          rarity: i.card?.rarity,
          selectable: !i.locked,
          note: i.locked ? "mises reçues : non retirable" : null,
          values: { price: i.price, ends: i.ends ? new Date(i.ends).getTime() : null },
          cells: {
            kind: KINDS[i.kind].label,
            card: i.card ? `${i.card.name} (${LABELS[i.card.rarity] ?? i.card.rarity})` : "?",
            price: i.price == null ? "—" : fmt(i.price),
            detail: i.detail,
            ends: ago(i.ends),
          },
        })),
        // Tout est décoché d'office : on ne retire que ce qui est coché exprès.
        excluded: items.map((i) => `${i.kind}:${i.id}`),
        canRun: items.some((i) => !i.locked),
        state: { items },
      };
    },

    async run(ctx, p, { excludedIds, state }) {
      const queue = state.items.filter((i) => !i.locked && !excludedIds.has(`${i.kind}:${i.id}`));
      let done = 0;
      for (const i of queue) {
        ctx.checkStopped();
        const name = i.card?.name ?? "?";
        ctx.status(`Retrait ${done + 1}/${queue.length} : ${name}…`);
        try {
          await ctx.api(KINDS[i.kind].cancel(i.id), { method: "POST" });
          done++;
          ctx.log(`✔ ${KINDS[i.kind].label} retirée : ${name}`, "success");
        } catch (e) {
          if (e instanceof K.StoppedError) throw e;
          ctx.log(`✖ ${KINDS[i.kind].label} ${name} : ${e.message}`, "error");
        }
      }
      ctx.status(`${done}/${queue.length} élément(s) retiré(s).`);
    },
  });
})();
