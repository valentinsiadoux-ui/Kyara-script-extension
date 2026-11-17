/* Prépare le formulaire d'échange du site. Aucun envoi de proposition. */
(() => {
  const K = globalThis.KyaraExt;
  const labels = ["Tu donnes", "Tu reçois"];
  const idOf = el => el.querySelector("img")?.getAttribute("src")?.match(/\/(\d+)\.[a-z0-9]+(?:[?#]|$)/i)?.[1];
  const amount = text => {
    const match = String(text).replace(/\s/g, "").match(/\d+(?:[.,]\d+)?/);
    if (!match) throw new Error("Montant illisible dans le formulaire.");
    return Number(match[0].replace(",", "."));
  };
  function currentForm() {
    const forms = [...document.querySelectorAll('[role="dialog"] form.desk')].filter(f => f.getClientRects().length);
    if (forms.length !== 1) throw new Error("Ouvre une seule fenêtre « Proposer un échange ».");
    return forms[0];
  }
  function parts(form) {
    const inventories = [form.querySelector(".inv.mine"), form.querySelector(".inv.theirs")];
    const trays = [form.querySelector(".table > .tray.mine"), form.querySelector(".table > .tray:not(.mine)")];
    if (inventories.some(x => !x) || trays.some(x => !x)) throw new Error("Structure de la fenêtre d'échange non reconnue.");
    return { inventories, trays };
  }
  function assertEmpty(form) {
    const { trays } = parts(form);
    if (trays.some(t => !t.querySelector(".empty") || Number(t.querySelector(".ch input")?.value || 0) !== 0))
      throw new Error("Commence avec un échange vide (sans carte ni chakra).");
  }
  async function reserved(ctx) {
    const data = await ctx.api("/me/trades");
    if (!Array.isArray(data?.outgoing)) throw new Error("Réponse des échanges envoyés non reconnue.");
    const ids = new Set();
    for (const trade of data.outgoing.filter(t => t.status === "pending")) {
      if (!Array.isArray(trade.want?.cards)) throw new Error("Cartes demandées illisibles dans un échange en attente.");
      for (const card of trade.want.cards) {
        if (card.characterId == null) throw new Error("Identifiant absent d'une carte déjà demandée.");
        ids.add(String(card.characterId));
      }
    }
    return ids;
  }
  function guard(ctx, form) {
    ctx.checkStopped();
    if (!form.isConnected || currentForm() !== form) throw new Error("La fenêtre d'échange a changé. Relance la préparation.");
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
    const button = [...inventory.querySelectorAll("button.only")].find(b => b.textContent.trim() === name);
    if (!button) throw new Error(`Filtre « ${name} » introuvable.`);
    if ((button.getAttribute("aria-pressed") === "true") !== enabled) {
      guard(ctx, form);
      button.click();
      await wait(ctx, form, () => button.getAttribute("aria-pressed") === String(enabled), `Le filtre « ${name} » ne répond pas.`);
      await ctx.sleep(250);
    }
  }
  const setValue = (input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  function validate(p) {
    for (const key of p.buy ? ["receiveRarities"] : ["giveRarities", "receiveRarities"]) {
      if (!Array.isArray(p[key]) || !p[key].length || p[key].some(r => !K.RARITIES.includes(r)))
        throw new Error("Coche au moins une rareté pour chaque côté utilisé.");
    }
    if (p.buy && (!Number.isFinite(p.buyPercent) || p.buyPercent <= 0 || p.buyPercent > 100))
      throw new Error("Le pourcentage d'achat doit être supérieur à 0 et inférieur ou égal à 100.");
  }
  K.register({
    id: "preparer-echange",
    name: "Préparer un échange",
    icon: "⇄",
    description: "Remplit l'échange ouvert avec des doubles manquants, puis le chakra si un côté est vide. Envoi manuel.",
    params: [
      { key: "giveRarities", label: "Raretés à donner (ignorées en mode Achat)", type: "raritySet", default: [...K.RARITIES] },
      { key: "receiveRarities", label: "Raretés à récupérer", type: "raritySet", default: [...K.RARITIES] },
      { key: "buy", label: "Achat : recevoir ses doubles contre du chakra, sans donner de cartes", type: "boolean", default: false },
      { key: "buyPercent", label: "Prix d'achat (% de la valeur totale)", type: "number", default: 50, min: 0.01, max: 100, step: 0.01, help: "Utilisé uniquement en mode Achat. Montant arrondi à l'entier inférieur." },
      { key: "compensate", label: "Si un côté est vide, compléter avec la moitié de la valeur opposée en chakra", type: "boolean", default: true },
    ],
    async preview(ctx, p) {
      validate(p);
      const form = currentForm();
      assertEmpty(form);
      ctx.status("Lecture des cartes déjà demandées…");
      const ids = await reserved(ctx);
      guard(ctx, form);
      return {
        summary: `${p.buy ? `Achat à ${p.buyPercent} % : jusqu’à 20 cartes à recevoir, sans carte donnée` : 'Échange : jusqu’à 20 cartes par côté'} — ${form.closest('[role="dialog"]').getAttribute("aria-label")}.`,
        warnings: [
          `${ids.size} carte(s) déjà demandée(s) dans des échanges envoyés en attente seront exclues du côté reçu.`,
          "Les cartes seront choisies dans l'ordre du site après activation des filtres doubles et manquantes. La liste complète sera chargée au lancement.",
          "La préparation modifie le formulaire ouvert. L'arrêt conserve les cartes déjà ajoutées. Vérifie le résultat puis envoie toi-même la proposition.",
        ],
        columns: [{ key: "side", label: "Côté" }, { key: "rule", label: "Sélection" }],
        rows: labels.map((side, i) => ({ id: i, selectable: false, cells: { side, rule: i
          ? "Ses doubles · Il me manque · Pas déjà demandées · " + p.receiveRarities.map(r => K.LABELS[r]).join(", ")
          : p.buy ? "Chakra : " + p.buyPercent + " % de la valeur reçue"
          : "Mes doubles · Il lui manque · " + p.giveRarities.map(r => K.LABELS[r]).join(", ") } })),
        canRun: true,
        state: { form },
      };
    },
    async run(ctx, p, { state }) {
      const form = state.form;
      guard(ctx, form);
      assertEmpty(form);
      validate(p);
      const ids = await reserved(ctx);
      guard(ctx, form);
      const counts = [0, 0];
      for (const side of p.buy ? [1] : [0, 1]) {
        ctx.status(`${labels[side]} : chargement des doubles manquants…`);
        const tab = form.querySelectorAll('.steps button[role="tab"]')[side];
        if (!tab || tab.disabled) throw new Error(`Étape « ${labels[side]} » indisponible.`);
        tab.click();
        await wait(ctx, form, () => tab.getAttribute("aria-selected") === "true", "Le changement d'étape a échoué.");
        const inventory = parts(form).inventories[side];
        // Supprimer les anciens filtres de recherche et de rareté.
        const search = inventory.querySelector('input[type="search"]');
        if (search?.value) setValue(search, "");
        const all = inventory.querySelector(".rbar button.all");
        if (!all) throw new Error("Filtre de rareté Toutes introuvable.");
        if (all.getAttribute("aria-pressed") !== "true") all.click();
        if (side === 1) await toggle(ctx, form, inventory, "Je l’ai", false);
        for (const name of side ? ["Il me manque", "Ses doubles"] : ["Mes doubles", "Il lui manque"])
          await toggle(ctx, form, inventory, name, true);
        await ctx.sleep(300);
        while (inventory.querySelector("button.more")) {
          const before = inventory.querySelectorAll("button.tile").length;
          await wait(ctx, form, () => !inventory.querySelector("button.more") || !inventory.querySelector("button.more").disabled, "Voir plus reste désactivé.");
          const more = inventory.querySelector("button.more");
          if (!more) break;
          more.click();
          await wait(ctx, form, () => !inventory.querySelector("button.more") || inventory.querySelectorAll("button.tile").length > before, "Le chargement des cartes ne progresse plus.");
        }
        guard(ctx, form);
        const cards = [...inventory.querySelectorAll('button.tile[aria-label^="Ajouter "]')]
          .filter(b => !b.disabled)
          .map(b => ({ id: idOf(b), name: b.getAttribute("title") || b.getAttribute("aria-label"), rarity: b.querySelector(".seal")?.textContent.trim() }));
        if (cards.some(c => !c.id)) throw new Error("Identifiant de carte introuvable dans un inventaire.");
        if (cards.some(c => !K.RARITIES.includes(c.rarity))) throw new Error("Rareté de carte illisible. Préparation arrêtée.");
        const allowed = new Set(side === 0 ? p.giveRarities : p.receiveRarities);
        const chosen = [...new Map(cards.filter(c => allowed.has(c.rarity) && (side === 0 || !ids.has(c.id))).map(c => [c.id, c])).values()].slice(0, 20);
        for (const card of chosen) {
          guard(ctx, form);
          const button = [...inventory.querySelectorAll('button.tile[aria-label^="Ajouter "]')].find(b => idOf(b) === card.id);
          if (!button || button.disabled) throw new Error(`Carte indisponible : ${card.name}.`);
          button.click();
          await wait(ctx, form, () => [...parts(form).trays[side].querySelectorAll("img")].some(img => img.getAttribute("src")?.match(/\/(\d+)\.[a-z0-9]+(?:[?#]|$)/i)?.[1] === card.id), `L'ajout de ${card.name} n'a pas été confirmé. Préparation arrêtée.`);
          counts[side]++;
          ctx.log(`${labels[side]} : ${card.name}`, "success");
        }
      }
      guard(ctx, form);
      if ((p.buy && counts[1] > 0) || (!p.buy && p.compensate && counts.some(n => n === 0) && counts.some(n => n > 0))) {
        const empty = counts[0] === 0 ? 0 : 1;
        const opposite = 1 - empty;
        const trays = parts(form).trays;
        const total = trays[opposite].querySelector(".total") || form.querySelectorAll(".strip .amt b")[opposite];
        const input = trays[empty].querySelector('.ch input[type="number"]');
        if (!total || !input) throw new Error("Total ou champ chakra introuvable.");
        const value = Math.floor(amount(total.textContent) * (p.buy ? p.buyPercent / 100 : 0.5));
        if (input.disabled || input.readOnly) throw new Error("Le champ chakra est indisponible.");
        setValue(input, value);
        await ctx.sleep(250);
        guard(ctx, form);
        if (Number(input.value) !== value || !input.checkValidity()) throw new Error("Le montant de chakra n'a pas été accepté par le champ.");
        ctx.log(`${labels[empty]} : ${value} ◆ (${p.buy ? p.buyPercent + " % de la valeur reçue" : "moitié du total opposé"}).`, "success");
      }
      ctx.status(`${counts[0]} carte(s) donnée(s), ${counts[1]} reçue(s). Envoi manuel.`);
      ctx.log(counts.every(n => n === 0) ? "Aucun double manquant disponible des deux côtés." : "Préparation terminée. Vérifie le formulaire puis envoie la proposition sur le site.", "info");
    },
  });
})();
