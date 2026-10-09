import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAutoplayDisabled } from '../scripts/engineBSeasonReportCapture.mjs';

function pageWith(buttons) {
  const matched = matches => ({
    filter: ({ hasText }) => {
      assert.ok(hasText instanceof RegExp, 'exact text filtering must use an anchored regular expression');
      return matched(matches.filter(button => hasText.test(button.text)));
    },
    count: async () => matches.length,
    textContent: async () => { assert.equal(matches.length, 1); return matches[0].text; },
    getAttribute: async name => {
      assert.equal(matches.length, 1, 'strict locator requires one match');
      assert.equal(name, 'aria-pressed');
      return matches[0].pressed;
    },
  });
  return {
    locator(selector) {
      if (selector === '.autoplay-toggle') return matched(buttons);
      if (selector === '.autoplay-control button') return matched(buttons.filter(button => button.inAutoplayContainer));
      assert.equal(selector, '.autoplay-control > button');
      return matched(buttons.filter(button => button.directChild));
    },
    getByRole(role, options) {
      assert.equal(role, 'button');
      return matched(buttons.filter(button => button.text.trim() === options.name && (!button.hidden || options.includeHidden)));
    },
  };
}
const autoplay = { text: ' 다른 설정 ', pressed: 'false', directChild: true, inAutoplayContainer: true, hidden: true };
const target = { ...autoplay, text: '\n 자동 발전\n' };
const siblings = ['소리 켬', '곡선 지면', '해상도 배율', '색약 모드', '지금 저장'].map(text =>
  ({ text, pressed: 'true', directChild: ['곡선 지면', '해상도 배율'].includes(text), inAutoplayContainer: true, hidden: true }));
test('closed settings autoplay is readable without selecting direct and nested sibling toggles or opening settings', async () => {
  await assertAutoplayDisabled(pageWith([...siblings, target]));
});
test('autoplay read fails closed for enabled, absent, duplicated, or relabeled direct controls', async () => {
  await assert.rejects(assertAutoplayDisabled(pageWith([...siblings, { ...target, pressed: 'true' }])), /enabled/);
  await assert.rejects(assertAutoplayDisabled(pageWith(siblings)), /unique/);
  await assert.rejects(assertAutoplayDisabled(pageWith([target, target])), /unique/);
  await assert.rejects(assertAutoplayDisabled(pageWith([...siblings, autoplay])), /unique|label/);
});

test('exact autoplay identity does not match another control containing its name', async () => {
  const similarlyNamed = { ...target, text: '자동 발전 설정', pressed: 'true' };
  await assertAutoplayDisabled(pageWith([...siblings, similarlyNamed, target]));
});
