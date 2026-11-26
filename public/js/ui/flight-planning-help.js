import {composeMarkup} from './render-plan.js';
import {actionButton} from './buttons.js';
import {headingTitle} from './headers.js';
import {CASK_GROUPS} from '../domain/flight-casks.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('tastings/flight-planning-help.html');


/**
 * The formulas below mirror public/js/domain/flight-planner.js. Keep both in
 * sync.
 */
const FORMULAS = Object.freeze({
  distance: 'dG(A,B) = mean(abs(pA(k) - pB(k))) / 10 (at least 2 shared axes)',
  cask: 'dGroup = 1 - sum(min(wA(g), wB(g))) / sum(max(wA(g), wB(g)))\n' +
    'detail = (1-dGroup)*0.25*mean(known shared dimension distances)\n' +
    'dF = dGroup + (detail or 0)\n' +
    'K = sum_g(min(1, sum_i(w_i(g)/max(1, sum_h(w_i(h))))))',
  age: 'dA = min(abs(ageA-ageB)/15, 1) (only if both ages are known)',
  combined:
    'wG=0.65, wF=0.25, wA=0.10\nDsigned = 10 * sum(wi * direction(i) * di) / sum(wi for known dimensions)\ndirection(i): Similar=-1, Contrast=+1; explicit preferences override F/A',
  preferences: 'Pref = 9*matchingCaskGroup + 4*matchingCaskDetails + ' + '3*agesInPreferredRange\n' +
    '(group and detail matches require the selected phase)\n' +
    '(phase only: +9 for matching phase; no extra detail bonus)\n' +
    'For Balanced/Discover: +4*sum(dF) if varied, -4*sum(dF) if similar;\n' +
    '+2*sum(dA) if varied, -2*sum(dA) if similar',
  intensity: 'I(A) = (ABV or 40) / 12 + mean(assessed axes) + smoky / 4 + peaty / 4',
  novelty:
    'N(A) = (never tasted ? 30 : 0) + (no profile ? 4 : 0) + (open ? 3 : 0)\n       + min(10, max(0, days since last tasting / 30))',
  unfamiliar: 'U(A) = min(d(A,H)) for H in tasting history; 0 if no comparison exists',
  balanced: 'S = -2*V + 13*G + 4*R + 0.08*sum(N) - P - 1.5*L - 1.5*M\n' +
    '  + (cask auto ? 4*K + 4*J : 0) + (age auto ? 2*Q : 0) + Pref\n' +
    'P = (comparable pairs exist ? 1.2*abs(Davg - 3) : 4)',
  similar:
    'S = -2*V + 8*R + 3.2*sum(Dsigned) - 14*M + F + Pref\nF = (no focus ? 0 : sum(rated focus ? 1.9*focusValue : -12))',
  contrast: 'S = -2*V + 8*R + 2.5*sum(Dsigned) + 3*G - 14*M - 3*max(0, L-3) + Pref',
  discover: 'S = -2*V + sum(N + (prefer unfamiliar ? 2*U : 0)) + 2*G\n' +
    '  + (cask auto ? 5*Knew + 4*Jnew : 0) + (age auto ? 3*Qnew : 0) + Pref',
  transition:
    'delta = I(B) - I(A)\nC(A,B) = 0.35*abs(delta) + 1.8*max(0, delta-3)\n       + 2.8*max(0, -delta) + 0.55*(profileDistance(A,B) or 0)\n       + 0.65*(dF(A,B) or 0) + 0.025*min(abs(ageA-ageB),15) if ages known',
  order: 'C(start) = 2*(I(first) - min(I(all)))\nC(total) = C(start) + sum(C(previous, next)) -> minimize',
});

/**
 * Renders the explanatory content used by the flight planner.
 *
 * @param {*} t Translation function for flight-planning help keys.
 * @return {!import('./render-plan.js').RenderPlan} Flight planning explanations, formulas and strategy descriptions.
 */
