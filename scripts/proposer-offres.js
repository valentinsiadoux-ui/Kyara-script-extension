/*
 * SCRIPT 1 – Kyara : publication d'offres d'échange avec mes doublons
 *
 *   - je donne : un de mes doublons
 *   - je veux  : des cartes qui me MANQUENT, de rareté égale ou SUPÉRIEURE à la carte donnée
 *                (jamais de perte au change) sans dépasser la rareté max demandée,
 *                rareté la plus proche d'abord ("closest")
 *   - une même carte n'est jamais demandée deux fois sur le tableau
 *   - une carte déjà mise aux enchères (ou en vente) n'est JAMAIS proposée à l'échange :
 *     vérifié à chaque cycle ET une dernière fois juste avant chaque publication ; si les
 *     annonces du marché sont illisibles, rien n'est publié
 *   - le site limite à 5 offres simultanées : dès qu'une place se libère, la suivante part
 *   - « totalOffers » offres au total, puis le script s'arrête
 *
 * ⚠ ENDPOINT À VÉRIFIER : la création d'une offre du tableau n'apparaît pas dans le code de
 * Kyara Plus. endpoint / buildBody sont une déduction. Pour les confirmer : F12 > Réseau,
 * publie une offre à la main (« Proposer une carte »), puis recopie l'URL et le corps de la requête.
 */
