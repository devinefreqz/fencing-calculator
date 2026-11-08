/**
 * Device-only JSON store. Nothing is uploaded.
 * Backups are schema-checked before they replace or merge local quotes.
 */
import { freshState } from "./quote.js";

export const STORAGE_KEY = "fencing-quotes.v1";
export const MAX_BACKUP_CHARS = 5_000_000;

const STATUSES = new Set(["draft", "ready", "accepted", "declined", "completed"]);
const ENQUIRY_STATUSES = new Set(["new", "reviewed", "converted", "dismissed"]);
const KINDS = new Set(["colourbond", "timber"]);
const ID_RE = /^[A-Za-z0-9._:-]{1,80}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function badKeys(value) {
  if (!isObject(value)) return false;
  return Object.keys(value).some((key) => key === "__proto__" || key === "prototype" || key === "constructor");
}

export function asString(value, max, path, errors) {
  if (typeof value !== "string" || value.includes("\u0000") || value.length > max) {
    errors.push(path + " must be text up to " + max + " characters.");
    return "";
  }
  return value;
}

function asBool(value, path, errors) {
  if (typeof value !== "boolean") {
    errors.push(path + " must be true or false.");
    return false;
  }
  return value;
}

function asNumber(value, path, errors, { min, max, integer } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(path + " must be a finite number.");
    return null;
  }
  if (min != null && value < min) errors.push(path + " is below " + min + ".");
  if (max != null && value > max) errors.push(path + " is above " + max + ".");
  if (integer && Math.abs(value - Math.round(value)) > 1e-9) errors.push(path + " must be a whole number.");
  return value;
}

function asNullableNumber(value, path, errors, opts) {
  if (value == null) return null;
  return asNumber(value, path, errors, opts);
}

function asId(value, path, errors) {
  if (typeof value !== "string" || !ID_RE.test(value)) {
    errors.push(path + " has an invalid id.");
    return "";
  }
  return value;
}

function pushLimit(list, max, path, errors) {
  if (!Array.isArray(list)) {
    errors.push(path + " must be a list.");
    return [];
  }
  if (list.length > max) errors.push(path + " has too many items (max " + max + ").");
  return list;
}

function normaliseBusiness(raw, errors) {
  if (!isObject(raw) || badKeys(raw)) {
    errors.push("business details are missing or not an object.");
    return freshState().business;
  }
  const gstPercent = asNumber(raw.gstPercent, "business.gstPercent", errors, { min: 0, max: 100 });
  const nextNumber = asNumber(raw.nextNumber, "business.nextNumber", errors, { min: 1, max: 1000000, integer: true });
  return {
    tradingName: asString(raw.tradingName, 200, "business.tradingName", errors),
    contactLines: asString(raw.contactLines, 2000, "business.contactLines", errors),
    abn: asString(raw.abn, 20, "business.abn", errors),
    inclusions: asString(raw.inclusions, 4000, "business.inclusions", errors),
    exclusions: asString(raw.exclusions, 4000, "business.exclusions", errors),
    quotePrefix: asString(raw.quotePrefix, 12, "business.quotePrefix", errors) || "Q",
    nextNumber: nextNumber == null ? 1 : Math.round(nextNumber),
    gstRegistered: asBool(raw.gstRegistered, "business.gstRegistered", errors),
    gstPercent: gstPercent == null ? 10 : gstPercent,
  };
}

function normaliseCustomer(raw, path, errors) {
  if (!isObject(raw) || badKeys(raw)) {
    errors.push(path + " is missing.");
    return { name: "", phone: "", email: "", siteAddress: "" };
  }
  return {
    name: asString(raw.name, 200, path + ".name", errors),
    phone: asString(raw.phone, 80, path + ".phone", errors),
    email: asString(raw.email, 200, path + ".email", errors),
    siteAddress: asString(raw.siteAddress, 400, path + ".siteAddress", errors),
  };
}

function normaliseSync(raw, path, errors) {
  if (!isObject(raw) || badKeys(raw)) {
    errors.push(path + " is missing.");
    return { status: "device-only", remoteId: null, enquiryId: null };
  }
  if (raw.status !== "device-only") errors.push(path + ".status must be device-only in this version.");
  const remoteId = raw.remoteId == null ? null : asId(raw.remoteId, path + ".remoteId", errors);
  const enquiryId = raw.enquiryId == null ? null : asId(raw.enquiryId, path + ".enquiryId", errors);
  return { status: "device-only", remoteId, enquiryId };
}

