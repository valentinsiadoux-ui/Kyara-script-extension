/* Prépare le formulaire d'échange du site. Aucun envoi de proposition. */
(() => {
  const K = globalThis.KyaraExt;
  const labels = ["Tu donnes", "Tu reçois"];
  const idOf = (el) =>
    el
      .querySelector("img")
      ?.getAttribute("src")
      ?.match(/\/(\d+)\.[a-z0-9]+(?:[?#]|$)/i)?.[1];
  const parseAmount = (text) => {
    const match = String(text)
      .replace(/\s/g, "")
      .match(/\d+(?:[.,]\d+)?/);
    if (!match) return null;
    return Number(match[0].replace(",", "."));
  };
  function currentForm() {
    const forms = [
      ...document.querySelectorAll('[role="dialog"] form.desk'),
    ].filter((f) => f.getClientRects().length);
    if (forms.length !== 1)
      throw new Error("Ouvre une seule fenêtre « Proposer un échange ».");
    return forms[0];
  }
  function parts(form) {
    const inventories = [
      form.querySelector(".inv.mine"),
      form.querySelector(".inv.theirs"),
    ];
    const trays = [
      form.querySelector(".table > .tray.mine"),
      form.querySelector(".table > .tray:not(.mine)"),
    ];
    if (inventories.some((x) => !x) || trays.some((x) => !x))
      throw new Error("Structure de la fenêtre d'échange non reconnue.");
    return { inventories, trays };
  }
  function assertEmpty(form) {
    const { trays } = parts(form);
    if (
      trays.some(
        (t) =>
          !t.querySelector(".empty") ||
          Number(t.querySelector(".ch input")?.value || 0) !== 0,
      )
    )
      throw new Error("Commence avec un échange vide (sans carte ni chakra).");
  }
  async function reserved(ctx) {
    const data = await ctx.api("/me/trades");
    if (!Array.isArray(data?.outgoing))
      throw new Error("Réponse des échanges envoyés non reconnue.");
    const ids = new Set();
    for (const trade of data.outgoing.filter((t) => t.status === "pending")) {
      if (!Array.isArray(trade.want?.cards))
        throw new Error(
          "Cartes demandées illisibles dans un échange en attente.",
        );
      for (const card of trade.want.cards) {
        if (card.characterId == null)
          throw new Error("Identifiant absent d'une carte déjà demandée.");
        ids.add(String(card.characterId));
      }
    }
    return ids;
  }
  function guard(ctx, form) {
    ctx.checkStopped();
    if (!form.isConnected || currentForm() !== form)
      throw new Error("La fenêtre d'échange a changé. Relance la préparation.");
  }
  async function wait(ctx, form, test, message) {
    const start = Date.now();
    while (true) {
      guard(ctx, form);
      if (test()) return;
      if (Date.now() - start > 15000) throw new Error(message);
      await ctx.sleep(100);
    }
  }
  async function toggle(ctx, form, inventory, name, enabled) {
    const button = [...inventory.querySelectorAll("button.only")].find(
      (b) => b.textContent.trim() === name,
    );
    if (!button) throw new Error(`Filtre « ${name} » introuvable.`);
    if ((button.getAttribute("aria-pressed") === "true") !== enabled) {
      guard(ctx, form);
      button.click();
      await wait(
        ctx,
        form,
        () => button.getAttribute("aria-pressed") === String(enabled),
        `Le filtre « ${name} » ne répond pas.`,
      );
      await ctx.sleep(250);
    }
  }
  const setValue = (input, value) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  function validate(p) {
    if (
      !Array.isArray(p.rarities) ||
      !p.rarities.length ||
      p.rarities.some((r) => !K.RARITIES.includes(r))
    )
      throw new Error("Coche au moins une rareté.");
    if (
      p.buy &&
      (!Number.isFinite(p.buyPercent) ||
        p.buyPercent <= 0 ||
        p.buyPercent > 100)
    )
      throw new Error(
        "Le pourcentage d'achat doit être supérieur à 0 et inférieur ou égal à 100.",
      );
    if (
      !p.buy &&
      p.balance &&
      p.balanceMode === "value" &&
      (!Number.isFinite(p.maxGapPercent) ||
        p.maxGapPercent < 0 ||
        p.maxGapPercent > 100)
    )
      throw new Error("L’écart maximum doit être compris entre 0 et 100 %.");
    if (!p.buy && p.balance && !["rarity", "value"].includes(p.balanceMode))
      throw new Error("Choisis un mode d'équilibrage.");
  }
  const sum = (cards) => cards.reduce((n, c) => n + c.value, 0);
  // Écart relatif au plus petit total : le plus grand ne dépasse pas 110 % du plus petit.
  const close = (a, b, percent = 10) =>
    a > 0 &&
    b > 0 &&
    Math.max(a, b) <= Math.min(a, b) * (1 + percent / 100) + 1e-8;
  function rarityPlan(pools) {
    const remaining = new Map(
      K.RARITIES.map((r) => [r, pools[1].filter((c) => c.rarity === r)]),
    );
    const plan = [[], []];
    for (const card of pools[0]) {
      const partner = remaining.get(card.rarity).shift();
      if (!partner) continue;
      plan[0].push(card);
      plan[1].push(partner);
      if (plan[0].length === 20) break;
    }
    return plan;
  }
  function nearTarget(sorted, target) {
    let chosen = [],
      total = 0;
    for (const card of sorted) {
      if (chosen.length < 20 && total + card.value <= target) {
        chosen.push(card);
        total += card.value;
      }
    }
    // Une carte au-dessus de la cible peut être plus proche que le panier glouton.
    for (const card of sorted) {
      if (Math.abs(card.value - target) < Math.abs(total - target)) {
        chosen = [card];
        total = card.value;
      }
    }
    // Améliorer par ajout ou remplacement sans jamais dépasser 20 cartes.
    const ids = new Set(chosen.map((c) => c.id));
    let best = null,
      error = Math.abs(total - target);
    for (const card of sorted) {
      if (ids.has(card.id)) continue;
      if (chosen.length < 20 && Math.abs(total + card.value - target) < error) {
        best = { card, index: -1 };
        error = Math.abs(total + card.value - target);
      }
      for (let i = 0; i < chosen.length; i++) {
        const next = total - chosen[i].value + card.value;
        if (Math.abs(next - target) < error) {
          best = { card, index: i };
          error = Math.abs(next - target);
        }
      }
    }
    if (best)
      best.index < 0
        ? chosen.push(best.card)
        : chosen.splice(best.index, 1, best.card);
    return chosen;
  }
  async function valuePlan(ctx, pools, percent = 10) {
    const sorted = pools.map((cards) =>
      cards
        .filter((c) => c.value > 0)
        .slice()
        .sort((a, b) => b.value - a.value),
    );
    if (sorted.some((cards) => !cards.length)) return [[], []];
    const targets = new Set();
    for (const cards of sorted) {
      for (const order of [cards, cards.slice().reverse()]) {
        let total = 0;
        for (const card of order.slice(0, 20)) {
          total += card.value;
          targets.add(total);
        }
      }
    }
    let best = [[], []],
      bestCount = 0,
      bestGap = Infinity;
    const consider = (plan) => {
      const totals = plan.map(sum);
      if (!close(...totals, percent)) return;
      const count = plan[0].length + plan[1].length;
      const gap = Math.abs(totals[0] - totals[1]) / Math.min(...totals);
      if (count > bestCount || (count === bestCount && gap < bestGap)) {
        best = plan;
        bestCount = count;
        bestGap = gap;
      }
    };
    consider(pools.map((cards) => cards.slice(0, 20)));
    for (const target of targets) {
      ctx.checkStopped();
      const left = nearTarget(sorted[0], target),
        right = nearTarget(sorted[1], target);
      consider([left, right]);
      consider([left, nearTarget(sorted[1], sum(left))]);
      consider([nearTarget(sorted[0], sum(right)), right]);
      await ctx.sleep(0);
    }
    // Garantir qu'une paire simple compatible n'est pas ignorée par la recherche de paniers.
    let j = 0;
    for (const left of sorted[0]) {
      while (
        j < sorted[1].length &&
        sorted[1][j].value > left.value * (1 + percent / 100)
      )
        j++;
      if (j < sorted[1].length) consider([[left], [sorted[1][j]]]);
    }
    return best;
  }
  K.register({
    id: "preparer-echange",
    name: "Préparer un échange",
    icon: "🤝",
    category: "Échanges",
    short: "Remplit l'échange direct ouvert",
    description:
      "Prépare des doubles manquants avec raretés communes, équilibrage ou achat en chakra. Envoi manuel.",
    skipPreview: true,
    params: [
      {
        key: "rarities",
        label: "Raretés à échanger ou récupérer",
        type: "raritySet",
        default: [...K.RARITIES],
      },
      { key: "buy", label: "Mode", type: "modeToggle", default: false },
      {
        key: "buyPercent",
        enabledWhen: { buy: true },
        label: "Prix d'achat (% de la valeur totale)",
        type: "number",
        default: 50,
        min: 1,
        max: 100,
        step: 1,
        help: "Mode Achat uniquement. Arrondi à l'entier inférieur.",
      },
      {
        key: "balance",
        enabledWhen: { buy: false },
        label: "Équilibrer les cartes",
        type: "boolean",
        default: false,
      },
      {
        key: "balanceMode",
        enabledWhen: { buy: false, balance: true },
        label: "Mode d'équilibrage",
        type: "select",
        default: "rarity",
        options: [
          ["rarity", "Par rareté"],
          ["value", "Par valeur"],
        ],
        help: "Par rareté : même nombre de cartes de chaque rareté des deux côtés. Par valeur : raretés différentes possibles, selon l’écart maximum choisi.",
      },
      {
        key: "maxGapPercent",
        label: "Écart max. (%)",
        type: "number",
        default: 10,
        min: 0,
        max: 100,
        step: 0.1,
        enabledWhen: { buy: false, balance: true, balanceMode: "value" },
        title:
          "Écart calculé par rapport au plus petit total. 0 % impose des totaux identiques.",
      },
    ],
    async run(ctx, p) {
      const form = currentForm();
      guard(ctx, form);
      assertEmpty(form);
      validate(p);
      const ids = await reserved(ctx);
      guard(ctx, form);
      const counts = [0, 0];
      const pools = [[], []];
      for (const side of p.buy ? [1] : [0, 1]) {
        ctx.status(`${labels[side]} : chargement des doubles manquants…`);
        const tab = form.querySelectorAll('.steps button[role="tab"]')[side];
        if (!tab || tab.disabled)
          throw new Error(`Étape « ${labels[side]} » indisponible.`);
        tab.click();
        await wait(
          ctx,
          form,
          () => tab.getAttribute("aria-selected") === "true",
          "Le changement d'étape a échoué.",
        );
        const inventory = parts(form).inventories[side];
        // Supprimer les anciens filtres de recherche et de rareté.
        const search = inventory.querySelector('input[type="search"]');
        if (search?.value) setValue(search, "");
        const all = inventory.querySelector(".rbar button.all");
        if (!all) throw new Error("Filtre de rareté Toutes introuvable.");
        if (all.getAttribute("aria-pressed") !== "true") all.click();
        if (side === 1) await toggle(ctx, form, inventory, "Je l’ai", false);
        for (const name of side
          ? ["Il me manque", "Ses doubles"]
          : ["Mes doubles", "Il lui manque"])
          await toggle(ctx, form, inventory, name, true);
        await ctx.sleep(300);
        while (inventory.querySelector("button.more")) {
          const before = inventory.querySelectorAll("button.tile").length;
          await wait(
            ctx,
            form,
            () =>
              !inventory.querySelector("button.more") ||
              !inventory.querySelector("button.more").disabled,
            "Voir plus reste désactivé.",
          );
          const more = inventory.querySelector("button.more");
          if (!more) break;
          more.click();
          await wait(
            ctx,
            form,
            () =>
              !inventory.querySelector("button.more") ||
              inventory.querySelectorAll("button.tile").length > before,
            "Le chargement des cartes ne progresse plus.",
          );
        }
        guard(ctx, form);
        const allowed = new Set(p.rarities);
        let missingPrice = "";
        ctx.status(labels[side] + (p.buy ? " : lecture des doubles…" : " : attente du chargement des prix…"));
        await wait(ctx, form, () => {
          // Relire les éléments : Svelte peut remplacer les cartes pendant le chargement.
          const cards = [...inventory.querySelectorAll('button.tile[aria-label^="Ajouter "]')]
            .filter(b => !b.disabled)
            .map(b => ({
              id: idOf(b),
              name: b.getAttribute("title") || b.getAttribute("aria-label"),
              rarity: b.querySelector(".seal")?.textContent.trim(),
              value: parseAmount(b.querySelector(".pr")?.textContent),
            }));
          if (cards.some(c => !c.id)) throw new Error("Identifiant de carte introuvable dans un inventaire.");
          if (cards.some(c => !K.RARITIES.includes(c.rarity))) throw new Error("Rareté de carte illisible. Préparation arrêtée.");
          const eligible = cards.filter(c => allowed.has(c.rarity) && (side === 0 || !ids.has(c.id)));
          missingPrice = eligible.find(c => c.value === null)?.name || "";
          if (!p.buy && missingPrice) return false;
          pools[side] = [...new Map(eligible.map(c => [c.id, c])).values()];
          return true;
        }, "Certains prix de cartes n’ont pas été chargés après 15 secondes. Réessaie lorsque les prix sont affichés.");

      }
      guard(ctx, form);
      assertEmpty(form);
      ctx.status("Choix des cartes…");
      let plan = pools.map((cards) => cards.slice(0, 20));
      if (!p.buy && p.balance) {
        plan =
          p.balanceMode === "rarity"
            ? rarityPlan(pools)
            : await valuePlan(ctx, pools, p.maxGapPercent);
        guard(ctx, form);
        if (plan.some((cards) => !cards.length)) {
          ctx.status("Aucun échange équilibré trouvé.");
          ctx.log(
            "Aucun panier compatible trouvé avec ces filtres. Aucune carte ajoutée.",
            "warn",
          );
          return;
        }
        ctx.log(
          "Équilibrage " +
            (p.balanceMode === "rarity" ? "par rareté" : "par valeur") +
            " : " +
            plan.map(sum).join(" ◆ contre ") +
            " ◆.",
          "info",
        );
      }
      for (const side of p.buy ? [1] : [0, 1]) {
        guard(ctx, form);
        const tab = form.querySelectorAll('.steps button[role="tab"]')[side];
        if (!tab || tab.disabled)
          throw new Error("Étape d'échange indisponible.");
        tab.click();
        await wait(
          ctx,
          form,
          () => tab.getAttribute("aria-selected") === "true",
          "Le changement d'étape a échoué.",
        );
        const inventory = parts(form).inventories[side];
        const chosen = plan[side];
        for (const card of chosen) {
          guard(ctx, form);
          const button = [
            ...inventory.querySelectorAll(
              'button.tile[aria-label^="Ajouter "]',
            ),
          ].find((b) => idOf(b) === card.id);
          if (!button || button.disabled)
            throw new Error(`Carte indisponible : ${card.name}.`);
          button.click();
          await wait(
            ctx,
            form,
            () =>
              [...parts(form).trays[side].querySelectorAll("img")].some(
                (img) =>
                  img
                    .getAttribute("src")
                    ?.match(/\/(\d+)\.[a-z0-9]+(?:[?#]|$)/i)?.[1] === card.id,
              ),
            `L'ajout de ${card.name} n'a pas été confirmé. Préparation arrêtée.`,
          );
          counts[side]++;
          ctx.log(`${labels[side]} : ${card.name}`, "success");
        }
      }
      guard(ctx, form);
      if (p.buy && counts[1] > 0) {
        const empty = counts[0] === 0 ? 0 : 1;
        const opposite = 1 - empty;
        const trays = parts(form).trays;
        let totalValue = null;
        let previous = null;
        let stableReads = 0;
        const expectedPositive = sum(plan[opposite]) > 0 || plan[opposite].some(card => card.value === null);
        ctx.status("Attente de la mise à jour du total…");
        await wait(ctx, form, () => {
          const currentTrays = parts(form).trays;
          const total = currentTrays[opposite].querySelector(".total") || form.querySelectorAll(".strip .amt b")[opposite];
          const next = parseAmount(total?.textContent);
          if (next === null || (expectedPositive && next === 0)) {
            stableReads = 0; previous = null; return false;
          }
          stableReads = next === previous ? stableReads + 1 : 1;
          previous = next; totalValue = next;
          return stableReads >= 3;
        }, "Le total des cartes reçues n’a pas été chargé après 15 secondes. Aucun chakra n’a été saisi.");
        const input = trays[empty].querySelector('.ch input[type="number"]');
        if (!input)
          throw new Error("Total ou champ chakra introuvable.");
        const value = Math.floor(
          (totalValue * p.buyPercent) / 100,
        );
        if (input.disabled || input.readOnly)
          throw new Error("Le champ chakra est indisponible.");
        setValue(input, value);
        await ctx.sleep(250);
        guard(ctx, form);
        if (Number(input.value) !== value || !input.checkValidity())
          throw new Error(
            "Le montant de chakra n'a pas été accepté par le champ.",
          );
        ctx.log(
          `${labels[empty]} : ${value} ◆ (${p.buyPercent} % de la valeur reçue).`,
          "success",
        );
      }
      ctx.status(
        `${counts[0]} carte(s) donnée(s), ${counts[1]} reçue(s). Envoi manuel.`,
      );
      ctx.log(
        counts.every((n) => n === 0)
          ? "Aucun double manquant disponible des deux côtés."
          : "Préparation terminée. Vérifie le formulaire puis envoie la proposition sur le site.",
        "info",
      );
    },
  });
})();
