import {
  calculateColourbond,
  calculateTimber,
  clearOpeningM,
  equalPostClearance,
  equalPostCopy,
  isWhole,
  parseNumber,
  postSpacing,
  stepDown,
  stepRoundingCopy,
} from "./calc.js";
import { spacingDiagram, stepDownDiagram, timberDiagram, mountSvg } from "./diagrams.js";
import { formatM, formatMm } from "./format.js";
import { el } from "./dom.js";

let fallUnit = "mm";
let countMode = "posts";
let lengthUnit = "m";
let postMode = "maxbay";

function byId(id) {
  return document.getElementById(id);
}

function show(id, on) {
  const node = byId(id);
  if (node) node.hidden = !on;
}

function setText(id, text) {
  const node = byId(id);
  if (node) node.textContent = text;
}

function chips(parent, items) {
  parent.replaceChildren();
  for (const item of items) {
    parent.append(el("span", { class: "meta-chip", text: item }));
  }
}

function qtyCard(label, value, sub, span) {
  return el("div", { class: span ? "qty-card span-2" : "qty-card" }, [
    el("p", { class: "qty-label", text: label }),
    el("p", { class: "qty-value", text: value }),
    sub ? el("p", { class: "qty-sub", text: sub }) : null,
  ]);
}

function timberTools() {
  return [
    { checked: byId("sd-timber"), wrap: byId("sd-timber-wrap"), size: byId("sd-timber-size") },
    { checked: byId("sp-timber"), wrap: byId("sp-timber-wrap"), size: byId("sp-timber-size") },
    { checked: byId("mat-timber"), wrap: byId("mat-timber-wrap"), size: byId("mat-timber-size") },
  ];
}

function syncTimber(source) {
  const on = source.checked.checked;
  const size = source.size.value;
  for (const tool of timberTools()) {
    tool.checked.checked = on;
    tool.wrap.hidden = !on;
    if (tool !== source) tool.size.value = size;
  }
  const hint = byId("sp-maxbay-hint");
  if (hint) {
    hint.textContent = on
      ? "Your maximum timber post centres — centres will never exceed this."
      : "Your maximum post centres — centres will never exceed this.";
  }
}

