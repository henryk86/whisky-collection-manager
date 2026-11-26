import {fixtureMarkup, renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {actionButton} from '../../public/js/ui/buttons.js';
import {modalFrame, modalFooter} from '../../public/js/ui/modal-layout.js';
import {textInput, selectInput, areaInput, checkboxInput}
  from '../../public/js/ui/fields.js';

test(
  'button variants preserve existing semantics and expose loading/disabled/focusable controls',
  () => {
    for (const [variant, className] of [
      ['primary', 'primary'],
      ['secondary', 'ds-button'],
      ['destructive', 'danger'],
      ['text', 'ds-button--text'],
      ['icon', 'ds-button--icon'],
    ]) {
      assert.match(renderedText(actionButton({label: 'A & B', action: 'do-it', variant})), new RegExp(className));
    }
    const loading = actionButton({
      label: 'Save', variant: 'primary',
      type: 'submit', loading: true,
    });
    assert.ok(domElements(loading, '[type="submit"]').length > 0);
    assert.ok(domElements(loading, '[disabled][aria-busy="true"]').length > 0);
    const icon = actionButton({
      label: 'Close',
      icon: fixtureMarkup('<svg aria-hidden="true"></svg>'),
      iconOnly: true,
      size: 'small',
    });
    assert.ok(domElements(icon, '[aria-label="Close"]').length > 0);
    assert.equal(domElements(icon, 'svg').length, 1);
    assert.throws(() => actionButton({variant: 'unknown'}), RangeError);
    assert.throws(() => actionButton({size: 'massive'}), RangeError);
    assert.match(renderedText(actionButton({label: '<script>hi</script>', action: 'evil" test'})), /&lt;script&gt;/);
    assert.equal(domElements(actionButton({label: '<script>hi</script>'}), 'script').length, 0);
  }
);


test(
  'shared buttons render app-owned icon labels without double-escaping',
  () => {
    const iconLabel = fixtureMarkup('<span class="add-action-label">' + '<svg aria-hidden="true"></svg>' + '<span>A &amp; B</span></span>');
    const markup = actionButton({
      trustedContent: iconLabel,
      action: 'add-distillery',
      variant: 'primary',
    });
    assert.ok(domElements(markup, '[data-act="add-distillery"]').length > 0);
    assert.ok(domElements(markup, '[class="add-action-label"]').length > 0);
    assert.equal(domElements(markup, 'svg').length, 1);
    assert.match(renderedText(markup), /A &amp; B/);
    assert.doesNotMatch(renderedText(markup), /&amp;amp;/);
    const withData = actionButton({
      label: 'Open',
      action: 'tastings-open',
      data: {'tasting-id': 'A&B"<>'},
      ariaLabel: 'Show <tasting>',
      title: 'Open & view',
    });
    assert.ok(domElements(withData, '[data-tasting-id="A&B\\"<>"]').length > 0);
    assert.ok(domElements(withData, '[aria-label="Show <tasting>"]').length > 0);
    assert.ok(domElements(withData, '[title="Open & view"]').length > 0);
    assert.throws(() => actionButton({data: {'foo\" onmouseover': 'bad'}}), RangeError);
    assert.match(renderedText(actionButton({label: '<script>alert(1)</script>'})), /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  }
);

test(
  'central modal frame provides title, named close action, inner content and explicit variants',
  () => {
    const html = modalFrame({
      title: 'Whisky & Me',
      content: fixtureMarkup('<form id="edit"></form>'),
      wide: true,
      variant: 'editor',
      closeLabel: 'Close',
    });
    assert.ok(domElements(html, '[role="dialog"][aria-modal="true"][aria-labelledby="ds-modal-title"]').length > 0);
    assert.ok(domElements(html, '[class="dialog ds-modal ds-modal--editor"]').length > 0);
    assert.doesNotMatch(renderedText(html), /ds-modal--wide/, 'explicit modal variant must override legacy wide size');
    const assignment = modalFrame({
      title: 'Lagerort',
      content: fixtureMarkup('<form id="warehouse-form"></form>'),
      wide: true,
      variant: 'assignment',
      closeLabel: 'Close',
    });
    assert.ok(domElements(assignment, '[class="dialog ds-modal ds-modal--assignment"]').length > 0);
    assert.doesNotMatch(renderedText(assignment), /ds-modal--wide/, 'assignment stays at the documented 740px maximum');
    const legacyWide = modalFrame({
      title: 'Other', content: fixtureMarkup('<p></p>'),
      wide: true, closeLabel: 'Close',
    });
    assert.ok(domElements(legacyWide, '[class="dialog ds-modal wide ds-modal--wide"]').length > 0);
    assert.match(renderedText(html), /id="ds-modal-title">Whisky &amp; Me/);
    assert.match(renderedText(html), /class="ds-modal-body"><form id="edit"><\/form>/);
    assert.ok(domElements(html, '[data-act="close-modal"]').length > 0);
    assert.throws(() => modalFrame({title: 'bad', variant: 'random'}), RangeError);
    const footer = modalFooter(actionButton({
      label: 'Cancel',
      action: 'close-modal',
    }));
    assert.ok(domElements(footer, '[class="actions ds-modal-footer"]').length > 0);
  }
);

test(
  'form helpers escape untrusted text and associate help/errors with controls',
  () => {
    const field = textInput('Your & name', 'name', '<x>', {required: true, description: 'Helpful', error: 'Wrong & missing'});
    assert.equal(domElements(field, 'input[name="name"][required][aria-invalid="true"][aria-describedby="ds-name-hint ds-name-error"]').length, 1);
    assert.ok(domElements(field, '[value="<x>"]').length > 0);
    assert.match(renderedText(field), /id="ds-name-hint">Helpful/);
    assert.equal(domElements(field, '#ds-name-error[role="alert"]')[0].text, 'Wrong & missing');
    const select = selectInput('Choose', 'id', [['', '<Empty>'], ['a', 'Yes']], 'a');
    assert.match(renderedText(select), /&lt;Empty&gt;/); assert.ok(domElements(select, '[value="a"][selected]').length > 0);
    assert.match(renderedText(areaInput('Note', 'note', '<br>')), /&lt;br&gt;/);
    assert.ok(domElements(checkboxInput('Accept', 'consent', true), '[type="checkbox"][name="consent"][checked]').length > 0);
  }
);
