/*
 * Poste une annonce au comptoir du marché (/marche/chat) à partir de modèles :
 * vente ou achat sous la médiane, échange de doublons, recherche de cartes, texte libre.
 *
 * API du site (client B0ipqPxQ.js / CaAeYCEN.js) :
 *   GET  /me/chat           -> { canPost, reasons, mutedUntil, muteReason, maxLength }
 *   POST /market/chat/join  { room? } -> { room, rooms, capacity }
 *   POST /market/chat       { text, room, card?: { characterId, tag: "seek" | "trade" | "look" } }
 */
(() => {
  const K = globalThis.KyaraExt;
  const { LABELS, fmt } = K;

  // Pastilles utilisées par les joueurs du comptoir, de la plus commune à la plus rare.
  const DOTS = { C: "⚪", U: "🟢", R: "🔵", E: "🟣", L: "🟡", M: "🔴" };
  const ORDER = ["C", "U", "R", "E", "L", "M"];
  const dots = (set) => ORDER.filter((r) => set.includes(r)).map((r) => DOTS[r]).join("");
  const KINDS = [
    ["vendre", "💰 Je vends"],
    ["acheter", "🛒 J'achète"],
    ["echanger", "🔁 J'échange"],
    ["chercher", "🔎 Je cherche"],
    ["libre", "✏️ Libre"],
  ];

  // « +4 000 » plutôt que « +4 137 » : un ordre de grandeur suffit dans une annonce.
  const roughly = (n) => {
    const step = n >= 1000 ? 100 : n >= 100 ? 10 : 1;
    return Math.floor(n / step) * step;
  };
  const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  function duplicates(collection, catalog, rarities) {
    let n = 0;
    for (const e of collection) {
      const card = catalog.get(e.characterId);
      if (card && rarities.includes(card.rarity)) n += Math.max(0, e.qty - 1);
    }
    return n;
  }

  function findCards(names, catalog) {
    const byName = new Map([...catalog.values()].map((c) => [normalize(c.name), c]));
    const found = [], unknown = [];
    for (const name of names) {
      const c = byName.get(normalize(name));
      c ? found.push(c) : unknown.push(name);
    }
    return { found, unknown };
  }

  function compose(p, { dupes, cards }) {
    const count = p.showCount && dupes ? ` (+${fmt(roughly(dupes))} doublons)` : "";
    const base = {
      vendre: `Je vends tous mes doublons ${dots(p.giveRarities)} à -${p.discount}% du prix de la médiane${count} !`,
      acheter: `J'achète toutes vos cartes ${dots(p.wantRarities)} à -${p.discount}% du prix de la médiane !`,
      echanger: `J'échange mes doublons ${dots(p.giveRarities)}${count} contre vos doublons ${dots(p.wantRarities)} que je n'ai pas, à valeur de chakra équivalente !`,
      chercher: cards.length ? `Je cherche ${cards.map((c) => c.name).join(", ")} !` : "",
      libre: "",
    }[p.kind];
    return [base, p.extra].filter(Boolean).join(" ");
  }

  K.register({
    id: "annonces",
    name: "Poster une annonce",
    icon: "📣",
    category: "Comptoir",
    short: "Vente, achat, échange, recherche",
    description: "Publie au comptoir du marché une annonce de vente, d'achat, d'échange ou de recherche.",
    params: [
      { key: "kind", label: "Annonce", type: "choice", default: "vendre", options: KINDS },
      {
        key: "giveRarities", label: "Mes doublons", type: "raritySet", default: ["C", "U", "R"],
        enabledWhen: { kind: ["vendre", "echanger"] },
      },
      {
        key: "wantRarities", label: "Cartes recherchées", type: "raritySet", default: ["E", "L"],
        enabledWhen: { kind: ["acheter", "echanger"] },
      },
      {
        key: "discount", label: "Remise sur la médiane (%)", type: "number", default: 40, min: 0, max: 99,
        enabledWhen: { kind: ["vendre", "acheter"] },
      },
      {
        key: "showCount", label: "Indiquer le nombre de doublons", type: "boolean", default: true,
        help: "Compté dans ta collection pour les raretés choisies, arrondi (+4 000).",
        enabledWhen: { kind: ["vendre", "echanger"] },
      },
      {
        key: "cards", label: "Cartes cherchées (séparées par des virgules)", type: "text", default: "",
        help: "Une seule carte : elle est jointe à l'annonce (bouton « Faire une offre »).",
        enabledWhen: { kind: "chercher" },
      },
      {
        key: "extra", label: "Texte en plus (facultatif ; tout le message en mode Libre)", type: "textarea",
        default: "", optional: true,
      },
      {
        key: "room", label: "Salon", type: "select", default: "auto", group: "advanced",
        options: [["auto", "Celui attribué par le site"], ...[1, 2, 3, 4, 5].map((n) => [String(n), `Salon ${n}`])],
      },
    ],

    async preview(ctx, p) {
      ctx.status("Lecture du statut du comptoir…");
      const needsCatalog = p.kind === "chercher" || (p.showCount && ["vendre", "echanger"].includes(p.kind));
      const [status, characters, collection] = await Promise.all([
        ctx.api("/me/chat"),
        needsCatalog ? ctx.api("/characters") : null,
        needsCatalog && p.kind !== "chercher" ? ctx.api("/me/collection?lean=1") : null,
      ]);
      const catalog = new Map((characters ?? []).map((c) => [c.id, c]));
      const blocking = [], notes = [];

      if (["vendre", "echanger"].includes(p.kind) && !p.giveRarities.length) blocking.push("Choisis au moins une rareté de doublons.");
      if (["acheter", "echanger"].includes(p.kind) && !p.wantRarities.length) blocking.push("Choisis au moins une rareté recherchée.");

      const dupes = collection ? duplicates(collection, catalog, p.giveRarities) : 0;
      let cards = [];
      if (p.kind === "chercher") {
        const { found, unknown } = findCards(p.cards.split(",").map((s) => s.trim()).filter(Boolean), catalog);
        cards = found;
        if (unknown.length) notes.push(`Carte(s) introuvable(s), ignorée(s) : ${unknown.join(", ")}.`);
        if (!found.length) notes.push("Aucune carte cherchée reconnue.");
      }

      const text = compose(p, { dupes, cards });
      const max = status?.maxLength ?? 300;
      if (!text) blocking.push("Le message est vide.");
      if (text.length > max) blocking.push(`Message trop long : ${text.length}/${max} caractères.`);
      if (status && !status.canPost) blocking.push(`Le site refuse encore tes messages : ${(status.reasons ?? []).join(" ")}`);
      if (status?.mutedUntil) blocking.push(`Tu es réduit au silence jusqu'au ${new Date(status.mutedUntil).toLocaleString("fr-FR")}${status.muteReason ? ` (${status.muteReason})` : ""}.`);

      const card = p.kind === "chercher" && cards.length === 1 ? { characterId: cards[0].id, tag: "seek" } : undefined;
      return {
        summary: "Message qui sera posté au comptoir :",
        warnings: [...blocking, ...notes],
        columns: [
          { key: "text", label: "Message" },
          { key: "card", label: "Carte jointe" },
          { key: "length", label: "Caractères", align: "end" },
        ],
        rows: [{
          id: "msg",
          selectable: false,
          cells: {
            text,
            card: card ? `${cards[0].name} (${LABELS[cards[0].rarity] ?? cards[0].rarity})` : "—",
            length: `${text.length}/${max}`,
          },
        }],
        canRun: blocking.length === 0,
        state: { text, card },
      };
    },

    async run(ctx, p, { state }) {
      ctx.status("Connexion au comptoir…");
      const seat = await ctx.api("/market/chat/join", { method: "POST", body: p.room === "auto" ? {} : { room: Number(p.room) } });
      const room = seat?.room ?? (p.room === "auto" ? 1 : Number(p.room));
      ctx.status(`Envoi au salon ${room}…`);
      await ctx.api("/market/chat", { method: "POST", body: { text: state.text, room, ...(state.card ? { card: state.card } : {}) } });
      ctx.log(`Annonce postée au salon ${room} : « ${state.text} »`, "success");
      ctx.status(`Annonce postée au salon ${room}.`);
    },
  });
})();
