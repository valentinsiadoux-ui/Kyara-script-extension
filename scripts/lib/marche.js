/*
 * Étude de marché d'une carte (position « Étude de marché » de Vendre mes doublons) :
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
 *   - jamais sous le prix de recyclage (net après taxe et frais, par défaut) ni hors de la fourchette du site.
 */
(() => {
  const K = globalThis.KyaraExt;
  const { fmt, netSale } = K;

  // Départ (× valeur), achat immédiat de base (× valeur) et bonus par point de pression.
  const STRATEGIES = {
    rapide: { start: 0.85, buyout: 1.05, perPressure: 0.03 },
    equilibre: { start: 0.9, buyout: 1.15, perPressure: 0.05 },
    max: { start: 0.95, buyout: 1.25, perPressure: 0.08 },
  };
  const clamp = (x, min, max) => Math.min(max, Math.max(min, x));

  // Le site refuse une annonce sous un prix minimum par rareté : « Prix minimum pour cette rareté : 100 ◆ ».
  const MIN_PRICE_ERROR = /prix minimum[^0-9]*([\d\s  .,]+)/i;
  // Minimums appris lors d'un refus, gardés d'un lancement à l'autre.
  const LEARNED_KEY = "kx_min_price_by_rarity";
  const learnedMins = () => { try { return JSON.parse(localStorage.getItem(LEARNED_KEY)) ?? {}; } catch { return {}; } };
  const learnMin = (rarity, min) => { try { localStorage.setItem(LEARNED_KEY, JSON.stringify({ ...learnedMins(), [rarity]: min })); } catch { /* non mémorisé */ } };
  const minPriceFromError = (error) => {
    const m = MIN_PRICE_ERROR.exec(error?.message ?? "");
    return m ? Number(m[1].replace(/[^\d]/g, "")) || null : null;
  };

  // ---------- Demande : joueurs qui cherchent mes cartes ----------
  // takeable=1 renvoie les offres ouvertes du tableau dont les cartes demandées incluent une carte que je possède.
  async function scanDemand(ctx, p, myId, prices) {
    const offers = [];
    for (let page = 1; page <= p.demandPages; page++) {
      ctx.status(`Étude de la demande : tableau des échanges, page ${page}…`);
      const { items = [], more } = (await ctx.api(`/trades/offers/search?page=${page}&pageSize=60&takeable=1`)) ?? {};
      offers.push(...items.filter((o) => o.status === "open" && o.user?.id !== myId));
      if (!more || items.length === 0) break;
    }
    // Valeur de ce que chaque chercheur propose en échange = ce qu'il est prêt à « payer ».
    await ctx.loadPrices(offers.map((o) => o.characterId), prices);
    const byCard = new Map(); // id -> { seekers: Set, offered: [valeurs] }
    for (const o of offers) {
      const offered = prices.get(o.characterId)?.value ?? null;
      for (const id of o.wantIds ?? []) {
        const d = byCard.get(id) ?? { seekers: new Set(), offered: [] };
        d.seekers.add(o.user?.id ?? o.id);
        if (offered) d.offered.push(offered);
        byCard.set(id, d);
      }
    }
    return { byCard, offers: offers.length };
  }

  // ---------- Concurrence : enchères actives des autres vendeurs ----------
  async function competitors(ctx, p, card) {
    const found = [];
    for (let page = 1; page <= p.listingPages; page++) {
      const data = await ctx.api(`/market/listings?characterId=${card.id}&type=auction&sort=ending&page=${page}&pageSize=24`);
      const items = Array.isArray(data) ? data : data?.items ?? [];
      for (const l of items) {
        const sameCard = (l.character?.id ?? l.characterId) === card.id;
        const active = l.status == null || l.status === "active";
        if (sameCard && active && !l.isMine && typeof (l.currentBid ?? l.price) === "number")
          found.push({ price: l.currentBid ?? l.price, buyout: l.buyoutPrice ?? null, bids: l.bidCount ?? 0 });
      }
      const more = Array.isArray(data) ? items.length >= 24 : data?.more ?? items.length >= 24;
      if (!more || items.length === 0) break;
    }
    return found;
  }

  // Plus petit prix de départ dont le net dépasse le recyclage (ou simplement > recyclage).
  const floorFor = (p, recycle) => {
    let x = recycle + 1;
    if (p.netAboveRecycle) while (netSale(x) <= recycle) x++;
    return x;
  };

  // x : { card, market: { value, median7d, median30d, sales7d }, recycle, min, max }
  async function study(ctx, p, demand, x) {
    const S = STRATEGIES[p.strategy] ?? STRATEGIES.equilibre;
    const { median7d, median30d, sales7d, value } = x.market;
    const recycleFloor = floorFor(p, x.recycle);
    const floor = Math.max(recycleFloor, x.min ?? 0);
    const rivals = await competitors(ctx, p, x.card);

    const d = demand.byCard.get(x.card.id);
    const seekers = d?.seekers.size ?? 0;
    // Ce que le chercheur le plus offrant propose en échange.
    const willingness = d?.offered.length ? Math.max(...d.offered) : null;
    const rivalBids = rivals.reduce((sum, r) => sum + r.bids, 0);
    const lowest = rivals.length ? Math.min(...rivals.map((r) => r.price)) : null;
    const rivalBuyouts = rivals.map((r) => r.buyout).filter((b) => typeof b === "number");
    const lowestBuyout = rivalBuyouts.length ? Math.min(...rivalBuyouts) : null;

    // Demande pondérée : un chercheur actif = 2 pts, une mise concurrente = 1 pt. Les ventes de la semaine
    // montrent que la carte se vend, pas qu'elle manque : échelle logarithmique, 1,5 pt au plus.
    const salesPts = Math.min(1.5, Math.log2(1 + (sales7d ?? 0)) / 4);
    const demandScore = seekers * 2 + rivalBids + salesPts;
    // Pression = demande rapportée à l'offre concurrente.
    const pressure = demandScore / (1 + rivals.length);
    const trend = median7d && median30d ? median7d / median30d : 1;
    const fair = value * clamp(trend, 0.85, 1.15);
    const cap = Math.min((value * p.maxBuyoutPercent) / 100, x.max ?? Infinity);

    const facts = { seekers, willingness, rivals: rivals.length, rivalBids, lowest, lowestBuyout, sales7d, trend, demandScore, pressure, fair, floor };
    if (floor > cap) return { ...facts, skip: `prix minimum (${fmt(floor)} ◆) au-dessus de ce que vaut la carte` };
    if (demandScore < p.minDemand) return { ...facts, skip: `demande trop faible (score ${demandScore.toFixed(1)} < ${p.minDemand})` };

    // Départ attractif : forte demande -> départ plus bas, les mises feront monter le prix.
    let start = fair * (S.start - (pressure >= 2 ? 0.1 : pressure >= 1 ? 0.05 : 0));
    if (p.stayUnderRivals && lowest != null) {
      const underRivals = lowest - Math.max(1, Math.round((lowest * p.undercutPct) / 100));
      if (underRivals < floor)
        return { ...facts, skip: `concurrence trop basse (${fmt(lowest)} ◆) pour rester au-dessus ${floor > recycleFloor ? "du prix minimum du site" : "du recyclage"} (≥ ${fmt(floor)} ◆)` };
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
      buyout = Math.min(buyout, cap);
      buyout = Math.round(buyout);
      if (buyout <= start) buyout = null;
    }

    // Prix de vente attendu : de la valeur juste vers l'achat immédiat selon la pression.
    const expected = Math.round(clamp(fair * (0.9 + 0.05 * Math.min(pressure, 4)), start, buyout ?? Math.max(start, fair * 1.2)));
    const hours = pressure >= 2 && p.fastDurationHours ? p.fastDurationHours : Number(p.durationHours);
    const gain = netSale(expected) - x.recycle;
    // Les places d'annonces sont limitées : pas de carte qui rapporte trop peu.
    if (gain < p.minGain) return { ...facts, skip: `gain attendu trop faible (${fmt(gain)} ◆ < ${fmt(p.minGain)} ◆)`, start, buyout, expected, gain };
    return { ...facts, start, buyout, expected, hours, gain };
  }

  K.marche = { STRATEGIES, scanDemand, competitors, study, learnedMins, learnMin, minPriceFromError };
})();