function normaliseInput(kind, raw, path, errors) {
  if (!isObject(raw) || badKeys(raw)) {
    errors.push(path + " is missing.");
    return {};
  }
  if (kind === "timber") {
    return {
      lengthM: asNullableNumber(raw.lengthM, path + ".lengthM", errors, { min: 0, max: 100000 }),
      maxBayM: asNullableNumber(raw.maxBayM, path + ".maxBayM", errors, { min: 0, max: 1000 }),
      heightMm: asNullableNumber(raw.heightMm, path + ".heightMm", errors, { min: 0, max: 10000 }),
      postMm: asNullableNumber(raw.postMm, path + ".postMm", errors, { min: 0, max: 1000 }),
      widthMm: asNullableNumber(raw.widthMm, path + ".widthMm", errors, { min: 0, max: 1000 }),
      lapMm: asNullableNumber(raw.lapMm, path + ".lapMm", errors, { min: 0, max: 500 }),
      rails: asNullableNumber(raw.rails, path + ".rails", errors, { min: 0, max: 20 }),
      nailsPerRail: asNullableNumber(raw.nailsPerRail, path + ".nailsPerRail", errors, { min: 0, max: 20 }),
      plinth: asBool(raw.plinth, path + ".plinth", errors),
    };
  }
  const mode = raw.postMode;
  if (mode !== "maxbay" && mode !== "posts" && mode !== "bays") errors.push(path + ".postMode is invalid.");
  return {
    lengthM: asNullableNumber(raw.lengthM, path + ".lengthM", errors, { min: 0, max: 100000 }),
    postMode: mode === "posts" || mode === "bays" ? mode : "maxbay",
    maxBayM: asNullableNumber(raw.maxBayM, path + ".maxBayM", errors, { min: 0, max: 1000 }),
    count: asNullableNumber(raw.count, path + ".count", errors, { min: 0, max: 10000 }),
    heightMm: asNullableNumber(raw.heightMm, path + ".heightMm", errors, { min: 0, max: 10000 }),
    coverMm: asNullableNumber(raw.coverMm, path + ".coverMm", errors, { min: 0, max: 5000 }),
    railsPerBay: asNullableNumber(raw.railsPerBay, path + ".railsPerBay", errors, { min: 0, max: 20 }),
    includeCaps: asBool(raw.includeCaps, path + ".includeCaps", errors),
    timberPosts: asBool(raw.timberPosts, path + ".timberPosts", errors),
    timberSizeMm: asNullableNumber(raw.timberSizeMm, path + ".timberSizeMm", errors, { min: 0, max: 1000 }),
    fixingsPerPost: asNullableNumber(raw.fixingsPerPost, path + ".fixingsPerPost", errors, { min: 0, max: 100 }),
    useStepDown: asBool(raw.useStepDown, path + ".useStepDown", errors),
    fallMm: asNullableNumber(raw.fallMm, path + ".fallMm", errors, { min: 0, max: 100000 }),
    equalPosts: asBool(raw.equalPosts, path + ".equalPosts", errors),
    postHeightMm: asNullableNumber(raw.postHeightMm, path + ".postHeightMm", errors, { min: 0, max: 10000 }),
  };
}

function normaliseRates(raw, path, errors) {
  if (!isObject(raw) || badKeys(raw)) {
    errors.push(path + " is missing.");
    return {};
  }
  const rates = {};
  const keys = Object.keys(raw);
  if (keys.length > 40) errors.push(path + " has too many rates.");
  for (const key of keys) {
    if (!/^[a-z0-9-]{1,40}$/.test(key)) {
      errors.push(path + " has an invalid rate name.");
      continue;
    }
    rates[key] = asNullableNumber(raw[key], path + "." + key, errors, { min: 0, max: 1000000 });
  }
  return rates;
}

