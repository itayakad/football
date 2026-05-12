// Dark matte palette — Sleeper / modern sportsbook aesthetic.
// Layered dark grays for depth; one accent for actions, two semantic colors.

export const colors = {
  // Backgrounds (low → high elevation)
  bg: {
    base:     '#0B0C0E',  // app background
    elevated: '#15171A',  // card surface
    surface:  '#1E2126',  // pressed states / inner cards
    overlay:  'rgba(0,0,0,0.6)',
  },

  // Text
  text: {
    primary:   '#F5F5F7',
    secondary: '#9CA0A6',
    muted:     '#5C6068',
    inverse:   '#0B0C0E',
  },

  // Accent + semantic
  // 2026-05-08: deepened from #4A8DFF — was pulling more attention than content.
  accent: {
    primary: '#3D6FD9',  // deeper, slightly desaturated — feels premium, not loud
    pressed: '#2F5BBA',
  },
  success: '#2ECC71',
  danger:  '#FF4D5C',
  warn:    '#F39C12',

  // Style-identity tags (offense / defense / tempo)
  identity: {
    pass:   '#5BA8FF',
    run:    '#E68E3C',
    bal:    '#9CA0A6',
    agg:    '#FF6B6B',
    prv:    '#3FBC8C',
    fast:   '#E0B048',
    slow:   '#7E84A0',
  },

  // Lines + dividers (rarely used — prefer background contrast)
  divider: 'rgba(255,255,255,0.06)',
  border:  'rgba(255,255,255,0.08)',
};
