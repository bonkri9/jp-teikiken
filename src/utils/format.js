export function formatKm(km) {
  const rounded = Math.round(km * 100) / 100;
  return Number(rounded.toString());
}
