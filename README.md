# Kyara Scripts — extension navigateur

Ajoute sur https://kyara.games un menu déroulant « K Scripts » flottant en haut à droite, par-dessus
la page (juste sous le header). Chaque script du menu ouvre un popover en trois étapes :

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
