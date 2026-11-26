import {domElements, domText, domMatches, domScope, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBottling} from '../../server/domain/normalization.js';
import {createTastingHistory} from '../../public/js/domain/tasting-history.js';
import {glencairnRating} from '../../public/js/ui/glencairn-rating.js';
import {parseTastingScore} from '../../shared/tasting.js';
import {WHISKY_COLORS, whiskyPickerHex, whiskyPickerPosition, isAllowedWhiskyHex, normalizeWhiskyColor} from '../../shared/whisky-colors.js';
import {whiskyColorSelector, whiskyColorDisplay, whiskyCustomColorName} from '../../public/js/ui/whisky-color-selector.js';
import {WHISKY_COLOR_REFERENCES, whiskyColorNameKey} from '../../shared/whisky-color-names.js';
import {createTranslator} from '../../public/js/i18n/index.js';
import german from '../../public/locales/de.json' with {type: 'json'};
import english from '../../public/locales/en.json' with {type: 'json'};
import {GLENCAIRN_INK} from '../../public/js/ui/glencairn-icon.js';

/**
 * Derives the notes result from the supplied values.
 *
 * @param {*} nose Value used by this operation.
 * @return {!Object} Result computed from the supplied inputs.
 */
const notes = nose => ({nose, palate: '', finish: ''});

test(
  'five clickable Glencairn glasses retain fractional original 0-100 ratings',
  async () => {
    const html = glencairnRating(85);
    assert.equal((await domElements(html, '[data-rating-points]')).length, 5);
    assert.equal((await domElements(html, '[class="tasting-glass"]')).length, 5);
    assert.ok((await domElements(html, '[data-tasting-score]')).length > 0);
    assert.ok((await domElements(html, '[value="85"]')).length > 0);
    await assertDom(html, "[style*=\"--glass-fill:25%\"]"); // the fifth GLASS is filled to 25% of its liquid height
    assert.ok((await domElements(html, '[role="group"]')).length > 0);
    assert.ok((await domElements(html, '[clip-path="url(#rating-glass-4)"]')).length > 0);
    assert.match(GLENCAIRN_INK, /M215,97/, 'original Glencairn shines inside the bowl');
    assert.ok((await domElements(html, '[class="glencairn-rating-outline"]')).length > 0);
    assert.ok((await domElements(html, '[class="glencairn-rating-fill"]')).length > 0);
    await assertDom(html, "[data-rating-fill][y=\"267.75\"][height=\"63.25\"]");
    assert.equal((await domElements(html, '[class="glencairn-gold"]')).length, 0, 'rating uses its dedicated gold liquid fill');
    assert.ok((await domElements(html, '[class="tasting-score-control"]')).length > 0);
    await assertDom(html, "span#tasting-score-suffix", {"text": new RegExp("^/ 100$")});
    assert.equal((await domMatches(html, "[data-tasting-rating-total], .tasting-rating-total")), false, 'only the editable score displays the point value');
    assert.ok((await domElements(html, '[data-glass-state="partial"]')).length > 0);
    assert.equal((new RegExp("★|☆").test(await domText(html))), false);
    assert.ok((await domElements(glencairnRating(null), '[placeholder="–"]')).length > 0);
    assert.ok((await domElements(glencairnRating(null), '[value=""]')).length > 0);
  }
);

test(
  'precise rating input accepts comma and period, preserves one decimal, rejects invalid values',
  async () => {
    assert.equal(parseTastingScore('87,5'), 87.5);
    assert.equal(parseTastingScore('87.5'), 87.5);
    assert.equal(parseTastingScore('0'), 0);
    assert.equal(parseTastingScore('100'), 100);
    assert.equal(parseTastingScore(''), null);
    for (const bad of ['-1', '100.1', '87.55', 'word', '1e2']) assert.throws(() => parseTastingScore(bad));
    assert.throws(() => normalizeBottling({name: 'Release', rating: 87.5}));
    assert.ok((await domElements(glencairnRating(87.5), '[value="87,5"]')).length > 0);
    await assertDom(glencairnRating(87.5), "[style*=\"--glass-fill:37.5%\"]");
  }
);

