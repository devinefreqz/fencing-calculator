/**
 * SVG diagrams for step-downs, post spacing, and timber lap-and-cap.
 * Markup is built from numbers only. Text is escaped. No user strings.
 */
import { formatM, formatMm, xmlEscape } from "./format.js";

const FONT = ' font-family="system-ui,sans-serif"';

function num(n) {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

export function stepDownDiagram({ posts, roundedStepMm, fallMm, timberWidthMm, equal }) {
  const width = 400;
  const height = 180;
  const span = 344;
  const ground0 = 14 + 132 * 0.78;
  const slope = 21.12;
  const scale = Math.max(48, ground0 - 14 - 4) / 1950;
  const panelH = 1800 * scale;
  const plinthH = Math.max(5, 150 * scale);
  const fallScale = Math.max(fallMm, 1);
  const visual = 21.12;
  const xs = [];
  for (let i = 0; i < posts; i++) xs.push(28 + (posts === 1 ? 172 : (i / (posts - 1)) * span));

  function groundY(i) {
    return posts === 1 ? ground0 : ground0 + (i / (posts - 1)) * slope;
  }
  function panelTop(i) {
    const drop = ((i * roundedStepMm) / fallScale) * visual;
    const highTop = groundY(0) - plinthH - panelH;
    return highTop + (fallMm > 0 ? drop : 0);
  }
  function panelBottom(i) {
    return panelTop(i) + panelH;
  }
  function groundMid(i) {
    return (groundY(i) + groundY(i + 1)) / 2;
  }

  const timberOn = timberWidthMm != null && timberWidthMm > 0;
  const bayPx = posts > 1 ? span / (posts - 1) : span;
  const timberW = timberOn ? Math.min(0.45 * bayPx, Math.max(4, timberWidthMm * scale)) : 0;
  const halfT = timberW / 2;
  const parts = [];
  const wood = "#b8956a";

  const groundPts = xs.map((x, i) => x + " " + num(groundY(i)));
  const soilBack = xs
    .map((x, i) => x + " " + num(Math.min(162, groundY(i) + 12)))
    .reverse()
    .join(" L ");
  parts.push(
    '<path d="M 20 ' +
      num(Math.min(162, groundY(0) + 12)) +
      " L 20 " +
      num(groundY(0)) +
      " L " +
      groundPts.join(" L ") +
      " L 380 " +
      num(groundY(posts - 1)) +
      " L 380 " +
      num(Math.min(162, groundY(posts - 1) + 12)) +
      " L " +
      soilBack +
      ' Z" fill="#c4b59a" opacity="0.55"/>',
  );
  parts.push(
    '<polyline fill="none" stroke="#8b7355" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="' +
      xs.map((x, i) => num(x) + "," + num(groundY(i))).join(" ") +
      '"/>',
  );

  for (let i = 0; i < posts - 1; i++) {
    const x1 = xs[i] + halfT;
    const x2 = xs[i + 1] - halfT;
    const y = panelBottom(i);
    const mid = groundMid(i);
    const h = Math.max(0.85 * plinthH, mid - y);
    const w = Math.max(2, x2 - x1);
    parts.push(
      '<rect x="' +
        num(x1) +
        '" y="' +
        num(y) +
        '" width="' +
        num(w) +
        '" height="' +
        num(h) +
        '" fill="#c4a574" stroke="#8a6a3d" stroke-width="0.75" rx="1"/>',
    );
    parts.push(
      '<line x1="' +
        num(x1 + 2) +
        '" y1="' +
        num(y + 0.35 * h) +
        '" x2="' +
        num(x2 - 2) +
        '" y2="' +
        num(y + 0.35 * h) +
        '" stroke="' +
        wood +
        '" stroke-width="0.8" opacity="0.7"/>',
    );
    parts.push(
      '<line x1="' +
        num(x1 + 2) +
        '" y1="' +
        num(y + 0.7 * h) +
        '" x2="' +
        num(x2 - 2) +
        '" y2="' +
        num(y + 0.7 * h) +
        '" stroke="' +
        wood +
        '" stroke-width="0.8" opacity="0.55"/>',
    );
  }

  for (let i = 0; i < posts - 1; i++) {
    const x1 = xs[i] + halfT;
    const x2 = xs[i + 1] - halfT;
    const y = panelTop(i);
    const bot = panelBottom(i);
    const w = Math.max(2, x2 - x1);
    parts.push(
      '<rect x="' +
        num(x1) +
        '" y="' +
        num(y) +
        '" width="' +
        num(w) +
        '" height="' +
        num(Math.max(2, bot - y)) +
        '" fill="#2d6348" opacity="0.88" rx="1"/>',
    );
    parts.push(
      '<line x1="' + num(x1) + '" y1="' + num(y) + '" x2="' + num(x2) + '" y2="' + num(y) + '" stroke="#1a3a2a" stroke-width="2.5"/>',
    );
    parts.push(
      '<line x1="' + num(x1) + '" y1="' + num(bot) + '" x2="' + num(x2) + '" y2="' + num(bot) + '" stroke="#1a3a2a" stroke-width="2"/>',
    );
  }

  let tops = null;
  if (equal) {
    const pxPerMm = visual / fallScale;
    const groundStepPx = posts > 1 ? equal.groundStepMm * pxPerMm : 0;
    const mainPx = equal.mainClearMm * pxPerMm;
    const limit = 16;
    let offset;
    if (mainPx >= 0) offset = limit * Math.tanh(mainPx / limit);
    else if (-mainPx <= groundStepPx) offset = mainPx;
    else offset = -groundStepPx - limit * Math.tanh((-mainPx - groundStepPx) / limit);
    const high = posts > 1 ? groundStepPx + offset : offset;
    tops = [];
    for (let i = 0; i < posts; i++) tops.push(panelTop(0) - high + i * groundStepPx);
  }

  function postTopY(i) {
    if (tops) return tops[i];
    return panelTop(i) - (i === 0 || i === posts - 1 ? 5 : 2);
  }
  function capFill(i) {
    return equal && equal.flags[i] ? "#dc2626" : "#0f2419";
  }

  for (let i = 0; timberOn && i < posts; i++) {
    const x = xs[i];
    const y1 = postTopY(i);
    const y2 = groundY(i) + 5;
    const lowerPanel = Math.max(i > 0 ? panelBottom(i - 1) : -Infinity, i < posts - 1 ? panelBottom(i) : -Infinity);
    const steel = Math.max(1.6, Math.min(0.4 * timberW, 50 * scale));
    parts.push(
      '<rect x="' +
        num(x - halfT) +
        '" y="' +
        num(y1) +
        '" width="' +
        num(timberW) +
        '" height="' +
        num(y2 - y1) +
        '" fill="#a87d4f" stroke="#6b4a26" stroke-width="0.8"/>',
    );
    parts.push(
      '<line x1="' +
        num(x - 0.45 * halfT) +
        '" y1="' +
        num(y1 + 3) +
        '" x2="' +
        num(x - 0.45 * halfT) +
        '" y2="' +
        num(y2 - 2) +
        '" stroke="' +
        wood +
        '" stroke-width="0.6" opacity="0.6"/>',
    );
    parts.push(
      '<rect x="' +
        num(x - steel / 2) +
        '" y="' +
        num(y1 + 1) +
        '" width="' +
        num(steel) +
        '" height="' +
        num(Math.max(2, lowerPanel - y1 - 1)) +
        '" fill="#0f2419" opacity="0.9"/>',
    );
    parts.push(
      '<rect x="' +
        num(x - halfT - 1) +
        '" y="' +
        num(y1 - 2.5) +
        '" width="' +
        num(timberW + 2) +
        '" height="3" rx="1" fill="' +
        capFill(i) +
        '"/>',
    );
  }

  for (let i = 0; !timberOn && i < posts; i++) {
    const x = xs[i];
    const y1 = postTopY(i);
    const y2 = groundY(i) + 3;
    parts.push(
      '<line x1="' +
        num(x) +
        '" y1="' +
        num(y1) +
        '" x2="' +
        num(x) +
        '" y2="' +
        num(y2) +
        '" stroke="#0f2419" stroke-width="3.5" stroke-linecap="round"/>',
    );
    parts.push('<circle cx="' + num(x) + '" cy="' + num(y1) + '" r="3" fill="' + capFill(i) + '"/>');
  }

  if (tops && posts > 1) {
    const pad = 10;
    const slopePx = (tops[posts - 1] - tops[0]) / (xs[posts - 1] - xs[0]);
    parts.push(
      '<line x1="' +
        num(xs[0] - pad) +
        '" y1="' +
        num(tops[0] - 3 - slopePx * pad) +
        '" x2="' +
        num(xs[posts - 1] + pad) +
        '" y2="' +
        num(tops[posts - 1] - 3 + slopePx * pad) +
        '" stroke="#64748b" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>',
    );
  }

  if (posts > 1) {
    const x = (xs[0] + xs[1]) / 2;
    const h = Math.max(0.85 * plinthH, groundMid(0) - panelBottom(0));
    const y = panelBottom(0) + h / 2;
    parts.push(
      '<text x="' +
        num(x) +
        '" y="' +
        num(y) +
        '" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="650" fill="#5c4318"' +
        FONT +
        ">150 plinth</text>",
    );
  }

  const labelY = Math.min(172, 14 + 124.08 + 12 + 14);
  parts.push(
    '<text x="' +
      num(xs[0]) +
      '" y="' +
      num(labelY) +
      '" text-anchor="middle" font-size="10" font-weight="700" fill="#334155"' +
      FONT +
      ">High</text>",
  );
  if (posts > 1) {
    parts.push(
      '<text x="' +
        num(xs[posts - 1]) +
        '" y="' +
        num(labelY) +
        '" text-anchor="middle" font-size="10" font-weight="700" fill="#334155"' +
        FONT +
        ">Low</text>",
    );
  }
  if (fallMm > 0 && posts > 1) {
    const x = 386;
    const y1 = panelTop(0);
    const y2 = panelTop(posts - 1);
    parts.push(
      '<line x1="' +
        x +
        '" y1="' +
        num(y1) +
        '" x2="' +
        x +
        '" y2="' +
        num(y2) +
        '" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3 2"/>',
    );
    parts.push(
      '<text x="' +
        (x - 6) +
        '" y="' +
        num((y1 + y2) / 2) +
        '" text-anchor="end" dominant-baseline="middle" font-size="9" fill="#64748b"' +
        FONT +
        ">fall</text>",
    );
  }

  let shift = 0;
  if (tops) {
    const top = Math.min(...tops) - 6;
    if (top < 0) shift = Math.floor(top);
  }
  const timberText = timberOn ? formatMm(timberWidthMm) + " timber posts + Colourbond posts" : "plumb posts";
  let caption =
    "Stepped panels (level) · 150 mm timber plinth · " +
    timberText +
    " · ground falls high to low";
  if (equal) {
    caption =
      "Stepped panels (level) · 150 mm timber plinth · " +
      timberText +
      " · every post " +
      formatMm(equal.heightMm) +
      " above its ground (tops follow the fall) · ground falls high to low";
  }
  return { id: "step", viewBox: "0 " + shift + " " + width + " " + (height - shift), body: parts.join(""), caption };
}

export function spacingDiagram({ posts, lengthM, centresM, timber }) {
  const xs = [];
  for (let i = 0; i < posts; i++) xs.push(24 + (posts === 1 ? 176 : (i / (posts - 1)) * 352));
  const parts = ['<line x1="24" y1="52" x2="376" y2="52" stroke="#cbd5e1" stroke-width="2"/>'];
  for (let i = 0; i < posts; i++) {
    const x = xs[i];
    if (timber) {
      parts.push(
        '<rect x="' + num(x - 4) + '" y="30" width="8" height="32" rx="1.5" fill="#8b6914" stroke="#5c4510" stroke-width="1"/>',
      );
      parts.push(
        '<line x1="' + num(x + 2) + '" y1="32" x2="' + num(x + 2) + '" y2="60" stroke="#0f2419" stroke-width="2" stroke-linecap="round"/>',
      );
    } else {
      parts.push(
        '<line x1="' + num(x) + '" y1="30" x2="' + num(x) + '" y2="62" stroke="#0f2419" stroke-width="3" stroke-linecap="round"/>',
      );
      parts.push('<circle cx="' + num(x) + '" cy="30" r="3" fill="#0f2419"/>');
    }
    if (posts <= 12 || i === 0 || i === posts - 1 || i % Math.ceil(posts / 8) === 0) {
      parts.push(
        '<text x="' +
          num(x) +
          '" y="90" text-anchor="middle" font-size="9" font-weight="700" fill="#334155"' +
          FONT +
          ">P" +
          (i + 1) +
          "</text>",
      );
    }
  }
  if (posts >= 2) {
    const mid = (xs[0] + xs[1]) / 2;
    parts.push(
      '<text x="' +
        num(mid) +
        '" y="24" text-anchor="middle" font-size="10" font-weight="650" fill="#2d6348"' +
        FONT +
        ">" +
        xmlEscape(formatM(centresM, 3)) +
        "</text>",
    );
    parts.push(
      '<line x1="' + num(xs[0]) + '" y1="32" x2="' + num(xs[1]) + '" y2="32" stroke="#2d6348" stroke-width="1.5"/>',
    );
  }
  const bays = posts - 1;
  const caption =
    posts +
    " posts · " +
    bays +
    " equal bay" +
    (bays === 1 ? "" : "s") +
    " · " +
    formatM(lengthM, 3) +
    " run" +
    (timber ? " · timber + Colourbond" : "");
  return { id: "spacing", viewBox: "0 0 400 100", body: parts.join(""), caption };
}

export function timberDiagram(input, result, uid) {
  const clip = "tf-" + String(uid || "run").replace(/[^A-Za-z0-9_-]/g, "");
  const width = 400;
  const parts = [];
  const back = "#a8865a";
  const front = "#c4a574";
  const edge = "#8a6a3d";
  const shownBays = Math.min(2, result.bays);
  const shownMm = 1000 * result.centresM * shownBays;
  const scale = Math.min(368 / shownMm, 118 / input.heightMm);
  const drawnW = shownMm * scale;
  const x0 = (width - drawnW) / 2;
  const ground = 42 + input.heightMm * scale;
  const top = ground - input.heightMm * scale;
  parts.push(
    '<text x="16" y="13" font-size="10" font-weight="700" fill="#334155"' +
      FONT +
      ">Elevation · " +
      shownBays +
      " bay" +
      (shownBays === 1 ? "" : "s") +
      " (paling side)</text>",
  );
  parts.push(
    '<rect x="0" y="' +
      num(ground) +
      '" width="' +
      width +
      '" height="6" fill="#d6c7a8"/><line x1="0" y1="' +
      num(ground) +
      '" x2="' +
      width +
      '" y2="' +
      num(ground) +
      '" stroke="#7c6a4a" stroke-width="1.2"/>',
  );
  parts.push(
    '<defs><clipPath id="' +
      clip +
      '"><rect x="' +
      num(x0) +
      '" y="0" width="' +
      num(drawnW) +
      '" height="' +
      num(ground + 1) +
      '"/></clipPath></defs>',
  );
  const boardW = input.widthMm * scale;
  const step = result.advance * scale;
  const count = Math.ceil(drawnW / step) + 1;
  const backs = [];
  const fronts = [];
  for (let i = 0; i < count; i++) {
    const rect =
      '<rect x="' +
      num(x0 + i * step) +
      '" y="' +
      num(top) +
      '" width="' +
      num(boardW) +
      '" height="' +
      num(input.heightMm * scale) +
      '" fill="' +
      (i % 2 === 0 ? back : front) +
      '" stroke="' +
      edge +
      '" stroke-width="0.6"/>';
    if (i % 2 === 0) backs.push(rect);
    else fronts.push(rect);
  }
  parts.push('<g clip-path="url(#' + clip + ')">' + backs.join("") + fronts.join("") + "</g>");
  if (input.plinth) {
    const ph = Math.max(6, 150 * scale);
    parts.push(
      '<rect x="' +
        num(x0) +
        '" y="' +
        num(ground - ph) +
        '" width="' +
        num(drawnW) +
        '" height="' +
        num(ph) +
        '" fill="' +
        edge +
        '" stroke="#5c4510" stroke-width="0.8"/>',
    );
  }
  const rails = [];
  for (let i = 0; i < input.rails; i++) {
    const t = input.rails === 1 ? 0.5 : 0.12 + (0.76 * i) / (input.rails - 1);
    rails.push(top + t * input.heightMm * scale);
  }
  for (const y of rails) {
    parts.push(
      '<line x1="' +
        num(x0) +
        '" y1="' +
        num(y) +
        '" x2="' +
        num(x0 + drawnW) +
        '" y2="' +
        num(y) +
        '" stroke="#3f2d14" stroke-width="1.6" stroke-dasharray="5 3" opacity="0.85"/>',
    );
  }
  const postW = Math.max(4, input.postMm * scale);
  for (let i = 0; i <= shownBays; i++) {
    const x = x0 + i * result.centresM * 1000 * scale;
    parts.push(
      '<rect x="' +
        num(x - postW / 2) +
        '" y="' +
        num(top - 4) +
        '" width="' +
        num(postW) +
        '" height="' +
        num(ground - top + 4) +
        '" fill="none" stroke="#3f2d14" stroke-width="1.4" stroke-dasharray="4 2"/>',
    );
  }
  if (shownBays >= 1) {
    const x1 = x0;
    const x2 = x0 + 1000 * result.centresM * scale;
    parts.push(
      '<line x1="' +
        num(x1) +
        '" y1="33" x2="' +
        num(x2) +
        '" y2="33" stroke="#2d6348" stroke-width="1.2"/><text x="' +
        num((x1 + x2) / 2) +
        '" y="30" text-anchor="middle" font-size="9" font-weight="700" fill="#2d6348"' +
        FONT +
        ">" +
        xmlEscape(formatM(result.centresM, 3)) +
        " centres</text>",
    );
  }

  const planTitle = ground + 30;
  parts.push(
    '<text x="16" y="' +
      num(planTitle - 8) +
      '" font-size="10" font-weight="700" fill="#334155"' +
      FONT +
      ">Plan (top view) · lap and cap</text>",
  );
  const planMm = input.widthMm + 4 * result.advance;
  const planScale = Math.min(348 / planMm, 0.9);
  const planX = (width - planMm * planScale) / 2;
  const railY = planTitle + 2;
  const backY = railY + 8;
  const frontY = backY + 9;
  parts.push(
    '<rect x="' +
      num(planX - 8) +
      '" y="' +
      num(railY) +
      '" width="' +
      num(planMm * planScale + 16) +
      '" height="8" fill="none" stroke="#3f2d14" stroke-width="1" stroke-dasharray="4 2"/><text x="' +
      num(planX - 10) +
      '" y="' +
      num(railY + 7) +
      '" text-anchor="end" font-size="8" fill="#334155"' +
      FONT +
      ">rail</text>",
  );
  for (let i = 0; i < 5; i++) {
    const x = planX + i * result.advance * planScale;
    const isBack = i % 2 === 0;
    parts.push(
      '<rect x="' +
        num(x) +
        '" y="' +
        num(isBack ? backY : frontY) +
        '" width="' +
        num(input.widthMm * planScale) +
        '" height="9" fill="' +
        (isBack ? back : front) +
        '" stroke="' +
        edge +
        '" stroke-width="0.8"/>',
    );
  }

  function dim(x1, x2, y, label, color) {
    return (
      '<line x1="' +
      num(x1) +
      '" y1="' +
      y +
      '" x2="' +
      num(x2) +
      '" y2="' +
      y +
      '" stroke="' +
      color +
      '" stroke-width="1"/>' +
      '<line x1="' +
      num(x1) +
      '" y1="' +
      (y - 3) +
      '" x2="' +
      num(x1) +
      '" y2="' +
      (y + 3) +
      '" stroke="' +
      color +
      '" stroke-width="1"/>' +
      '<line x1="' +
      num(x2) +
      '" y1="' +
      (y - 3) +
      '" x2="' +
      num(x2) +
      '" y2="' +
      (y + 3) +
      '" stroke="' +
      color +
      '" stroke-width="1"/>' +
      '<text x="' +
      num((x1 + x2) / 2) +
      '" y="' +
      (y + 11) +
      '" text-anchor="middle" font-size="9" font-weight="700" fill="' +
      color +
      '"' +
      FONT +
      ">" +
      xmlEscape(label) +
      "</text>"
    );
  }
  const lapLeft = planX + result.advance * planScale;
  const backRight = planX + input.widthMm * planScale;
  const gapRight = planX + 2 * result.advance * planScale;
  const frontRight = lapLeft + input.widthMm * planScale;
  const rowY = frontY + 9 + 8;
  const lowY = rowY + 24;
  parts.push(dim(backRight, gapRight, lowY, "gap " + trimNum(result.gap), "#2d6348"));
  parts.push(dim(lapLeft, backRight, rowY, "lap " + trimNum(input.lapMm), "#b45309"));
  parts.push(dim(gapRight, frontRight, rowY, "lap " + trimNum(input.lapMm), "#b45309"));
  const boardStart = planX + 4 * result.advance * planScale;
  parts.push(dim(boardStart, boardStart + input.widthMm * planScale, lowY, trimNum(input.widthMm) + " paling", "#334155"));
  parts.push(
    '<text x="200" y="' +
      num(lowY + 30) +
      '" text-anchor="middle" font-size="9" fill="#334155"' +
      FONT +
      ">back row (darker) + front row · pair covers " +
      xmlEscape(trimNum(result.pitch)) +
      " mm</text>",
  );
  const vbH = Math.ceil(lowY + 38);
  const caption =
    "Posts and rails dashed (behind palings). Not to scale across the run · showing " +
    shownBays +
    " of " +
    result.bays +
    " bay" +
    (result.bays === 1 ? "" : "s") +
    ". Back gap " +
    trimNum(result.gap) +
    " mm, lap " +
    trimNum(input.lapMm) +
    " mm each side.";
  return { id: "timber", viewBox: "0 0 400 " + vbH, body: parts.join(""), caption };
}

function trimNum(n) {
  return Number(n)
    .toFixed(1)
    .replace(/\.?0+$/, "");
}

const SVG_TAGS = new Set(["path", "polyline", "line", "rect", "circle", "text", "g", "defs", "clipPath"]);

function safeSvgChild(node, doc) {
  if (node.nodeType === 3) return doc.createTextNode(node.textContent);
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  if (!SVG_TAGS.has(tag)) return null;
  const copy = doc.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const attr of Array.from(node.attributes)) {
    if (!/^[a-z][a-z0-9-]*$/.test(attr.name)) continue;
    if (attr.name.startsWith("on")) continue;
    const value = attr.value;
    if (/javascript:|<\s*script/i.test(value)) continue;
    if (attr.name === "clip-path" && !/^url\(#[A-Za-z0-9_-]+\)$/.test(value)) continue;
    if ((attr.name === "id" || attr.name === "font-family") && /[<>"']/.test(value)) continue;
    copy.setAttribute(attr.name, value);
  }
  for (const child of Array.from(node.childNodes)) {
    const next = safeSvgChild(child, doc);
    if (next) copy.appendChild(next);
  }
  return copy;
}

export function mountSvg(svg, diagram) {
  if (!svg || !diagram) return;
  const viewBox = /^[\d.\s-]+$/.test(diagram.viewBox || "") ? diagram.viewBox : "0 0 400 180";
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", diagram.caption || "Fence diagram");
  const doc = new DOMParser().parseFromString(
    '<svg xmlns="http://www.w3.org/2000/svg">' + String(diagram.body || "") + "</svg>",
    "image/svg+xml",
  );
  const root = doc.documentElement;
  svg.replaceChildren();
  if (!root || root.querySelector("parsererror")) return;
  for (const node of Array.from(root.childNodes)) {
    const next = safeSvgChild(node, svg.ownerDocument);
    if (next) svg.appendChild(next);
  }
}