(() => {
  const { register, LABELS, rank, atMost, spares } = KyaraExt;

  const buildBody = (giveId, wantIds) => ({ characterId: giveId, wantIds }); // À VÉRIFIER

  async function readState(ctx) {
    // Si les annonces sont illisibles, busyCards échoue : on ne publie jamais sans savoir ce qui est en vente.
    const [collectionRows, busy] = await Promise.all([ctx.api("/me/collection?lean=1"), ctx.busyCards()]);
    const listedIds = new Set(busy.listings.map((l) => l.character?.id ?? l.characterId));
    return { collectionRows, open: busy.openOffers, listedIds };
  }

  // Je reçois Y contre X : OK si Y est aussi rare ou plus rare que X, sans dépasser la rareté max demandée.
  const wantOk = (p, give, want) =>
    (p.allowEqualRarity ? rank(want) <= rank(give) : rank(want) < rank(give)) && atMost(want, p.maxWantRarity);

  function plan(p, catalog, { collectionRows, open, listedIds }, slots, excludedIds = new Set()) {
    const owned = new Map(collectionRows.map((e) => [e.characterId, e]));
    const alreadyOffered = new Set(open.map((o) => o.characterId));
    // Cartes déjà demandées par mes offres ouvertes + celles choisies pendant ce passage.
    const requested = new Set(open.flatMap((o) => o.wantIds ?? []));

    // Une carte déjà mise aux enchères (ou en vente) n'est jamais échangée.
    const busy = new Set([...alreadyOffered, ...listedIds, ...excludedIds]);
    const candidates = spares(collectionRows, catalog, { keepCopies: p.keepCopies, rarities: p.giveRarities, busy })
      .sort((a, b) => {
        const byRarity = rank(a.card.rarity) - rank(b.card.rarity);
        return (p.giveOrder === "commonest" ? -byRarity : byRarity) || a.card.name.localeCompare(b.card.name, "fr");
      });

    const missing = [...catalog.values()].filter((c) => !(owned.get(c.id)?.qty > 0));
    const result = [];
    for (const { card: give, n } of candidates) {
      if (result.length >= slots) break;
      const wanted = missing
        .filter((m) => wantOk(p, give.rarity, m.rarity) && !requested.has(m.id))
        .sort((a, b) =>
          p.wantOrder === "closest"
            ? rank(b.rarity) - rank(a.rarity) || a.name.localeCompare(b.name, "fr")
            : rank(a.rarity) - rank(b.rarity) || a.name.localeCompare(b.name, "fr")
        )
        .slice(0, p.maxWanted);
      if (wanted.length === 0) continue;
      wanted.forEach((w) => requested.add(w.id));
      result.push({
        giveId: give.id,
        rarity: give.rarity,
        wantIds: wanted.map((w) => w.id),
        label: `${give.name} (${LABELS[give.rarity] ?? give.rarity}) ×${n} en trop`,
        wantLabel: wanted.map((w) => `${w.name} (${w.rarity})`).join(", "),
      });
    }
    return result;
  }

  register({
    id: "proposer-offres",
    name: "Offres d'échange",
    icon: "⇄",
    category: "Échanges",
    short: "Doublons contre cartes manquantes",
    description: "Publie des offres d'échange avec mes doublons contre des cartes qui me manquent, de rareté égale ou supérieure.",
    params: [
      { key: "totalOffers", label: "Offres à publier au total", type: "number", default: 20, min: 1, max: 500 },
      { key: "maxOpenOffers", label: "Offres ouvertes en même temps", type: "number", default: 5, min: 1, max: 50, help: "Limite du site : 5." },
      { key: "keepCopies", label: "Exemplaires à toujours garder", type: "number", default: 1, min: 0, max: 50 },
      { key: "maxWanted", label: "Cartes demandées par offre", type: "number", default: 5, min: 1, max: 20 },
      { key: "giveOrder", label: "Doublons proposés en premier", type: "select", default: "rarest",
        options: [["rarest", "Les plus rares"], ["commonest", "Les plus communs"]] },
      { key: "wantOrder", label: "Cartes demandées en premier", type: "select", default: "closest",
        options: [["closest", "Rareté la plus proche"], ["rarest", "Les plus rares"]] },
      { key: "allowEqualRarity", label: "Accepter une rareté égale", type: "boolean", default: true,
        help: "Décoché : exiger une rareté strictement supérieure à la carte donnée." },
      { key: "giveRarities", label: "Raretés de mes doublons à proposer", type: "raritySet", default: ["C", "U", "R", "E"] },
      { key: "maxWantRarity", label: "Rareté max demandée", type: "rarityMax", default: "L",
        help: "Une offre qui demande trop rare n'est presque jamais prise." },
      { key: "pollSec", label: "Vérification d'une place libre (s)", type: "number", default: 60, min: 10, max: 3600, group: "advanced" },
      { key: "delayMs", label: "Pause entre deux publications (ms)", type: "number", default: 1500, min: 0, max: 60000, group: "advanced" },
      { key: "maxFailures", label: "Arrêt après N cycles en échec", type: "number", default: 3, min: 1, max: 20, group: "advanced" },
      { key: "endpoint", label: "Endpoint de création (à vérifier)", type: "text", default: "/trades/offers", group: "advanced" },
    ],

    async preview(ctx, p) {
      ctx.status("Chargement du catalogue…");
      const catalog = await ctx.catalog();
      ctx.status("Lecture de la collection, des offres et du marché…");
      const s = await readState(ctx);
      if (!p.giveRarities.length) throw new Error("Choisis au moins une rareté de doublons à proposer.");
      const freeSlots = p.maxOpenOffers - s.open.length;
      // Sans place libre, on montre quand même les prochaines offres qui partiront.
      const slots = Math.min(freeSlots > 0 ? freeSlots : p.maxOpenOffers, p.totalOffers);
      // Plan large pour pouvoir décocher des lignes et garder des remplaçantes.
      const todo = plan(p, base.catalog, s, Math.min(p.totalOffers, slots + 10));

      const warnings = [];
      if (freeSlots <= 0) warnings.push(`${s.open.length}/${p.maxOpenOffers} offres déjà ouvertes : la publication attendra qu'une place se libère.`);
      if (s.listedIds.size) warnings.push(`${s.listedIds.size} carte(s) en vente / aux enchères sont exclues de l'échange.`);
      warnings.push("Endpoint de création déduit (non vérifié) : contrôle la première publication dans F12 > Réseau.");

      return {
        summary: todo.length
          ? `${Math.min(todo.length, slots)} offre(s) partiront tout de suite (${s.open.length} déjà ouvertes), ${p.totalOffers} au total au fil des places libres. Décoche une ligne pour ne jamais proposer cette carte.`
          : "Plus rien à proposer (plus de doublon utile ou plus de carte à demander).",
        warnings,
        columns: [
          { key: "n", label: "n°", align: "end" },
          { key: "give", label: "Je donne" },
          { key: "want", label: "Je veux l'une de" },
        ],
        rows: todo.map((t, i) => ({
          id: t.giveId,
          rarity: t.rarity,
          selectable: true,
          note: i < slots ? null : "en attente d'une place",
          cells: { n: i + 1, give: t.label, want: t.wantLabel },
        })),
        canRun: todo.length > 0,
        state: null,
      };
    },

    async run(ctx, p, { excludedIds }) {
      const catalog = await ctx.catalog();
      const st = { open: 0, published: 0, cycles: 0 };
      let lastStatus = "";
      let lastOpen = null;
      const excludedLogged = new Set();
      const refreshStatus = () =>
        ctx.status(`${st.open}/${p.maxOpenOffers} offres ouvertes · ${st.published}/${p.totalOffers} publiée(s) · ${st.cycles} vérification(s)`);

      async function cycle() {
        const s = await readState(ctx);
        st.open = s.open.length;

        for (const id of s.listedIds) {
          if (id == null || excludedLogged.has(id)) continue;
          excludedLogged.add(id);
          ctx.log(`${catalog.get(id)?.name ?? `Carte ${id}`} est en vente / aux enchères : elle n'est pas proposée à l'échange.`, "info");
        }

        const remaining = p.totalOffers - st.published;
        if (remaining <= 0) return true;
        const freeSlots = p.maxOpenOffers - s.open.length;
        const slots = Math.min(freeSlots, remaining);

        if (lastOpen !== null && s.open.length < lastOpen) {
          ctx.log(`${lastOpen - s.open.length} place(s) libérée(s) (offre prise, expirée ou retirée).`, "success");
        }
        lastOpen = s.open.length;

        if (slots <= 0) {
          const status = `${s.open.length}/${p.maxOpenOffers} offres ouvertes : en attente d'une place…`;
          if (status !== lastStatus) ctx.log(status);
          lastStatus = status;
          return false;
        }

        const todo = plan(p, catalog, s, slots, excludedIds);
        if (todo.length === 0) {
          ctx.log("Plus rien à proposer (plus de doublon utile ou plus de carte à demander). Arrêt.", "warn");
          return true;
        }

        let publishedNow = 0;
        for (const t of todo) {
          if (ctx.stopped) break;
          // Dernière vérification : une enchère a pu être lancée (par un autre script ou à la main) depuis le début du cycle.
          const { listings } = await ctx.busyCards();
          if (listings.some((l) => (l.character?.id ?? l.characterId) === t.giveId)) {
            ctx.log(`${catalog.get(t.giveId)?.name ?? `Carte ${t.giveId}`} vient d'être mise en vente / aux enchères : offre annulée pour cette carte.`, "info");
            continue;
          }
          await ctx.api(p.endpoint, { method: "POST", body: buildBody(t.giveId, t.wantIds), withPass: true });
          st.published++;
          publishedNow++;
          refreshStatus();
          ctx.log(`✔ Offre publiée : ${t.label} → veut l'une de : ${t.wantLabel}`, "success");
          await ctx.sleep(p.delayMs + Math.random() * 1000);
        }
        lastStatus = "";
        // Seules les offres réellement publiées occupent une place.
        lastOpen = s.open.length + publishedNow;
        return st.published >= p.totalOffers || ctx.stopped;
      }

      ctx.log(`Lancé : ${p.totalOffers} offres à publier, ${p.maxOpenOffers} ouvertes en même temps au maximum.`);
      let failures = 0;
      while (!ctx.stopped) {
        try {
          const done = await cycle();
          st.cycles++;
          refreshStatus();
          failures = 0;
          if (done) break;
        } catch (e) {
          if (e instanceof KyaraExt.StoppedError) break;
          failures++;
          ctx.log(`✖ Cycle en échec (${failures}/${p.maxFailures}) : ${e.message}`, "error");
          if (failures >= p.maxFailures) {
            ctx.log("Arrêt. Vérifie l'endpoint de création ou ta connexion.", "error");
            break;
          }
        }
        await ctx.sleep(p.pollSec * 1000 + Math.random() * 5000);
      }
      ctx.log(`Terminé : ${st.published} offre(s) publiée(s) sur ${p.totalOffers} prévues.`, "success");
    },
  });
})();
