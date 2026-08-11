/**
 * Formulaire représentatif du contrat GoGoCarto observé, réservé au development build.
 *
 * Les noms des champs personnalisés sont volontairement différents du site live : la fixture
 * vérifie que le bridge s'appuie sur la sémantique (libellés/sections), pas sur les IDs générés.
 * Elle ne fait aucune requête et ne peut donc créer aucune contribution.
 */
export const OFFICIAL_SUBMISSION_FIXTURE_HTML = `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <!-- Reproduit le viewport desktop défectueux observé sur le formulaire tiers. -->
    <meta name="viewport" content="width=980" />
    <style>
      :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 20px; color: #102734; background: #fff; }
      h1 { margin: 0 0 6px; font-size: 24px; }
      h2 { margin: 24px 0 8px; font-size: 18px; }
      .notice { margin: 0 0 22px; color: #526875; font-size: 14px; line-height: 1.4; }
      .test { display: inline-block; margin-bottom: 18px; padding: 6px 9px; border-radius: 999px;
        color: #8c492d; background: #f7e9e2; font-size: 11px; font-weight: 800; }
      label, .group-label { display: block; margin: 14px 0 6px; font-size: 13px; font-weight: 700; }
      input, textarea { width: 100%; min-height: 44px; padding: 10px; border: 1px solid #c9d3d8;
        border-radius: 10px; background: #fff; font: inherit; }
      input[type=radio], input[type=checkbox] { width: auto; min-height: auto; }
      input[type=file] { min-height: 52px; padding: 12px 8px; }
      textarea { min-height: 80px; resize: vertical; }
      .radio-option { display: flex; gap: 8px; align-items: center; margin: 8px 0; }
      .radio-option label { display: inline; margin: 0; font-weight: 500; }
      button { width: 100%; min-height: 48px; margin-top: 22px; border: 0; border-radius: 24px;
        color: #fff; background: #174b68; font: inherit; font-weight: 800; }
      #selected { margin-top: 10px; color: #59717d; font-size: 12px; }
      .legacy-form-shell { min-width: 720px; }
    </style>
  </head>
  <body>
    <span class="test">MODE TEST LOCAL — AUCUN ENVOI</span>
    <h1>Déposer une reprise</h1>

    <p class="notice">Fixture du formulaire officiel observé : informations de la photo,
      sections 1970/2026, profil et règlement.</p>
    <form class="legacy-form-shell" id="fixture-form">
      <section>
        <h2>Localisation</h2>
        <div class="field-container">
          <input id="fixture-address" name="element[fullAddress]" />
          <label for="fixture-address">Adresse complète</label>
          <input id="fixture-latitude" name="element[geo][latitude]" type="hidden" value="0" />
          <input id="fixture-longitude" name="element[geo][longitude]" type="hidden" value="0" />
        </div>
      </section>

      <section>
        <h2>Informations de votre photo</h2>
        <div class="field-container">
          <input id="fixture-title" name="element[name]" placeholder="Adresse (numéro + rue)" />
          <label for="fixture-title">Titre de la fiche</label>
        </div>
        <div class="field-container">
          <input id="fixture-arrondissement" name="data[fixture_arrondissement]" type="number" />
          <label for="fixture-arrondissement">Arrondissement (75001)</label>
        </div>
        <div class="field-container">
          <input id="fixture-city" name="data[fixture_ville]" />
          <label for="fixture-city">Ville</label>
        </div>
        <div class="field-container">
          <textarea id="fixture-observations" name="data[fixture_observations]"></textarea>
          <label for="fixture-observations">Observations commentaires</label>
        </div>
      </section>

      <section>
        <h2>Photo de 1970</h2>
        <div class="field-container">
          <input id="fixture-1970-date-start" name="data[fixture_1970_date]" type="hidden" />
          <input id="fixture-1970-date-display" readonly />
          <label for="fixture-1970-date">Date de la prise de vue</label>
        </div>
        <label for="reference-photo">Photographie historique</label>
        <input id="reference-photo" name="reference-photo" type="file" accept="image/*" />
      </section>

      <section>
        <h2>Photo de 2026</h2>
        <div class="field-container">
          <input id="fixture-2026-date-start" name="data[fixture_2026_date]" type="hidden" />
          <input id="fixture-2026-date-display" readonly />
          <label for="fixture-2026-date">Date de la prise de vue</label>
        </div>
        <div class="field-container">
          <span class="group-label">Type d'appareil utilisé</span>
          <div class="radio-option">
            <input id="fixture-appareil-smartphone" name="data[fixture_appareil][]" type="radio" value="Smartphone" />
            <label for="fixture-appareil-smartphone">Smartphone</label>
          </div>
          <div class="radio-option">
            <input id="fixture-appareil-numerique" name="data[fixture_appareil][]" type="radio" value="Appareil photo numérique" />
            <label for="fixture-appareil-numerique">Appareil photo numérique</label>
          </div>
        </div>
        <label for="current-photo">Photographie actuelle</label>
        <input id="current-photo" name="current-photo" type="file" accept="image/*" />
      </section>

      <section>
        <h2>Contributeur</h2>
        <label for="fixture-identity">Prénom NOM</label>
        <input id="fixture-identity" name="data[fixture_identity]" />
        <label for="fixture-email">Mail</label>
        <input id="fixture-email" name="data[fixture_email]" type="email" />
        <label for="fixture-age">Age</label>
        <input id="fixture-age" name="data[fixture_age]" type="number" />
        <label for="fixture-country">Pays</label>
        <input id="fixture-country" name="data[fixture_country]" />
        <div class="radio-option">
          <input id="fixture-consent" name="data[fixture_consent]" type="checkbox" />
          <label for="fixture-consent">J'ai lu et j'accepte le règlement de participation</label>
        </div>
      </section>


      <p id="selected">0/2 photo sélectionnée</p>
      <button id="fixture-submit" type="submit">Simuler l'envoi</button>
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
