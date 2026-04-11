export function normalizeExcelDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = value * 24 * 60 * 60 * 1000;
    return new Date(excelEpoch.getTime() + ms).toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`).toISOString().slice(0, 10);
  }

  return null;
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
