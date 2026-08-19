import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  MOBILE_VIEWPORT_CONTENT,
  buildOfficialFormUsabilityScript,
  needsMobileViewport,
  officialChromeIsExpanded,
} from '../src/services/official-form-usability.ts';
import { OFFICIAL_SUBMISSION_FIXTURE_HTML } from '../src/services/official-submission-fixture.ts';

function runUsabilityScript(viewportContent) {
  const messages = [];
  const nodesById = new Map();
  const listeners = new Map();
  const viewport = viewportContent === undefined
    ? undefined
    : {
        content: viewportContent,
        getAttribute(name) { return name === 'content' ? this.content : null; },
        setAttribute(name, value) { if (name === 'content') this.content = value; },
      };
  const appended = [];
  const timers = new Map();
  const clearedTimers = [];
  let nextTimer = 1;
  const document = {
    activeElement: undefined,
    documentElement: { appendChild(node) { appended.push(node); } },
    head: { appendChild(node) { appended.push(node); if (node.id) nodesById.set(node.id, node); } },
    querySelector(selector) { return selector.startsWith('meta[name=') ? viewport : undefined; },
    createElement(tagName) {
      return {
        tagName: tagName.toUpperCase(),
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; if (name === 'content') this.content = value; },
        getAttribute(name) { return this.attributes[name] ?? null; },
      };
    },
    getElementById(id) { return nodesById.get(id); },
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  const window = {
    ReactNativeWebView: { postMessage(value) { messages.push(JSON.parse(value)); } },
    setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
    clearTimeout(id) { clearedTimers.push(id); timers.delete(id); },
  };

  Function('window', 'document', buildOfficialFormUsabilityScript())(window, document);
  return { appended, clearedTimers, document, listeners, messages, timers, viewport, window };
}

test('repairs only a missing or desktop viewport', () => {
  assert.equal(needsMobileViewport(undefined), true);
  assert.equal(needsMobileViewport('width=980, initial-scale=1'), true);
  assert.equal(needsMobileViewport('initial-scale=1, width = device-width'), false);

  const desktop = runUsabilityScript('width=980');
  assert.equal(desktop.viewport.content, MOBILE_VIEWPORT_CONTENT);
  assert.equal(desktop.messages.at(-1).viewportPatched, true);

  const mobile = runUsabilityScript('width=device-width, initial-scale=1');
  assert.equal(mobile.viewport.content, 'width=device-width, initial-scale=1');
  assert.equal(mobile.messages.at(-1).viewportPatched, false);
});

test('constrains known form content while preserving horizontal scrolling for unknown wrappers', () => {
  const result = runUsabilityScript('width=980');
  const style = result.appended.find((node) => node.id === 'reprise-mobile-usability');
  assert.match(style.textContent, /max-width: 430px/);
  assert.doesNotMatch(style.textContent, /overflow-x:\s*hidden/);
  assert.match(style.textContent, /overflow-x:\s*auto/);
  assert.match(style.textContent, /-webkit-text-size-adjust: 100%/);
});

test('focus scrolling cancels stale timers and only scrolls the still-active field without animation', () => {
  const result = runUsabilityScript('width=980');
  const first = { tagName: 'INPUT', isConnected: true, scrollIntoView() { assert.fail('stale field scrolled'); } };
  let scrollOptions;
  const second = {
    tagName: 'TEXTAREA',
    isConnected: true,
    scrollIntoView(options) { scrollOptions = options; },
  };

  result.document.activeElement = first;
  result.listeners.get('focusin')({ target: first });
  const staleTimer = [...result.timers.keys()][0];
  const staleCallback = result.timers.get(staleTimer);
  result.document.activeElement = second;
  result.listeners.get('focusin')({ target: second });
  assert.equal(result.clearedTimers.includes(staleTimer), true);
  staleCallback();

  const activeTimer = [...result.timers.keys()][0];
  const activeCallback = result.timers.get(activeTimer);
  result.timers.delete(activeTimer);
  activeCallback();
  assert.deepEqual(scrollOptions, { block: 'center', inline: 'nearest' });

  result.listeners.get('focusin')({ target: first });
  const blurredTimer = [...result.timers.keys()][0];
  result.listeners.get('focusout')({ target: first });
  assert.equal(result.clearedTimers.includes(blurredTimer), true);
});

test('fixture preserves the representative live contract and includes a nested wide-wrapper fallback case', () => {
  assert.match(OFFICIAL_SUBMISSION_FIXTURE_HTML, /content="width=980"/);
  assert.match(OFFICIAL_SUBMISSION_FIXTURE_HTML, /min-width: 720px/);
  assert.match(OFFICIAL_SUBMISSION_FIXTURE_HTML, /class="nested-wide-wrapper"/);
  assert.match(OFFICIAL_SUBMISSION_FIXTURE_HTML, /\.nested-wide-wrapper\s*\{[^}]*min-width:/);
  assert.match(OFFICIAL_SUBMISSION_FIXTURE_HTML, /<h2>Contributeur<\/h2>/);
  assert.match(OFFICIAL_SUBMISSION_FIXTURE_HTML, /<h2>Contributeur 2026<\/h2>/);
  assert.equal((OFFICIAL_SUBMISSION_FIXTURE_HTML.match(/Prénom NOM/g) || []).length, 2);
  assert.equal((OFFICIAL_SUBMISSION_FIXTURE_HTML.match(/>Mail<\/label>/g) || []).length, 2);
  assert.equal((OFFICIAL_SUBMISSION_FIXTURE_HTML.match(/règlement de participation/g) || []).length, 2);
  assert.equal((OFFICIAL_SUBMISSION_FIXTURE_HTML.match(/type="file"/g) || []).length, 1);
  assert.match(OFFICIAL_SUBMISSION_FIXTURE_HTML, /accept="\.jpg,\.jpeg,\.png"/);
  assert.match(OFFICIAL_SUBMISSION_FIXTURE_HTML, /8 Mo maximum/);
});

test('native chrome stays compact by default', () => {
  assert.equal(
    officialChromeIsExpanded({ detailsRequested: false, hasBlockingMessage: false }),
    false,
  );
  assert.equal(
    officialChromeIsExpanded({ detailsRequested: true, hasBlockingMessage: false }),
    true,
  );
  assert.equal(
    officialChromeIsExpanded({ detailsRequested: false, hasBlockingMessage: true }),
    true,
  );
});

test('screen injects prefill before usability after load and never at document start', () => {
  const source = readFileSync(
    new URL('../src/screens/official-submission/index.tsx', import.meta.url),
    'utf8',
  );
  const injection = source.match(/const injectedScript = useMemo\(([\s\S]*?)\n  \);/)?.[1] ?? '';
  const prefillIndex = injection.indexOf('buildObservatoirePrefillScript(prefill)');
  const usabilityIndex = injection.indexOf('buildOfficialFormUsabilityScript()');

  assert.equal(source.includes('injectedJavaScriptBeforeContentLoaded='), false);
  assert.ok(prefillIndex > -1 && usabilityIndex > prefillIndex);
});