export function flightPlanningHelpHtml(t) {
  /**
   * Resolves a translation key in the flight-planning help catalog.
   *
   * @param {*} key Key used to select or group values.
   * @return {string} Literal translation of the requested flight-planning help entry.
   */
  const tx = key => t(`flightPlan.help.${key}`);

  /**
   * Prepares localized help paragraph with an optional CSS class.
   *
   * @param {*} key Key used to select or group values.
   * @param {string=} extraClass Optional CSS class on the help paragraph.
   * @return {!import('./render-plan.js').RenderPlan} Localized help paragraph with an optional CSS class.
   */
  const p = (key, extraClass = '') => renderTemplate('p', {
    classAttributes: extraClass ? {"class": extraClass} : {},
    tx: tx(key),
  });

  /**
   * Prepares formula display for the selected planning strategy.
   *
   * @param {*} key Key used to select or group values.
   * @return {!import('./render-plan.js').RenderPlan} Formula display for the selected planning strategy.
   */
  const formula = key => renderTemplate('flightPlanHelpFormula', {formula: FORMULAS[key], });

  /**
   * Prepares localized help section heading.
   *
   * @param {*} key Key used to select or group values.
   * @return {!import('./render-plan.js').RenderPlan} Localized help section heading.
   */
  const heading = key => headingTitle({title: t(`flightPlan.help.${key}`)});

  /**
   * Prepares definition of the supplied formula symbol.
   *
   * @param {*} symbol Mathematical variable symbol displayed alongside its translated definition.
   * @param {*} key Key used to select or group values.
   * @return {!import('./render-plan.js').RenderPlan} Definition of the supplied formula symbol.
   */
  const variable = (symbol, key) =>
    renderTemplate('flightPlanHelpDefinition', {
      symbol: symbol,
      tx: tx(`vars.${key}`),
    });

  /**
   * Prepares planning strategy explanation, formula and details.
   *
   * @param {*} key Key used to select or group values.
   * @return {!import('./render-plan.js').RenderPlan} Planning strategy explanation, formula and details.
   */
  const strategy = key => renderTemplate('flightPlanHelpStrategy', {
    tx: tx(`${key}.title`),
    p: p(`${key}.text`),
    formula: formula(key),
    strategyDetails: p(`${key}.details`, 'flight-plan-help-caption'),
  });
  return renderTemplate('flightPlanHelp', {
    p: p('intro', 'flight-plan-help-intro'),
    heading: heading('selection'),
    candidatesIntro: p('candidates'),
    profileDataIntro: p('profileData'),
    familiesIntro: p('families'),
    basicsHeading: heading('basics.title'),
    tx: tx('basics.distance'),
    formula: formula('distance'),
    distanceDetails: p('basics.distanceDetails'),
    distanceExample: p('basics.example', 'flight-plan-help-example'),
    intensityLabel: tx('basics.intensity'),
    intensityFormula: formula('intensity'),
    intensityDetails: p('basics.intensityDetails'),
    noveltyLabel: tx('basics.novelty'),
    noveltyFormula: formula('novelty'),
    noveltyDetails: p('basics.noveltyDetails'),
    unfamiliarLabel: tx('basics.unfamiliar'),
    unfamiliarFormula: formula('unfamiliar'),
    unfamiliarDetails: p('basics.unfamiliarDetails'),
    variablesLabel: tx('basics.variables'),
    content: composeMarkup([
      ['S', 'score'], ['V', 'repeats'], ['G', 'families'], ['R', 'profiled'],
      ['M', 'missing'], ['sum(d)', 'distanceSum'], ['Davg', 'distanceMean'],
      ['L', 'gap'], ['N / U', 'other'], ['K / Q / J', 'caskAgeGroups'],
    ].map(([symbol, key]) => variable(symbol, key))),
    caskAgeHeading: heading('caskAge.title'),
    classificationIntro: p('caskAge.classification'),
    groupsLabel: tx('caskAge.groups'),
    caskGroupLabels: CASK_GROUPS.map(group => t(`flightPlan.caskAge.group.${group}`)).join(' · '),
    selectionIntro: p('caskAge.selection'),
    examples: p('caskAge.examples'),
    coverage: p('caskAge.coverage'),
    distanceLabel: tx('caskAge.distance'),
    caskFormula: formula('cask'),
    ageFormula: formula('age'),
    combinedLabel: tx('caskAge.combined'),
    combinedFormula: formula('combined'),
    preferencesLabel: tx('caskAge.preferences'),
    preferencesFormula: formula('preferences'),
    missingDataNote: p('caskAge.missing', 'flight-plan-help-caption'),
    strategiesHeading: heading('strategies.title'),
    strategiesIntro: p('strategies.intro'),
    strategyCards: composeMarkup(['balanced', 'similar', 'contrast', 'discover'].map(strategy)),
    searchHeading: heading('search.title'),
    searchSteps: composeMarkup(['shortlist', 'seeds',
      'improve'].map(key => renderTemplate('li', {tx: tx(`search.${key}`), }))),
    sequenceHeading: heading('sequence'),
    sequenceIntro: p('sequenceIntro'),
    transitionFormula: formula('transition'),
    orderFormula: formula('order'),
    sequenceDetails: p('sequenceDetails'),
    limitsHeading: heading('limits.title'),
    limitsIntro: p('limits'),
    limitationsDetails: p('limitationsDetails'),
    closeModalButton: actionButton({
      label: t('common.actions.close'),
      action: 'close-modal',
      variant: 'primary',
    }),
  });
}
