/** ChiedzaAI light/clarity tokens. Import `theme.extend` into tailwind.config.js. */
module.exports = {
  colors: {
    ink: '#142033', paper: '#FFFDF7', dawn: '#FFF3D6', glow: '#F4B942',
    education: '#6B4FA1', educationSoft: '#EDE7F6',
    risk: { low: '#176B5B', lowSoft: '#D8F3EC', moderate: '#9A5A00', moderateSoft: '#FFF0C2', high: '#A8411E', highSoft: '#FFE2D7', critical: '#6E285D', criticalSoft: '#F6DDF0' },
    surface: { DEFAULT: '#FFFDF7', raised: '#FFFFFF', muted: '#F3F0EA', inverse: '#142033' }
  },
  spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px' },
  borderRadius: { sm: '8px', md: '12px', lg: '18px', xl: '24px', pill: '9999px' },
  fontFamily: { sans: ['System'] },
  fontWeight: { regular: '400', medium: '500', bold: '700' },
  fontSize: { display: ['36px', { lineHeight: '42px', fontWeight: '700' }], heading: ['24px', { lineHeight: '30px', fontWeight: '700' }], body: ['16px', { lineHeight: '24px', fontWeight: '400' }], caption: ['13px', { lineHeight: '18px', fontWeight: '400' }], 'chip-label': ['12px', { lineHeight: '16px', fontWeight: '700' }] }
};
