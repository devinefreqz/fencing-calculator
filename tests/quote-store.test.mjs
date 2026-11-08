import assert from "node:assert/strict";
import test from "node:test";
import { priceAmount, priceJob } from "../js/money.js";
import { formatAud } from "../js/format.js";
import {
  addRun,
  buildFictionalExample,
  createJob,
  duplicateJob,
  freshState,
  recalculateRun,
} from "../js/quote.js";
import { exportBackup, loadStore, mergeState, parseBackup, saveStore, STORAGE_KEY, validateState } from "../js/store.js";

function memoryStorage() {
  const mem = new Map();
  return {
    getItem(key) {
      return mem.has(key) ? mem.get(key) : null;
    },
    setItem(key, value) {
      if (memoryStorage.fail) {
        const error = new Error("quota exceeded");
        error.name = "QuotaExceededError";
        throw error;
      }
      mem.set(key, String(value));
    },
    removeItem(key) {
      mem.delete(key);
    },
  };
}

test("money rounds to cents and leaves blank rates out", () => {
  assert.deepEqual(priceAmount(1, null), { status: "missing", cents: null, rounded: false });
  assert.equal(priceAmount(1, 0).status, "zero");
  assert.equal(priceAmount(1, 0).cents, 0);
  const rounded = priceAmount(1, 0.015);
  assert.equal(rounded.cents, 2);
  assert.equal(rounded.rounded, true);
  assert.equal(formatAud(88000), "$880.00");
  assert.equal(formatAud(105), "$1.05");
});

test("GST stays off until the quote turns it on", () => {
  const state = freshState();
  const job = createJob(state);
  assert.equal(job.gstEnabled, false);
  const run = addRun(job, "timber");
  run.input.lengthM = 10;
  recalculateRun(run);
  run.rates.palings = 10;
  const off = priceJob(job);
  assert.equal(off.subtotalCents, 80000);
  assert.equal(off.gstCents, 0);
  assert.equal(off.totalCents, 80000);
  assert.equal(off.incomplete, true);
  for (const key of ["posts", "rails", "nails"]) run.rates[key] = 0;
  const zeros = priceJob(job);
  assert.equal(zeros.zeroCount, 3);
  assert.equal(zeros.totalCents, 80000);
  job.gstEnabled = true;
  job.gstPercent = 10;
  run.rates.posts = 1;
  run.rates.rails = 1;
  run.rates.nails = 1;
  const on = priceJob(job);
  const expected = 80000 + 6 * 100 + 15 * 100 + 480 * 100;
  assert.equal(on.subtotalCents, expected);
  assert.equal(on.gstCents, Math.round(expected * 0.1));
  assert.equal(on.totalCents, expected + on.gstCents);
  assert.equal(on.incomplete, false);
});

test("half-cent GST rounds half up", () => {
  const state = freshState();
  const job = createJob(state);
  job.gstEnabled = true;
  job.labour.push({ id: "lab-1", description: "Call out", qty: 1, unit: "each", rate: 1.05 });
  const priced = priceJob(job);
  assert.equal(priced.subtotalCents, 105);
  assert.equal(priced.gstCents, 11);
  assert.equal(priced.totalCents, 116);
});

test("each run keeps its own snapshot and diagram", () => {
  const state = freshState();
  const job = createJob(state);
  const rear = addRun(job, "timber");
  rear.name = "Rear";
  rear.input.lengthM = 10;
  recalculateRun(rear);
  const side = addRun(job, "colourbond");
  side.name = "Side";
  side.input.lengthM = 12;
  side.input.coverMm = 820;
  side.input.timberPosts = true;
  side.input.useStepDown = true;
  side.input.fallMm = 240;
  side.input.equalPosts = true;
  recalculateRun(side);
  const sideSvg = side.snapshot.diagrams.map((diagram) => diagram.body).join("|");
  const sidePalings = side.snapshot.result.panels;
  rear.input.lengthM = 22;
  rear.input.rails = 4;
  rear.rates.palings = 3;
  recalculateRun(rear);
  assert.equal(side.snapshot.diagrams.map((diagram) => diagram.body).join("|"), sideSvg);
  assert.equal(side.snapshot.result.panels, sidePalings);
  assert.equal(side.snapshot.input.lengthM, 12);
  assert.equal(rear.snapshot.result.palings > 80, true);
  assert.equal(rear.rates.palings, 3);
  assert.notEqual(rear.snapshot.input, rear.input);
  rear.input.lengthM = 1;
  assert.equal(rear.snapshot.input.lengthM, 22);

  const copy = duplicateJob(state, job.id);
  assert.notEqual(copy.id, job.id);
  assert.notEqual(copy.runs[0].id, job.runs[0].id);
  copy.runs[0].input.lengthM = 3;
  recalculateRun(copy.runs[0]);
  assert.equal(job.runs[0].snapshot.input.lengthM, 22);
  assert.equal(copy.gstEnabled, false);
});

