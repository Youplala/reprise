# Audit UX — Paris GO

Retour d'un designer UX (via Élie) + relevé chiffré dans le code, 9 septembre 2026.
Objectif : alléger l'application avant la soumission App Store.

## Le diagnostic d'ensemble

> « L'application est beaucoup trop chargée : trop de textes, de toutes les tailles
> différentes. On ne sait pas où s'y retrouver, et les espacements ne sont pas
> consistants. Beaucoup trop d'informations pour une application censée être simple. »

Relevé dans le code, qui confirme point par point :

| Constat | Mesure |
|---|---|
| Aucune échelle typographique dans `theme.ts` | **36 tailles** distinctes, 312 `fontSize` en dur |
| Texte majoritairement minuscule | 10px (53×), 9px (40×), 12px (31×), 11px (31×), 8px (21×), 7px (16×) |
| Écran le plus chargé | `station` : **68** blocs `<Text>`, 15 tailles |
| Incohérence typo maximale | `onboarding` : 49 blocs `<Text>`, **20 tailles** |
| Espacements hors échelle | **170 / 654** (26 %), valeurs 2-7px arbitraires |

## Règles transverses

- **Trois niveaux de hiérarchie de texte au maximum.**
- Texte suffisamment **gros pour rester lisible** (les 7-10px dominants sont à remonter).
- Tous les espacements passent par l'échelle `Spacing`, aucune valeur en dur.

## Par écran

### Onboarding
- Trop d'informations. Garder le *à quoi ça sert* et le *comment ça marche*, mais réduire fortement.
- Le rendre **interactif** : sur l'écran « comment ça marche », ouvrir directement la caméra,
  proposer une photo, puis montrer l'avant/après. À défaut, une courte vidéo explicative.

### Accueil
- La première carte met parfois en avant une reprise de **2022**, moins intéressante qu'une
  archive de 1970. Ne pas l'afficher en tête.

### Carte
- Le **carrousel d'images en bas est trop haut** : il couvre plus de la moitié de la carte et
  gêne le zoom et la navigation.
- La **barre de recherche est rectangulaire** alors que tout le reste de l'app est arrondi.
- Afficher un **pourcentage global à droite de la barre de recherche**, et supprimer la ligne
  située juste en dessous, qui mange de la carte.
- Les **boutons flottants ne sont pas clairs** : on ne distingue pas « réorienter au nord » de
  « me localiser ».
- Afficher **par défaut la position de l'utilisateur** quand elle est disponible.
- **Transition fluide au zoom** entre les carrés du découpage et les photos à reprendre.
- Afficher **par défaut uniquement les photos à reprendre**, pas celles déjà reprises, avec une
  option pour les réafficher.
- « **Secteur 237** » ne veut rien dire pour l'utilisateur (carrés de 250 m du concours de 1970).
  Trouver un libellé compréhensible (rue, quartier, arrondissement).

### Caméra / alignement
- Simplifier l'interface, mais **garder impérativement la transparence et le zoom**.
- Permettre l'**orientation horizontale** du téléphone : testé, ne fonctionne pas du tout.

### Vie privée — transverse
- N'afficher que le **prénom et l'initiale du nom** des contributeurs, jamais le nom complet.
  ⚠️ À arbitrer : le README documente l'affichage prénom + nom au titre de l'attribution exigée
  par l'article 10.3 du règlement de l'Observatoire. Vérifier la compatibilité avant d'appliquer.
