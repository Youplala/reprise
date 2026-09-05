# Mail au CAUE de Paris (Observatoire photo participatif)

À : observatoire-photo@caue75.fr
Cc : contact@caue75.fr
Objet : Reprise, application mobile d'accompagnement de l'Observatoire — demande de confirmation écrite

Bonjour,

Je m'appelle Élie Brosset. Je développe bénévolement Reprise, une application iPhone gratuite,
sans publicité et open source (licence MIT) qui accompagne la campagne 2026 de l'Observatoire photo
participatif des paysages parisiens. Elle aide les participantes et participants à retrouver les
points de vue du concours « C'était Paris en 1970 », à retrouver le cadrage grâce à une
superposition de l'archive sur la caméra, puis à déposer leur photo sur votre formulaire officiel.

Reprise est en cours d'examen par Apple pour publication sur l'App Store. Apple me demande de
documenter l'utilisation de contenus tiers. Je vous écris donc pour vous informer précisément de
ce que fait l'application et vous demander une confirmation écrite (une simple réponse à ce mail
suffit) que ces usages vous conviennent.

Ce que Reprise utilise :

1. Les données publiques de l'Observatoire (stations, reprises publiées, prénoms et noms des
   contributeurs pour l'attribution), telles qu'elles sont diffusées sur le site et son API publique.
   J'ai bien noté que le règlement (articles 10.1 et 10.2) n'accorde d'autorisation qu'au CAUE et à la
   Ville de Paris : Reprise ne revendique aucun droit propre et ne fait que montrer, avec un lien
   vers la source, ce que le site publie déjà.
   Un script relève ces données une fois par nuit et publie un instantané normalisé ; l'application
   n'interroge jamais votre API à l'exécution. Les champs sont filtrés par liste blanche et aucune
   adresse e-mail n'est conservée. L'attribution est affichée conformément à l'article 10.3 du
   règlement de participation.
2. L'export GeoJSON de la grille du concours de 1970 publié par le CAUE.
3. Le formulaire officiel https://observatoire-photo.paris/elements/add, affiché dans une vue web
   intégrée. Reprise préremplit uniquement des champs publics vides (date, lieu, coordonnées, modèle
   d'appareil) et prépare les deux images attendues par votre mode d'emploi : la photographie
   actuelle de l'utilisateur et une copie de la photographie d'archive de la BHVP correspondante. Elle ne renseigne jamais l'identité, ne coche
   aucun consentement et ne déclenche jamais l'envoi : le dépôt reste un acte conscient de
   l'utilisateur, sur votre site, selon vos conditions.
4. Le nom « Observatoire photo participatif des paysages parisiens » et la mention « animé par le
   CAUE de Paris », à titre descriptif. L'application se présente explicitement comme un projet
   indépendant, ni édité ni approuvé officiellement par le CAUE.

Reprise ne possède aucun serveur : elle ne reçoit ni les identités ni les photos des utilisateurs,
qui partent directement de votre formulaire. Un bouton « Signaler cette photo » prépare un mail à
cette adresse pour toute reprise publiée posant problème ; dites-moi si vous préférez une autre
adresse.

Pourriez-vous me confirmer par retour que :

- vous autorisez explicitement Reprise à afficher les données publiques de l'Observatoire (stations,
  reprises publiées, noms des contributeurs), avec attribution et lien vers la source ;
- vous autorisez l'intégration du formulaire officiel avec préremplissage des seuls champs publics,
  y compris la préparation de la copie de la photographie d'archive que votre formulaire demande ;
- la formulation des crédits vous convient, ou m'indiquer celle que vous souhaitez.

Je me tiens à votre disposition pour tout ajustement, et je serais heureux de vous présenter
l'application. Le code, la politique de confidentialité et la page des sources sont publics :

- https://github.com/Youplala/reprise
- https://youplala.github.io/reprise/sources/
- https://youplala.github.io/reprise/confidentialite/

Merci beaucoup pour cette campagne, et pour votre temps.

Bien cordialement,
Élie Brosset
eliebrosset@gmail.com