test("backup round-trip and invalid imports", () => {
  const state = freshState();
  state.business.tradingName = "Sample Fencing Co (fictional)";
  const job = buildFictionalExample(state);
  const validated = validateState(state);
  assert.equal(validated.ok, true, (validated.errors || []).join("\n"));
  const exported = exportBackup(validated.state);
  assert.equal(exported.ok, true);
  const parsed = parseBackup(exported.json);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.state.jobs[0].reference, job.reference);
  assert.equal(parsed.state.jobs[0].runs[0].snapshot.result.palings, 80);
  assert.equal(parsed.state.jobs[0].runs[1].snapshot.diagrams.length >= 2, true);
  assert.equal(parsed.state.jobs[0].runs[0].checkedOnSite, true);
  assert.equal(parsed.state.jobs[0].runs[1].checkedOnSite, false);
  assert.equal(parsed.state.business.gstRegistered, false);

  assert.equal(parseBackup("not json").ok, false);
  assert.equal(parseBackup("[]").ok, false);
  assert.equal(parseBackup(JSON.stringify({ schemaVersion: 2, business: {}, jobs: [], enquiries: [] })).ok, false);
  const evil = structuredClone(parsed.state);
  evil.jobs[0].runs[0].kind = "barbed";
  assert.equal(validateState(evil).ok, false);
  const scripted = structuredClone(parsed.state);
  scripted.jobs[0].runs[0].snapshot.diagrams[0].body = "<script>alert(1)</script>";
  assert.equal(validateState(scripted).ok, false);
  const protoText = exported.json.replace('{\n  "schemaVersion"', '{\n  "__proto__": {"admin": true},\n  "schemaVersion"');
  assert.equal(parseBackup(protoText).ok, false);

  const enquiry = structuredClone(parsed.state);
  enquiry.enquiries.push({
    id: "enq-1",
    receivedAt: "2026-11-08T00:00:00.000Z",
    source: "future-form",
    status: "new",
    customer: { name: "Pat Example (fictional)", phone: "", email: "pat@example.com" },
    siteAddress: "2 Example Street, Sampletown VIC 3999",
    message: "Please quote the side fence.",
    linkedJobId: null,
  });
  assert.equal(validateState(enquiry).ok, true);
  enquiry.enquiries[0].status = "sent-email";
  assert.equal(validateState(enquiry).ok, false);

  const current = freshState();
  const other = createJob(current);
  other.customer.name = "Kept Local";
  const merged = mergeState(current, parsed.state);
  assert.equal(merged.ok, true);
  assert.equal(merged.added, 1);
  assert.equal(merged.state.jobs.some((item) => item.customer.name === "Kept Local"), true);
  assert.equal(merged.state.jobs.some((item) => item.id === job.id), true);
});

test("local save, reload, and storage failure", () => {
  globalThis.localStorage = memoryStorage();
  memoryStorage.fail = false;
  const state = freshState();
  const job = buildFictionalExample(state);
  job.customer.name = "<script>alert('x')</script>";
  const saved = saveStore(state);
  assert.equal(saved.ok, true);
  const loaded = loadStore();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.jobs[0].customer.name, "<script>alert('x')</script>");
  assert.equal(loaded.state.jobs[0].id, job.id);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).schemaVersion, 1);

  localStorage.setItem(STORAGE_KEY, "{");
  const corrupt = loadStore();
  assert.equal(corrupt.ok, false);
  assert.equal(corrupt.code, "corrupt");

  memoryStorage.fail = true;
  const blocked = saveStore(state);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "quota");
  memoryStorage.fail = false;
});
