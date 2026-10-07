/**
 * Fencing Calculator — Colourbond step-downs, post spacing & materials
 */

(function () {
  "use strict";

  /* ── Shared helpers ── */
  function parseNumber(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (s === "" || s === "-" || s === ".") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function roundMm(x) {
    return Math.round(x);
  }

  function formatMm(mm) {
    return roundMm(mm).toLocaleString("en-AU") + " mm";
  }

  function formatM(mm) {
    const m = mm / 1000;
    const s = m.toFixed(3).replace(/\.?0+$/, "");
    return s + " m";
  }

  function formatMetres(m, decimals) {
    const d = decimals == null ? 3 : decimals;
    const s = Number(m).toFixed(d).replace(/\.?0+$/, "");
    return s + " m";
  }

  function escapeHtml(s) {
    // Use \u0026 so entity strings survive HTML-entity decoding in some upload paths
    return String(s)
      .replace(/&/g, "\u0026amp;")
      .replace(/</g, "\u0026lt;")
      .replace(/>/g, "\u0026gt;")
      .replace(/"/g, "\u0026quot;");
  }

  function setSvgContent(svgEl, markup) {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    const doc = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg">' + markup + "</svg>",
      "image/svg+xml"
    );
    const root = doc.documentElement;
    if (!root || root.querySelector("parsererror")) return;
    const owner = svgEl.ownerDocument;
    Array.prototype.forEach.call(root.childNodes, function (node) {
      svgEl.appendChild(owner.importNode(node, true));
    });
  }

  /* REST OF FILE LOADED FROM DISK - SEE FOLLOW-UP */
  console.error("INCOMPLETE_PUSH");
})();
