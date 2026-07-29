# Reprise

Application mobile gratuite pour retrouver les points de vue photographiques de Paris et les
reconduire aujourd'hui.

En 1970, la FNAC et la Ville de Paris organisent un concours amateur d'une ampleur inédite :
Paris est découpé en carrés de 250 m, et 2 800 photographes en rapportent des dizaines de
milliers d'images, aujourd'hui conservées par la Bibliothèque historique de la Ville de Paris.
Reprise vous aide à retrouver ces points de vue, à caler le cadrage avec la caméra du téléphone,
et à comparer les deux époques.

Le projet accompagne la campagne de l'[Observatoire photo participatif des paysages
parisiens](https://observatoire-photo.paris/), animée par le CAUE de Paris.

| | | | |
|:-:|:-:|:-:|:-:|
| <img src="docs/screenshots/01-accueil.png" width="200" alt="Écran d'accueil : la mission et le pouls du collectif"> | <img src="docs/screenshots/02-carte-grille.png" width="200" alt="Carte : la grille du concours de 1970 sur tout Paris"> | <img src="docs/screenshots/03-carte-reprises.png" width="200" alt="Carte : les reprises publiées, place des Vosges"> | <img src="docs/screenshots/04-collectif.png" width="200" alt="Collectif : contributeurs et comparaisons avant/après"> |
| Les points de vue autour de vous | Les 1 171 carrés de 250 m | Les reprises déjà publiées | Le collectif et ses comparaisons |

## Développement

```bash
npm install
npx expo run:ios --device
```

Un development build est nécessaire : l'app utilise `react-native-maps`, `expo-camera`,
`expo-media-library` et `expo-glass-effect`, qui ne sont pas disponibles dans Expo Go.

## Les données

L'app n'interroge jamais l'API de l'Observatoire à l'exécution. Un script produit un relevé
normalisé, embarqué dans le bundle :

```bash
node scripts/ingest-observatoire.mjs
```

Ce relevé est régénéré chaque nuit par une action planifiée et publié dans ce dépôt. L'app le
télécharge au lancement, avec repli sur la copie embarquée : elle reste utilisable hors connexion
et n'a pas besoin d'une mise à jour App Store pour rafraîchir ses chiffres.

Trois raisons à ce choix. L'API amont est servie sans CDN ni compression et en
`cache-control: private`, une ouverture coûtait 4,5 Mo ; la campagne se termine le 30 novembre
2026 et l'endpoint peut évoluer ; enfin les clés du formulaire sont auto-générées, un champ
renommé côté serveur casserait une app déjà publiée.

Le script filtre les champs par liste blanche et refuse d'écrire si une adresse e-mail survit.
Le même contrôle est rejoué en intégration continue avant publication.

## Sources et licences

**Données de l'Observatoire** : © les contributrices et contributeurs de l'Observatoire photo
participatif des paysages parisiens, animé par le CAUE de Paris, sous licence
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/). Les prénoms et noms sont affichés au
titre de l'attribution, conformément à l'article 10.3 du règlement de participation. Aucune
autre donnée personnelle n'est reprise.

**Grille de 1970** : découpage officiel du concours, exporté en WGS84 par le CAUE de Paris.

**Photographies de 1970** : fonds « C'était Paris en 1970 », conservé par la Bibliothèque
historique de la Ville de Paris. Ces images restent sous le droit d'auteur de leurs auteurs et
**ne sont pas redistribuées par cette application** : Reprise renvoie vers les permaliens ARK du
portail des bibliothèques spécialisées de la Ville de Paris.

## Publication

L'identifiant Apple utilisé pour la soumission n'est pas versionné. Il se fournit par
l'environnement :

```bash
export EXPO_APPLE_ID="votre@adresse"
eas build --platform ios --profile production --auto-submit
```

## Licence

Le code est publié sous licence MIT (voir `LICENSE`). Les données et les photographies relèvent
des licences indiquées ci-dessus.
