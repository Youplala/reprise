# Reprise

Une application Expo pour retrouver les points de vue du concours photographique parisien de
1970, aligner une image d’archive sur le Paris d’aujourd’hui, puis préparer une contribution à
l’[Observatoire photographique des paysages parisiens](https://observatoire-photo.paris/).

## Ce qui fonctionne

- carte des stations chargée depuis l’API publique de l’Observatoire, avec cache local ;
- géolocalisation iPhone, distances et points de vue proches ;
- fiche complète du carré 839 avec les 13 diapositives de Roland Logerot fournies avec le projet ;
- assistant de cadrage combinant caméra, surimpression réglable, horizon, contraste, zoom et
  micro-déplacements ;
- mode démonstration automatique dans le simulateur iOS, où la caméra n’est pas disponible ;
- vérification avant dépôt, carnet local, partage et fil collectif alimenté par des reconductions
  publiées ;
- liens directs vers la carte de l’Observatoire et la notice des bibliothèques spécialisées de Paris.

## Lancer le projet

```bash
npm install
npm run ios
```

Le projet utilise Expo SDK 57. Dans le simulateur, le bouton de prise de vue génère une comparaison
de démonstration. Sur un iPhone, l’application demande les autorisations de localisation, de caméra
et de mouvement puis enregistre la vraie photo.

Vérifications locales :

```bash
npx tsc --noEmit
npm run lint
npx expo export --platform ios
```

## Données

- API cartographique : `https://observatoire-photo.paris/api/elements`
- grille officielle 1970 :
  `https://opppp.cartes.xyz/uploads/opppp/files/260421-export-grille-concours-1970-wsg84.geojson`
- archive locale : `assets/archive/roland-logerot-839/`

Les réponses réseau sont limitées aux champs publics utiles à l’interface et mises en cache avec
AsyncStorage. Si le réseau est indisponible, le carré 839 et ses archives restent entièrement
consultables.

## Vers la version de production

La version actuelle lit l’API publique mais ne publie pas directement dessus. L’architecture cible
pour synchroniser toutes les photographies, conserver durablement les prises de vue et soumettre de
véritables reconductions est décrite dans
[docs/architecture-cible.md](docs/architecture-cible.md).
