/** @fileoverview Explicit render-plan capture ports for controller tests. */
import {RenderPlan, composeMarkup} from '../../public/js/ui/render-plan.js';

/**
 * Creates an application-owned fragment for a synthetic test fixture.
 * @param {string} source Static test fixture markup.
 * @return {!RenderPlan} Fragment that the production DOM renderer can mount.
 */
export function fixtureMarkup(source) {return new RenderPlan(source, {});}

/**
 * Records the mount boundary without materializing or coercing its content.
 * @param {!Object} host Test double exposing a renderedContent capture property.
 * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Content supplied by the controller.
 */
export function captureContent(host, value) {host.renderedContent = value;}

/**
 * Records appended content in the same order as the production mount port.
 * @param {!Object} host Test double exposing a renderedContent capture property.
 * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Additional content supplied by the controller.
 */
export function captureAppend(host, value) {host.renderedContent = composeMarkup(host.renderedContent, value);}