test(
  'twelve-step whisky color scale persists as independent, validated bottling attribute and joins undo history',
  async () => {
    assert.equal(WHISKY_COLORS.length, 12);
    const chosen = whiskyColorSelector('butter');
    assert.ok((await domElements(chosen, '[data-color-key="butter"][aria-pressed="true"]')).length > 0);
    await assertDom(chosen, ".whisky-color-choice.is-selected");
    assert.equal((await domMatches(chosen, "[data-act=\"tasting-color-clear\"]")) || (await domMatches(chosen, ".whisky-color-footer, .whisky-color-current")), false, 'no repeated colour name or clear control below palette');
    assert.equal(new Set(WHISKY_COLORS.map(v => v.key)).size, 12);
    for (const color of WHISKY_COLORS) assert.match(color.hex, /^#[0-9a-f]{6}$/);
    assert.throws(() => normalizeBottling({
      name: 'Release', whiskyColor: 'amber', rating: 87.5,
    }));
    const html = whiskyColorSelector('amber');
    assert.equal((await domElements(html, '[data-color-key]')).length, 12);
    assert.ok((await domElements(html, '[data-whisky-color="amber"]')).length > 0);
    assert.ok((await domElements(html, '[style="fill:#d17b20"]')).length > 0);
    const history = createTastingHistory({
      flavorProfile: null,
      tastingNotes: notes(''),
      rating: 87.5,
      whiskyColor: 'amber',
    });
    history.record({...history.value, whiskyColor: 'honey'});
    history.undo(); assert.equal(history.value.whiskyColor, 'amber');
    history.redo(); assert.equal(history.value.whiskyColor, 'honey');
  }
);

test(
  'custom whisky picker hides HEX from users, stores exact shades and rejects green/blue',
  async () => {
    const html = whiskyColorSelector('custom:#b74154');
    assert.equal((await domElements(html, '.whisky-color-choice')).length, 12, 'reference colours stay unchanged');
    assert.ok((await domElements(html, '[class="whisky-custom-row is-selected"]')).length > 0);
    assert.ok((await domElements(html, '[data-whisky-picker-area]')).length > 0);
    assert.ok((await domElements(html, 'input[type="hidden"][data-whisky-custom-hex][value="#b74154"]')).length > 0);
    assert.equal((await domMatches(html, "[type=\"text\"][data-whisky-custom-hex]")) || (await domMatches(html, "*", {"text": new RegExp("^HEX$")})) || (await domMatches(html, ".whisky-custom-hex-row")), false);
    assert.ok((await domElements(html, '[value="#b74154"]')).length > 0);
    assert.ok((await domElements(html, '[style="fill:#b74154"]')).length > 0);
    assert.equal((await domElements(html, 'output[data-whisky-custom-name][aria-live="polite"]'))[0].text.trim(), 'Rubinrot');
    await assertDom(whiskyColorDisplay('custom:#b74154'), "strong", {"text": new RegExp("^Rubinrot$")});
    assert.doesNotMatch(
      await domText(domScope(whiskyColorDisplay('custom:#b74154'), 'strong')),
      /#[0-9a-f]{6}/i,
      'readonly label hides hexadecimal code'
    );
    // Switching from a custom shade to a reference colour clears the custom
    // field,
    // its preview liquid and the picker marker instead of retaining a stale
    // HEX.
    for (const fixedSelection of ['honey', null]) {
      const fixedHtml = whiskyColorSelector(fixedSelection);
      assert.ok((await domElements(fixedHtml, '[data-whisky-custom-hex][value=""]')).length > 0);
      assert.ok((await domElements(fixedHtml, '[id="custom-color-glass"]')).length > 0);
      assert.ok((await domElements(fixedHtml, '[class="glencairn-liquid"][style="fill:transparent"]')).length > 0);
      assert.ok((await domElements(fixedHtml, '[class="whisky-custom-row"]')).length > 0);
      assert.equal((await domElements(fixedHtml, '[class="whisky-custom-row is-selected"]')).length, 0);
      await assertDom(fixedHtml, "[style*=\"#b74154\"], [value*=\"#b74154\"]", {}, true);
      assert.equal((await domElements(fixedHtml, 'output[data-whisky-custom-name][aria-live="polite"]'))[0].text.trim(), '');
    }
    assert.equal(normalizeWhiskyColor('custom:#F4B3C1'), 'custom:#f4b3c1', 'rose HEX is normalized');
    for (const hex of ['#b74154', '#f4b3c1', '#9b2125', '#eaa52e', '#50392d',
      '#f6efb6'])
      assert.equal(normalizeWhiskyColor(`custom:${hex}`), `custom:${hex}`);
    for (const hex of [
      '#00ff00',
      '#3a8a53',
      '#0044ff',
      '#00ffff',
      '#ff00ff',
      '#555555',
      '#ffffff',
      '#12345g',
      '#abc',
      'color:red',
    ])
      assert.throws(() => normalizeWhiskyColor(`custom:${hex}`), `reject ${hex}`);
    for (let y = 0; y <= 10; y++) for (let x = 0; x <= 10; x++) {
      const hex = whiskyPickerHex(x / 10, y / 10);
      assert.equal(isAllowedWhiskyHex(hex), true, `picker colour ${hex} must be persisted`);
      const point = whiskyPickerPosition(hex);
      assert.ok(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
    }
    assert.equal(normalizeWhiskyColor('honey'), 'honey', 'existing fixed keys survive');
    const history = createTastingHistory({
      flavorProfile: null,
      tastingNotes: notes(''),
      rating: null,
      whiskyColor: 'honey',
    });
    history.record({...history.value, whiskyColor: 'custom:#f4b3c1'});
    assert.equal(history.value.whiskyColor, 'custom:#f4b3c1');
    history.undo(); assert.equal(history.value.whiskyColor, 'honey');
    history.redo(); assert.equal(history.value.whiskyColor, 'custom:#f4b3c1');
  }
);

test(
  '50 curated custom-colour names use perceptual matches without changing stored HEX',
  async () => {
    assert.equal(WHISKY_COLOR_REFERENCES.length, 50);
    const keys = new Set(), shades = new Set();
    const en = createTranslator(english, german, 'en');
    const de = createTranslator(german, english, 'de');
    for (const ref of WHISKY_COLOR_REFERENCES) {
      assert.ok(!keys.has(ref.key), `duplicate key: ${ref.key}`);
      assert.ok(!shades.has(ref.hex), `duplicate colour: ${ref.hex}`);
      keys.add(ref.key); shades.add(ref.hex);
      assert.equal(whiskyColorNameKey(ref.hex), ref.key, `reference ${ref.key} must name itself`);
      const translationKey = `tasting.colorName.${ref.key}`;
      assert.notEqual(de(translationKey), translationKey);
      assert.notEqual(en(translationKey), translationKey);
      assert.ok(de(translationKey).trim());
      assert.ok(en(translationKey).trim());
      assert.equal(normalizeWhiskyColor(`custom:${ref.hex}`), `custom:${ref.hex}`);
    }
    assert.equal(whiskyColorNameKey('#00ff00'), null);
    assert.equal(whiskyColorNameKey('#0011ee'), null);
    assert.equal(whiskyColorNameKey(''), null);
    assert.equal(whiskyColorNameKey('#CB8154'), 'copperGold');
    assert.equal(whiskyCustomColorName('#cb8154'), 'Kupfergold');
    await assertDom(whiskyColorDisplay('custom:#cb8154'), "strong", {"text": new RegExp("^Kupfergold$")});
    await assertDom(whiskyColorSelector('custom:#cb8154'), "output[data-whisky-custom-name]", {"text": new RegExp("^Kupfergold$")});
    assert.equal(whiskyColorNameKey('#cb8255'), 'copperGold', 'nearby colour is named by perceptual proximity');
    // Near-white pink and straw can be close in OKLab lightness, but must
    // keep their distinct colour families at the upper picker boundary.
    const paleRose = whiskyPickerHex(0, 0);
    assert.equal(paleRose, '#f2d4de');
    assert.equal(whiskyColorNameKey(paleRose), 'paleRose');
    assert.equal(whiskyCustomColorName(paleRose), 'Blasses Rosé');
    await assertDom(whiskyColorDisplay(`custom:${paleRose}`), "strong", {"text": new RegExp("^Blasses Rosé$")});
    assert.equal(whiskyColorNameKey(whiskyPickerHex(0.24, 0)), 'paleRose');
    assert.equal(whiskyColorNameKey(whiskyPickerHex(1, 0)), 'veryPaleStraw');
    assert.equal(whiskyColorNameKey(whiskyPickerHex(0, 0.05)), 'paleRose');
    assert.equal(
      normalizeWhiskyColor('custom:#cb8255'),
      'custom:#cb8255',
      'naming must not quantize the saved colour'
    );
    await assertDom(whiskyColorDisplay('honey'), "strong", {"text": new RegExp("^Honig$")}, false, 'fixed reference labels are unchanged');
  }
);