function normaliseDiagram(raw, path, errors) {
  if (!isObject(raw) || badKeys(raw)) {
    errors.push(path + " is missing.");
    return null;
  }
  const id = asString(raw.id, 40, path + ".id", errors);
  const viewBox = asString(raw.viewBox, 80, path + ".viewBox", errors);
  const caption = asString(raw.caption, 500, path + ".caption", errors);
  const body = asString(raw.body, 100000, path + ".body", errors);
  if (/<\s*(script|foreignObject|iframe|object|embed|image|use|style|a)\b|on\w+\s*=|javascript:/i.test(body)) {
    errors.push(path + " contains markup that cannot be stored.");
  }
  if (!/^[\d.\s-]+$/.test(viewBox)) errors.push(path + " viewBox is invalid.");
  return { id, viewBox, caption, body };
}

function normaliseSnapshot(raw, path, kind, errors) {
  if (raw == null) return null;
  if (!isObject(raw) || badKeys(raw)) {
    errors.push(path + " is invalid.");
    return null;
  }
  const capturedAt = asString(raw.capturedAt, 40, path + ".capturedAt", errors);
  if (Number.isNaN(Date.parse(capturedAt))) errors.push(path + ".capturedAt is not a date.");
  if (!isObject(raw.result) || badKeys(raw.result)) errors.push(path + ".result is missing.");
  else {
    let resultJson = "";
    try {
      resultJson = JSON.stringify(raw.result);
    } catch {
      errors.push(path + ".result could not be stored.");
    }
    if (resultJson.length > 50000 || /__proto__|<\s*script/i.test(resultJson)) {
      errors.push(path + ".result is not a safe calculator snapshot.");
    }
  }
  const diagramsIn = pushLimit(raw.diagrams, 4, path + ".diagrams", errors);
  const diagrams = diagramsIn.slice(0, 4).map((diagram, i) => normaliseDiagram(diagram, path + ".diagrams[" + i + "]", errors)).filter(Boolean);
  const linesIn = pushLimit(raw.lines, 30, path + ".lines", errors);
  const lines = linesIn.slice(0, 30).map((line, i) => {
    const linePath = path + ".lines[" + i + "]";
    if (!isObject(line) || badKeys(line)) {
      errors.push(linePath + " is invalid.");
      return null;
    }
    return {
      key: asString(line.key, 40, linePath + ".key", errors),
      description: asString(line.description, 300, linePath + ".description", errors),
      qty: asNumber(line.qty, linePath + ".qty", errors, { min: 0, max: 1000000 }),
      unit: asString(line.unit, 20, linePath + ".unit", errors),
    };
  }).filter(Boolean);
  return {
    capturedAt,
    input: normaliseInput(kind, raw.input, path + ".input", errors),
    result: raw.result,
    diagrams,
    lines,
  };
}

function normaliseRun(raw, path, errors) {
  if (!isObject(raw) || badKeys(raw)) {
    errors.push(path + " is invalid.");
    return null;
  }
  const kind = KINDS.has(raw.kind) ? raw.kind : null;
  if (!kind) errors.push(path + ".kind must be colourbond or timber.");
  return {
    id: asId(raw.id, path + ".id", errors),
    kind: kind || "colourbond",
    name: asString(raw.name, 120, path + ".name", errors),
    checkedOnSite: asBool(raw.checkedOnSite, path + ".checkedOnSite", errors),
    input: normaliseInput(kind || "colourbond", raw.input, path + ".input", errors),
    rates: normaliseRates(raw.rates, path + ".rates", errors),
    snapshot: normaliseSnapshot(raw.snapshot, path + ".snapshot", kind || "colourbond", errors),
    error: null,
  };
}

function normaliseManual(raw, path, errors) {
  if (!isObject(raw) || badKeys(raw)) {
    errors.push(path + " is invalid.");
    return null;
  }
  return {
    id: asId(raw.id, path + ".id", errors),
    description: asString(raw.description, 300, path + ".description", errors),
    qty: asNumber(raw.qty, path + ".qty", errors, { min: 0, max: 100000 }),
    unit: asString(raw.unit, 20, path + ".unit", errors),
    rate: asNullableNumber(raw.rate, path + ".rate", errors, { min: 0, max: 1000000 }),
  };
}

