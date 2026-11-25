import {fixtureMarkup, renderedText} from '../helpers/rendering.js';
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
    assert.match(renderedText(loading), /type="submit"/);
    assert.match(renderedText(loading), /disabled aria-busy="true"/);
    const icon = actionButton({
      label: 'Close',
      icon: fixtureMarkup('<svg aria-hidden="true"></svg>'),
      iconOnly: true,
      size: 'small',
    });
    assert.match(renderedText(icon), /aria-label="Close"/);
    assert.equal((renderedText(icon).match(/<svg/g) || []).length, 1);
    assert.throws(() => actionButton({variant: 'unknown'}), RangeError);
    assert.throws(() => actionButton({size: 'massive'}), RangeError);
    assert.match(renderedText(actionButton({label: '<script>hi</script>', action: 'evil" test'})), /&lt;script&gt;/);
    assert.doesNotMatch(renderedText(actionButton({label: '<script>hi</script>'})), /<script>/);
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
    assert.match(renderedText(markup), /data-act="add-distillery"/);
    assert.match(renderedText(markup), /class="add-action-label"/);
    assert.equal((renderedText(markup).match(/<svg/g) || []).length, 1);
    assert.match(renderedText(markup), /A &amp; B/);
    assert.doesNotMatch(renderedText(markup), /&amp;amp;/);
    const withData = actionButton({
      label: 'Open',
      action: 'tastings-open',
      data: {'tasting-id': 'A&B"<>'},
      ariaLabel: 'Show <tasting>',
      title: 'Open & view',
    });
    assert.match(renderedText(withData), /data-tasting-id="A&amp;B&quot;&lt;&gt;"/);
    assert.match(renderedText(withData), /aria-label="Show &lt;tasting&gt;"/);
    assert.match(renderedText(withData), /title="Open &amp; view"/);
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
    assert.match(renderedText(html), /role="dialog" aria-modal="true" aria-labelledby="ds-modal-title"/);
    assert.match(renderedText(html), /class="dialog ds-modal ds-modal--editor"/);
    assert.doesNotMatch(renderedText(html), /ds-modal--wide/, 'explicit modal variant must override legacy wide size');
    const assignment = modalFrame({
      title: 'Lagerort',
      content: fixtureMarkup('<form id="warehouse-form"></form>'),
      wide: true,
      variant: 'assignment',
      closeLabel: 'Close',
    });
    assert.match(renderedText(assignment), /class="dialog ds-modal ds-modal--assignment"/);
    assert.doesNotMatch(renderedText(assignment), /ds-modal--wide/, 'assignment stays at the documented 740px maximum');
    const legacyWide = modalFrame({
      title: 'Other', content: fixtureMarkup('<p></p>'),
      wide: true, closeLabel: 'Close',
    });
    assert.match(renderedText(legacyWide), /class="dialog ds-modal wide ds-modal--wide"/);
    assert.match(renderedText(html), /id="ds-modal-title">Whisky &amp; Me/);
    assert.match(renderedText(html), /class="ds-modal-body"><form id="edit"><\/form>/);
    assert.match(renderedText(html), /data-act="close-modal"/);
    assert.throws(() => modalFrame({title: 'bad', variant: 'random'}), RangeError);
    const footer = modalFooter(actionButton({
      label: 'Cancel',
      action: 'close-modal',
    }));
    assert.match(renderedText(footer), /class="actions ds-modal-footer"/);
  }
);

test(
  'form helpers escape untrusted text and associate help/errors with controls',
  () => {
    const field = textInput('Your & name', 'name', '<x>', {required: true, description: 'Helpful', error: 'Wrong & missing'});
    assert.match(
      renderedText(field),
      new RegExp('name="name" required aria-invalid="true" a' + 'ria-describedby="ds-name-hint ds-name-erro' + 'r"')
    );
    assert.match(renderedText(field), /value="&lt;x&gt;"/);
    assert.match(renderedText(field), /id="ds-name-hint">Helpful/);
    assert.match(renderedText(field), /id="ds-name-error" role="alert">Wrong &amp; missing/);
    const select = selectInput('Choose', 'id', [['', '<Empty>'], ['a', 'Yes']], 'a');
    assert.match(renderedText(select), /&lt;Empty&gt;/); assert.match(renderedText(select), /value="a" selected/);
    assert.match(renderedText(areaInput('Note', 'note', '<br>')), /&lt;br&gt;/);
    assert.match(renderedText(checkboxInput('Accept', 'consent', true)), /type="checkbox" name="consent" checked/);
  }
);
