# Changelog

## 2.0.0

### Nouveautés
- **Rareté max** pour les échanges : « Rareté max demandée » et raretés de mes doublons dans *Offres d'échange* ;
  « Rareté max » commune aux deux côtés dans *Préparer un échange*.
- **Ordres d'achat** (Marché) : ordres sur mes cartes manquantes, sous la médiane, dans un budget.
- **Recycler les doublons** (Collection) : doublons qui valent moins que leur recyclage ; cartes rares décochées d'office.
- **Tableau de bord** (Suivi) : mes ventes, enchères, ordres et offres en cours, retrait de ceux que je coche.
- *Préparer un échange* vérifie les inventaires par l'API et s'arrête tout de suite s'il n'y a rien d'éligible.

### Changements
- *Enchères (étude de marché)* est fusionné dans **Vendre mes doublons** (position « 🧠 Étude de marché ») ; les
  réglages de l'ancien script sont repris automatiquement. Seules les cartes en tête sont étudiées, et le prix de
  chacune est recalculé juste avant sa publication (beaucoup moins de requêtes). La vente attend une place libre au
  lieu d'échouer quand les places d'annonce sont pleines.
- Interface : préréglages nommés, tri des colonnes et ligne de total dans l'aperçu, pastilles de rareté, « Copier le
  journal », point rouge / vert fixe quand un script masqué se termine, bouton déplaçable et réductible.
- Requêtes limitées en débit pour tous les scripts (250 ms min., suit l'en-tête `x-kyara-rush`) ; messages clairs
  pour une session expirée ou un code d'accès manquant.
- Une seule règle pour les cartes occupées (annonces non terminées, offres ouvertes) et les doublons (hors épinglées,
  exemplaires gardés) dans tous les scripts.

### Corrections
- *Offres d'échange* : le journal n'annonce plus de « place libérée » quand une offre a été sautée.
- *Poster une annonce* : le nombre de doublons annoncé ignore les cartes épinglées et les exemplaires gardés.

## 1.0.9 et avant
Voir l'historique git (`git log v1.0.9`).
