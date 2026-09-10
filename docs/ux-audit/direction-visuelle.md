# Direction visuelle — « La photo d'abord »

Deuxième passe, 10 septembre 2026. La première a désencombré ; celle-ci compose.

## Le constat

Le désencombrement a marché — moins de texte, une échelle typographique, des espacements réguliers —
mais le résultat est **fade**. Trois causes, visibles sur n'importe quelle capture de
`docs/ux-audit/apres/` :

1. **Les photos sont enfermées.** L'application parle de photographie, et ses images sont serrées
   dans des cartes blanches à marges, posées sur un fond gris-vert délavé. Le contenu est traité
   comme une pièce jointe.
2. **Chaque écran répète le même gabarit** : kicker orange en capitales mono, gros titre condensé,
   paragraphe gris, carte blanche. D'un onglet à l'autre, rien ne distingue.
3. **Tout est carte blanche.** Quand chaque bloc est détaché de la même façon, plus rien ne ressort :
   la hiérarchie est à plat.

## Le principe

**L'image est le décor de l'écran, le texte n'est plus qu'une légende.**

## Les règles

### Les images vont à fond perdu
Pleine largeur, bord à bord, **sans conteneur blanc, sans marge horizontale, sans bordure**.
Une photo qui touche les bords de l'écran ne prend pas de coins arrondis. Le padding de page
s'applique au texte, pas aux images : sors l'image de la colonne de texte plutôt que de rétrécir
l'image.

### Les légendes se posent, elles ne s'encadrent pas
Lieu, année, crédit : en `Typography.caption` directement sur le fond, sous l'image — ou en
surimpression quand l'image est assez sombre pour le porter. Jamais dans une carte.

### Les surfaces se méritent
Une carte (fond blanc, ombre, rayon) signale **un objet détaché et actionnable** : un panneau de
carte, une liste de contributeurs, un bouton. Elle ne sert jamais à poser du texte courant, ni à
encadrer trois pictogrammes. Par défaut, le contenu vit directement sur le fond.

### Un seul accent par écran
Le cuivre (`Palette.copper`) est un signal, pas une décoration. **Un seul kicker orange par
écran** — le premier. Les autres têtes de section se contentent du titre.

### Le rythme, pas l'air uniforme
Ce qui va ensemble se serre (`Spacing.two` entre un kicker et son titre), ce qui sépare respire
(`Spacing.five` entre deux sections). Pas de grand vide orphelin en bas d'écran : si un espace
reste, c'est que l'image doit grandir.

### Le texte d'introduction disparaît
Un paragraphe qui reformule le titre juste au-dessus ne sert à rien. Le titre porte, l'image
montre, la légende précise.

## Ce qui ne bouge pas

- L'échelle `Typography` (`display` 30 / `title` 20 / `body` 16 / `caption` 13), **trois niveaux
  maximum par écran**, jamais `display` et `title` ensemble.
- L'échelle `Spacing` : aucune valeur en dur.
- La palette de `src/constants/theme.ts`. On change la **répartition** des surfaces et des accents,
  pas les couleurs.
- Les noms de personnes passent par `formatContributorName` : jamais de nom complet.
- Les mentions d'honnêteté restent : « zone approximative », crédits d'attribution, « mode démo ».

## Exemple — l'onboarding

Aujourd'hui : kicker orange, titre sur deux lignes, paragraphe de trois lignes, carte blanche de
trois pictogrammes (« SMARTPHONE / 5 MIN / GRATUIT »), puis la comparaison 1970/2026 dans une carte
blanche à bordure épaisse, une légende, et un grand vide avant le bouton.

Visé : la comparaison 1970/2026 **occupe le haut de l'écran, bord à bord**. Le titre et sa légende
se posent dessous. Le paragraphe et la carte de pictogrammes disparaissent — « 5 min » et
« gratuit » n'ont jamais décidé personne, et l'image dit déjà de quoi il s'agit.
