/**
 * Fence calculators preserved from the v12 app (Colourbond step-downs,
 * post spacing, materials, timber lap-and-cap).
 *
 * Timber paling geometry (what the shipped code actually does):
 *   back gap     = paling width − 2 × lap     (lap is each side)
 *   advance      = paling width − lap         (each successive paling, alternating rows)
 *   pair pitch   = 2 × advance                (back + front)
 *   palings      = 1, if the run is no longer than one paling
 *                = 1 + ceil((run mm − width) / advance − 1e-9) otherwise
 *   The run starts on a back paling. Palings continue past the posts.
 *   Nails        = palings × rails per bay × nails per paling per rail
 * A lap that leaves no positive back gap is rejected, as is a post as wide as the bay.
 *
 * Colourbond: panels stay level, posts stay plumb, equal vertical steps.
 *   steps = bays = posts − 1
 *   bays  = ceil(length ÷ max bay); centres = length ÷ bays; posts = bays + 1
 * Timber-supported Colourbond: clear opening = centres − timber width (default 100 mm).
 */

export const PANEL_MM = 1800;
export const PLINTH_MM = 150;
/** Panel on plinth. Post clearance is measured above this line. */
export const POST_CLEAR_BASE_MM = PANEL_MM + PLINTH_MM;

export function parseNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value).trim();
  if (text === "" || text === "-" || text === ".") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}

export function isWhole(n) {
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) <= 1e-9;
}

export function postSpacing(lengthM, maxBayM) {
  const bays = Math.ceil(lengthM / maxBayM);
  const centresM = lengthM / bays;
  return { bays, centresM, posts: bays + 1 };
}

export function clearOpeningM(centresM, timberMm) {
  return centresM - timberMm / 1000;
}

export function stepDown(fallMm, posts) {
  const steps = posts - 1;
  const exactStepMm = fallMm / steps;
  const roundedStepMm = Math.round(exactStepMm);
  const even = Math.abs(exactStepMm - Math.round(exactStepMm)) < 1e-9;
  const remainderMm = fallMm - roundedStepMm * steps;
  return { fallMm, posts, steps, bays: steps, exactStepMm, roundedStepMm, even, remainderMm };
}

export function stepRoundingCopy(step) {
  if (step.even) return null;
  const exact = step.exactStepMm;
  const exactText =
    Number.isInteger(exact) || Math.abs(exact - Number(exact.toFixed(3))) < 1e-9
      ? exact.toFixed(3).replace(/\.?0+$/, "")
      : String(Math.round(exact * 1000) / 1000);
  let tail;
  if (Math.abs(step.remainderMm) < 0.05) {
    tail = "Rounds cleanly to the nearest millimetre across the run.";
  } else if (step.remainderMm > 0) {
    tail =
      "Rounded steps total " +
      formatMmLocal(step.roundedStepMm * step.steps) +
      " — about " +
      formatMmLocal(Math.abs(step.remainderMm)) +
      " short of the true fall. Take up the leftover on one end if needed.";
  } else {
    tail =
      "Rounded steps total " +
      formatMmLocal(step.roundedStepMm * step.steps) +
      " — about " +
      formatMmLocal(Math.abs(step.remainderMm)) +
      " over the true fall. Shave a millimetre somewhere if it matters.";
  }
  return (
    "Fall doesn’t divide evenly. Exact step is " +
    exactText +
    " mm. Showing " +
    formatMmLocal(step.roundedStepMm) +
    " (nearest mm). " +
    tail
  );
}

function formatMmLocal(mm) {
  return Math.round(mm).toLocaleString("en-AU") + " mm";
}

/**
 * How far each post top sits above the higher adjacent panel top
 * when every post is the same height above its own ground.
 * Negative means the top finishes below that panel.
 */
export function equalPostClearance(posts, exactStepMm, roundedStepMm, postHeightMm) {
  const clear = [];
  const flags = [];
  for (let i = 0; i < posts; i++) {
    const above =
      postHeightMm - i * exactStepMm - (POST_CLEAR_BASE_MM - Math.max(i - 1, 0) * roundedStepMm);
    clear.push(above);
    flags.push(Math.round(above) < 0);
  }
  let min = Infinity;
  let max = -Infinity;
  for (const value of clear) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const suggestedHeightMm = Math.ceil(postHeightMm - min - 1e-9);
  return {
    heightMm: postHeightMm,
    groundStepMm: exactStepMm,
    mainClearMm: posts > 1 ? clear[1] : clear[0],
    clear,
    flags,
    min,
    max,
    suggestedHeightMm,
    belowPosts: flags.map((flag, i) => (flag ? i + 1 : 0)).filter(Boolean),
  };
}

