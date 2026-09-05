# Réponse à App Review — Guideline 2.1 (Information Needed), build 1.0.0 (12)

Texte à coller dans App Store Connect → Messages App Review (« Répondre »), en joignant la vidéo
(`.mp4`) produite avec [SCRIPT-ENREGISTREMENT.md](SCRIPT-ENREGISTREMENT.md). La partie 1 est
couverte par la pièce jointe ; les parties 2 à 7 sont ci-dessous, en anglais.

Avant d'envoyer, remplacer les crochets `[…]` : version iOS réellement utilisée pour la vidéo,
et retirer la phrase sur les confirmations écrites si les mails CAUE / BHVP n'ont pas encore reçu
de réponse (voir [MAIL-CAUE.md](MAIL-CAUE.md) et [MAIL-BHVP.md](MAIL-BHVP.md)).

---

Hello,

Thank you for your review. Please find below the requested information for Paris GO. We have also uploaded a new build, 1.0.0 (11), which fixes an issue found while preparing the recording: on a device where camera access had not been granted yet, the viewfinder showed a still image instead of asking for camera permission. The viewfinder now asks for camera access up front and shows the live camera only. Please review build 11.

**1. Screen recording**

Attached: a screen recording made on a physical iPhone 13 Pro running iOS [26.x.x], starting from the app launch and walking through the core flow: onboarding, location permission prompt, home ("nearby" historic viewpoints), station detail (1970 archive photograph, credits, before/after comparison), map with the 1970 grid, "Collectif" tab (published comparisons and contributors, including the "Report this photo" mechanism), the camera viewfinder with the historic photograph overlaid (camera permission prompt, and the motion permission prompt when iOS shows it), capture and review, saving the photo to the Photos library (add-only permission), and the "Dépôt officiel" screen that opens the official third-party contribution form in a WebView. The recording deliberately stops before the form is sent, because that would publish a test contribution on a real public campaign run by a public institution (see point 4).

The app has no account registration, login or account deletion (no accounts at all), no paid content, subscriptions or purchases, and no App Tracking Transparency prompt (nothing is tracked). Users do not create content inside the app: photos stay on the device unless the user sends them through the third-party form described below.

**2. Devices and operating systems tested**

- iPhone 13 Pro (iPhone14,2), iOS [26.x.x] — physical device, App Store build 1.0.0 (12) installed through TestFlight; also used for the recording.
- [Add any other physical devices / iOS versions you or your TestFlight testers actually used, e.g. "iPhone 15, iOS 26.5" — remove this line otherwise.]
- Build environment: macOS 26.6.2, Xcode 26.6 (17F113), Expo SDK 57 / React Native 0.86, built with EAS Build.

**3. What the app does, for whom**

Paris GO is a free, ad-free, open-source (MIT) utility for rephotography in Paris.

In 1970 the FNAC and the City of Paris organised an amateur photo contest: Paris was divided into 1,755 squares of 250 m and about 2,800 photographers produced tens of thousands of photographs, now held by the Bibliothèque historique de la Ville de Paris (BHVP). In 2026 the CAUE de Paris (a public-interest architecture and landscape council) runs a public participatory campaign, the "Observatoire photo participatif des paysages parisiens" (observatoire-photo.paris), inviting anyone to retake those views.

Problem solved: finding the exact viewpoint of a 1970 photograph and reproducing its framing is hard to do with a phone browser and a printed picture. Paris GO (a) shows the historic photographs around the user on a map, (b) overlays the archive photograph on the live camera with adjustable opacity and tilt guides so the user can match the framing, (c) saves the resulting photo to the user's Photos library, and (d) pre-fills the public, official contribution form of the Observatoire so the user can submit their photo themselves.

Target audience: adults and teenagers interested in Paris, photography, urban history and heritage; participants of the Observatoire campaign. Age rating 4+. No user accounts, no advertising, no analytics SDK, no in-app purchases.

**4. Setup and access instructions**

