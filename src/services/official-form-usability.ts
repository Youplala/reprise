export const MOBILE_VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover';

export function needsMobileViewport(content?: string | null) {
  if (!content) return true;
  const normalized = content.toLowerCase().replace(/\s+/g, '');
  return !normalized.split(',').some((part) => part === 'width=device-width');
}

export function officialChromeIsExpanded(input: {
  detailsRequested: boolean;
  hasBlockingMessage: boolean;
}) {
  return input.detailsRequested || input.hasBlockingMessage;
}

/**
 * Keeps the third-party form inside the physical WebView width without redesigning it.
 * Existing mobile viewport declarations are preserved; only a missing/desktop viewport is repaired.
 */
export function buildOfficialFormUsabilityScript() {
  return `
    (() => {
      const bridge = window.ReactNativeWebView;
      const send = (message) => {
        try { bridge && bridge.postMessage(JSON.stringify(message)); } catch (_) {}
      };
      const desiredViewport = ${JSON.stringify(MOBILE_VIEWPORT_CONTENT)};
      let viewport = document.querySelector('meta[name="viewport" i]');
      const currentViewport = String(viewport?.getAttribute('content') || '');
      const hasDeviceWidth = currentViewport
        .toLowerCase()
        .replace(/\\s+/g, '')
        .split(',')
        .some((part) => part === 'width=device-width');
      let viewportPatched = false;
      if (!hasDeviceWidth) {
        if (!viewport) {
          viewport = document.createElement('meta');
          viewport.setAttribute('name', 'viewport');
          (document.head || document.documentElement).appendChild(viewport);
        }
        viewport.setAttribute('content', desiredViewport);
        viewportPatched = true;
      }

      if (!document.getElementById('reprise-mobile-usability')) {
        const style = document.createElement('style');
        style.id = 'reprise-mobile-usability';
        style.textContent = [
          'html, body { max-width: 100% !important; overflow-x: hidden !important; -webkit-text-size-adjust: 100% !important; }',
          'img, video, iframe, table { max-width: 100% !important; }',
          '@media (max-width: 430px) {',
          '  form, fieldset, [class*="form"], [class*="field"] { min-width: 0 !important; max-width: 100% !important; }',
          '  input:not([type="checkbox"]):not([type="radio"]), select, textarea, button { max-width: 100% !important; }',
          '}'
        ].join('\\n');
        (document.head || document.documentElement).appendChild(style);
      }

      if (!window.__repriseFocusScrollInstalled) {
        window.__repriseFocusScrollInstalled = true;
        document.addEventListener('focusin', (event) => {
          const target = event.target;
          if (!target || !/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
          window.setTimeout(() => {
            try { target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch (_) {}
          }, 320);
        }, true);
      }
      send({ type: 'usability-ready', viewportPatched });
    })();
    true;
  `;
}
