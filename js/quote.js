/**
 * Local quote records. Calculator inputs and diagrams are copied onto each run
 * so a later edit to another run, or to the standalone calculators, cannot change them.
 * Records include a sync stub for a later backend. This version never sends them.
 */
import { calculateColourbond, calculateTimber, defaultColourbondInput, defaultTimberInput } from "./calc.js";
import { spacingDiagram, stepDownDiagram, timberDiagram } from "./diagrams.js";
import { formatM, formatMm, todayISO } from "./format.js";

export const STATUSES = [
  { id: "draft", label: "Draft" },
  { id: "ready", label: "Ready" },
  { id: "accepted", label: "Accepted" },
  { id: "declined", label: "Declined" },
  { id: "completed", label: "Completed" },
];

export function newId() {
  if (globalThis.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export function blankBusiness() {
  return {
    tradingName: "",
    contactLines: "",
    abn: "",
    inclusions: "",
    exclusions: "",
    quotePrefix: "Q",
    nextNumber: 1,
    gstRegistered: false,
    gstPercent: 10,
  };
}

export function freshState() {
  return {
    schemaVersion: 1,
    business: blankBusiness(),
    jobs: [],
    enquiries: [],
  };
}

function stamp() {
  return new Date().toISOString();
}

export function blankJob(business, date) {
  const now = stamp();
  const gst = !!(business && business.gstRegistered);
  return {
    id: newId(),
    reference: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    quoteDate: todayISO(date ? new Date(date) : new Date()),
    fictional: false,
    customer: { name: "", phone: "", email: "", siteAddress: "" },
    jobTitle: "",
    internalNotes: "",
    customerNotes: "",
    inclusions: business && business.inclusions ? business.inclusions : "",
    exclusions: business && business.exclusions ? business.exclusions : "",
    gstEnabled: gst,
    gstPercent: business && Number.isFinite(business.gstPercent) ? business.gstPercent : 10,
    runs: [],
    labour: [],
    extras: [],
    sync: { status: "device-only", remoteId: null, enquiryId: null },
    origin: "local",
  };
}

export function allocateReference(state) {
  const prefix = String(state.business.quotePrefix || "Q").trim() || "Q";
  const n = Math.max(1, Math.round(state.business.nextNumber || 1));
  state.business.nextNumber = n + 1;
  return prefix + "-" + String(n).padStart(4, "0");
}

export function createJob(state, date) {
  const job = blankJob(state.business, date);
  job.reference = allocateReference(state);
  state.jobs.unshift(job);
  return job;
}

function clone(value) {
  return structuredClone(value);
}

export function duplicateJob(state, jobId) {
  const source = state.jobs.find((job) => job.id === jobId);
  if (!source) return null;
  const copy = clone(source);
  const now = stamp();
  copy.id = newId();
  copy.reference = allocateReference(state);
  copy.status = "draft";
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.quoteDate = todayISO();
  copy.sync = { status: "device-only", remoteId: null, enquiryId: null };
  copy.origin = "local";
  copy.jobTitle = copy.jobTitle ? copy.jobTitle + " (copy)" : "";
  for (const run of copy.runs) run.id = newId();
  for (const line of copy.labour) line.id = newId();
  for (const line of copy.extras) line.id = newId();
  state.jobs.unshift(copy);
  return copy;
}

export function deleteJob(state, jobId) {
  const before = state.jobs.length;
  state.jobs = state.jobs.filter((job) => job.id !== jobId);
  return state.jobs.length !== before;
}

export function blankRun(kind) {
  const timber = kind === "timber";
  return {
    id: newId(),
    kind: timber ? "timber" : "colourbond",
    name: timber ? "Timber paling" : "Colourbond",
    checkedOnSite: false,
    input: timber ? defaultTimberInput() : defaultColourbondInput(),
    rates: {},
    snapshot: null,
    error: null,
  };
}

export function colourbondLines(input, result) {
  const height = result.heightMm ? ", " + Math.round(result.heightMm) + " mm high" : "";
  const lines = [
    {
      key: "panels",
      description: "Colourbond panels" + height,
      qty: result.panels,
      unit: "panel",
    },
  ];
  if (result.timberPosts) {
    const size = Math.round(result.timberSizeMm);
    lines.push({
      key: "timber-posts",
      description: "Timber posts " + size + "×" + size + " mm",
      qty: result.posts,
      unit: "post",
    });
    lines.push({
      key: "colourbond-posts",
      description: "Colourbond posts on timber",
      qty: result.posts,
      unit: "post",
    });
    if (result.fixingCount > 0) {
      lines.push({
        key: "fixings",
        description: "Timber-to-steel fixings",
        qty: result.fixingCount,
        unit: "each",
      });
    }
  } else {
    lines.push({
      key: "posts",
      description: "Colourbond posts",
      qty: result.posts,
      unit: "post",
    });
  }
  if (result.includeCaps) {
    lines.push({ key: "caps", description: "Post caps", qty: result.caps, unit: "cap" });
  }
  lines.push({
    key: "rails",
    description:
      "Rails (" +
      result.railsPerBay +
      " per bay, about " +
      formatM(result.railPieceM, 3) +
      " each)",
    qty: result.railPieces,
    unit: "length",
  });
  return lines;
}

export function timberLines(result) {
  const lines = [
    {
      key: "palings",
      description:
        "Palings " +
        trim(result.widthMm) +
        " mm × " +
        Math.round(result.heightMm) +
        " mm (" +
        result.back +
        " back + " +
        result.front +
        " front)",
      qty: result.palings,
      unit: "paling",
    },
    {
      key: "posts",
      description: "Timber posts " + Math.round(result.postMm) + "×" + Math.round(result.postMm) + " mm",
      qty: result.posts,
      unit: "post",
    },
    {
      key: "rails",
      description:
        "Rails (" + result.rails + " per bay, about " + formatM(result.centresM, 3) + " each)",
      qty: result.railPieces,
      unit: "length",
    },
  ];
  if (result.nailsPerRail > 0) {
    lines.push({
      key: "nails",
      description: "Nails (" + result.nailsPerRail + " per paling per rail)",
      qty: result.nails,
      unit: "nail",
    });
  }
  if (result.plinth) {
    lines.push({
      key: "plinth",
      description: "Plinth boards (1 per bay)",
      qty: result.plinthBoards,
      unit: "board",
    });
  }
  return lines;
}

function trim(n) {
  return Number(n)
    .toFixed(1)
    .replace(/\.?0+$/, "");
}

export function diagramsFor(run, input, result) {
  if (result.kind === "timber") return [timberDiagram(input, result, run.id)];
  const diagrams = [
    spacingDiagram({
      posts: result.posts,
      lengthM: result.lengthM,
      centresM: result.centresM,
      timber: result.timberPosts,
    }),
  ];
  if (result.step && !result.step.pending) {
    diagrams.unshift(
      stepDownDiagram({
        posts: result.posts,
        roundedStepMm: result.step.roundedStepMm,
        fallMm: result.step.fallMm,
        timberWidthMm: result.timberPosts ? result.timberSizeMm : null,
        equal: result.step.equal,
      }),
    );
  }
  return diagrams;
}

export function recalculateRun(run) {
  const input = clone(run.input);
  const outcome = run.kind === "timber" ? calculateTimber(input) : calculateColourbond(input);
  if (outcome.state === "empty") {
    run.error = null;
    run.snapshot = null;
    return run;
  }
  if (outcome.state === "error") {
    run.error = outcome.error;
    run.snapshot = null;
    return run;
  }
  run.error = null;
  const lines = run.kind === "timber" ? timberLines(outcome.result) : colourbondLines(input, outcome.result);
  run.snapshot = {
    capturedAt: stamp(),
    input,
    result: clone(outcome.result),
    diagrams: diagramsFor(run, input, outcome.result),
    lines,
  };
  return run;
}

export function addRun(job, kind) {
  const run = blankRun(kind);
  job.runs.push(run);
  job.updatedAt = stamp();
  return run;
}

export function duplicateRun(job, runId) {
  const source = job.runs.find((run) => run.id === runId);
  if (!source) return null;
  const copy = clone(source);
  copy.id = newId();
  copy.name = copy.name ? copy.name + " copy" : "Run copy";
  if (copy.snapshot && copy.snapshot.diagrams) {
    copy.snapshot = clone(copy.snapshot);
    for (const diagram of copy.snapshot.diagrams) {
      if (diagram.body) diagram.body = diagram.body.replaceAll(source.id, copy.id);
    }
  }
  const index = job.runs.findIndex((run) => run.id === runId);
  job.runs.splice(index + 1, 0, copy);
  job.updatedAt = stamp();
  return copy;
}

export function removeRun(job, runId) {
  job.runs = job.runs.filter((run) => run.id !== runId);
  job.updatedAt = stamp();
}

export function blankManual(unit) {
  return { id: newId(), description: "", qty: 1, unit, rate: null };
}

export function runSummary(run) {
  const snap = run.snapshot;
  if (!snap) return run.error ? run.error.message : "Enter the measurements to calculate this run.";
  const result = snap.result;
  if (result.kind === "timber") {
    return (
      formatM(result.lengthM, 3) +
      " · " +
      result.posts +
      " posts · " +
      result.bays +
      " bays @ " +
      formatM(result.centresM, 3) +
      " · " +
      result.palings +
      " palings · back gap " +
      trim(result.gap) +
      " mm"
    );
  }
  let text =
    formatM(result.lengthM, 3) +
    " · " +
    result.posts +
    " posts · " +
    result.bays +
    " bays @ " +
    formatM(result.centresM, 3) +
    " · " +
    result.panels +
    " panels";
  if (result.timberPosts && result.clearM != null) text += " · clear " + formatM(result.clearM, 3);
  if (result.step && !result.step.pending) text += " · step " + formatMm(result.step.roundedStepMm);
  return text;
}

export function measurementNote(run) {
  if (run.checkedOnSite) return { unverified: false, text: "Measurements checked on site." };
  return {
    unverified: true,
    text: "Customer-supplied measurements — not verified on site.",
  };
}

/** Obvious made-up job for layout checks. Rates stay blank. */
export function buildFictionalExample(state) {
  const job = createJob(state);
  job.fictional = true;
  job.jobTitle = "Side and rear fences";
  job.customer = {
    name: "Alex Example (fictional)",
    phone: "0400 000 000",
    email: "alex@example.com",
    siteAddress: "1 Example Street, Sampletown VIC 3999",
  };
  job.customerNotes = "Fictional sample only. These are not a real customer’s measurements.";
  job.inclusions = "Supply and install the runs described in this sample quote.";
  job.exclusions = "Concrete, gates, and making good of garden beds are not in this sample.";
  job.internalNotes = "Internal only — do not put cost notes on the customer sheet. This sentence must not appear on the print.";
  if (!state.business.tradingName) {
    state.business.tradingName = "Sample Fencing Co (fictional)";
    state.business.contactLines = "Example Road, Sampletown VIC 3999\n0400 000 000\nquotes@example.com";
  }

  const timber = addRun(job, "timber");
  timber.name = "Rear boundary";
  timber.input = {
    ...defaultTimberInput(),
    lengthM: 10,
    maxBayM: 2.4,
    heightMm: 1800,
    postMm: 100,
    widthMm: 150,
    lapMm: 25,
    rails: 3,
    nailsPerRail: 2,
    plinth: false,
  };
  recalculateRun(timber);

  const colour = addRun(job, "colourbond");
  colour.name = "Side boundary";
  colour.input = {
    ...defaultColourbondInput(),
    lengthM: 12,
    postMode: "maxbay",
    maxBayM: 2.4,
    heightMm: 1800,
    coverMm: 820,
    railsPerBay: 2,
    includeCaps: true,
    timberPosts: true,
    timberSizeMm: 100,
    fixingsPerPost: 4,
    useStepDown: true,
    fallMm: 240,
    equalPosts: true,
    postHeightMm: 2100,
  };
  colour.checkedOnSite = false;
  timber.checkedOnSite = true;
  recalculateRun(colour);

  job.labour.push({ id: newId(), description: "Install labour (fictional)", qty: 8, unit: "hr", rate: null });
  job.extras.push({ id: newId(), description: "Gate (fictional, not priced)", qty: 1, unit: "each", rate: null });
  return job;
}
