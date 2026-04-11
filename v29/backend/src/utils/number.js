export function normalizeHours(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return value;

  const text = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [h, m] = text.split(':').map(Number);
    return h + m / 60;
  }

  const num = Number(text.replace(/,/g, ''));
  return Number.isFinite(num) ? num : 0;
}

export function roundHours(value) {
  return Math.round(value * 100) / 100;
}
