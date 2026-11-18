# Kyara Scripts — extension navigateur

Ajoute sur https://kyara.games un bouton « K Scripts » flottant à droite de la page. Son menu range les scripts
par rubrique (Marché, Échanges, Comptoir, Collection, Suivi). Chaque script ouvre un popover en trois étapes :

1. **Réglages** : mémorisés d'une fois sur l'autre. Le menu **Préréglages** enregistre des jeux de réglages sous un nom
   et revient aux valeurs par défaut.
2. **Aperçu** : lecture seule, rien n'est publié. Tableau de ce que le script va faire : clic sur un en-tête pour trier,
   décoche une ligne pour l'exclure, la ligne **Total** suit les lignes cochées.
   - **Confirmer et lancer** · **← Modifier** · **Annuler**
3. **Exécution** : statut et journal en direct, **Arrêter**, **Copier le journal**. « Masquer » laisse tourner le script
   en arrière-plan.

Sur le bouton et dans le menu, un point indique l'état : **vert clignotant** = en cours, **rouge** = terminé avec une
erreur, **vert fixe** = terminé (disparaît une fois le script rouvert). Recharger la page arrête les scripts.

Le bouton se **déplace** verticalement en le glissant (position mémorisée) ; « Réduire / agrandir le bouton », en bas
du menu, ne laisse que le « K ».

## Installation

**Chrome / Edge / Brave** : `chrome://extensions` → activer le *Mode développeur* → *Charger l'extension non empaquetée* → choisir ce dossier.

**Firefox (≥ 125)** : `about:debugging#/runtime/this-firefox` → *Charger un module complémentaire temporaire* → choisir `manifest.json`.

Après une mise à jour : recharger l'extension, puis la page kyara.games.

**Le menu n'apparaît pas ?** Clique sur l'icône « K » de l'extension : la popup indique si l'accès à kyara.games est
bloqué (bouton « Autoriser sur kyara.games ») ou si l'onglet doit être rechargé.

## Scripts

### Marché

**🏷️ Vendre mes doublons** — met des doublons en vente (prix fixe ou enchère). Le prix se choisit par rapport à la
**référence** (médiane 7 j par défaut, ou 30 j, ou dernière vente) :

