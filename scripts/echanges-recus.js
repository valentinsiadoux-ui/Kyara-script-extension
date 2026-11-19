/*
 * Échanges reçus : pour chaque proposition en attente, dit si je peux l'accepter et si elle est avantageuse.
 *   - impossible : une carte demandée n'a pas d'exemplaire libre (délai de revente, en vente, en offre, épinglée),
 *     ou le chakra demandé dépasse mon solde
 *   - perte de collection : l'échange prend un exemplaire que je garde (réglage « Exemplaires à garder »)
 *   - valeur : mes cartes au prix net d'une vente au marché (au moins leur recyclage), ses cartes au prix du
 *     marché, le chakra à sa valeur faciale
 * Les exemplaires libres sont répartis entre les propositions, les plus avantageuses d'abord : deux propositions
 * qui demandent le même doublon ne passent pas toutes les deux.
 * Rien n'est coché d'office ; « Confirmer et lancer » accepte (ou refuse, selon le réglage) ce qui est coché.
 *
 * API du site (Kyara Plus) :
 *   GET  /me/trades            propositions reçues (incoming) et envoyées (outgoing)
 *   POST /trades/:id/accept    accepte (code d'accès requis)
 *   POST /trades/:id/decline   refuse
 */
(() => {
  const K = globalThis.KyaraExt;
  const { LABELS, RARITIES, fmt, netSale, recycleOf } = K;

  const VERDICTS = { impossible: "⛔ Impossible", loss: "⚠ Perte de collection", good: "✅ Avantageux", bad: "❌ Défavorable" };

  const nameOf = (catalog, id) => catalog.get(id)?.name ?? `Carte ${id}`;
  const names = (catalog, cards) => {
    const list = cards.map((c) => nameOf(catalog, c.characterId));
    return list.slice(0, 4).join(", ") + (list.length > 4 ? ` +${list.length - 4}` : "");
  };
  // « 5 cartes (3 R, 2 U) + 7 ◆ »
  function side(catalog, { cards = [], chakra = 0 }) {
    const parts = [];
    const n = cards.reduce((s, c) => s + c.qty, 0);
    if (n) {
      const byRarity = {};
      for (const c of cards) {
        const r = catalog.get(c.characterId)?.rarity ?? "?";
        byRarity[r] = (byRarity[r] ?? 0) + c.qty;
      }
      const detail = Object.entries(byRarity)
        .sort(([a], [b]) => RARITIES.indexOf(a) - RARITIES.indexOf(b))
        .map(([r, k]) => `${k} ${r}`)
        .join(", ");
      const only = cards[0].characterId;
      parts.push(n === 1 ? `${nameOf(catalog, only)} (${LABELS[catalog.get(only)?.rarity] ?? "?"})` : `${n} cartes (${detail})`);
    }
    if (chakra) parts.push(`${fmt(chakra)} ◆`);
    return parts.join(" + ") || "rien";
  }

  // Valeur des deux côtés, indépendante des autres propositions.
  function worth(trade, catalog, prices, config) {
    const value = (id) => prices.get(id)?.value ?? null;
    const unpriced = [];
    let give = trade.want.chakra ?? 0;
    for (const c of trade.want.cards ?? []) {
      const v = value(c.characterId);
      if (v == null) unpriced.push(c);
      give += c.qty * Math.max(v ? netSale(v) : 0, recycleOf(catalog.get(c.characterId)?.rarity, config));
    }
    let get = trade.give.chakra ?? 0;
    for (const c of trade.give.cards ?? []) {
      const v = value(c.characterId);
      if (v == null) unpriced.push(c);
      get += c.qty * (v ?? 0);
    }
    return { give, get, gain: get - give, unpriced };
  }

  // Exemplaires et chakra encore disponibles une fois les propositions précédentes acceptées.
  function check(trade, owned, used, balance, keepCopies) {
    const blocked = [];
    const conflict = [];
    const last = [];
    for (const c of trade.want.cards ?? []) {
      const e = owned.get(c.characterId);
      const taken = used.get(c.characterId) ?? 0;
      const free = (e && !e.pinned ? (e.listable ?? 0) : 0) - taken;
      const spare = (e ? e.qty - (e.locked ?? 0) - taken : 0) - keepCopies;
      if (free < c.qty) (taken > 0 && free + taken >= c.qty ? conflict : blocked).push(c);
      else if (spare < c.qty) last.push(c);
    }
    const noChakra = (trade.want.chakra ?? 0) > balance;
    return { blocked, conflict, last, noChakra, possible: !blocked.length && !conflict.length && !noChakra };
  }

  async function readState(ctx) {
    const [catalog, config, trades, collection, boot] = await Promise.all([
      ctx.catalog(),
      ctx.config(),
      ctx.api("/me/trades"),
      ctx.api("/me/collection?lean=1"),
      ctx.api("/me/bootstrap"),
    ]);
    if (!Array.isArray(trades?.incoming)) throw new Error("Réponse des échanges reçus non reconnue.");
    return {
      catalog,
      config,
      pending: trades.incoming.filter((t) => t.status === "pending"),
      owned: new Map(collection.map((e) => [e.characterId, e])),
      chakra: boot?.me?.chakra ?? 0,
    };
  }

  K.register({
    id: "echanges-recus",
    name: "Échanges reçus",
    icon: "📥",
    category: "Échanges",
    short: "Lesquels je peux accepter",
    description:
      "Analyse les propositions d'échange reçues : possibles ou non (cartes bloquées, dernier exemplaire, chakra), et avantageuses ou non au prix du marché. Accepte ou refuse celles que je coche.",
    params: [
      { key: "keepCopies", label: "Exemplaires à toujours garder", type: "number", default: 1, min: 0, max: 50 },
      {
        key: "minGainPercent",
        label: "Gain minimum pour être avantageux (%)",
        type: "number",
        default: 0,
        min: -100,
        max: 1000,
        title: "Écart entre ce que je reçois et ce que je donne, par rapport à ce que je donne. Négatif : j'accepte de perdre un peu.",
      },
      {
        key: "action",
        label: "Lignes cochées",
        type: "choice",
        default: "accept",
        options: [
          ["accept", "Accepter"],
          ["decline", "Refuser"],
        ],
      },
    ],

    async preview(ctx, p) {
      ctx.status("Lecture des propositions reçues, de ma collection et de mon chakra…");
      const s = await readState(ctx);
      const { catalog } = s;
      const ids = s.pending.flatMap((t) => [...(t.want.cards ?? []), ...(t.give.cards ?? [])].map((c) => c.characterId));
      const prices = await ctx.loadPrices(ids);

      // Les plus avantageuses se servent en premier dans mes exemplaires libres et mon chakra.
      const analysed = s.pending.map((t) => ({ trade: t, ...worth(t, catalog, prices, s.config) })).sort((a, b) => b.gain - a.gain);
      const used = new Map();
      let balance = s.chakra;
      for (const a of analysed) {
        Object.assign(a, check(a.trade, s.owned, used, balance, p.keepCopies));
        const good = a.get >= a.give * (1 + p.minGainPercent / 100);
        a.verdict = !a.possible ? "impossible" : a.last.length ? "loss" : good ? "good" : "bad";
        if (a.possible) {
          for (const c of a.trade.want.cards ?? []) used.set(c.characterId, (used.get(c.characterId) ?? 0) + c.qty);
          balance -= a.trade.want.chakra ?? 0;
        }
      }

      const notes = (a) =>
        [
          a.blocked.length && `bloquées : ${names(catalog, a.blocked)}`,
          a.conflict.length && `déjà prises par une proposition plus avantageuse : ${names(catalog, a.conflict)}`,
          a.noChakra && `chakra insuffisant (${fmt(a.trade.want.chakra)} ◆ demandés, ${fmt(s.chakra)} ◆ en poche)`,
          a.last.length && `dernier exemplaire : ${names(catalog, a.last)}`,
          a.unpriced.length && `sans prix : ${names(catalog, a.unpriced)}`,
        ]
          .filter(Boolean)
          .join(" · ") || null;

      const count = (v) => analysed.filter((a) => a.verdict === v).length;
      const selectable = (a) => p.action === "decline" || a.verdict !== "impossible";
      return {
        summary: analysed.length
          ? `${analysed.length} proposition(s) en attente : ${count("good")} avantageuse(s), ${count("bad")} défavorable(s), ${count("loss")} qui coûte(nt) un exemplaire gardé, ${count("impossible")} impossible(s). Rien n'est coché d'office : coche celles à ${p.action === "decline" ? "refuser" : "accepter"}.`
          : "Aucune proposition d'échange en attente.",
        warnings: [
          "Valeur donnée : mes cartes au prix net d'une vente au marché (taxe 5 % et frais 2 % déduits), au moins leur recyclage. Valeur reçue : ses cartes au prix du marché, plus le chakra.",
        ],
        columns: [
          { key: "from", label: "De" },
          { key: "give", label: "Je donne" },
          { key: "get", label: "Je reçois" },
          { key: "giveWorth", label: "Valeur donnée", align: "end" },
          { key: "getWorth", label: "Valeur reçue", align: "end" },
          { key: "gain", label: "Écart", align: "end" },
          { key: "verdict", label: "Verdict" },
        ],
        rows: analysed.map((a) => ({
          id: a.trade.id,
          selectable: selectable(a),
          note: notes(a),
          values: { giveWorth: a.give, getWorth: a.get, gain: a.gain },
          cells: {
            from: a.trade.from?.pseudo ?? "?",
            give: side(catalog, a.trade.want),
            get: side(catalog, a.trade.give),
            giveWorth: `${fmt(a.give)} ◆`,
            getWorth: `${fmt(a.get)} ◆`,
            gain: `${a.gain > 0 ? "+" : ""}${fmt(a.gain)} ◆${a.give ? ` (${a.gain > 0 ? "+" : ""}${Math.round((a.gain / a.give) * 100)} %)` : ""}`,
            verdict: VERDICTS[a.verdict],
          },
        })),
        excluded: analysed.map((a) => a.trade.id),
        canRun: analysed.some(selectable),
        state: null,
      };
    },

    async run(ctx, p, { excludedIds }) {
      const accept = p.action === "accept";
      const verb = accept ? "acceptée" : "refusée";
      // Relu juste avant d'agir : une proposition a pu être retirée, ou une carte engagée ailleurs.
      const s = await readState(ctx);
      const queue = s.pending.filter((t) => !excludedIds.has(t.id));
      if (!queue.length) {
        ctx.log("Aucune des propositions cochées n'est encore en attente.", "warn");
        return;
      }
      const used = new Map();
      let balance = s.chakra;
      let done = 0;
      for (const t of queue) {
        ctx.checkStopped();
        const label = `${t.from?.pseudo ?? "?"} : je donne ${side(s.catalog, t.want)}, je reçois ${side(s.catalog, t.give)}`;
        if (accept) {
          const c = check(t, s.owned, used, balance, 0);
          if (!c.possible) {
            ctx.log(`⛔ ${label} : plus possible (cartes bloquées ou déjà données, ou chakra insuffisant).`, "warn");
            continue;
          }
        }
        ctx.status(`Proposition ${done + 1}/${queue.length}…`);
        try {
          await ctx.api(`/trades/${encodeURIComponent(t.id)}/${p.action}`, { method: "POST", withPass: accept });
          done++;
          if (accept) {
            for (const c of t.want.cards ?? []) used.set(c.characterId, (used.get(c.characterId) ?? 0) + c.qty);
            balance -= t.want.chakra ?? 0;
          }
          ctx.log(`✔ Proposition ${verb} — ${label}`, "success");
        } catch (e) {
          if (e instanceof K.StoppedError) throw e;
          ctx.log(`✖ ${label} : ${e.message}`, "error");
        }
      }
      ctx.status(`${done}/${queue.length} proposition(s) ${verb}(s).`);
    },
  });
})();
