(() => {
  const K = globalThis.KyaraExt;

  K.register({
    id: "albums-a-remplir",
    name: "Albums à remplir",
    icon: "▤",
    category: "Collection",
    short: "Séries incomplètes jamais terminées",
    description: "Liste les albums d’au moins cinq cartes à compléter, du plus proche au plus éloigné.",
    params: [
      {
        key: "maxRarity",
        label: "Rareté maximale des cartes manquantes",
        type: "select",
        default: "M",
        options: [...K.RARITIES].reverse().map(r => [r, K.LABELS[r]]),
        help: "Un album est retenu si toutes ses cartes manquantes respectent cette limite.",
      },
    ],
    async preview(ctx) {
      ctx.status("Lecture de la collection et des missions…");
      const [catalog, collection, progress, wishlist] = await Promise.all([
        ctx.catalog(),
        ctx.api("/me/collection?lean=1"),
        ctx.api("/me/progress"),
        ctx.api("/me/wishlist").catch(() => null),
      ]);
      if (!Array.isArray(progress?.series)) throw new Error("Historique des missions d’albums indisponible.");
      const completed = new Set(progress.series.filter(s => s.claimed || s.completedAt).map(s => s.series));
      const owned = new Set(collection.filter(c => c.qty > 0).map(c => String(c.characterId)));
      const albums = new Map();
      for (const card of catalog.values()) {
        if (!card.series || completed.has(card.series)) continue;
        if (!albums.has(card.series)) albums.set(card.series, { name: card.series, total: 0, missing: [] });
        const album = albums.get(card.series);
        album.total++;
        if (!owned.has(String(card.id))) album.missing.push(card);
      }
      const matches = [...albums.values()]
        .filter(a => a.total >= 5 && a.missing.length)
        .sort((a, b) => a.missing.length - b.missing.length || a.name.localeCompare(b.name, "fr"));
      return {
        albums: matches,
        wishlist,
        rows: [],
        columns: [],
        canRun: false,
      };
    },
  });
})();
