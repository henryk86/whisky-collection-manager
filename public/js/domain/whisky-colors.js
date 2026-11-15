/** Immutable, theme-independent twelve-step whisky colour reference scale. */
export const WHISKY_COLORS = Object.freeze([
    {key:'new_make',hex:'#f9f6de'}, {key:'white_wine',hex:'#f6efb6'},
    {key:'butter',hex:'#f3e579'}, {key:'straw',hex:'#efd04b'},
    {key:'honey',hex:'#e8b12b'}, {key:'gold',hex:'#e49a1b'},
    {key:'amber',hex:'#d17b20'}, {key:'reddish_brown',hex:'#b65c2a'},
    {key:'rust',hex:'#ad4628'}, {key:'copper',hex:'#922c2a'},
    {key:'brandy',hex:'#824044'}, {key:'chocolate',hex:'#50392d'},
]);
export function normalizeWhiskyColor(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !WHISKY_COLORS.some(color => color.key === value))
        throw new Error('Ungültige Whiskyfarbe');
    return value;
}
