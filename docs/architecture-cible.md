# Architecture cible de Reprise

## Objectif

Faire de Reprise un client mobile fiable de l’Observatoire : consulter l’intégralité des stations et
des photographies autorisées, préparer une reconduction sur le terrain, l’envoyer, suivre sa
modération puis participer à la vie du collectif.

L’intégration officielle devra être définie avec l’équipe de l’Observatoire. Tant qu’aucune API
d’écriture documentée n’est disponible, Reprise ne doit ni simuler une publication réussie ni
automatiser un formulaire avec les identifiants d’un utilisateur.

## Flux de lecture

```text
API publique de l’Observatoire
            │
            ▼
Synchronisation serveur Reprise ──► base PostgreSQL
            │                           │
            │                           ├── stations et géométrie
            │                           ├── métadonnées et auteurs
            │                           └── versions et état de synchronisation
            ▼
Cache d’images autorisées / CDN
            │
            ▼
API Reprise ──► application mobile ──► cache hors ligne
```

Le serveur Reprise doit synchroniser les modifications de façon incrémentale, conserver l’identifiant
officiel de chaque élément et ne recopier les images que si les droits de diffusion le permettent.
L’application peut alors proposer recherche, pagination, favoris et missions sans télécharger
l’intégralité de la photothèque sur le téléphone.

## Flux de soumission

1. L’application crée un brouillon local et copie la photographie dans un stockage persistant.
2. Elle enregistre le point de vue : latitude, longitude, précision GPS, cap, roulis, tangage, focale,
   heure, station officielle et transformation appliquée à l’image de référence.
3. Le serveur crée une URL d’envoi signée. L’original et une miniature sont chargés directement vers
   un stockage objet.
4. Une soumission est créée avec son auteur, sa licence, son consentement et l’état `brouillon`.
5. Les contrôles automatiques vérifient format, taille, métadonnées, proximité et contenu.
6. La soumission passe dans une file de modération.
7. Après validation, un connecteur officiel la transmet à l’Observatoire. Sans API d’écriture, une
   interface de médiation produit un dossier complet destiné à une validation humaine.
8. L’application affiche les états `envoyée`, `à corriger`, `validée`, `publiée` ou `refusée`.

Les envois doivent être reprenables après une coupure réseau et ne jamais être marqués comme terminés
avant confirmation du serveur.

## Modèle minimal

- `users` : compte, pseudonyme, rôles et consentements ;
- `stations` : identifiant officiel, géométrie, source et dernière synchronisation ;
- `archive_images` : station, ordre, auteur, date, droits et URL ;
- `submissions` : auteur, station, état, licence, original et miniature ;
- `capture_telemetry` : position, orientation, focale et transformation d’alignement ;
- `moderation_events` : historique des décisions et demandes de correction ;
- `reactions`, `comments`, `walks` et `walk_members` pour les fonctions collectives.

## Sécurité et vie privée

- authentification Apple ou lien magique et jetons conservés dans SecureStore ;
- URLs signées de courte durée pour les photographies ;
- coordonnées précises privées tant que la soumission n’est pas publiée ;
- suppression du compte et export des données conformes au RGPD ;
- journal d’audit pour la modération ;
- règles explicites de droit d’auteur, droit à l’image et licence de contribution ;
- aucun secret de serveur dans les variables `EXPO_PUBLIC_*`.

## Étapes

1. Obtenir la documentation, les droits de réutilisation et le mécanisme officiel de contribution.
2. Construire le synchroniseur de lecture et mesurer la couverture réelle des photos disponibles.
3. Rendre les captures locales durables et enregistrer toutes les données de terrain.
4. Ajouter comptes, stockage objet, brouillons synchronisés et modération.
5. Brancher la publication officielle puis remplacer le fil collectif de démonstration.
6. Ajouter réactions persistantes, commentaires, profils et sorties collectives.