export function equalPostCopy(model) {
  const below = model.belowPosts;
  const low = Math.round(model.min);
  const high = Math.round(model.max);
  const range =
    low === high
      ? signedMm(low)
      : signedMm(low) + " to " + signedMm(high);
  const modelText =
    " Model: " +
    formatMmLocal(PANEL_MM) +
    " panel on a " +
    formatMmLocal(PLINTH_MM) +
    " plinth (bottom rail on the plinth, " +
    formatMmLocal(PLINTH_MM) +
    " above the ground at each bay’s high post), ground falling evenly from High to Low.";
  if (below.length) {
    const who =
      below.length === model.clear.length
        ? "All posts"
        : below.length <= 6
          ? "Post" + (below.length === 1 ? " " : "s ") + below.join(", ")
          : below.length + " posts";
    return {
      tone: "warn",
      text:
        who +
        " finish below the higher panel top (by up to " +
        formatMmLocal(-model.min) +
        "). At " +
        formatMmLocal(model.heightMm) +
        " above ground the post tops drop " +
        formatMmLocal(model.groundStepMm) +
        " per post with the ground. Use at least " +
        formatMmLocal(model.suggestedHeightMm) +
        " above ground to clear every panel." +
        modelText,
    };
  }
  return {
    tone: "info",
    text:
      "Post tops follow the fall. Every post is " +
      formatMmLocal(model.heightMm) +
      " above its own ground, so the tops drop " +
      formatMmLocal(model.groundStepMm) +
      " per post. Post tops sit " +
      range +
      " above the higher adjacent panel top" +
      (Math.round(model.groundStepMm) > 0
        ? " (most at the high-end post; the rest about " + formatMmLocal(model.groundStepMm) + " less)."
        : ".") +
      modelText,
  };
}

function signedMm(rounded) {
  return rounded < 0 ? "\u2212" + formatMmLocal(-rounded) : formatMmLocal(rounded);
}

function fail(title, message) {
  return { state: "error", error: { title, message } };
}

function resolvePosts(input) {
  const lengthM = parseNumber(input.lengthM);
  const mode = input.postMode || "maxbay";
  if (lengthM == null) return { empty: true };
  if (Number.isNaN(lengthM)) return fail("Check your numbers", "Enter a valid run length.");
  if (lengthM <= 0) return fail("Length must be positive", "Run length must be greater than 0.");

  if (mode === "posts" || mode === "bays") {
    const count = parseNumber(input.count);
    if (count == null) return { empty: true };
    if (Number.isNaN(count)) {
      return fail("Check your numbers", mode === "posts" ? "Enter a valid number of posts." : "Enter a valid number of bays.");
    }
    if (!isWhole(count)) {
      return fail("Whole posts/bays only", mode === "posts" ? "Enter a whole number of posts." : "Enter a whole number of bays.");
    }
    const whole = Math.round(count);
    if (mode === "posts") {
      if (whole < 2) return fail("Need at least 2 posts", "A run needs at least one bay (2 posts).");
      const posts = whole;
      const bays = posts - 1;
      return { lengthM, posts, bays, centresM: lengthM / bays, maxBayM: null };
    }
    if (whole < 1) return fail("Need at least 1 bay", "Enter 1 or more bays.");
    const bays = whole;
    return { lengthM, posts: bays + 1, bays, centresM: lengthM / bays, maxBayM: null };
  }

  const maxBayM = parseNumber(input.maxBayM);
  if (maxBayM == null) return { empty: true };
  if (Number.isNaN(maxBayM)) return fail("Check your numbers", "Enter a valid max bay.");
  if (maxBayM <= 0) return fail("Max bay must be positive", "Max bay / post centres must be greater than 0.");
  const spaced = postSpacing(lengthM, maxBayM);
  return { lengthM, posts: spaced.posts, bays: spaced.bays, centresM: spaced.centresM, maxBayM };
}