No login, credentials or sample files are needed. An internet connection is required to load the 1970 photographs (they are streamed from the BHVP's public viewer, not bundled) and to open the official form; the map, grid and published comparisons work offline from an embedded data snapshot.

Everything can be tested from anywhere; only a real rephotography requires being physically at the Paris viewpoint.

- Onboarding: swipe through the intro pages. On the last page, "Utiliser ma position" triggers the location prompt; "Explorer sans localisation" skips it. Without location, the home screen falls back to Paris.
- Home ("Accueil"): list of nearby historic viewpoints. Tap a card to open the station detail (1970 photograph, author, BHVP credits, and, when a retake has already been published, a before/after slider).
- Map ("Carte"): the 1970 grid over Paris, filters, and markers for stations; tap a marker to open a station. The "Couverture" screen shows campaign progress.
- Collectif: published comparisons and contributors. On a published comparison, "Signaler cette photo" prepares an e-mail to the campaign team (observatoire-photo@caue75.fr); if no mail app is configured, the app shows the address, subject and link to copy instead. This is the reporting mechanism for third-party content; nothing is sent without the user's own action.
- Camera: from any station, "Refaire cette photo" opens the viewfinder (camera permission; iOS may also show the motion permission used for the tilt guides). The historic photograph is overlaid; the slider changes its opacity. Take a photo → review screen → "Enregistrer ma photo" asks for add-only Photos access and saves the picture to the user's library.
- Official submission: "Préparer le dépôt officiel" shows a short guide, then loads https://observatoire-photo.paris/elements/add in a WebView and pre-fills public fields (date, place, coordinates, device model) and prepares the two image files. The app never fills identity fields, never ticks consent boxes and never submits. Please do not press the form's final send button: it would publish a test contribution on a live public campaign. Note that this third-party site has had availability incidents; if it is unreachable the app shows an explicit error state and the rest of the app keeps working.

**5. External services, tools and platforms**

- Apple MapKit (via react-native-maps) for the main map on iOS.
- OpenStreetMap tiles (tile.openstreetmap.org) for some detail maps.
- GitHub (raw.githubusercontent.com) to refresh the embedded public-data snapshot at launch, with fallback to the bundled copy.
- Bibliothèque historique de la Ville de Paris public viewer (bibliotheques-specialisees.paris.fr) to display the 1970 photographs from their ARK permalinks.
- WordPress.com image proxy (i0.wp.com, Automattic) to resize some remote images.
- observatoire-photo.paris (CAUE de Paris) loaded in a WebView only on the "Dépôt officiel" screen; its public API is used only by an offline script that generates the data snapshot, never by the app at runtime.
- No authentication provider, no payment processor, no AI service, no analytics or advertising SDK, no push notifications. The developer runs no server and receives no user data.

**6. Regional differences**

None. The app behaves identically in every region. The content is inherently about Paris, France, and the interface is in French only.

**7. Regulated industry / third-party material**

The app does not operate in a regulated industry. Third-party material is used as follows:

- Observatoire photo participatif data (stations, published retakes, contributor names): information already published on the campaign's public website and API by the CAUE de Paris. The app displays it with the attribution required by article 10.3 of the campaign rules and links back to the source; it does not claim any redistribution right and never sends contributions itself.
- 1970 contest grid: official GeoJSON export published by the CAUE de Paris.
- 1970 photographs: held by the BHVP. They are not copied into the app or its repository; they are loaded on demand from the library's own public viewer via their permalinks and displayed with the photographer's name, the institution and the collection name. The app links back to the source.
- Descriptive metadata (authors, places) for some 1970 records: from the open-source project paris-1970 (framagit.org/dohseven/paris-1970), which normalises the BHVP catalogue records.
- OpenStreetMap data: ODbL, attributed.

Paris GO is an independent project and is presented as such in the app and on its website (https://youplala.github.io/reprise/sources/). [We have asked the CAUE de Paris and the BHVP for written confirmation of these uses and can forward their replies on request.]

Support: https://youplala.github.io/reprise/support/ — Privacy policy: https://youplala.github.io/reprise/confidentialite/ — Source code: https://github.com/Youplala/reprise

Best regards,
Élie Brosset

---

## Version courte pour le champ « Notes » (App Review Information), à conserver pour les prochaines soumissions

No account, login, purchase, subscription or tracking. Free, ad-free, open-source rephotography app for the 1970 "C'était Paris en 1970" photo contest and the 2026 public campaign of the Observatoire photo participatif des paysages parisiens (CAUE de Paris).

Testing from anywhere: swipe the onboarding, tap "Utiliser ma position" (location prompt) or "Explorer sans localisation". Home lists historic viewpoints (falls back to Paris without location). Map tab shows the 1970 grid and stations. Collectif tab shows published before/after comparisons; "Signaler cette photo" prepares a report e-mail to the campaign team. From any station, "Refaire cette photo" opens the camera with the 1970 photograph overlaid (camera prompt, plus motion prompt when iOS shows it); take a photo, then "Enregistrer ma photo" saves it with add-only Photos access.

"Préparer le dépôt officiel" loads the official third-party form https://observatoire-photo.paris/elements/add in a WebView and pre-fills public fields only; the app never fills identity, never ticks consents, never submits. Please do not press the site's send button (live public campaign). If that third-party site is temporarily unreachable, the app shows an explicit error and everything else keeps working.

External services: Apple MapKit, OpenStreetMap tiles, GitHub raw (data snapshot), BHVP public viewer (1970 photos via permalinks, not bundled), WordPress.com image proxy, observatoire-photo.paris (WebView). No analytics, no server operated by the developer.

Third-party material: public Observatoire data displayed with attribution and links to the source; 1970 photographs streamed from the BHVP viewer with credits, not bundled; grid published by CAUE de Paris. Independent project, credits at https://youplala.github.io/reprise/sources/.

Contact: eliebrosset@gmail.com
