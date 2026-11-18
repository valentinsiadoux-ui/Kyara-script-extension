/*
 * Recycle les doublons qui rapportent plus (ou presque autant) au recyclage qu'à la vente.
 *
 * API du site (Kyara Plus) :
 *   POST /me/collection/:id/recycle  { qty }
 * Hors cartes épinglées, en vente ou proposées dans une offre d'échange ouverte.
 */
(() => {
  const K = globalThis.KyaraExt;
  const { LABELS, fmt, netSale } = K;
  const RARE = ["E", "L", "M"];

  K.register({
    id: "recyclage",
    name: "Recycler les doublons",
    icon: "♻️",
    category: "Collection",
    short: "Ceux qui valent moins que leur recyclage",
    description: "Recycle les doublons dont la vente rapporterait moins que le recyclage (taxe et frais déduits), ou peu au-dessus.",
    params: [
      { key: "rarities", label: "Raretés", type: "raritySet", default: ["C", "U", "R"] },
      { key: "margin", label: "Recycler si le net de vente ≤ recyclage × ", type: "number", default: 1, min: 0.1, max: 100, step: 0.1,
        help: "1 : seulement quand vendre ne rapporte pas plus. 2 : aussi quand la vente rapporterait jusqu'au double." },
      { key: "keepCopies", label: "Exemplaires à toujours garder", type: "number", default: 1, min: 0, max: 50 },
      { key: "noPrice", label: "Recycler aussi les cartes sans prix de marché", type: "boolean", default: false },
      { key: "delayMs", label: "Pause entre deux cartes (ms)", type: "number", default: 800, min: 0, max: 60000, group: "advanced" },
    ],

    async preview(ctx, p) {
      if (!p.rarities.length) throw new Error("Choisis au moins une rareté.");
      ctx.status("Lecture de la collection et des annonces…");
      const [catalog, collection, busy, config] = await Promise.all([
        ctx.catalog(),
        ctx.api("/me/collection?lean=1"),
        ctx.busyCards(),
        ctx.config(),
      ]);
      const spares = K.spares(collection, catalog, { keepCopies: p.keepCopies, rarities: p.rarities, busy: busy.ids });
      const prices = await ctx.loadPrices(spares.map((x) => x.card.id));
      const rows = spares
        .map((x) => {
          const value = prices.get(x.card.id)?.value ?? null;
          const recycle = K.recycleOf(x.card.rarity, config);
          return { ...x, value, recycle, net: value == null ? null : netSale(value) };
        })
        .filter((x) => (x.net == null ? p.noPrice : x.net <= x.recycle * p.margin))
        .sort((a, b) => K.rank(b.card.rarity) - K.rank(a.card.rarity) || a.card.name.localeCompare(b.card.name, "fr"));
      const gained = rows.reduce((s, r) => s + r.n * r.recycle, 0);
      const rare = rows.filter((r) => RARE.includes(r.card.rarity));
      const warnings = ["Le recyclage est définitif : les cartes recyclées sont détruites."];
      if (rare.length) warnings.unshift(`⚠ ${rare.length} carte(s) Épique ou plus rare dans la liste : vérifie-les une par une.`);

      return {
        summary: rows.length
          ? `${rows.reduce((s, r) => s + r.n, 0)} exemplaire(s) de ${rows.length} carte(s) à recycler pour ${fmt(gained)} ◆.`
          : "Aucun doublon à recycler avec ces réglages.",
        warnings,
        columns: [
          { key: "card", label: "Carte" },
          { key: "n", label: "Exemplaires", align: "end", total: true },
          { key: "value", label: "Valeur", align: "end" },
          { key: "net", label: "Net de vente", align: "end" },
          { key: "gain", label: "Recyclage", align: "end", total: true },
        ],
        rows: rows.map((r) => ({
          id: r.card.id,
          rarity: r.card.rarity,
          selectable: true,
          // Les cartes rares sont décochées par défaut : il faut les cocher exprès.
          note: RARE.includes(r.card.rarity) ? "rare : coche-la pour la recycler" : r.value == null ? "sans prix de marché" : null,
          values: { n: r.n, value: r.value, net: r.net, gain: r.n * r.recycle },
          cells: {
            card: `${r.card.name} (${LABELS[r.card.rarity] ?? r.card.rarity})`,
            n: r.n,
            value: r.value == null ? "—" : fmt(r.value),
            net: r.net == null ? "—" : fmt(r.net),
            gain: `${fmt(r.n * r.recycle)} (${r.recycle} × ${r.n})`,
          },
        })),
        excluded: rare.map((r) => r.card.id),
        canRun: rows.length > 0,
        state: { rows },
      };
    },

    async run(ctx, p, { excludedIds, state }) {
      const queue = state.rows.filter((r) => !excludedIds.has(r.card.id));
      let done = 0, gained = 0;
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
