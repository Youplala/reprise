# Enregistrement vidéo pour App Review (point 1)

Apple exige une capture **sur appareil physique, sous le dernier iOS**, qui **commence au lancement
de l'app** et montre le parcours type, **y compris chaque demande d'autorisation**. Durée visée :
4 à 6 minutes. Une seule prise propre suffit ; pas de montage nécessaire.

## Avant de filmer

1. **Mettre l'iPhone 13 Pro à jour** : Réglages → Général → Mise à jour logicielle. Il est en
   26.4.2 ; Apple demande la dernière version disponible. Noter la version installée pour la réponse.
2. **Installer le build exact en review** : TestFlight → Paris GO → build **1.0.0 (11)**. Pas de
   development build.
3. **Repartir de zéro** pour que toutes les demandes d'autorisation réapparaissent : supprimer
   l'app, puis réinstaller depuis TestFlight. Ne pas l'ouvrir avant d'enregistrer.
4. Connexion internet active (les photos de 1970 sont chargées depuis la BHVP). Vérifier avant de
   filmer que https://observatoire-photo.paris/elements/add répond dans Safari : le site était
   injoignable le 5 septembre. S'il est en panne, filmer quand même et montrer l'écran d'erreur,
   la réponse écrite l'explique.
5. Mode Concentration « Ne pas déranger », batterie chargée, luminosité fixe, orientation portrait.
6. Activer l'enregistrement d'écran : Réglages → Centre de contrôle → ajouter « Enregistrement de
   l'écran ». Le micro n'est pas nécessaire.
7. Idéalement se placer près d'un point de vue parisien pour que « Autour de vous » ait du sens.
   Sinon, ce n'est pas bloquant : tout le parcours fonctionne depuis n'importe où.

## Déroulé (dans cet ordre)

Chaque étape : laisser l'écran se poser 2 secondes avant d'agir.

1. **Écran d'accueil iOS** → lancer Paris GO depuis l'icône (le lancement doit être visible).
2. **Onboarding** : faire défiler les pages jusqu'à la dernière. Toucher **« Utiliser ma
   position »** → la demande de **localisation** apparaît → « Autoriser lorsque l'app est active ».
3. **Accueil** : laisser la liste « Autour de vous » se charger. Faire défiler une fois.
4. **Fiche station** : toucher une carte. Attendre la photo de 1970 (chargée depuis la BHVP),
   montrer l'auteur et le crédit BHVP. Si une reprise 2026 existe, faire glisser le comparateur
   avant/après. Revenir.
5. **Carte** : onglet Carte. Montrer la grille de 1970, zoomer, toucher un marqueur, ouvrir la
   fiche. Si un écran « Couverture » est accessible, l'ouvrir 3 secondes. Revenir.
6. **Collectif** : onglet Collectif. Faire défiler les comparaisons et les contributeurs. Ouvrir une
   comparaison publiée, toucher **« Signaler cette photo »**, confirmer : le brouillon Mail s'ouvre
   (c'est le mécanisme de signalement de contenu tiers ; sans app Mail, un repli affiche l'adresse
   et le sujet à copier). Le brouillon affiche votre adresse
   d'expéditeur : si vous ne voulez pas la montrer, annulez dès son ouverture. **Annuler** sans
   envoyer, revenir dans Paris GO.
7. **Viseur** : depuis une fiche station, toucher **« Refaire cette photo »**. Demande **caméra** →
   Autoriser. Si une demande **« Mouvement et forme physique »** apparaît (elle n'est pas
   systématique sur iOS), l'autoriser aussi. Montrer la superposition de
   l'archive, jouer le curseur d'opacité, incliner un peu le téléphone pour montrer les repères,
   puis **déclencher**.
8. **Revue** : montrer le comparatif. Toucher **« Enregistrer ma photo »** → demande **Photos
   (ajout uniquement)** → Autoriser. Montrer le message « Enregistrée dans vos photos ».
9. **Dépôt officiel** : toucher **« Préparer le dépôt officiel »**. Laisser le guide s'afficher,
   continuer. La WebView charge le formulaire officiel du CAUE ; montrer que les champs publics sont
   préremplis et les deux images préparées. **Ne pas cocher de case, ne pas envoyer.** Faire défiler
   le formulaire une fois, puis **« Fermer le formulaire »**.
   - Si le site est en panne : montrer l'écran d'erreur, revenir en arrière, montrer que l'app
     fonctionne toujours.
10. Optionnel mais utile : Réglages iOS → Paris GO, montrer les autorisations (Position, Appareil
    photo, Mouvement, Photos « Ajouter uniquement »). Revenir sur Paris GO.
11. Arrêter l'enregistrement.

## Après

1. La vidéo est dans Photos en `.mov`. Apple accepte **.mp4** en pièce jointe de message App
   Review. Transférer sur le Mac (AirDrop) puis convertir :

   ```bash
   ffmpeg -i Enregistrement.mov -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart -an reprise-app-review.mp4
   ```

   (`brew install ffmpeg` si absent.) Viser moins de 200 Mo ; ajouter `-vf scale=-2:1080` si besoin.
2. Regarder la vidéo une fois en entier : lancement visible, les demandes d'autorisation
   (position, caméra, Photos, et mouvement si elle est apparue), aucun envoi de formulaire, aucune donnée personnelle
   à l'écran (pas d'adresse mail dans le brouillon de signalement autre que celle du CAUE).
3. Dans App Store Connect → l'app → version 1.0 → message App Review → **Répondre**, coller le texte
   de [REPONSE-APP-STORE-CONNECT.md](REPONSE-APP-STORE-CONNECT.md) avec la bonne version iOS,
   **Joindre un fichier** → le `.mp4`, envoyer.
4. Copier la « version courte » du même document dans App Store Connect → App Review Information →
   Notes, pour cette version et les suivantes.