export function calculateColourbond(input) {
  const posts = resolvePosts(input);
  if (posts.empty) return { state: "empty" };
  if (posts.error) return posts;

  const coverMm = parseNumber(input.coverMm);
  if (coverMm == null) return { state: "empty" };
  if (Number.isNaN(coverMm)) return fail("Check your numbers", "Enter a valid panel cover width.");
  if (coverMm <= 0) return fail("Cover must be positive", "Panel cover width must be greater than 0.");

  const railsRaw = parseNumber(input.railsPerBay);
  if (railsRaw == null) return { state: "empty" };
  if (Number.isNaN(railsRaw) || !isWhole(railsRaw) || Math.round(railsRaw) < 1) {
    return fail("Rails per bay", "Enter a whole number of rails per bay (1 or more).");
  }
  const railsPerBay = Math.round(railsRaw);

  const heightRaw = parseNumber(input.heightMm);
  if (Number.isNaN(heightRaw)) return fail("Check your numbers", "Enter a valid fence height.");
  if (heightRaw != null && heightRaw <= 0) return fail("Height must be positive", "Fence height must be greater than 0.");
  const heightMm = heightRaw == null ? null : heightRaw;

  const timberPosts = !!input.timberPosts;
  let timberSizeMm = null;
  let clearM = null;
  let fixingsPerPost = 0;
  let fixingCount = 0;
  if (timberPosts) {
    const size = parseNumber(input.timberSizeMm);
    if (size == null || Number.isNaN(size) || size <= 0) {
      return fail("Timber size", "Enter a positive timber post size in mm (e.g. 100).");
    }
    timberSizeMm = size;
    clearM = clearOpeningM(posts.centresM, timberSizeMm);
    if (clearM <= 0) {
      return fail("Timber wider than bay", "Timber width must be less than equal centres (" + trimM(posts.centresM) + ").");
    }
    const fixRaw = parseNumber(input.fixingsPerPost);
    if (fixRaw == null || Number.isNaN(fixRaw) || fixRaw < 0) {
      return fail("Fixings", "Enter fixings per post (0 or more).");
    }
    if (!isWhole(fixRaw)) return fail("Fixings", "Enter a whole number of fixings per post.");
    fixingsPerPost = Math.round(fixRaw);
    fixingCount = fixingsPerPost * posts.posts;
  }

  const includeCaps = input.includeCaps !== false;
  const panels = Math.ceil(posts.lengthM / (coverMm / 1000));
  const railPieceM = timberPosts ? clearM : posts.centresM;

  let step = null;
  if (input.useStepDown) {
    const fallMm = parseNumber(input.fallMm);
    if (fallMm == null) {
      step = { pending: true };
    } else if (Number.isNaN(fallMm)) {
      return fail("Check your numbers", "Enter a valid total fall.");
    } else if (fallMm < 0) {
      return fail("Fall can’t be negative", "Total fall should be 0 or more (high end to low end).");
    } else {
      const core = stepDown(fallMm, posts.posts);
      let equal = null;
      if (input.equalPosts) {
        const postHeightMm = parseNumber(input.postHeightMm);
        if (postHeightMm == null || Number.isNaN(postHeightMm) || postHeightMm <= 0) {
          return fail("Post height above ground", "Enter a positive post height above ground in mm (e.g. 2100).");
        }
        equal = equalPostClearance(posts.posts, core.exactStepMm, core.roundedStepMm, postHeightMm);
      }
      step = { pending: false, ...core, equal };
    }
  }

  return {
    state: "ok",
    result: {
      kind: "colourbond",
      lengthM: posts.lengthM,
      heightMm,
      coverMm,
      posts: posts.posts,
      bays: posts.bays,
      centresM: posts.centresM,
      maxBayM: posts.maxBayM,
      timberPosts,
      timberSizeMm,
      clearM,
      panels,
      includeCaps,
      caps: includeCaps ? posts.posts : 0,
      fixingsPerPost,
      fixingCount,
      railsPerBay,
      railPieces: railsPerBay * posts.bays,
      railM: posts.lengthM * railsPerBay,
      railPieceM,
      step,
    },
  };
}

