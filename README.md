# Kyara Scripts — extension navigateur

Ajoute sur https://kyara.games un menu déroulant « K Scripts » flottant en haut à droite, par-dessus
la page (juste sous le header). Les scripts y sont rangés par rubrique (Marché, Échanges, Comptoir), sur une ligne
courte chacun (la description complète s'affiche au survol). Chaque script du menu ouvre un popover en trois étapes :

1. **Réglages** : les paramètres du script (mémorisés d'une fois sur l'autre, « Valeurs par défaut » pour revenir en arrière).
2. **Aperçu** : lecture seule, rien n'est publié. Tableau de ce que le script va faire ; décoche une ligne pour l'exclure.
   - **Confirmer et lancer** · **← Modifier** (retour aux réglages) · **Annuler**
3. **Exécution** : statut et journal en direct, **Arrêter**. « Masquer » laisse tourner le script en arrière-plan
   (un point vert sur le menu indique qu'il tourne). Recharger la page arrête les scripts.

## Installation

**Chrome / Edge / Brave** : `chrome://extensions` → activer le *Mode développeur* → *Charger l'extension non empaquetée* → choisir ce dossier `extension/`.

**Firefox (≥ 125)** : `about:debugging#/runtime/this-firefox` → *Charger un module complémentaire temporaire* → choisir `manifest.json`.

Après une modification des fichiers : recharger l'extension, puis la page kyara.games.

**Le menu n'apparaît pas ?** Clique sur l'icône « K » (épingle-la depuis le menu des extensions) :
la popup indique si l'accès à kyara.games est bloqué (bouton « Autoriser sur kyara.games ») ou si
l'onglet doit être rechargé. Dans Chrome/Brave, l'accès se règle aussi dans *Détails de l'extension →
Accès aux sites → Sur tous les sites listés*.

## Structure

```
manifest.json
core/kit.js          outils communs : api(), sleep(), raretés, KyaraExt.register()
scripts/*.js         un fichier par script (une entrée du menu chacun)
ui/styles.js         styles (shadow DOM, n'interfère pas avec le site)
ui/content.js        menu flottant + popover
```

## Ajouter un script

1. Créer `scripts/mon-script.js` :

```js
(() => {
  KyaraExt.register({
    id: "mon-script",
    name: "Mon script",
    icon: "★",
    category: "Marché",                            // rubrique du menu (Marché, Échanges, Comptoir ou une nouvelle)
    short: "Ligne courte du menu",
    description: "Ce que fait le script.",
    params: [
      { key: "max", label: "Nombre max", type: "number", default: 10, min: 1, max: 100 },
      { key: "mode", label: "Mode", type: "select", default: "a", options: [["a", "Mode A"], ["b", "Mode B"]] },
      { key: "strict", label: "Strict", type: "boolean", default: false },
      { key: "url", label: "Endpoint", type: "text", default: "/x", group: "advanced" },
      // type "rarityMap" : une valeur par rareté (M L E R U C)
    ],
    async preview(ctx, p) {
      ctx.status("Lecture…");                       // texte affiché pendant le chargement
      const coll = await ctx.api("/me/collection?lean=1");
      return {
        summary: `${coll.length} cartes lues.`,
        warnings: [],
        columns: [{ key: "id", label: "Carte" }],
        rows: coll.slice(0, p.max).map((e) => ({ id: e.characterId, selectable: true, cells: { id: e.characterId } })),
        canRun: true,
        state: { coll },                            // repassé tel quel à run()
      };
    },
    async run(ctx, p, { excludedIds, state }) {
      for (const e of state.coll) {
        if (ctx.stopped) break;                     // bouton « Arrêter »
        if (excludedIds.has(e.characterId)) continue;
        ctx.log(`Traitement de ${e.characterId}`, "success"); // tons : success | warn | error | info
        await ctx.sleep(1000);                      // interrompu par « Arrêter »
      }
    },
  });
})();
```

2. L'ajouter dans `manifest.json` → `content_scripts[0].js`, **avant** `ui/styles.js`.
3. Recharger l'extension.

## Scripts fournis

- **Offres d'échange** (`scripts/proposer-offres.js`) : port de `kyara_proposer_offres_console.js`.
- **Enchères (étude de marché)** (`scripts/encheres-concurrentiel.js`) : avant de publier, étudie pour chaque doublon
  - la **valeur** : médiane 7 j corrigée de la tendance 7 j / 30 j ;
  - la **demande** : joueurs dont une offre d'échange ouverte demande la carte (et ce qu'ils proposent en échange),
    ventes des 7 derniers jours, mises sur les enchères concurrentes. Les wishlists des autres joueurs ne sont
    pas accessibles par l'API : ce sont les signaux les plus proches ;
  - l'**offre** : annonces actives des autres vendeurs (prix, achat immédiat, mises).

  Prix : mise de départ attractive (sous la valeur et sous la concurrence, d'autant plus basse que la demande est
  forte, car les mises feront monter le prix) ; achat immédiat au-dessus de la valeur selon la demande, plafonné
  par ce que les chercheurs proposent et par l'achat immédiat concurrent ; jamais sous le recyclage. Les cartes
  partent dans l'ordre du gain attendu. Stratégies : *Équilibrée*, *Gain maximum*, *Vente rapide*.

  Le site impose un **prix minimum par rareté** : quand il refuse une annonce trop basse, le script retient ce
  minimum (mémorisé dans le navigateur), recalcule la carte et réessaie. Les cartes dont le gain attendu est
  sous le **gain minimum** (50 ◆ par défaut) ne prennent pas de place d'annonce.

⚠ Comme dans les scripts d'origine, les endpoints de **création** (offre d'échange, annonce d'enchère) et
leur corps de requête sont déduits, pas vérifiés : contrôle la première publication dans F12 > Réseau,
et corrige l'endpoint dans « Réglages avancés » ou `buildBody` dans le fichier du script.

## Vendre mes doublons

**K Scripts → Vendre mes doublons** met des doublons en vente au marché (prix fixe ou enchère). Une rangée
de boutons choisit le prix par rapport à la **référence** (médiane 7 j par défaut, ou 30 j, ou dernière vente) :

- **💎 Chère** 125 % · **⚖️ Marché** 100 % · **💸 Abordable** 85 % · **⚡ Liquidation** 60 % (pourcentages modifiables dans « Réglages avancés ») ;
- **🎯 Concurrentiel** : 1 ◆ (réglable) sous l'annonce à prix fixe la moins chère des autres vendeurs, jamais sous 70 % de la référence ;
- **✏️ Perso** : le pourcentage de ton choix.

Les cartes les plus chères passent en premier, jusqu'au nombre d'annonces max par lancement (une annonce par exemplaire).
Le prix est borné par la fourchette du site (`/fair-play/bounds`) et le prix de recyclage. L'aperçu montre pour chaque carte
la référence, l'annonce concurrente la moins chère, le meilleur ordre d'achat (une annonce à ce prix ou moins part
tout de suite), le prix, l'écart à la référence et le net après taxe et frais. Les cartes épinglées, déjà en vente
ou proposées dans une offre d'échange ouverte sont laissées de côté.

## Poster une annonce au comptoir

**K Scripts → Poster une annonce** : une rangée de boutons choisit le modèle, le message est rédigé
automatiquement, l'aperçu le montre tel quel, puis **Confirmer et lancer** le publie au comptoir
(`/marche/chat`) :

- **💰 Je vends** : « Je vends tous mes doublons ⚪🟢🔵 à -40% du prix de la médiane (+4 000 doublons) ! »
- **🛒 J'achète** : « J'achète toutes vos cartes 🟣🟡 à -30% du prix de la médiane ! »
- **🔁 J'échange** : « J'échange mes doublons ⚪🟢🔵 (+4 000 doublons) contre vos doublons 🟣🟡 que je n'ai pas, à valeur de chakra équivalente ! »
- **🔎 Je cherche** : « Je cherche Frieren, Power ! » ; avec une seule carte, elle est jointe (bouton « Faire une offre » sur le site).
- **✏️ Libre** : le texte saisi tel quel.

Le nombre de doublons est compté dans ta collection pour les raretés choisies et arrondi. Un « Texte en plus »
s'ajoute à la fin de chaque modèle. L'aperçu bloque l'envoi si le site refuse tes messages (Discord non lié,
pas assez de boosters ouverts, sourdine) ou si le message dépasse la longueur permise (300 caractères).
Salon : celui que le site t'attribue, ou un salon précis dans « Réglages avancés ».

