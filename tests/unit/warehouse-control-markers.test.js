import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../public/styles/warehouse.css', import.meta.url), 'utf8');

test('warehouse assignment radios and bulk-selection checkboxes keep native 18px marks', () => {
    const rule = css.match(/\.warehouse-assignment-modes input\[type="radio"\],\s*\.warehouse-bulk-check\[type="checkbox"\]\s*\{([^}]*)\}/);
    assert.ok(rule, 'only the two relevant warehouse controls should share the fix');
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