export function showCalculator(tool) {
  const name = tool || "stepdown";
  document.querySelectorAll("#calculators-root .tool-tab[data-tool]").forEach((tab) => {
    const on = tab.getAttribute("data-tool") === name;
    tab.classList.toggle("is-active", on);
    if (on) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  document.querySelectorAll("#calculators-root .tool-panel[data-panel]").forEach((panel) => {
    const on = panel.getAttribute("data-panel") === name;
    panel.hidden = !on;
    panel.classList.toggle("is-active", on);
  });
}

function renderStep() {
  const fallInput = byId("fall");
  const countInput = byId("count");
  const fallText = fallInput.value.trim();
  const countText = countInput.value.trim();
  if (fallText === "" || countText === "") {
    show("results", false);
    show("error-state", false);
    show("empty-state", true);
    return;
  }
  const fallRaw = parseNumber(fallInput.value);
  const countRaw = parseNumber(countInput.value);
  const fail = (title, message) => {
    show("results", false);
    show("empty-state", false);
    show("error-state", true);
    setText("error-title", title);
    setText("error-body", message);
  };
  if (Number.isNaN(fallRaw) || Number.isNaN(countRaw)) return fail("Check your numbers", "Enter valid numbers for fall and posts/bays.");
  const fall = fallUnit === "m" ? fallRaw * 1000 : fallRaw;
  const posts = countMode === "bays" ? countRaw + 1 : countRaw;
  if (fall < 0) return fail("Fall can’t be negative", "Total fall should be 0 or more (high end to low end).");
  const wholePosts = Math.round(posts);
  if (!isWhole(posts)) {
    return fail("Whole posts/bays only", countMode === "bays" ? "Enter a whole number of bays." : "Enter a whole number of posts.");
  }
  if (wholePosts < 2) {
    return fail("Need at least 2 posts", "A step-down run needs at least one bay (2 posts). Add more posts or switch to bays (≥ 1).");
  }
  if (countMode === "bays" && Math.round(countRaw) < 1) return fail("Need at least 1 bay", "Enter 1 or more bays (that’s 2+ posts).");
  let timberMm = null;
  if (byId("sd-timber").checked) {
    timberMm = parseNumber(byId("sd-timber-size").value);
    if (timberMm == null || Number.isNaN(timberMm) || timberMm <= 0) {
      return fail("Timber post width", "Enter a positive timber post width in mm (e.g. 100).");
    }
  }
  let equal = null;
  if (byId("sd-eqpost").checked) {
    const height = parseNumber(byId("sd-eqpost-height").value);
    if (height == null || Number.isNaN(height) || height <= 0) {
      return fail("Post height above ground", "Enter a positive post height above ground in mm (e.g. 2100).");
    }
    const preview = stepDown(fall, wholePosts);
    equal = equalPostClearance(wholePosts, preview.exactStepMm, preview.roundedStepMm, height);
  }
  const step = stepDown(fall, wholePosts);
  show("empty-state", false);
  show("error-state", false);
  show("results", true);
  setText("step-display", fallUnit === "m" ? formatM(step.roundedStepMm / 1000) + "  ·  " + formatMm(step.roundedStepMm) : formatMm(step.roundedStepMm));
  setText(
    "step-sub",
    step.steps + " equal step" + (step.steps === 1 ? "" : "s") + " across " + wholePosts + " posts (" + step.steps + " bay" + (step.steps === 1 ? "" : "s") + ")",
  );
  const meta = [wholePosts + " posts", step.steps + " steps / bays", "Fall " + formatMm(fall) + (fallUnit === "m" ? " (" + formatM(fall / 1000) + ")" : "")];
  if (equal) meta.push("Posts " + formatMm(equal.heightMm) + " above ground");
  chips(byId("result-meta"), meta);
  const note = byId("rounding-note");
  const copy = stepRoundingCopy(step);
  note.hidden = !copy;
  note.textContent = copy || "";
  const clearHead = byId("sd-clear-th");
  clearHead.hidden = !equal;
  const body = byId("drop-body");
  body.replaceChildren();
  for (let i = 0; i < wholePosts; i++) {
    const drop = i * step.roundedStepMm;
    const row = el("tr", {}, [
      el("td", { class: "post-num", text: "Post " + (i + 1) + (i === 0 ? " (high end)" : "") }),
      el("td", { text: formatMm(drop) + (fallUnit === "m" ? " (" + formatM(drop / 1000) + ")" : "") }),
      el("td", { text: i === 0 ? "—" : formatMm(step.roundedStepMm) }),
    ]);
    if (equal) {
      const clearance = Math.round(equal.clear[i]);
      const cell = el("td", {
        text: (clearance < 0 ? "−" + formatMm(-clearance) + " below" : formatMm(clearance) + (clearance === 0 ? " (flush)" : "")),
      });
      if (clearance < 0) cell.classList.add("is-warn");
      row.append(cell);
    }
    body.append(row);
  }
  const postNote = byId("sd-posttop-note");
  if (!equal) postNote.hidden = true;
  else {
    const info = equalPostCopy(equal);
    postNote.hidden = false;
    postNote.className = info.tone === "warn" ? "rounding-note" : "assumption-note";
    postNote.textContent = info.text;
  }
  const diagram = stepDownDiagram({
    posts: wholePosts,
    roundedStepMm: step.roundedStepMm,
    fallMm: fall,
    timberWidthMm: timberMm,
    equal,
  });
  mountSvg(byId("diagram"), diagram);
  setText("diagram-caption", diagram.caption);
}

function setFallUnit(unit) {
  if (unit === fallUnit) return;
  const current = parseNumber(byId("fall").value);
  const mm = current == null || Number.isNaN(current) ? null : fallUnit === "m" ? current * 1000 : current;
  fallUnit = unit;
  byId("unit-mm").classList.toggle("is-active", unit === "mm");
  byId("unit-m").classList.toggle("is-active", unit === "m");
  setText("fall-unit-label", unit);
  if (mm != null) byId("fall").value = unit === "m" ? String(Number((mm / 1000).toFixed(4))) : String(Math.round(mm));
  byId("fall").placeholder = unit === "m" ? "e.g. 0.24" : "e.g. 240";
  byId("fall").step = unit === "m" ? "0.001" : "1";
  renderStep();
}

function setCountMode(mode) {
  if (mode === countMode) return;
  const posts = (() => {
    const n = parseNumber(byId("count").value);
    if (n == null || Number.isNaN(n)) return null;
    return countMode === "bays" ? n + 1 : n;
  })();
  countMode = mode;
  byId("count-posts").classList.toggle("is-active", mode === "posts");
  byId("count-bays").classList.toggle("is-active", mode === "bays");
  if (mode === "posts") {
    setText("count-label", "Number of posts");
    setText("count-suffix", "posts");
    setText("count-hint", "Steps = posts − 1 (one step per bay).");
    byId("count").min = "2";
    byId("count").placeholder = "e.g. 5";
    if (posts != null) byId("count").value = String(Math.round(posts));
  } else {
    setText("count-label", "Number of bays");
    setText("count-suffix", "bays");
    setText("count-hint", "Steps = bays. Posts = bays + 1.");
    byId("count").min = "1";
    byId("count").placeholder = "e.g. 4";
    if (posts != null) byId("count").value = String(Math.max(0, Math.round(posts) - 1));
  }
  renderStep();
}

function lengthM() {
  const n = parseNumber(byId("sp-length").value);
  if (n == null || Number.isNaN(n)) return n;
  return lengthUnit === "mm" ? n / 1000 : n;
}

function renderSpacing() {
  const lengthText = byId("sp-length").value.trim();
  const maxText = byId("sp-maxbay").value.trim();
  const fail = (title, message) => {
    show("sp-results", false);
    show("sp-empty", false);
    show("sp-error", true);
    setText("sp-error-title", title);
    setText("sp-error-body", message);
  };
  if (lengthText === "" || maxText === "") {
    show("sp-results", false);
    show("sp-error", false);
    show("sp-empty", true);
    return;
  }
  const length = lengthM();
  const maxBay = parseNumber(byId("sp-maxbay").value);
  if (Number.isNaN(length) || Number.isNaN(maxBay)) return fail("Check your numbers", "Enter valid numbers for length and max bay.");
  if (length <= 0) return fail("Length must be positive", "Total run length must be greater than 0.");
  if (maxBay <= 0) return fail("Max bay must be positive", "Max bay / post centres must be greater than 0.");
  const spaced = postSpacing(length, maxBay);
  let timber = false;
  let size = null;
  let clear = null;
  if (byId("sp-timber").checked) {
    size = parseNumber(byId("sp-timber-size").value);
    if (size == null || Number.isNaN(size) || size <= 0) return fail("Timber size", "Enter a positive timber post size in mm (e.g. 100).");
    clear = clearOpeningM(spaced.centresM, size);
    if (clear <= 0) return fail("Timber wider than bay", "Timber width must be less than equal centres (" + formatM(spaced.centresM, 3) + ").");
    timber = true;
  }
  show("sp-empty", false);
  show("sp-error", false);
  show("sp-results", true);
  setText("sp-centres-display", lengthUnit === "mm" ? formatM(spaced.centresM, 3) + "  ·  " + formatMm(spaced.centresM * 1000) : formatM(spaced.centresM, 3));
  setText("sp-centres-sub", spaced.bays + " equal bay" + (spaced.bays === 1 ? "" : "s") + " (≤ " + formatM(maxBay, 3) + " max)");
  const meta = [spaced.posts + " posts", spaced.bays + " bays", "Run " + formatM(length, 3)];
  if (timber) meta.push("Timber " + formatMm(size) + " sq");
  chips(byId("sp-result-meta"), meta);
  const clearHero = byId("sp-clear-hero");
  if (timber) {
    clearHero.hidden = false;
    setText("sp-clear-display", lengthUnit === "mm" ? formatM(clear, 3) + "  ·  " + formatMm(clear * 1000) : formatM(clear, 3));
    setText("sp-clear-sub", "centres − " + formatMm(size) + " timber · rails/panels span clear opening between timber faces");
  } else clearHero.hidden = true;
  const body = byId("sp-body");
  body.replaceChildren();
  for (let i = 0; i < spaced.posts; i++) {
    const pos = i * spaced.centresM;
    body.append(
      el("tr", {}, [
        el("td", { class: "post-num", text: "Post " + (i + 1) + (i === 0 ? " (start)" : "") + (i === spaced.posts - 1 ? " (end)" : "") }),
        el("td", { text: formatM(pos, 3) + (lengthUnit === "mm" ? " (" + formatMm(pos * 1000) + ")" : "") }),
        el("td", { text: i === 0 ? "—" : formatM(spaced.centresM, 3) }),
      ]),
    );
  }
  const diagram = spacingDiagram({ posts: spaced.posts, lengthM: length, centresM: spaced.centresM, timber });
  mountSvg(byId("sp-diagram"), diagram);
  setText("sp-diagram-caption", diagram.caption);
}

function setLengthUnit(unit) {
  if (unit === lengthUnit) return;
  const current = lengthM();
  lengthUnit = unit;
  byId("sp-unit-m").classList.toggle("is-active", unit === "m");
  byId("sp-unit-mm").classList.toggle("is-active", unit === "mm");
  setText("sp-length-unit", unit);
  if (current != null && !Number.isNaN(current)) {
    byId("sp-length").value = unit === "mm" ? String(Math.round(current * 1000)) : String(Number(current.toFixed(4)));
  }
  byId("sp-length").placeholder = unit === "m" ? "e.g. 12" : "e.g. 12000";
  byId("sp-length").step = unit === "m" ? "0.001" : "1";
  renderSpacing();
}

function renderMaterials() {
  const input = {
    lengthM: byId("mat-length").value,
    postMode,
    maxBayM: byId("mat-maxbay").value,
    count: byId("mat-count").value,
    heightMm: byId("mat-height").value,
    coverMm: byId("mat-cover").value,
    railsPerBay: byId("mat-rails").value,
    includeCaps: byId("mat-caps").checked,
    timberPosts: byId("mat-timber").checked,
    timberSizeMm: byId("mat-timber-size").value,
    fixingsPerPost: byId("mat-fixings").value,
    useStepDown: false,
  };
  const outcome = calculateColourbond(input);
  if (outcome.state === "empty") {
    show("mat-results", false);
    show("mat-error", false);
    show("mat-empty", true);
    return;
  }
  if (outcome.state === "error") {
    show("mat-results", false);
    show("mat-empty", false);
    show("mat-error", true);
    setText("mat-error-title", outcome.error.title);
    setText("mat-error-body", outcome.error.message);
    return;
  }
  const r = outcome.result;
  show("mat-empty", false);
  show("mat-error", false);
  show("mat-results", true);
  const grid = byId("mat-qty-grid");
  const cards = [qtyCard("Panels", String(r.panels), "ceil(length ÷ cover)")];
  if (r.timberPosts) {
    cards.push(qtyCard("Timber posts", String(r.posts), formatMm(r.timberSizeMm) + " sq · stations"));
    cards.push(qtyCard("Colourbond posts", String(r.posts), "1 per timber"));
  } else cards.push(qtyCard("Posts", String(r.posts), "incl. ends"));
  cards.push(qtyCard("Caps", r.includeCaps ? String(r.caps) : "—", r.includeCaps ? (r.timberPosts ? "= Colourbond posts" : "= posts") : "not included"));
  if (r.timberPosts) cards.push(qtyCard("Fixings", String(r.fixingCount), r.fixingsPerPost + " × " + r.posts + " posts"));
  cards.push(qtyCard("Rail pieces", String(r.railPieces), r.railsPerBay + " × " + r.bays + " bays · ≈ " + formatM(r.railPieceM, 3) + " ea"));
  cards.push(qtyCard("Total rail length", formatM(r.railM, 2), "run × rails/bay", true));
  grid.replaceChildren(...cards);
  const meta = ["Run " + formatM(r.lengthM, 3), r.bays + " bay" + (r.bays === 1 ? "" : "s"), "Centres " + formatM(r.centresM, 3)];
  if (r.timberPosts) meta.push("Clear bay " + formatM(r.clearM, 3), "Timber " + formatMm(r.timberSizeMm) + " sq");
  if (r.heightMm) meta.push("Height " + formatMm(r.heightMm));
  meta.push("Cover " + formatMm(r.coverMm));
  chips(byId("mat-result-meta"), meta);
  const assumptions = byId("mat-assumptions");
  assumptions.replaceChildren();
  assumptions.append(el("strong", { text: "Assumptions: " }));
  assumptions.append(
    "Panels cover the run by effective cover width (not one panel per bay). " +
      (r.timberPosts
        ? "Each station = 1 timber post + 1 Colourbond post. Rail pieces cut ≈ clear bay (" + formatM(r.clearM, 3) + " = centres − timber). "
        : "Rail pieces are cut per bay (" + formatM(r.centresM, 3) + " each). ") +
      "Total rail length is continuous-track equivalent (run × rails/bay). Concrete not included.",
  );
}

function setPostMode(mode) {
  if (mode === postMode) return;
  let posts = null;
  const length = parseNumber(byId("mat-length").value);
  if (postMode === "maxbay") {
    const maxBay = parseNumber(byId("mat-maxbay").value);
    if (length > 0 && maxBay > 0) posts = Math.ceil(length / maxBay) + 1;
  } else if (postMode === "posts") {
    const n = parseNumber(byId("mat-count").value);
    if (n != null && !Number.isNaN(n)) posts = n;
  } else {
    const n = parseNumber(byId("mat-count").value);
    if (n != null && !Number.isNaN(n)) posts = n + 1;
  }
  postMode = mode;
  byId("mat-post-maxbay").classList.toggle("is-active", mode === "maxbay");
  byId("mat-post-posts").classList.toggle("is-active", mode === "posts");
  byId("mat-post-bays").classList.toggle("is-active", mode === "bays");
  byId("mat-maxbay-wrap").hidden = mode !== "maxbay";
  byId("mat-count-wrap").hidden = mode === "maxbay";
  if (mode === "posts") {
    setText("mat-count-label", "Number of posts");
    setText("mat-count-suffix", "posts");
    setText("mat-count-hint", "Posts including both ends. Bays = posts − 1.");
    byId("mat-count").placeholder = "e.g. 6";
    byId("mat-count").min = "2";
    if (posts != null) byId("mat-count").value = String(Math.round(posts));
  } else if (mode === "bays") {
    setText("mat-count-label", "Number of bays");
    setText("mat-count-suffix", "bays");
    setText("mat-count-hint", "Bays between posts. Posts = bays + 1.");
    byId("mat-count").placeholder = "e.g. 5";
    byId("mat-count").min = "1";
    if (posts != null) byId("mat-count").value = String(Math.max(0, Math.round(posts) - 1));
  }
  renderMaterials();
}

function renderTimber() {
  const input = {
    lengthM: byId("tf-length").value,
    maxBayM: byId("tf-maxbay").value,
    heightMm: byId("tf-height").value,
    postMm: byId("tf-post").value,
    widthMm: byId("tf-width").value,
    lapMm: byId("tf-lap").value,
    rails: byId("tf-rails").value,
    nailsPerRail: byId("tf-nails").value,
    plinth: byId("tf-plinth").checked,
  };
  const outcome = calculateTimber(input);
  if (outcome.state === "empty") {
    show("tf-results", false);
    show("tf-error", false);
    show("tf-empty", true);
    return;
  }
  if (outcome.state === "error") {
    show("tf-results", false);
    show("tf-empty", false);
    show("tf-error", true);
    setText("tf-error-title", outcome.error.title);
    setText("tf-error-body", outcome.error.message);
    return;
  }
  const r = outcome.result;
  show("tf-empty", false);
  show("tf-error", false);
  show("tf-results", true);
  const trim = (n) =>
    Number(n)
      .toFixed(1)
      .replace(/\.?0+$/, "");
  const cards = [
    qtyCard("Palings", String(r.palings), r.back + " back + " + r.front + " front"),
    qtyCard("Palings / metre", trim(r.perMetre), "1000 ÷ (" + trim(r.widthMm) + " − " + trim(r.lapMm) + ")"),
    qtyCard("Palings / bay", "≈ " + trim(r.perBay), "average, " + formatM(r.centresM, 3) + " bay"),
    qtyCard("Back gap", trim(r.gap) + " mm", trim(r.widthMm) + " − 2 × " + trim(r.lapMm) + " lap"),
    qtyCard("Posts", String(r.posts), trim(r.postMm) + " × " + trim(r.postMm) + " · incl. ends"),
    qtyCard("Bays", String(r.bays), formatM(r.centresM, 3) + " centres"),
    qtyCard("Rail pieces", String(r.railPieces), r.rails + " × " + r.bays + " bays · ≈ " + formatM(r.centresM, 3) + " ea"),
    qtyCard("Total rail length", formatM(r.railM, 2), "run × " + r.rails + " rails"),
    qtyCard("Paling length", formatMm(r.heightMm), "= fence height"),
  ];
  if (r.nailsPerRail > 0) {
    cards.push(qtyCard("Nails", r.nails.toLocaleString("en-AU"), r.nailsPerRail + " × " + r.rails + " rails × " + r.palings + " palings"));
  }
  if (r.plinth) cards.push(qtyCard("Plinth boards", String(r.plinthBoards), "1 per bay · ≈ " + formatM(r.centresM, 3) + " ea"));
  byId("tf-qty-grid").replaceChildren(...cards);
  chips(byId("tf-result-meta"), [
    "Run " + formatM(r.lengthM, 3),
    r.posts + " posts",
    r.bays + " bay" + (r.bays === 1 ? "" : "s") + " @ " + formatM(r.centresM, 3),
    "Height " + formatMm(r.heightMm),
    trim(r.widthMm) + " paling · " + trim(r.lapMm) + " lap",
  ]);
  const assumptions = byId("tf-assumptions");
  assumptions.replaceChildren();
  assumptions.append(el("strong", { text: "How palings are counted: " }));
  assumptions.append(
    "along the full run (" +
      formatM(r.lengthM, 3) +
      "), not bay by bay. Palings are nailed to the rails and run straight past the posts, so the count starts with a back paling at the start and each paling adds " +
      trim(r.advance) +
      " mm (width − lap). Back palings sit " +
      trim(r.gap) +
      " mm apart and each front paling laps " +
      trim(r.lapMm) +
      " mm onto the back palings either side. Per bay is an average. Rail pieces are cut per bay (≈ centres, joined on posts). Allow a few spares. Concrete not included.",
  );
  const diagram = timberDiagram(
    {
      heightMm: r.heightMm,
      widthMm: r.widthMm,
      lapMm: r.lapMm,
      postMm: r.postMm,
      rails: r.rails,
      plinth: r.plinth,
    },
    r,
    "calculator",
  );
  mountSvg(byId("tf-diagram"), diagram);
  setText("tf-diagram-caption", diagram.caption);
}

function watchTimber(tool, renders) {
  tool.checked.addEventListener("change", () => {
    syncTimber(tool);
    renders.forEach((fn) => fn());
  });
  tool.size.addEventListener("input", () => {
    syncTimber(tool);
    renders.forEach((fn) => fn());
  });
}

export function initCalculators() {
  byId("fall").addEventListener("input", renderStep);
  byId("count").addEventListener("input", renderStep);
  byId("unit-mm").addEventListener("click", () => setFallUnit("mm"));
  byId("unit-m").addEventListener("click", () => setFallUnit("m"));
  byId("count-posts").addEventListener("click", () => setCountMode("posts"));
  byId("count-bays").addEventListener("click", () => setCountMode("bays"));
  byId("sd-eqpost").addEventListener("change", () => {
    byId("sd-eqpost-wrap").hidden = !byId("sd-eqpost").checked;
    renderStep();
  });
  byId("sd-eqpost-height").addEventListener("input", renderStep);
  const all = [renderStep, renderSpacing, renderMaterials];
  watchTimber(timberTools()[0], all);
  watchTimber(timberTools()[1], [renderSpacing, renderMaterials, renderStep]);
  watchTimber(timberTools()[2], all);

  byId("sp-length").addEventListener("input", renderSpacing);
  byId("sp-maxbay").addEventListener("input", renderSpacing);
  byId("sp-unit-m").addEventListener("click", () => setLengthUnit("m"));
  byId("sp-unit-mm").addEventListener("click", () => setLengthUnit("mm"));

  ["mat-length", "mat-cover", "mat-maxbay", "mat-count", "mat-rails", "mat-height", "mat-fixings"].forEach((id) => {
    byId(id).addEventListener("input", renderMaterials);
  });
  byId("mat-caps").addEventListener("change", renderMaterials);
  byId("mat-post-maxbay").addEventListener("click", () => setPostMode("maxbay"));
  byId("mat-post-posts").addEventListener("click", () => setPostMode("posts"));
  byId("mat-post-bays").addEventListener("click", () => setPostMode("bays"));
  byId("mat-height").addEventListener("input", () => {
    const value = byId("mat-height").value.trim();
    document.querySelectorAll(".chip-btn[data-height]").forEach((chip) => {
      chip.classList.toggle("is-active", chip.getAttribute("data-height") === value);
    });
  });
  document.querySelectorAll(".chip-btn[data-height]").forEach((chip) => {
    chip.addEventListener("click", () => {
      byId("mat-height").value = chip.getAttribute("data-height");
      document.querySelectorAll(".chip-btn[data-height]").forEach((other) => other.classList.toggle("is-active", other === chip));
      renderMaterials();
    });
  });

  ["tf-length", "tf-maxbay", "tf-height", "tf-post", "tf-width", "tf-lap", "tf-rails", "tf-nails"].forEach((id) => {
    byId(id).addEventListener("input", renderTimber);
  });
  byId("tf-plinth").addEventListener("change", renderTimber);
  document.querySelectorAll("#calculators-root .tool-tab[data-tool]").forEach((tab) => {
    tab.addEventListener("click", () => {
      location.hash = "#/calc/" + tab.getAttribute("data-tool");
    });
  });
  renderStep();
  renderSpacing();
  renderTimber();
  renderMaterials();
}
