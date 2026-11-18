/*
 * Recycle les doublons dont la valeur de vente est au plus 8 % au-dessus du recyclage.
 *
 * API du site (Kyara Plus) :
 *   POST /me/collection/:id/recycle  { qty }
 * Hors cartes épinglées, en vente ou proposées dans une offre d'échange ouverte.
 */
(() => {
  const K = globalThis.KyaraExt;
  const { LABELS, fmt, netSale } = K;
  

  K.register({
    id: "recyclage",
    name: "Recycler les doublons",
    icon: "♻️",
    category: "Collection",
    short: "Valeur de vente ≤ recyclage + 8 %",
    description: "Recycle les doublons dont la valeur de vente ne dépasse pas 108 % de la valeur de recyclage.",
    params: [
      { key: "rarities", label: "Raretés", type: "raritySet", default: [...K.RARITIES] },
      { key: "keepCopies", label: "Exemplaires à toujours garder", type: "number", default: 1, min: 1, max: 50 },
      { key: "delayMs", label: "Pause entre deux cartes (ms)", type: "number", default: 800, min: 0, max: 60000, group: "advanced" },
    ],

    async preview(ctx, p) {
      if (!p.rarities.length) throw new Error("Choisis au moins une rareté.");
      ctx.status("Lecture de la collection et des annonces…");
      const [catalog, collection, busy, config] = await Promise.all([ctx.catalog(), ctx.api("/me/collection?lean=1"), ctx.busyCards(), ctx.config()]);
      const spares = K.spares(collection, catalog, { keepCopies: Math.max(1, p.keepCopies), rarities: p.rarities, busy: busy.ids });
      const prices = await ctx.loadPrices(spares.map((x) => x.card.id));
      const rows = spares
        .map((x) => {
          const value = prices.get(x.card.id)?.value ?? null;
          const recycle = K.recycleOf(x.card.rarity, config);
          return { ...x, value, recycle, net: value == null ? null : netSale(value) };
        })
        .filter((x) => Number.isFinite(x.value) && x.value > 0 && x.value * 100 <= x.recycle * 108)
        .sort((a, b) => K.rank(b.card.rarity) - K.rank(a.card.rarity) || a.card.name.localeCompare(b.card.name, "fr"));
      const gained = rows.reduce((s, r) => s + r.n * r.recycle, 0);
      const warnings = ["Le recyclage est définitif : les cartes recyclées sont détruites."];

      return {
        summary: rows.length
          ? `${rows.reduce((s, r) => s + r.n, 0)} exemplaire(s) de ${rows.length} carte(s) à recycler pour ${fmt(gained)} ◆.`
          : "Aucun doublon à recycler avec ces réglages.",
        warnings,
        columns: [
          { key: "card", label: "Carte" },
          { key: "n", label: "Exemplaires", align: "end", total: true },
          { key: "value", label: "Valeur de vente", align: "end" },
          { key: "net", label: "Net de vente", align: "end" },
          { key: "gain", label: "Recyclage", align: "end", total: true },
        ],
        rows: rows.map((r) => ({
          id: r.card.id,
          rarity: r.card.rarity,
          selectable: true,
          values: { n: r.n, value: r.value, net: r.net, gain: r.n * r.recycle },
          cells: {
            card: `${r.card.name} (${LABELS[r.card.rarity] ?? r.card.rarity})`,
            n: r.n,
            value: r.value == null ? "—" : fmt(r.value),
            net: r.net == null ? "—" : fmt(r.net),
            gain: `${fmt(r.n * r.recycle)} (${r.recycle} × ${r.n})`,
          },
        })),
        canRun: rows.length > 0,
        state: { rows },
      };
    },

    async run(ctx, p, { excludedIds, state }) {
      const queue = state.rows.filter((r) => !excludedIds.has(r.card.id));
      let done = 0,
        gained = 0;
      for (const r of queue) {
        ctx.checkStopped();
        ctx.status(`Recyclage ${done + 1}/${queue.length} : ${r.card.name}…`);
        try {
          const res = await ctx.api(`/me/collection/${r.card.id}/recycle`, { method: "POST", body: { qty: r.n } });
          done++;
          const got = typeof res?.gained === "number" ? res.gained : r.n * r.recycle;
          gained += got;
          ctx.log(`♻️ ${r.card.name} ×${r.n} — +${fmt(got)} ◆`, "success");
        } catch (e) {
          if (e instanceof K.StoppedError) throw e;
          ctx.log(`✖ ${r.card.name} : ${e.message}`, "error");
        }
        await ctx.sleep(p.delayMs);
      }
      ctx.status(`${done}/${queue.length} carte(s) recyclée(s), +${fmt(gained)} ◆.`);
    },
  });
})();
