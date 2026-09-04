// Mêmes tokens que apps/web/src/index.css et apps/admin — cohérence de
// marque entre les trois plateformes. React Native n'a pas Tailwind, donc
// ces valeurs sont dupliquées ici plutôt que partagées via un package CSS.
export const colors = {
  navy50: '#eef2f9',
  navy100: '#d7e0ef',
  navy500: '#2c4870',
  navy600: '#1e3a5f',
  navy700: '#14213d',
  navy900: '#0b1729',

  gold400: '#f2c94c',
  gold500: '#e0ac1f',
  gold600: '#b8860b',

  ink50: '#f7f8fa',
  ink100: '#e7eaf0',
  ink400: '#6b7686',
  ink600: '#3f4b5e',
  ink800: '#202a3b',
  ink900: '#0f1622',

  white: '#ffffff',
  red50: '#fef2f2',
  red700: '#b91c1c',
} as const
