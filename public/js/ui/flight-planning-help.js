import {headingTitle} from './headers.js';
import {escapeHtml} from './dom.js';

/** The formulas below mirror public/js/domain/flight-planner.js. Keep both in sync. */
const FORMULAS = Object.freeze({
  distance: 'dG(A,B) = mean(abs(pA(k) - pB(k))) / 10 (at least 2 shared axes)',
  cask: 'dF = 1 - sum(min(weightA(g),weightB(g))) / sum(max(weightA(g),weightB(g)))\nif both are Sherry with known subtypes: dF = 0.75*groupDistance + 0.25*subtypeDistance',
  age: 'dA = min(abs(ageA-ageB)/15, 1) (only if both ages are known)',
  combined: 'wG=0.65, wF=0.25, wA=0.10\nDsigned = 10 * sum(wi * direction(i) * di) / sum(wi for known dimensions)\ndirection(i): Similar=-1, Contrast=+1; explicit preferences override F/A',
  preferences: 'Pref = 9*matchingCaskGroup + 4*matchingSherrySubtype + 3*agesInPreferredRange\nFor Balanced/Discover: +4*sum(dF) if varied, -4*sum(dF) if similar;\n+2*sum(dA) if varied, -2*sum(dA) if similar',
  intensity: 'I(A) = (ABV or 40) / 12 + mean(assessed axes) + smoky / 4 + peaty / 4',
  novelty: 'N(A) = (never tasted ? 30 : 0) + (no profile ? 4 : 0) + (open ? 3 : 0)\n       + min(10, max(0, days since last tasting / 30))',
  unfamiliar: 'U(A) = min(d(A,H)) for H in tasting history; 0 if no comparison exists',
  balanced: 'S = -2*V + 13*G + 4*R + 0.08*sum(N) - P - 1.5*L - 1.5*M\n  + (cask auto ? 4*K : 0) + (age auto ? 2*Q : 0) + Pref\nP = (comparable pairs exist ? 1.2*abs(Davg - 3) : 4)',
  similar: 'S = -2*V + 8*R + 3.2*sum(Dsigned) - 14*M + F + Pref\nF = (no focus ? 0 : sum(rated focus ? 1.9*focusValue : -12))',
  contrast: 'S = -2*V + 8*R + 2.5*sum(Dsigned) + 3*G - 14*M - 3*max(0, L-3) + Pref',
  discover: 'S = -2*V + sum(N + (prefer unfamiliar ? 2*U : 0)) + 2*G\n  + (cask auto ? 5*Knew : 0) + (age auto ? 3*Qnew : 0) + Pref',
  transition: 'delta = I(B) - I(A)\nC(A,B) = 0.35*abs(delta) + 1.8*max(0, delta-3)\n       + 2.8*max(0, -delta) + 0.55*(profileDistance(A,B) or 0)\n       + 0.65*(dF(A,B) or 0) + 0.025*min(abs(ageA-ageB),15) if ages known',
  order: 'C(start) = 2*(I(first) - min(I(all)))\nC(total) = C(start) + sum(C(previous, next)) -> minimize'
});

export function flightPlanningHelpHtml(t) {
  const tx = key => escapeHtml(t(`flightPlan.help.${key}`));
  const p = (key, extraClass = '') => `<p${extraClass ? ` class="${extraClass}"` : ''}>${tx(key)}</p>`;
  const formula = key => `<pre class="flight-plan-help-formula"><code>${escapeHtml(FORMULAS[key])}</code></pre>`;
  const heading = key => headingTitle({title: t(`flightPlan.help.${key}`)});
  const variable = (symbol, key) => `<div class="flight-plan-help-definition"><dt>${escapeHtml(symbol)}</dt><dd>${tx(`vars.${key}`)}</dd></div>`;
  const strategy = key => `<section class="flight-plan-help-strategy">
        <h4>${tx(`${key}.title`)}</h4>
        ${p(`${key}.text`)}${formula(key)}${p(`${key}.details`, 'flight-plan-help-caption')}
    </section>`;
  return `<div class="flight-plan-help">
        ${p('intro', 'flight-plan-help-intro')}
        <section class="flight-plan-help-section">
            ${heading('selection')}
            ${p('candidates')}${p('profileData')}${p('families')}
        </section>
        <section class="flight-plan-help-section">
            ${heading('basics.title')}
            <h4>${tx('basics.distance')}</h4>${formula('distance')}${p('basics.distanceDetails')}${p('basics.example', 'flight-plan-help-example')}
            <h4>${tx('basics.intensity')}</h4>${formula('intensity')}${p('basics.intensityDetails')}
            <h4>${tx('basics.novelty')}</h4>${formula('novelty')}${p('basics.noveltyDetails')}
            <h4>${tx('basics.unfamiliar')}</h4>${formula('unfamiliar')}${p('basics.unfamiliarDetails')}
            <h4>${tx('basics.variables')}</h4>
            <dl class="flight-plan-help-definitions">${[
      ['S', 'score'], ['V', 'repeats'], ['G', 'families'], ['R', 'profiled'],
      ['M', 'missing'], ['sum(d)', 'distanceSum'], ['Davg', 'distanceMean'],
      ['L', 'gap'], ['N / U', 'other'], ['K / Q', 'caskAgeGroups']
    ].map(([symbol, key]) => variable(symbol, key)).join('')}</dl>
        </section>
        <section class="flight-plan-help-section">
            ${heading('caskAge.title')}
            ${p('caskAge.classification')}
            <h4>${tx('caskAge.distance')}</h4>${formula('cask')}${formula('age')}
            <h4>${tx('caskAge.combined')}</h4>${formula('combined')}
            <h4>${tx('caskAge.preferences')}</h4>${formula('preferences')}
            ${p('caskAge.missing', 'flight-plan-help-caption')}
        </section>
        <section class="flight-plan-help-section">
            ${heading('strategies.title')}
            ${p('strategies.intro')}
            ${['balanced', 'similar', 'contrast', 'discover'].map(strategy).join('')}
        </section>
        <section class="flight-plan-help-section">
            ${heading('search.title')}
            <ol class="flight-plan-help-steps">${['shortlist', 'seeds', 'improve'].map(key => `<li>${tx(`search.${key}`)}</li>`).join('')}</ol>
        </section>
        <section class="flight-plan-help-section">
            ${heading('sequence')}${p('sequenceIntro')}${formula('transition')}${formula('order')}${p('sequenceDetails')}
        </section>
        <section class="flight-plan-help-section">
            ${heading('limits.title')}${p('limits')}${p('limitationsDetails')}
        </section>
        <div class="actions"><button type="button" class="btn primary" data-act="close-modal">${escapeHtml(t('common.actions.close'))}</button></div>
    </div>`;
}
