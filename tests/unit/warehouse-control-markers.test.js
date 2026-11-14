import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../public/styles/warehouse.css', import.meta.url), 'utf8');

test('warehouse assignment radios keep native 18px marks while furniture batch uses tiles', () => {
    const rule = css.match(/\.warehouse-assignment-modes input\[type="radio"\]\s*\{([^}]*)\}/);
    assert.ok(rule, 'the native warehouse assignment radios should keep correct dimensions');
    assert.match(css,/\.warehouse-bulk-item\.is-selected/);
    assert.doesNotMatch(css,/\.warehouse-bulk-check\[type="checkbox"\]/);
    const declarations = rule[1];
    for (const [property, value] of [
        ['appearance', 'auto'],
        ['width', '18px'],
        ['height', '18px'],
        ['min-width', '18px'],
        ['min-height', '18px'],
        ['padding', '0'],
        ['margin', '0'],
    ]) {
        assert.match(declarations, new RegExp(`(?:^|;)\\s*${property}:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;`, 'm'),
            `${property} must override global text-field sizing`);
    }
});
