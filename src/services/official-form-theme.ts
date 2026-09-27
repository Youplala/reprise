// Valeurs de `Palette` recopiées : ce module est chargé tel quel par les tests Node, qui ne
// résolvent ni l'alias `@/` ni React Native.
const COLORS = {
  ink: '#0D2A3C',
  inkSoft: '#56646B',
  go: '#CC481C',
  goBright: '#E8552B',
  line: '#DDD5C8',
  fog: '#F4F1EC',
  parisBlue: '#153953',
} as const;

/** Classe posée sur `<html>` : les blocs remplis par Paris GO sont repliés. */
export const OFFICIAL_COMPACT_CLASS = 'paris-go-compact';

/**
 * Habille le formulaire officiel aux couleurs de Paris GO, sans en changer la structure ni le
 * comportement : aucun champ n'est ajouté, retiré ou rempli ici, et l'envoi reste le bouton du
 * site. Seuls les blocs déjà remplis par le pré-remplissage (`data-paris-go-prefilled`) peuvent
 * être repliés, leur valeur étant affichée dans l'écran natif.
 *
 * Les sélecteurs restent génériques (éléments de formulaire) ; ceux de Materialize, la
 * bibliothèque de GoGoCarto, sont inertes si le site en change.
 */
export function buildOfficialFormThemeScript() {
  const css = `
    :root {
      --pgo-ink: ${COLORS.ink};
      --pgo-soft: ${COLORS.inkSoft};
      --pgo-go: ${COLORS.go};
      --pgo-go-bright: ${COLORS.goBright};
      --pgo-line: ${COLORS.line};
      --pgo-fog: ${COLORS.fog};
      --pgo-navy: ${COLORS.parisBlue};
    }
    html, body { background: var(--pgo-fog) !important; }
    body {
      color: var(--pgo-ink) !important;
      font-family: -apple-system, system-ui, sans-serif !important;
      -webkit-font-smoothing: antialiased;
    }
    form h1, form h2, form h3, form h4, form legend {
      color: var(--pgo-ink) !important;
      font-family: 'Avenir Next Condensed', -apple-system, system-ui, sans-serif !important;
      font-weight: 800 !important;
      letter-spacing: 0 !important;
    }
    form label, form .group-label, form legend + p {
      color: var(--pgo-soft) !important;
      font-size: 14px !important;
      font-weight: 600 !important;
    }
    form input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]),
    form textarea, form select {
      color: var(--pgo-ink) !important;
      font-size: 17px !important;
      border-color: var(--pgo-line) !important;
      caret-color: var(--pgo-go) !important;
    }
    form input:focus, form textarea:focus, form select:focus {
      outline: none !important;
      border-color: var(--pgo-go) !important;
      box-shadow: 0 1px 0 0 var(--pgo-go) !important;
    }
    form input:focus + label, form textarea:focus + label, form label.active {
      color: var(--pgo-go) !important;
    }
    form input[type=checkbox], form input[type=radio] { accent-color: var(--pgo-go); }
    form [type=checkbox]:checked + span:not(.lever)::before {
      border-right-color: var(--pgo-go) !important;
      border-bottom-color: var(--pgo-go) !important;
    }
    form [type=radio]:checked + span::after {
      background-color: var(--pgo-go) !important;
      border-color: var(--pgo-go) !important;
    }
    form button, form .btn, form input[type=submit] {
      border-radius: 999px !important;
      box-shadow: none !important;
      font-family: -apple-system, system-ui, sans-serif !important;
      font-weight: 700 !important;
      letter-spacing: 0 !important;
      text-transform: none !important;
    }
    form button[type=submit], form input[type=submit], form .btn[type=submit] {
      width: 100% !important;
      min-height: 56px !important;
      border: 0 !important;
      background: var(--pgo-go) !important;
      color: #fff !important;
      font-size: 17px !important;
    }
    form button[type=button], form .btn:not([type=submit]) {
      border: 1px solid var(--pgo-navy) !important;
      background: #fff !important;
      color: var(--pgo-navy) !important;
    }
    form i, form .prefix, form .material-icons { color: #A7AEB2 !important; }
    [data-paris-go-section] {
      margin: 0 0 14px !important;
      padding: 18px 16px 8px !important;
      border: 0 !important;
      border-radius: 22px !important;
      background: #fff !important;
      box-shadow: 0 10px 18px rgba(13, 42, 60, 0.07) !important;
    }
    html.${OFFICIAL_COMPACT_CLASS} [data-paris-go-prefilled],
    html.${OFFICIAL_COMPACT_CLASS} [data-paris-go-section-done] { display: none !important; }
  `;

  return `
    (() => {
      let style = document.getElementById('paris-go-theme');
      if (!style) {
        style = document.createElement('style');
        style.id = 'paris-go-theme';
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = ${JSON.stringify(css)};

      // Une section est le plus proche ancêtre d'un titre qui contient des champs. Elle est
      // « terminée » quand tous ses champs visibles appartiennent à un bloc rempli par Paris GO :
      // le mode compact la masque entièrement, titre compris.
      const controlsOf = (root) => Array.from(
        root.querySelectorAll('input:not([type=hidden]), textarea, select'),
      );
      const sectionOf = (heading) => {
        let element = heading.parentElement;
        while (element && element !== document.body) {
          if (element.tagName === 'FORM') return undefined;
          if (controlsOf(element).length) return element;
          element = element.parentElement;
        }
        return undefined;
      };
      const markSections = () => {
        document.querySelectorAll('form h1, form h2, form h3, form h4, form legend').forEach((heading) => {
          const section = sectionOf(heading);
          if (section) section.setAttribute('data-paris-go-section', '');
        });
        document.querySelectorAll('[data-paris-go-section]').forEach((section) => {
          const controls = controlsOf(section);
          const open = controls.filter((control) => !control.closest('[data-paris-go-prefilled]'));
          if (controls.length && !open.length) section.setAttribute('data-paris-go-section-done', '');
          else section.removeAttribute('data-paris-go-section-done');
        });
      };
      window.__parisGoMarkSections = markSections;
      markSections();
      if (!window.__parisGoSectionObserver && window.MutationObserver) {
        window.__parisGoSectionObserver = new MutationObserver(() => {
          clearTimeout(window.__parisGoSectionTimer);
          window.__parisGoSectionTimer = setTimeout(markSections, 220);
        });
        window.__parisGoSectionObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
    })();
    true;
  `;
}

/** Replie ou déplie les blocs remplis par Paris GO, sans recharger la page. */
export function buildOfficialFormCompactScript(compact: boolean) {
  return `
    if (window.__parisGoMarkSections) window.__parisGoMarkSections();
    document.documentElement.classList.toggle(${JSON.stringify(OFFICIAL_COMPACT_CLASS)}, ${compact ? 'true' : 'false'});
    true;
  `;
}