- **💎 Chère** 125 % · **⚖️ Marché** 100 % · **💸 Abordable** 85 % · **⚡ Liquidation** 60 % (modifiables dans « Réglages avancés ») ;
- **🎯 Concurrentiel** : 1 ◆ (réglable) sous l'annonce à prix fixe la moins chère, jamais sous 70 % de la référence ;
- **✏️ Perso** : le pourcentage de ton choix ;
- **🧠 Étude de marché** (ancien script « Enchères ») : enchère dont le départ et l'achat immédiat suivent
  - la **demande** : joueurs dont une offre d'échange ouverte demande la carte (et ce qu'ils proposent), ventes des 7 derniers jours, mises concurrentes ;
  - l'**offre** : enchères actives des autres vendeurs ;
  - la **valeur** : médiane 7 j corrigée de la tendance 7 j / 30 j.

  Départ attractif (d'autant plus bas que la demande est forte), achat immédiat au-dessus de la valeur, plafonné par ce
  que proposent les chercheurs. Les cartes partent dans l'ordre du gain attendu ; celles sous le **gain minimum**
  (50 ◆) sont listées mais ignorées. Le prix de chaque carte est recalculé juste avant sa publication.
  Stratégies : *Équilibrée*, *Gain maximum*, *Vente rapide*.

Le prix est borné par la fourchette du site (`/fair-play/bounds`), le recyclage et le **prix minimum par rareté** : quand
le site refuse une annonce trop basse, le script retient ce minimum (mémorisé) et réessaie. Les cartes épinglées, déjà
en vente ou proposées dans une offre d'échange ouverte sont laissées de côté. Si toutes les places d'annonce sont
prises (« Annonces actives max »), le script attend qu'une place se libère.

**🛒 Ordres d'achat** — pose des ordres d'achat sur les cartes qui me manquent (raretés et rareté max au choix), à un
pourcentage de la médiane 7 j, juste au-dessus du meilleur ordre concurrent, dans la limite d'un budget. Les cartes où un
autre joueur paie déjà plus sont ignorées. ⚠ L'endpoint de création est déduit : contrôle le premier ordre dans F12 > Réseau.

### Échanges

**⇄ Offres d'échange** — publie des offres du tableau : un doublon contre des cartes qui me manquent, de rareté égale ou
supérieure, sans dépasser la **rareté max demandée** (Légendaire par défaut). Les **raretés de mes doublons à proposer**
se choisissent avec les boutons colorés. Le site limite à 5 offres ouvertes : dès qu'une place se libère, la suivante part.
⚠ L'endpoint de création est déduit : contrôle la première publication dans F12 > Réseau.

**🤝 Préparer un échange** — ouvrir un échange (depuis le profil du joueur), puis lancer : démarrage direct, sans aperçu.
**L'envoi reste manuel.**

- Modes **Échange**, **Achat**, **Vente**, **Compléter** ; jusqu'à 20 cartes par côté, uniquement des doubles manquants.
- Raretés à donner et à récupérer, plus une **rareté max** commune aux deux côtés.
- Les inventaires sont vérifiés par l'API (`/trades/available`, `/trades/owned`) en plus des filtres du site ; s'il n'y a
  rien d'éligible, rien n'est chargé.
- Les cartes déjà demandées dans les échanges envoyés en attente sont exclues des cartes reçues.
- **Achat** : chakra = pourcentage choisi de la valeur des cartes reçues (50 % par défaut), arrondi à l'entier inférieur.
  **Vente** : mes doublons qui lui manquent contre ce pourcentage de leur valeur.
- **Équilibrer** (Échange) : par rareté (même nombre de chaque rareté des deux côtés) ou par valeur (écart maximum
  choisi, 10 % par défaut). Sans panier compatible, aucune carte n'est ajoutée.
- **Compléter** : pose d'abord la ou les cartes voulues (ou offertes) ; le côté le moins chargé est complété avec des
  doubles manquants de valeur équivalente (écart max. réglable).
- L'arrêt conserve les cartes déjà ajoutées.

### Comptoir

**📣 Poster une annonce** — modèles de message, aperçu tel quel, puis publication au comptoir (`/marche/chat`) :
💰 Je vends · 🛒 J'achète · 🔁 J'échange · 🔎 Je cherche (une seule carte : elle est jointe) · ✏️ Libre. Le nombre de
doublons annoncé compte les doublons vendables (hors épinglées et exemplaires gardés). L'aperçu bloque l'envoi si le site
refuse tes messages ou si le message dépasse 300 caractères.

### Collection

**♻️ Recycler les doublons** — recycle les doublons dont la vente rapporterait moins que le recyclage (taxe et frais
déduits), ou moins de « recyclage × N ». Hors épinglées, en vente ou en offre. Les cartes Épique ou plus rares sont
décochées d'office : il faut les cocher exprès. Le recyclage est définitif.

### Suivi

**📋 Tableau de bord** — liste mes ventes, enchères, ordres d'achat et offres d'échange en cours (filtrables, avec
leur fin). Tout est décoché : coche ce que tu veux retirer, puis « Confirmer et lancer ». Une enchère qui a reçu des
mises ne peut plus être retirée.

## Structure

```
manifest.json
core/kit.js            outils communs : api() (débit limité, erreurs lisibles), catalogue en cache, prix,
                       cartes occupées, doublons, raretés, KyaraExt.register()
scripts/lib/marche.js  étude de marché (demande, concurrence, prix d'enchère)
scripts/*.js           un fichier par script (une entrée du menu chacun)
ui/styles.js           styles (shadow DOM, n'interfère pas avec le site)
ui/content.js          menu flottant + popover
```

Toutes les requêtes passent par une file commune (250 ms au moins entre deux requêtes, plus si le site est chargé),
pour rester sous la limite du site même avec plusieurs scripts lancés.

## Ajouter un script

1. Créer `scripts/mon-script.js` :

```js
(() => {
  const K = KyaraExt;
  K.register({
    id: "mon-script",
    name: "Mon script",
    icon: "★",
    category: "Marché", // rubrique du menu
    short: "Ligne courte du menu",
    description: "Ce que fait le script.",
    params: [
      { key: "max", label: "Nombre max", type: "number", default: 10, min: 1, max: 100 },
      { key: "rarities", label: "Raretés", type: "raritySet", default: ["C", "U"] },
      { key: "maxRarity", label: "Rareté max", type: "rarityMax", default: "E" },
      { key: "mode", label: "Mode", type: "choice", default: "a", options: [["a", "Mode A"], ["b", "Mode B"]] },
      { key: "seuil", label: "Seuil", type: "number", default: 5, enabledWhen: { mode: "b" }, row: "ligne1" },
      { key: "url", label: "Endpoint", type: "text", default: "/x", group: "advanced" },
    ],
    async preview(ctx, p) {
      const [catalog, rows, busy] = await Promise.all([ctx.catalog(), ctx.api("/me/collection?lean=1"), ctx.busyCards()]);
      const spares = K.spares(rows, catalog, { rarities: p.rarities, maxRarity: p.maxRarity, busy: busy.ids }).slice(0, p.max);
      return {
        summary: `${spares.length} doublon(s).`,
        columns: [{ key: "name", label: "Carte" }, { key: "n", label: "Exemplaires", align: "end", total: true }],
        rows: spares.map((x) => ({ id: x.card.id, rarity: x.card.rarity, selectable: true, cells: { name: x.card.name, n: x.n } })),
        canRun: spares.length > 0,
        state: { spares }, // repassé tel quel à run()
      };
    },
    async run(ctx, p, { excludedIds, state }) {
      for (const x of state.spares) {
        ctx.checkStopped(); // bouton « Arrêter »
        if (excludedIds.has(x.card.id)) continue;
        ctx.log(`Traitement de ${x.card.name}`, "success"); // tons : success | warn | error | info
        await ctx.sleep(1000);
      }
    },
  });
})();
```

Types de réglages : `number`, `boolean`, `select`, `choice` (boutons), `modeToggle`, `text`, `textarea`,
`raritySet` (plusieurs raretés), `rarityMax` (rareté maximale), `rarityMap` (une valeur par rareté).
Options : `enabledWhen` (masqué sinon), `inactiveWhen` (grisé au lieu de masqué), `row` (même ligne),
`group: "advanced"`, `help`, `title`. Aperçu : `columns[].total`, `rows[].values` (nombres pour le tri et les totaux),
`rows[].rarity` (pastille), `excluded` (lignes décochées d'office). Le détail est en tête de `core/kit.js`.

2. L'ajouter dans `manifest.json` → `content_scripts[0].js`, **avant** `ui/styles.js`.
3. Recharger l'extension.

Formatage : `npx prettier --write .` (config dans `.prettierrc`).
