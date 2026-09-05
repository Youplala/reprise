# Préparation des fiches App Store et Google Play

Ce document sert de source de vérité avant saisie dans App Store Connect et Play Console. Les
réponses de confidentialité doivent être revérifiées si les SDK, le formulaire de l’Observatoire
ou les flux réseau changent.

## Identité

- Nom : `Paris GO`
- Identifiant iOS : `fr.youplala.repriseparis`
- Identifiant Android : `fr.youplala.repriseparis`
- Version initiale : `1.0.0`
- Langue principale : français (`fr-FR`)
- Catégorie principale suggérée : Photo et vidéo
- Catégorie secondaire suggérée : Voyages
- Politique de confidentialité :
  `https://youplala.github.io/reprise/confidentialite/`
- Assistance : `https://youplala.github.io/reprise/support/`
- Marketing / projet : `https://youplala.github.io/reprise/`
- Conditions d’utilisation : `https://youplala.github.io/reprise/conditions/`

## App Store — français

### Sous-titre (30 caractères maximum)

`Rephotographier Paris`

### Texte promotionnel (170 caractères maximum)

`Retrouvez les points de vue du Paris de 1970, alignez votre cadrage et préparez une nouvelle photographie pour l’Observatoire.`

### Mots-clés (100 octets maximum)

`paris,photo,archives,1970,paysage,carte,histoire,patrimoine,cadrage`

### Description

Paris GO transforme Paris en terrain d’enquête photographique.

En 1970, un grand concours amateur a produit des milliers de photographies de la capitale,
aujourd’hui conservées par la Bibliothèque historique de la Ville de Paris. Paris GO vous aide à
retrouver ces lieux et à reprendre les mêmes points de vue aujourd’hui.

EXPLOREZ LA CARTE

Parcourez les secteurs du concours de 1970, repérez les photographies encore à retrouver et voyez
les reprises déjà publiées par l’Observatoire photo participatif des paysages parisiens.

RETROUVEZ LE CADRAGE

Affichez la photographie historique, rejoignez le point de vue et utilisez la superposition ainsi
que les repères d’inclinaison pour préparer une reprise fidèle. Aucune comparaison automatique de
visages ou d’images n’est effectuée.

GARDEZ LE CONTRÔLE

Vos prises de vue restent sur votre téléphone. Paris GO ne crée aucun compte, n’affiche aucune
publicité et ne dépose jamais une contribution à votre place.

CONTRIBUEZ À L’OBSERVATOIRE

Lorsque vous le souhaitez, Paris GO prépare les informations utiles et les deux photos dans le
formulaire officiel de l’Observatoire. Vous gardez la main sur chaque champ, l’identité, les
consentements et l’envoi final.

Paris GO est une application indépendante et open source qui accompagne la campagne de
l’Observatoire photo participatif des paysages parisiens, animée par le CAUE de Paris.

### Notes pour l’équipe de review

Le dossier complet de réponse à App Review (vidéo, questions 2 à 7, mails d’autorisation) est dans
[`docs/app-review/`](app-review/README.md).

L’application ne nécessite aucun compte. La position, la caméra et l’orientation sont demandées
uniquement au moment où l’utilisateur déclenche les fonctions correspondantes. Les photos sont
enregistrées en accès ajout uniquement.

L’écran « Dépôt officiel » contient une WebView vers
`https://observatoire-photo.paris/elements/add`. Paris GO préremplit seulement certains champs
publics vides et prépare deux fichiers, archive puis photo actuelle. Le commentaire reste vide.
Paris GO ne renseigne jamais l’identité, ne coche aucune case et ne soumet jamais le formulaire.
Les navigations non autorisées et les fenêtres secondaires sont bloquées dans l’application.

## Google Play — français

### Description courte (80 caractères maximum)

`Retrouvez et rephotographiez les points de vue historiques de Paris.`

### Description complète

Paris GO vous guide vers les photographies historiques de Paris pour reprendre aujourd’hui les
mêmes points de vue.

• Explorez le quadrillage historique du concours photographique de 1970.
• Repérez les vues encore à retrouver autour de vous.
• Comparez les archives et les reprises déjà publiées.
• Superposez la photographie de référence à la caméra pour retrouver le cadrage.
• Enregistrez vos reprises dans votre galerie sans donner accès à toutes vos photos.
• Préparez le formulaire officiel, puis vérifiez et envoyez vous-même votre contribution.

Vos prises de vue et votre carnet restent sur votre téléphone. Paris GO ne demande aucun compte,
n’affiche aucune publicité et n’envoie aucune contribution automatiquement.

Les photographies de 1970 sont conservées par la Bibliothèque historique de la Ville de Paris.
Les données et reprises actuelles proviennent de l’Observatoire photo participatif des paysages
parisiens, animé par le CAUE de Paris.

## Déclarations de confidentialité à préparer

### App Store Connect

Le formulaire officiel est une WebView intégrée. Tant que cet écran permet un dépôt, déclarer au
minimum comme collecte facultative par un tiers, pour la fonctionnalité de l’app :

- localisation précise ;
- photos ou vidéos ;
- autre contenu utilisateur (légende ou observation) ;
- coordonnées de contact si le formulaire officiel les demande.

Ces données ne sont pas utilisées pour le suivi publicitaire. Revérifier les champs exacts du site
de l’Observatoire dès que son serveur est de nouveau disponible.

### Google Play Data safety

Déclarer les données facultatives envoyées par l’utilisateur au formulaire de l’Observatoire :
photos, localisation précise, contenu utilisateur et éventuelles coordonnées de contact, utilisées
pour la fonctionnalité de l’application.

Déclarer aussi les données collectées par Google Maps SDK for Android pour fournir, mesurer et
améliorer le service :

- métadonnées d’appareil ou de requête ;
- adresse IP ;
- identifiant pseudonyme propre au SDK ;
- interactions avec la carte ;
- diagnostics de plantage du SDK.

L’application ne comporte ni compte, ni publicité, ni SDK publicitaire. Les réponses exactes sur
le chiffrement, la suppression et le partage doivent rester cohérentes avec les politiques de
l’Observatoire et de Google Maps au jour de la soumission.

## Éléments restant à fournir

- clé `GOOGLE_MAPS_API_KEY` restreinte à l’identifiant Android et à la signature de production ;
- captures marketing iPhone et Android aux dimensions stores ;
- visuel Google Play 1024 × 500 ;
- confirmation des pays de distribution, de la catégorie et de la tranche d’âge ;
- saisie des coordonnées de contact de review dans les consoles ;
- confirmation des droits de contenu : les licences et attributions sont détaillées dans le README.
