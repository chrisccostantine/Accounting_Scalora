export const money = (value: number | string | undefined, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value ?? 0));

export const labelize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export const isoDate = (value?: string) => (value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10));
