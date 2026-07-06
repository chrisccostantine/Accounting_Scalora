export function monthRange(year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}
