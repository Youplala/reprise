# Validation locale — 14 septembre 2026

## Intégration

Les PR #43 (comparaisons portrait), #44 (localisation hors Paris), #41 (consignes)
et #26 (carnet durable) sont fusionnées dans `origin/main` (`4e579c3`).
La branche locale `codex/integrated-simulator-20260914` intègre ce main ainsi que
les ajustements UI locaux préservés dans `codex/local-ui-20260914` (`060e17e`).
Elle ajoute l'accueil compact demandé, la correction Photos et une correction
de mesure du panneau repliable. Ces ajouts locaux ne constituent pas une release TestFlight.

## Corrections Photos

Le build TestFlight 1.0.0 (14) utilise `createAssetAsync` depuis la racine
`expo-media-library` 57.0.4 : cet export lève systématiquement une erreur.
L'erreur était interceptée et la copie Photos ne se faisait pas.
L'import explicite `expo-media-library/legacy` restaure l'API fonctionnelle, avec
permission ajout uniquement. La copie privée du carnet précède l'ajout à Photos.
Les retours UI distinguent démo, carnet seul et carnet + Photos.
Revue indépendante GPT Sol : APPROVE pour cette correction et pour la PR #26 réparée.

## Vérifications réalisées

- TypeScript : `tsc --noEmit`, réussi.
- Lint : `npm run lint`, réussi.
- `npm test -- --watchman=false --runInBand` : 154 tests Node et 21 tests Jest réussis.
  Watchman désactivé pour ces tests car son répertoire d'état est inaccessible dans le sandbox.
- Export iOS sans bytecode réussi avec le CLI Expo verrouillé du projet.
- Build natif `expo run:ios --device AC03D06C-85F0-4B1E-B719-C5845E64935C --no-bundler`
  réussi : zéro erreur, un avertissement de bibliothèque libc++ dupliquée.
- Simulateur ParisGO-Dev, iOS 26.5, simslim : 140/170 services gérés désactivés.
- Accueil : titre « Autour de moi », photos immédiatement après l'en-tête, accès carnet.
- Communauté : date de relevé non tronquée.
- Fiche « 2 rue Charles Robin » → carte : bonne station, cadrage et filtre Photos refaites.
- Panneau : réduction et réouverture par gestes vérifiées. La mesure doit être indépendante
  de la hauteur animée ; sinon une FlatList rétrécit progressivement et ne se redéploie plus.
- GPS : refus sans attente permanente, puis recentrage sur Lyon simulé et retour explicite à Paris.
  Position du simulateur remise à Paris après ce contrôle.
- Capture de démonstration → review → sauvegarde carnet → relance complète : brouillon retrouvé.
- Formulaire WebView local : navigation et préremplissage (6 champs), aucune sortie Safari observée.
  Mode démo sans fichier courant, donc aucun test de dépôt réel ni de deux pièces jointes réelles.

## Limites

Node local 26.8.2 ; CI des PR utilise Node 22. Les contrôles locaux ci-dessus passent.
La sauvegarde Photos réelle, caméra, permissions physiques et pièces jointes doivent encore
être vérifiées sur iPhone avec un nouveau build. Aucune release ni soumission officielle faite.
La capture utilisateur confirme TestFlight 14 et le formulaire interne final, mais n'exclut
pas un aller-retour Safari antérieur. Aucun chemin statique de ce build ne l'explique ; un
enregistrement d'écran continu est nécessaire pour isoler cette transition sur l'appareil.
Les captures simulées n'ont volontairement aucun fichier photo et ne testent pas Photos.

`npm install` signale 22 vulnérabilités de dépendances (15 modérées, 7 hautes) ;
aucune mise à niveau automatique hors périmètre n'a été effectuée.

## Itération Communauté et cartes (après-midi)

- Communauté : en-tête compact, accès explicite Statistiques et annuaire des 155 contributeurs.
  Recherche sur les noms publics, sans limite au top dix, insensible à la casse et aux accents.
  Navigation vérifiée vers Elie B. (rang 106), retour conservant la recherche,
  état sans résultat et effacement ; lien Statistiques vérifié dans le simulateur.
- Profil : identité et compteurs allégés, comparaisons pleine largeur, dates visibles.
  Tri existant par date de prise de vue décroissante conservé ; entrées sans date à la fin.
- Badge bleu et laiton « Refaite avec Paris GO » dans le profil, le fil, la carte et la fiche.
  Détection déclarative de la mention dans la description publique déjà importée ; aucun
  nouveau champ privé ni nouvel appel à l'API. Les fiches `1h3` et `1mv`, confirmées par leur
  auteur dans la conversation, sont les deux seules exceptions historiques sans mention.
- Le commentaire officiel reste libre et vide au départ. La signature est ajoutée à la fin
  lors du `submit`, en préservant le texte existant et sans doublon. Une notice près du champ
  et le guide annoncent cet ajout. Tests du bridge sur fixture locale et revue GPT Sol réussis.
  Aucun dépôt réel effectué ; un éventuel chemin amont utilisant directement `form.submit()`
  sans événement `submit` reste hors de la couverture actuelle.
- Cartes de secteur simplifiées : lieu, compteur, flèche. Zone ouverte = un bloc avec aperçu,
  sans numéros internes ni instructions répétées. Fiche archive allégée, crédits conservés.
  Autour conserve les images pleine largeur, fond uniforme et fin séparateur de légende.
- Bulles inertes après plusieurs rafraîchissements à chaud : reproduit puis résolu par
  rechargement complet. Le toucher des bulles et l'ouverture du secteur ont été revérifiés ;
  l'utilisateur a confirmé que le déplacement fonctionne également après rechargement.
  Pas de changement spéculatif des gestes natifs ni du filtrage des archives.
- Vérification locale : TypeScript, lint, 161 tests Node et 22 tests Jest, export JS iOS.
  Changements locaux uniquement, pas de nouveau binaire TestFlight.

## Onglet À propos et signature Paris GO

- Quatrième onglet natif « À propos » : bloc de marque bleu, présentation d’Élie Brosset,
  contact laiton `parisgo@eliebrosset.com`, site, code GitHub et confidentialité.
  Nom et informations du projet repris du site existant ; adresse choisie par le développeur.
- La mention « Open source » est limitée à cet écran dans l’application. Site GitHub Pages
  inchangé. Signature « Paris GO » conservée sur les comparaisons et le visuel de partage,
  sous les crédits pour leur laisser toute la largeur.
- Rendu de l’onglet et de la fiche « 2 rue Charles Robin » vérifié dans ParisGO-Dev.
  Les crédits et « Paris GO » sont visibles sans la mention « Open source ».
  Navigation GitHub ouverte dans Safari ; retour dans l’app. Aucun courriel envoyé.
- Tests comportementaux des quatre liens et du retour d’erreur : cycle rouge/vert,
  notamment pour l’adresse `mailto:` demandée. TypeScript, lint, 161 tests Node,
  24 tests Jest et export JS iOS réussis. Aucun nouveau build TestFlight publié.
