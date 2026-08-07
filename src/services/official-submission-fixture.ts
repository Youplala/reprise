/**
 * Formulaire minimal réservé au development build.
 *
 * Il reproduit les contraintes qui nous intéressent : champs repérés par leur libellé, deux
 * sélecteurs de photos natifs et une confirmation détectable par le bridge. Il ne fait aucune
 * requête et ne peut donc créer aucune contribution.
 */
export const OFFICIAL_SUBMISSION_FIXTURE_HTML = `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
    <style>
      :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 20px; color: #102734; background: #fff; }
      h1 { margin: 0 0 6px; font-size: 24px; }
      .notice { margin: 0 0 22px; color: #526875; font-size: 14px; line-height: 1.4; }
      .test { display: inline-block; margin-bottom: 18px; padding: 6px 9px; border-radius: 999px;
        color: #8c492d; background: #f7e9e2; font-size: 11px; font-weight: 800; }
      label { display: block; margin: 14px 0 6px; font-size: 13px; font-weight: 700; }
      input, textarea { width: 100%; min-height: 44px; padding: 10px; border: 1px solid #c9d3d8;
        border-radius: 10px; background: #fff; font: inherit; }
      input[type=file] { min-height: 52px; padding: 12px 8px; }
      textarea { min-height: 80px; resize: vertical; }
      button { width: 100%; min-height: 48px; margin-top: 22px; border: 0; border-radius: 24px;
        color: #fff; background: #174b68; font: inherit; font-weight: 800; }
      #selected { margin-top: 10px; color: #59717d; font-size: 12px; }
    </style>
  </head>
  <body>
    <span class="test">MODE TEST LOCAL — AUCUN ENVOI</span>
    <h1>Déposer une reprise</h1>
    <p class="notice">Cette fixture permet de vérifier le préremplissage et le sélecteur de photos
      de la WebView pendant l'indisponibilité du serveur officiel.</p>
    <form id="fixture-form">
      <label for="address">Adresse</label>
      <input id="address" name="address" />
      <label for="postal-code">Code postal</label>
      <input id="postal-code" name="postal-code" inputmode="numeric" />
      <label for="city">Ville</label>
      <input id="city" name="city" />
      <label for="capture-date">Date de prise de vue</label>
      <input id="capture-date" name="capture-date" type="date" />
      <label for="device">Appareil utilisé</label>
      <input id="device" name="device" />
      <label for="latitude">Latitude</label>
      <input id="latitude" name="latitude" inputmode="decimal" />
      <label for="longitude">Longitude</label>
      <input id="longitude" name="longitude" inputmode="decimal" />
      <label for="note">Commentaire</label>
      <textarea id="note" name="note"></textarea>
      <label for="reference-photo">Photographie historique</label>
      <input id="reference-photo" name="reference-photo" type="file" accept="image/*" />
      <label for="current-photo">Photographie actuelle</label>
      <input id="current-photo" name="current-photo" type="file" accept="image/*" />
      <p id="selected">0/2 photo sélectionnée</p>
      <button type="submit">Simuler l'envoi</button>
    </form>
    <script>
      const files = Array.from(document.querySelectorAll('input[type=file]'));
      const updateSelected = () => {
        const count = files.filter((input) => input.files && input.files.length > 0).length;
        document.getElementById('selected').textContent = count + '/2 photo' + (count > 1 ? 's' : '') + ' sélectionnée' + (count > 1 ? 's' : '');
      };
      files.forEach((input) => input.addEventListener('change', updateSelected));
      document.getElementById('fixture-form').addEventListener('submit', (event) => {
        event.preventDefault();
        document.body.innerHTML = '<h1>Merci pour votre contribution</h1><p>Contribution enregistrée en attente de modération.</p>';
      });
    </script>
  </body>
</html>
`;