## Préparer un échange direct

Ouvrir un échange vide puis **K Scripts → Préparer un échange**. Choisir les réglages
et cliquer sur **Préparer l'échange** : démarrage direct, sans aperçu.

- Jusqu'à 20 cartes par côté, uniquement des doubles manquants.
- Une sélection de raretés commune aux cartes données et reçues.
- Les cartes déjà demandées dans les échanges envoyés en attente sont exclues des cartes reçues.
- **Achat** : aucune carte donnée ; chakra égal au pourcentage choisi de la valeur des
  cartes reçues (50 % par défaut), arrondi à l'entier inférieur.
- **Vente** : aucune carte reçue ; mes doublons qui lui manquent sont donnés contre un
  chakra égal au pourcentage choisi de leur valeur (50 % par défaut), arrondi à l'entier inférieur.
- **Équilibrer** (échange uniquement) : par rareté, même nombre de cartes de chaque rareté
  des deux côtés ; par valeur, le plus grand total respecte l’écart maximum choisi (10 % par défaut),
  même si les raretés diffèrent. La recherche privilégie le nombre de cartes et peut
  retenir moins de 20 cartes. Si elle ne trouve aucun panier compatible, aucune carte n'est ajoutée.
- Sans équilibrage, les 20 premières cartes éligibles de chaque côté sont retenues.
- Aucune compensation automatique en chakra en mode échange.
- Fonctionne en demi-fenêtre avec passage entre les étapes. Charge tous les inventaires,
  efface la recherche et remet la rareté du site sur Toutes avant le filtrage du script.
- L'arrêt conserve les cartes déjà ajoutées. **L'envoi reste manuel.**

Recharger l'extension puis la page Kyara après une mise à jour.

Les réglages proposent un sélecteur **Échange / Achat / Vente**. Le prix est actif en Achat et en Vente ; l’équilibrage est actif en Échange, et son mode uniquement si la case Équilibrer est cochée. Les raretés sont des boutons colorés multisélection, avec un bouton Toutes.

Le bouton Toutes sélectionne tout ou désélectionne tout. Glisser sur les raretés applique à la plage traversée l’état inverse du bouton de départ. Le mode d’équilibrage reste visible mais grisé en Échange lorsque Équilibrer est décoché. Écart maximum (%) apparaît uniquement pour l’équilibrage par valeur actif (0 à 100 %). Seul le sélecteur de mode est animé.
