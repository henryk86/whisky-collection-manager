/**
 * @fileoverview Checks semantic palette aliases in both supported themes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const STYLES = path.resolve('public/styles');
const PALETTES = ['tokens.css', 'palette-bottle.css',
  'palette-map.css', 'palette-warehouse.css'];

/**
 * Collects active custom-property definitions for one colour theme.
 *
 * @param {boolean} dark Whether to include dark-theme overrides.
 * @return {!Map<string, string>} Effective values from all palettes.
 */
function themeVariables(dark) {
  const result = new Map();
  for (const filename of PALETTES) {
    const source = fs.readFileSync(path.join(STYLES, filename), 'utf8');
    const [light, overrides = ''] = source.split(':root[data-theme="dark"]');
    const parts = dark ? [light, overrides] : [light];
    for (const part of parts) {
      for (const match of part.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
        result.set(match[1], match[2].trim());
      }
    }
  }
  return result;
}

/**
 * Resolves a simple CSS variable chain and rejects missing or cyclic aliases.
 *
 * @param {string} name Variable to resolve.
 * @param {!Map<string, string>} values Active theme definitions.
 * @param {!Set<string>=} visited Variables encountered in the chain.
 * @return {string} Final value after resolving any direct aliases.
 */
function resolvedValue(name, values, visited = new Set()) {
  assert.ok(values.has(name), `Missing CSS variable: ${name}`);
  assert.ok(!visited.has(name), `Cyclic CSS variable: ${name}`);
  const value = values.get(name);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  if (!alias) return value;
  return resolvedValue(alias[1], values, new Set([...visited, name]));
}

test('shared palette aliases resolve without cycles in both themes', () => {
  for (const dark of [false, true]) {
    const values = themeVariables(dark);
    for (const [name, value] of values) {
      if (value.startsWith('var(') && /^var\(--[\w-]+\)$/.test(value)) {
        assert.ok(resolvedValue(name, values), name);
      }
    }
    for (const [alias, target] of [
      ['--ds-color-scanner-status-success', '--ds-color-status-success'],
      ['--ds-color-scanner-status-error', '--ds-color-tasting-score-error'],
      ['--ds-color-text-intro', '--ds-color-text-stat-label'],
      ['--ds-color-brand-h1-em-color', '--ds-color-brand-emblem-color'],
      ['--ds-map-zoom-level-color', '--ds-map-controls-button-color'],
      ['--ds-warehouse-elevated-rect-stroke',
        '--ds-warehouse-drag-rect-stroke'],
    ]) {
      assert.equal(
        resolvedValue(alias, values),
        resolvedValue(target, values),
        `${alias} in ${dark ? 'dark' : 'light'}`
      );
    }
  }
});

test('contrast and interaction colours keep distinct dark-theme roles', () => {
  const light = themeVariables(false);
  const dark = themeVariables(true);
  assert.equal(resolvedValue('--ds-color-link', light), resolvedValue('--ds-color-link-hover', light));
  assert.notEqual(resolvedValue('--ds-color-link', dark), resolvedValue('--ds-color-link-hover', dark));
  assert.notEqual(resolvedValue('--ds-color-control-bg', dark), resolvedValue('--ds-color-surface', dark));
  assert.notEqual(resolvedValue('--ds-color-hero-background-2', light),
    resolvedValue('--ds-color-hero-background-3', light));
});

/**
 * Converts a solid CSS hex colour to its relative luminance.
 *
 * @param {string} hex Solid CSS hex colour.
 * @return {number} WCAG relative luminance.
 */
function relativeLuminance(hex) {
  assert.match(hex, /^#(?:[\da-f]{3}|[\da-f]{6})$/i);
  const fullHex = hex.length === 4 ? `#${[...hex.slice(1)].map(char => char + char).join('')}` : hex;
  const channels = [1, 3, 5].map(offset => parseInt(fullHex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/**
 * Calculates the WCAG contrast of two opaque CSS colours.
 *
 * @param {string} foreground Foreground hex colour.
 * @param {string} background Background hex colour.
 * @return {number} WCAG contrast ratio.
 */
function contrastRatio(foreground, background) {
  const high = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const low = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (high + 0.05) / (low + 0.05);
}

test('text on inverted navy surfaces is readable in both themes', () => {
  for (const dark of [false, true]) {
    const values = themeVariables(dark);
    const background = resolvedValue('--navy', values);
    const foregroundTokens = [
      '--ds-color-filter-chip-selected-text',
      '--ds-bottle-main-source-color',
      '--ds-bottle-photo-source-color',
      '--ds-color-pagination-pages-current-color',
      '--ds-color-pagination-pages-current-hover-color',
    ];
    for (const token of foregroundTokens) {
      const foreground = resolvedValue(token, values);
      assert.ok(contrastRatio(foreground, background) >= 4.5,
        `${token} needs readable text on ${background} in ` + `${dark ? 'dark' : 'light'} mode: ${foreground}`);
    }
  }
});
