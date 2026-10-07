/**
 * Fencing Calculator — Colourbond step-down tool
 * Formula: step = fall ÷ (posts − 1)   |   bays = posts − 1
 */

(function () {
  "use strict";

  const els = {
    fall: document.getElementById("fall"),
    count: document.getElementById("count"),
    fallUnitLabel: document.getElementById("fall-unit-label"),
    countLabel: document.getElementById("count-label"),
    countSuffix: document.getElementById("count-suffix"),
    countHint: document.getElementById("count-hint"),
    results: document.getElementById("results"),
    empty: document.getElementById("empty-state"),
    error: document.getElementById("error-state"),
    errorTitle: document.getElementById("error-title"),
    errorBody: document.getElementById("error-body"),
    stepDisplay: document.getElementById("step-display"),
    stepSub: document.getElementById("step-sub"),
    resultMeta: document.getElementById("result-meta"),
    roundingNote: document.getElementById("rounding-note"),
    dropBody: document.getElementById("drop-body"),
    diagram: document.getElementById("diagram"),
    diagramCaption: document.getElementById("diagram-caption"),
    unitMm: document.getElementById("unit-mm"),
    unitM: document.getElementById("unit-m"),
    countPosts: document.getElementById("count-posts"),
    countBays: document.getElementById("count-bays"),
  };

  const state = {
    fallUnit: "mm", // "mm" | "m"
    countMode: "posts", // "posts" | "bays"
  };

  function parseNumber(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (s === "" || s === "-" || s === ".") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  /** Fall value converted to millimetres */
  function fallMm() {
    const n = parseNumber(els.fall.value);
    if (n === null) return null;
    if (Number.isNaN(n)) return NaN;
    return state.fallUnit === "m" ? n * 1000 : n;
  }

  /** Posts count, derived from current mode */
  function postsCount() {
    const n = parseNumber(els.count.value);
    if (n === null) return null;
    if (Number.isNaN(n)) return NaN;
    if (state.countMode === "bays") return n + 1;
    return n;
  }

  function roundMm(x) {
    return Math.round(x);
  }

  function formatMm(mm) {
    const r = roundMm(mm);
    return r.toLocaleString("en-AU") + " mm";
  }

  function formatM(mm) {
    const m = mm / 1000;
    // Sensible site display: up to 3 decimal places, trim trailing zeros
    const s = m.toFixed(3).replace(/\.?0+$/, "");
    return s + " m";
  }

  function formatStepPrimary(mmExact) {
    const rounded = roundMm(mmExact);
    if (state.fallUnit === "m") {
      return formatM(rounded) + "  ·  " + formatMm(rounded);
    }
    return formatMm(rounded);
  }

  function setUnit(unit) {
    if (unit === state.fallUnit) return;
    const currentMm = fallMm();
    state.fallUnit = unit;
    els.unitMm.classList.toggle("is-active", unit === "mm");
    els.unitM.classList.toggle("is-active", unit === "m");
    els.fallUnitLabel.textContent = unit;

    // Convert displayed value when switching units (if we have a valid number)
    if (currentMm !== null && !Number.isNaN(currentMm)) {
      if (unit === "m") {
        const m = currentMm / 1000;
        els.fall.value = Number(m.toFixed(4)).toString();
      } else {
        els.fall.value = String(roundMm(currentMm));
      }
    }
    els.fall.placeholder = unit === "m" ? "e.g. 0.24" : "e.g. 240";
    els.fall.step = unit === "m" ? "0.001" : "1";
    recalculate();
  }

  function setCountMode(mode) {
    if (mode === state.countMode) return;
    const posts = postsCount();
    state.countMode = mode;
    els.countPosts.classList.toggle("is-active", mode === "posts");
    els.countBays.classList.toggle("is-active", mode === "bays");

    if (mode === "posts") {
      els.countLabel.textContent = "Number of posts";
      els.countSuffix.textContent = "posts";
      els.countHint.textContent = "Steps = posts − 1 (one step per bay).";
      els.count.min = "2";
      els.count.placeholder = "e.g. 5";
      if (posts !== null && !Number.isNaN(posts)) {
        els.count.value = String(Math.round(posts));
      }
    } else {
      els.countLabel.textContent = "Number of bays";
      els.countSuffix.textContent = "bays";
      els.countHint.textContent = "Steps = bays. Posts = bays + 1.";
      els.count.min = "1";
      els.count.placeholder = "e.g. 4";
      if (posts !== null && !Number.isNaN(posts)) {
        els.count.value = String(Math.max(0, Math.round(posts) - 1));
      }
    }
    recalculate();
  }

  function showEmpty() {
    els.results.hidden = true;
    els.error.hidden = true;
    els.empty.hidden = false;
  }

  function showError(title, body) {
    els.results.hidden = true;
    els.empty.hidden = true;
    els.error.hidden = false;
    els.errorTitle.textContent = title;
    els.errorBody.textContent = body;
  }

  function showResults() {
    els.empty.hidden = true;
    els.error.hidden = true;
    els.results.hidden = false;
  }

  function buildTable(posts, stepRounded, steps) {
    const rows = [];
    for (let i = 0; i < posts; i++) {
      const cumulative = i * stepRounded;
      const stepFromPrev = i === 0 ? null : stepRounded;
      const isHigh = i === 0;
      rows.push(
        "<tr>" +
          '<td class="post-num">Post ' +
          (i + 1) +
          (isHigh ? ' <span class="high-end">(high end)</span>' : "") +
          "</td>" +
          "<td>" +
          formatMm(cumulative) +
          (state.fallUnit === "m" ? " <span class=\"high-end\">(" + formatM(cumulative) + ")</span>" : "") +
          "</td>" +
          "<td>" +
          (stepFromPrev === null ? "—" : formatMm(stepFromPrev)) +
          "</td>" +
          "</tr>"
      );
    }
    els.dropBody.innerHTML = rows.join("");
  }

  /**
   * SVG: ground slope + stepped panel tops + posts
   * High end on the left (Post 1).
   */
  function drawDiagram(posts, stepRounded, fallRounded) {
    const W = 400;
    const H = 160;
    const padL = 28;
    const padR = 28;
    const padT = 18;
    const padB = 36;
    const usableW = W - padL - padR;
    const usableH = H - padT - padB;

    const groundYHigh = padT + usableH * 0.22;
    const groundYLow = padT + usableH * 0.85;
    // Panel tops: start near ground at high end, step down by same visual ratio as fall
    const panelTopHigh = groundYHigh - 42;
    const maxDropVisual = Math.min(usableH * 0.55, groundYLow - groundYHigh);
    const fallVis = fallRounded > 0 ? fallRounded : 1;

    const xs = [];
    for (let i = 0; i < posts; i++) {
      xs.push(padL + (posts === 1 ? usableW / 2 : (i / (posts - 1)) * usableW));
    }

    function groundYAt(i) {
      if (posts === 1) return groundYHigh;
      return groundYHigh + (i / (posts - 1)) * (groundYLow - groundYHigh);
    }

    function panelTopAt(i) {
      const drop = (i * stepRounded) / fallVis * maxDropVisual;
      return panelTopHigh + (fallRounded > 0 ? drop : 0);
    }

    const parts = [];

    // Sky / fade already from CSS bg

    // Ground fill
    parts.push(
      '<path d="M ' +
        (padL - 8) +
        " " +
        H +
        " L " +
        (padL - 8) +
        " " +
        groundYAt(0) +
        " L " +
        xs
          .map(function (x, i) {
            return x + " " + groundYAt(i);
          })
          .join(" L ") +
        " L " +
        (W - padR + 8) +
        " " +
        groundYAt(posts - 1) +
        " L " +
        (W - padR + 8) +
        " " +
        H +
        ' Z" fill="#c4b59a" opacity="0.55"/>'
    );

    // Ground line
    parts.push(
      '<polyline fill="none" stroke="#8b7355" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="' +
        xs
          .map(function (x, i) {
            return x + "," + groundYAt(i);
          })
          .join(" ") +
        '"/>'
    );

    // Stepped panels (rectangles between posts)
    for (let i = 0; i < posts - 1; i++) {
      const x1 = xs[i];
      const x2 = xs[i + 1];
      const top = panelTopAt(i);
      const bot = groundYAt(i); // panel sits to ground at high side of bay (simplified)
      // Use average ground under bay for bottom — panels are level, so bottom = top + panel height visual
      const panelH = 38;
      const y1 = top;
      const y2 = top + panelH;
      parts.push(
        '<rect x="' +
          x1 +
          '" y="' +
          y1 +
          '" width="' +
          Math.max(2, x2 - x1) +
          '" height="' +
          panelH +
          '" fill="#2d6348" opacity="0.88" rx="1"/>'
      );
      // Highlight top edge (level rail)
      parts.push(
        '<line x1="' +
          x1 +
          '" y1="' +
          y1 +
          '" x2="' +
          x2 +
          '" y2="' +
          y1 +
          '" stroke="#1a3a2a" stroke-width="2.5"/>'
      );
    }

    // Posts (plumb)
    for (let i = 0; i < posts; i++) {
      const x = xs[i];
      const top = panelTopAt(i) - (i === 0 || i === posts - 1 ? 6 : 2);
      const bot = groundYAt(i) + 4;
      parts.push(
        '<line x1="' +
          x +
          '" y1="' +
          top +
          '" x2="' +
          x +
          '" y2="' +
          bot +
          '" stroke="#0f2419" stroke-width="3.5" stroke-linecap="round"/>'
      );
      // Cap
      parts.push(
        '<circle cx="' + x + '" cy="' + top + '" r="3" fill="#0f2419"/>'
      );
    }

    // Labels
    parts.push(
      '<text x="' +
        xs[0] +
        '" y="' +
        (H - 12) +
        '" text-anchor="middle" font-size="10" font-weight="700" fill="#334155" font-family="system-ui,sans-serif">High</text>'
    );
    if (posts > 1) {
      parts.push(
        '<text x="' +
          xs[posts - 1] +
          '" y="' +
          (H - 12) +
          '" text-anchor="middle" font-size="10" font-weight="700" fill="#334155" font-family="system-ui,sans-serif">Low</text>'
      );
    }

    // Fall arrow annotation (right side)
    if (fallRounded > 0 && posts > 1) {
      const ax = W - 14;
      const ay1 = panelTopAt(0);
      const ay2 = panelTopAt(posts - 1);
      parts.push(
        '<line x1="' +
          ax +
          '" y1="' +
          ay1 +
          '" x2="' +
          ax +
          '" y2="' +
          ay2 +
          '" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3 2"/>'
      );
      parts.push(
        '<text x="' +
          (ax - 6) +
          '" y="' +
          (ay1 + ay2) / 2 +
          '" text-anchor="end" dominant-baseline="middle" font-size="9" fill="#64748b" font-family="system-ui,sans-serif">fall</text>'
      );
    }

    els.diagram.innerHTML = parts.join("");
    els.diagramCaption.textContent =
      "Stepped panels (level) · plumb posts · ground falls high → low";
  }

  function recalculate() {
    const mm = fallMm();
    const posts = postsCount();
    const fallRaw = els.fall.value.trim();
    const countRaw = els.count.value.trim();

    // Both empty → empty state
    if (fallRaw === "" && countRaw === "") {
      showEmpty();
      return;
    }

    // Partial input — still empty-ish guidance if one missing
    if (fallRaw === "" || countRaw === "") {
      showEmpty();
      return;
    }

    if (Number.isNaN(mm) || Number.isNaN(posts)) {
      showError("Check your numbers", "Enter valid numbers for fall and posts/bays.");
      return;
    }

    if (mm < 0) {
      showError("Fall can’t be negative", "Total fall should be 0 or more (high end to low end).");
      return;
    }

    const postsInt = Math.round(posts);
    if (Math.abs(posts - postsInt) > 1e-9) {
      showError(
        "Whole posts/bays only",
        state.countMode === "bays"
          ? "Enter a whole number of bays."
          : "Enter a whole number of posts."
      );
      return;
    }

    if (postsInt < 2) {
      showError(
        "Need at least 2 posts",
        "A step-down run needs at least one bay (2 posts). Add more posts or switch to bays (≥ 1)."
      );
      return;
    }

    // If counting bays and user typed fractional somehow already caught; also bays ≥ 1 ⇒ posts ≥ 2
    if (state.countMode === "bays") {
      const bays = Math.round(parseNumber(els.count.value));
      if (bays < 1) {
        showError("Need at least 1 bay", "Enter 1 or more bays (that’s 2+ posts).");
        return;
      }
    }

    const steps = postsInt - 1;
    const exactStep = mm / steps;
    const stepRounded = roundMm(exactStep);
    // "Doesn't divide evenly" when exact step isn't a whole millimetre
    const evenMm = Math.abs(exactStep - Math.round(exactStep)) < 1e-9;

    showResults();

    els.stepDisplay.textContent = formatStepPrimary(exactStep);
    els.stepSub.textContent =
      steps +
      " equal step" +
      (steps === 1 ? "" : "s") +
      " across " +
      postsInt +
      " posts (" +
      steps +
      " bay" +
      (steps === 1 ? "" : "s") +
      ")";

    els.resultMeta.innerHTML =
      '<span class="meta-chip">' +
      postsInt +
      " posts</span>" +
      '<span class="meta-chip">' +
      steps +
      " steps / bays</span>" +
      '<span class="meta-chip">Fall ' +
      formatMm(mm) +
      (state.fallUnit === "m" ? " (" + formatM(mm) + ")" : "") +
      "</span>";

    if (!evenMm) {
      const exactStr =
        Number.isInteger(exactStep) || Math.abs(exactStep - exactStep.toFixed(3)) < 1e-9
          ? exactStep.toFixed(3).replace(/\.?0+$/, "")
          : (Math.round(exactStep * 1000) / 1000).toString();
      const rem = mm - stepRounded * steps;
      let remText;
      if (Math.abs(rem) < 0.05) {
        remText = "Rounds cleanly to the nearest millimetre across the run.";
      } else if (rem > 0) {
        remText =
          "Rounded steps total " +
          formatMm(stepRounded * steps) +
          " — about " +
          formatMm(Math.abs(rem)) +
          " short of the true fall. Take up the leftover on one end if needed.";
      } else {
        remText =
          "Rounded steps total " +
          formatMm(stepRounded * steps) +
          " — about " +
          formatMm(Math.abs(rem)) +
          " over the true fall. Shave a millimetre somewhere if it matters.";
      }
      els.roundingNote.hidden = false;
      els.roundingNote.innerHTML =
        "<strong>Fall doesn’t divide evenly.</strong> Exact step is " +
        exactStr +
        " mm. Showing " +
        formatMm(stepRounded) +
        " (nearest mm). " +
        remText;
    } else {
      els.roundingNote.hidden = true;
      els.roundingNote.innerHTML = "";
    }

    buildTable(postsInt, stepRounded, steps);
    drawDiagram(postsInt, stepRounded, Math.max(mm, 1));
  }

  // Events
  els.fall.addEventListener("input", recalculate);
  els.count.addEventListener("input", recalculate);

  els.unitMm.addEventListener("click", function () {
    setUnit("mm");
  });
  els.unitM.addEventListener("click", function () {
    setUnit("m");
  });
  els.countPosts.addEventListener("click", function () {
    setCountMode("posts");
  });
  els.countBays.addEventListener("click", function () {
    setCountMode("bays");
  });

  // Initial
  showEmpty();
})();
