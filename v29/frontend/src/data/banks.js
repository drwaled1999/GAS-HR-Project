export const saudiBanks = [
  'Saudi National Bank (SNB)',
  'Al Rajhi Bank',
  'Riyad Bank',
  'Saudi Awwal Bank (SAB)',
  'Arab National Bank',
  'Alinma Bank',
  'Banque Saudi Fransi',
  'Saudi Investment Bank',
  'Bank AlJazira',
  'Bank AlBilad',
  'Gulf International Bank (GIB)'
];

export function formatSaudiIban(value = '') {
  return value
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

export function normalizeSaudiIban(value = '') {
  return value.replace(/\s+/g, '').toUpperCase();
}