export function calculateTimber(input) {
  const lengthM = parseNumber(input.lengthM);
  if (lengthM == null) return { state: "empty" };
  if (Number.isNaN(lengthM)) return fail("Check your numbers", "Enter valid numbers for all fields.");

  const fields = [
    ["maxBayM", "max bay"],
    ["heightMm", "fence height"],
    ["postMm", "post size"],
    ["widthMm", "paling width"],
    ["lapMm", "lap"],
    ["rails", "rails per bay"],
    ["nailsPerRail", "nails per rail"],
  ];
  const parsed = { lengthM };
  for (const [key, label] of fields) {
    const value = parseNumber(input[key]);
    if (value == null) return fail("Missing " + label, "Enter a value for " + label + ".");
    if (Number.isNaN(value)) return fail("Check your numbers", "Enter valid numbers for all fields.");
    parsed[key] = value;
  }
  if ([lengthM, ...fields.map(([key]) => parsed[key])].some(Number.isNaN)) {
    return fail("Check your numbers", "Enter valid numbers for all fields.");
  }
  if (lengthM <= 0) return fail("Length must be positive", "Run length must be greater than 0.");
  if (parsed.maxBayM <= 0) return fail("Max bay must be positive", "Max bay / post centres must be greater than 0.");
  if (parsed.heightMm <= 0) return fail("Height must be positive", "Fence height must be greater than 0.");
  if (parsed.widthMm <= 0) return fail("Paling width", "Paling width must be greater than 0.");
  if (parsed.lapMm <= 0) return fail("Lap must be positive", "Enter the minimum lap each side (e.g. 25 mm).");
  if (parsed.widthMm - 2 * parsed.lapMm <= 0) {
    return fail(
      "Lap too big for paling width",
      "A " +
        trim1(parsed.widthMm) +
        " mm paling can’t lap " +
        trim1(parsed.lapMm) +
        " mm each side — that leaves no gap between back palings. Lap must be less than half the width (under " +
        trim1(parsed.widthMm / 2) +
        " mm).",
    );
  }
  if (!isWhole(parsed.rails) || Math.round(parsed.rails) < 1) {
    return fail("Rails per bay", "Enter a whole number of rails per bay (1 or more).");
  }
  if (!isWhole(parsed.nailsPerRail) || Math.round(parsed.nailsPerRail) < 0) {
    return fail("Nails", "Enter a whole number of nails per paling per rail (0 or more).");
  }
  if (parsed.postMm <= 0) return fail("Post size", "Enter a positive post size in mm (e.g. 100).");

  const rails = Math.round(parsed.rails);
  const nailsPerRail = Math.round(parsed.nailsPerRail);
  const gap = parsed.widthMm - 2 * parsed.lapMm;
  const advance = parsed.widthMm - parsed.lapMm;
  const pitch = 2 * advance;
  const spaced = postSpacing(lengthM, parsed.maxBayM);
  const runMm = 1000 * lengthM;
  const palings = runMm <= parsed.widthMm ? 1 : 1 + Math.ceil((runMm - parsed.widthMm) / advance - 1e-9);
  const back = Math.ceil(palings / 2);
  const front = palings - back;
  if (parsed.postMm / 1000 >= spaced.centresM) {
    return fail("Post wider than bay", "Post size must be less than the equal centres (" + trimM(spaced.centresM) + ").");
  }
  const plinth = !!input.plinth;
  return {
    state: "ok",
    result: {
      kind: "timber",
      lengthM,
      maxBayM: parsed.maxBayM,
      heightMm: parsed.heightMm,
      postMm: parsed.postMm,
      widthMm: parsed.widthMm,
      lapMm: parsed.lapMm,
      rails,
      nailsPerRail,
      plinth,
      gap,
      advance,
      pitch,
      bays: spaced.bays,
      centresM: spaced.centresM,
      posts: spaced.posts,
      palings,
      back,
      front,
      perMetre: 1000 / advance,
      perBay: (1000 * spaced.centresM) / advance,
      railPieces: rails * spaced.bays,
      railM: lengthM * rails,
      nails: palings * rails * nailsPerRail,
      plinthBoards: plinth ? spaced.bays : 0,
    },
  };
}

function trimM(metres) {
  return (
    Number(metres)
      .toFixed(3)
      .replace(/\.?0+$/, "") + " m"
  );
}

function trim1(n) {
  return Number(n)
    .toFixed(1)
    .replace(/\.?0+$/, "");
}

export function defaultColourbondInput() {
  return {
    lengthM: null,
    postMode: "maxbay",
    maxBayM: 2.4,
    count: null,
    heightMm: null,
    coverMm: null,
    railsPerBay: 2,
    includeCaps: true,
    timberPosts: false,
    timberSizeMm: 100,
    fixingsPerPost: 4,
    useStepDown: false,
    fallMm: null,
    equalPosts: false,
    postHeightMm: 2100,
  };
}

export function defaultTimberInput() {
  return {
    lengthM: null,
    maxBayM: 2.4,
    heightMm: 1800,
    postMm: 100,
    widthMm: 150,
    lapMm: 25,
    rails: 3,
    nailsPerRail: 2,
    plinth: false,
  };
}