function normaliseJob(raw, path, errors, seen) {
  if (!isObject(raw) || badKeys(raw)) {
    errors.push(path + " is invalid.");
    return null;
  }
  const id = asId(raw.id, path + ".id", errors);
  if (id && seen.has(id)) errors.push(path + " duplicates id " + id + ".");
  if (id) seen.add(id);
  if (!STATUSES.has(raw.status)) errors.push(path + ".status is not a known status.");
  const quoteDate = asString(raw.quoteDate, 10, path + ".quoteDate", errors);
  if (!DATE_RE.test(quoteDate) || Number.isNaN(Date.parse(quoteDate + "T00:00:00"))) {
    errors.push(path + ".quoteDate must be YYYY-MM-DD.");
  }
  for (const key of ["createdAt", "updatedAt"]) {
    const value = asString(raw[key], 40, path + "." + key, errors);
    if (Number.isNaN(Date.parse(value))) errors.push(path + "." + key + " is not a date.");
  }
  const runsIn = pushLimit(raw.runs, 30, path + ".runs", errors);
  const labourIn = pushLimit(raw.labour, 40, path + ".labour", errors);
  const extrasIn = pushLimit(raw.extras, 40, path + ".extras", errors);
  const runSeen = new Set();
  return {
    id,
    reference: asString(raw.reference, 40, path + ".reference", errors),
    status: STATUSES.has(raw.status) ? raw.status : "draft",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    quoteDate,
    fictional: asBool(raw.fictional, path + ".fictional", errors),
    customer: normaliseCustomer(raw.customer, path + ".customer", errors),
    jobTitle: asString(raw.jobTitle, 200, path + ".jobTitle", errors),
    internalNotes: asString(raw.internalNotes, 8000, path + ".internalNotes", errors),
    customerNotes: asString(raw.customerNotes, 8000, path + ".customerNotes", errors),
    inclusions: asString(raw.inclusions, 4000, path + ".inclusions", errors),
    exclusions: asString(raw.exclusions, 4000, path + ".exclusions", errors),
    gstEnabled: asBool(raw.gstEnabled, path + ".gstEnabled", errors),
    gstPercent: asNumber(raw.gstPercent, path + ".gstPercent", errors, { min: 0, max: 100 }) ?? 10,
    runs: runsIn.slice(0, 30).map((run, i) => normaliseRun(run, path + ".runs[" + i + "]", errors)).filter(Boolean).map((run) => {
      if (run.id && runSeen.has(run.id)) errors.push(path + " has a duplicate run id.");
      runSeen.add(run.id);
      return run;
    }),
    labour: labourIn.slice(0, 40).map((line, i) => normaliseManual(line, path + ".labour[" + i + "]", errors)).filter(Boolean),
    extras: extrasIn.slice(0, 40).map((line, i) => normaliseManual(line, path + ".extras[" + i + "]", errors)).filter(Boolean),
    sync: normaliseSync(raw.sync, path + ".sync", errors),
    origin: raw.origin === "enquiry" ? "enquiry" : raw.origin === "local" ? "local" : (errors.push(path + ".origin is invalid."), "local"),
  };
}

function normaliseEnquiry(raw, path, errors) {
  if (!isObject(raw) || badKeys(raw)) {
    errors.push(path + " is invalid.");
    return null;
  }
  if (!ENQUIRY_STATUSES.has(raw.status)) errors.push(path + ".status is invalid.");
  const receivedAt = asString(raw.receivedAt, 40, path + ".receivedAt", errors);
  if (Number.isNaN(Date.parse(receivedAt))) errors.push(path + ".receivedAt is not a date.");
  return {
    id: asId(raw.id, path + ".id", errors),
    receivedAt,
    source: asString(raw.source, 80, path + ".source", errors),
    status: ENQUIRY_STATUSES.has(raw.status) ? raw.status : "new",
    customer: {
      name: asString(raw.customer && raw.customer.name, 200, path + ".customer.name", errors),
      phone: asString(raw.customer && raw.customer.phone, 80, path + ".customer.phone", errors),
      email: asString(raw.customer && raw.customer.email, 200, path + ".customer.email", errors),
    },
    siteAddress: asString(raw.siteAddress, 400, path + ".siteAddress", errors),
    message: asString(raw.message, 8000, path + ".message", errors),
    linkedJobId: raw.linkedJobId == null ? null : asId(raw.linkedJobId, path + ".linkedJobId", errors),
  };
}

