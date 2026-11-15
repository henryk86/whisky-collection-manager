/** Language-independent eight-axis whisky flavour profile. Positions are fixed clockwise. */
export const FLAVOR_AXES = Object.freeze(['woody','cereal','peaty','fruity','floral','winey','feinty','sulphury']);
export function normalizeFlavorProfile(value) {
    if (value === null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== FLAVOR_AXES.length ||
        Object.keys(value).some(key => !FLAVOR_AXES.includes(key))) {
        throw new Error('Geschmacksprofil muss genau acht Achsen enthalten');
    }
    const result = {};
    for (const axis of FLAVOR_AXES) {
        const score = value[axis];
        if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 10)
            throw new Error('Geschmacksprofil: Werte müssen ganze Zahlen von 0 bis 10 sein');
        result[axis] = score;
    }
    return result;
}
