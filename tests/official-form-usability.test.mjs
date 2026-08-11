import assert from 'node:assert/strict';
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
  const document = {
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
    setTimeout(callback) { callback(); },
  };

  Function('window', 'document', buildOfficialFormUsabilityScript())(window, document);
  return { appended, document, listeners, messages, viewport, window };
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

test('constrains wide form content and scrolls a focused field above the keyboard', () => {
  const result = runUsabilityScript('width=980');
  const style = result.appended.find((node) => node.id === 'reprise-mobile-usability');
  assert.match(style.textContent, /max-width: 430px/);
  assert.match(style.textContent, /overflow-x: hidden/);
  assert.match(style.textContent, /-webkit-text-size-adjust: 100%/);

  let scrollOptions;
  result.listeners.get('focusin')({
    target: {
      tagName: 'INPUT',
      scrollIntoView(options) { scrollOptions = options; },
    },
  });
  assert.deepEqual(scrollOptions, { block: 'center', inline: 'nearest', behavior: 'smooth' });
});

test('fixture reproduces the wide third-party contract and native chrome stays compact by default', () => {
  assert.match(OFFICIAL_SUBMISSION_FIXTURE_HTML, /content="width=980"/);
  assert.match(OFFICIAL_SUBMISSION_FIXTURE_HTML, /min-width: 720px/);
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
