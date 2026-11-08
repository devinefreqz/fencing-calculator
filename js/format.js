/** Display helpers. Amounts are integer cents. Lengths follow the v12 calculator. */

export function formatMm(mm) {
  const rounded = Math.round(mm);
  const sign = rounded < 0 ? "\u2212" : "";
  return sign + Math.abs(rounded).toLocaleString("en-AU") + " mm";
}

export function formatM(metres, places) {
  const n = places == null ? 3 : places;
  return (
    Number(metres)
      .toFixed(n)
      .replace(/\.?0+$/, "") + " m"
  );
}

export function formatMmAndMaybeM(mm, alsoMetres) {
  const rounded = Math.round(mm);
  if (alsoMetres) return formatM(rounded / 1000) + "  \u00b7  " + formatMm(rounded);
  return formatMm(rounded);
}

/** Nearest cent, half-cents away from zero via Math.round (positive halves round up). */
export function formatAud(cents) {
  if (!Number.isFinite(cents)) return "\u2014";
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return (neg ? "\u2212" : "") + "$" + dollars.toLocaleString("en-AU") + "." + String(rem).padStart(2, "0");
}

export function formatQty(n) {
  if (!Number.isFinite(n)) return "\u2014";
  if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n).toLocaleString("en-AU");
  return Number(n)
    .toFixed(2)
    .replace(/\.?0+$/, "");
}

export function formatPercent(n) {
  return (
    Number(n)
      .toFixed(2)
      .replace(/\.?0+$/, "") + "%"
  );
}

export function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function todayISO(date) {
  const d = date instanceof Date ? date : new Date();
  const z = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
}

export function formatDisplayDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return iso || "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