export function validateState(data) {
  const errors = [];
  if (!isObject(data) || badKeys(data)) return { ok: false, errors: ["Backup must be a JSON object."] };
  if (data.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  const business = normaliseBusiness(data.business, errors);
  const jobsIn = pushLimit(data.jobs, 200, "jobs", errors);
  const enquiriesIn = pushLimit(data.enquiries, 200, "enquiries", errors);
  const seen = new Set();
  const jobs = jobsIn.slice(0, 200).map((job, i) => normaliseJob(job, "jobs[" + i + "]", errors, seen)).filter(Boolean);
  const enquiries = enquiriesIn.slice(0, 200).map((item, i) => normaliseEnquiry(item, "enquiries[" + i + "]", errors)).filter(Boolean);
  if (errors.length) return { ok: false, errors: errors.slice(0, 12) };
  return { ok: true, state: { schemaVersion: 1, business, jobs, enquiries } };
}

function storage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function loadStore() {
  const bin = storage();
  if (!bin) return { ok: false, code: "unavailable", message: "This browser has no local storage. Quotes cannot be kept." };
  let raw;
  try {
    raw = bin.getItem(STORAGE_KEY);
  } catch {
    return { ok: false, code: "unavailable", message: "Local storage is blocked. Quotes cannot be kept on this device." };
  }
  if (raw == null || raw === "") return { ok: true, empty: true, state: freshState() };
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      code: "corrupt",
      message: "Saved quotes on this device could not be read. They are still stored. Download the raw backup or erase them before saving new quotes.",
      raw,
    };
  }
  const validated = validateState(data);
  if (!validated.ok) {
    return {
      ok: false,
      code: "invalid",
      message: "Saved quotes on this device don’t match this app. Download the raw backup or erase them before saving new quotes.",
      errors: validated.errors,
      raw,
    };
  }
  return { ok: true, empty: false, state: validated.state };
}

export function saveStore(state) {
  const validated = validateState(state);
  if (!validated.ok) return { ok: false, code: "invalid", message: "Couldn’t save on this device. " + (validated.errors[0] || "The quote failed a safety check."), errors: validated.errors };
  const bin = storage();
  if (!bin) return { ok: false, code: "unavailable", message: "This browser has no local storage." };
  try {
    bin.setItem(STORAGE_KEY, JSON.stringify(validated.state));
    return { ok: true, state: validated.state };
  } catch (error) {
    const quota = /quota|exceeded/i.test(String(error && error.name) + " " + String(error && error.message));
    return {
      ok: false,
      code: quota ? "quota" : "blocked",
      message: quota
        ? "This device is out of room for saved quotes. Export a backup, then delete an old quote."
        : "Couldn’t save quotes on this device. Export a backup before you leave this page.",
    };
  }
}

export function exportBackup(state) {
  const validated = validateState(state);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  return {
    ok: true,
    filename: "fencing-quotes-backup-" + new Date().toISOString().slice(0, 10) + ".json",
    json: JSON.stringify(validated.state, null, 2),
  };
}

export function parseBackup(text) {
  if (typeof text !== "string" || text.trim() === "") return { ok: false, errors: ["That file is empty."] };
  if (text.length > MAX_BACKUP_CHARS) return { ok: false, errors: ["That backup is larger than 5 MB."] };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["That file is not valid JSON."] };
  }
  return validateState(data);
}

export function mergeState(current, incoming) {
  const base = validateState(current);
  const next = validateState(incoming);
  if (!base.ok) return base;
  if (!next.ok) return next;
  const ids = new Set(base.state.jobs.map((job) => job.id));
  const jobs = base.state.jobs.slice();
  let added = 0;
  for (const job of next.state.jobs) {
    if (ids.has(job.id)) continue;
    jobs.unshift(job);
    ids.add(job.id);
    added += 1;
  }
  const enquiryIds = new Set(base.state.enquiries.map((item) => item.id));
  const enquiries = base.state.enquiries.slice();
  for (const item of next.state.enquiries) {
    if (enquiryIds.has(item.id)) continue;
    enquiries.push(item);
    enquiryIds.add(item.id);
  }
  const business = { ...base.state.business };
  business.nextNumber = Math.max(business.nextNumber || 1, next.state.business.nextNumber || 1);
  return { ok: true, added, state: { schemaVersion: 1, business, jobs, enquiries } };
}
