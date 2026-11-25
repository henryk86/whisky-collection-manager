/** @fileoverview Explicit markup assertions for tests that do not need a DOM. */
import {RenderPlan, serializeMarkup} from '../../public/js/ui/render-plan.js';

/**
 * Serializes a render plan at the assertion boundary, never as input to views.
 * Ordinary values remain unchanged for assertions against test doubles.
 * @param {*} value Captured value.
 * @return {*} Serialized render plan or original value.
 */
export function renderedText(value) {
  return value instanceof RenderPlan ? serializeMarkup(value) : value;
}

/**
 * Creates an explicitly trusted static markup fixture for a component test.
 * @param {string} source Test-owned static HTML.
 * @return {!RenderPlan} Fixture fragment.
 */
export function fixtureMarkup(source) {
  return new RenderPlan(source, {});
}
