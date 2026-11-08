/** Quote money in integer cents. Rates are dollars or null when not entered. */

export function priceAmount(qty, rate) {
  if (rate == null || rate === "") return { status: "missing", cents: null, rounded: false };
  const rateNum = typeof rate === "number" ? rate : Number(rate);
  const qtyNum = typeof qty === "number" ? qty : Number(qty);
  if (!Number.isFinite(rateNum) || rateNum < 0 || !Number.isFinite(qtyNum) || qtyNum < 0) {
    return { status: "invalid", cents: null, rounded: false };
  }
  const rawCents = qtyNum * rateNum * 100;
  const cents = Math.round(rawCents);
  return {
    status: rateNum === 0 ? "zero" : "priced",
    cents,
    rounded: Math.abs(rawCents - cents) > 1e-6,
  };
}

export function joinRates(lines, rates) {
  const book = rates && typeof rates === "object" ? rates : {};
  return lines.map((line) => {
    const rate = Object.prototype.hasOwnProperty.call(book, line.key) ? book[line.key] : null;
    return { ...line, rate, ...priceAmount(line.qty, rate) };
  });
}

function manualLines(items) {
  const out = [];
  for (const item of items || []) {
    const description = String(item.description || "");
    const hasText = description.trim().length > 0;
    const rateBlank = item.rate == null || item.rate === "";
    if (!hasText && rateBlank) continue;
    if (!hasText) {
      out.push({
        id: item.id,
        key: item.id,
        description: "",
        qty: item.qty,
        unit: item.unit || "each",
        rate: item.rate,
        status: "needs-description",
        cents: null,
        rounded: false,
      });
      continue;
    }
    out.push({
      id: item.id,
      key: item.id,
      description,
      qty: item.qty,
      unit: item.unit || "each",
      rate: item.rate,
      ...priceAmount(item.qty, item.rate),
    });
  }
  return out;
}

export function priceJob(job) {
  const groups = (job.runs || []).map((run) => {
    if (!run.snapshot || !run.snapshot.lines) {
      return { run, lines: [], skipped: true };
    }
    return { run, lines: joinRates(run.snapshot.lines, run.rates), skipped: false };
  });
  const labour = manualLines(job.labour);
  const extras = manualLines(job.extras);
  const all = [...groups.flatMap((group) => group.lines), ...labour, ...extras];
  const counted = all.filter((line) => line.status === "priced" || line.status === "zero");
  const subtotalCents = counted.reduce((sum, line) => sum + line.cents, 0);
  let gstCents = 0;
  if (job.gstEnabled) {
    const basisPoints = Math.round(Number(job.gstPercent) * 100);
    gstCents = Math.round((subtotalCents * basisPoints) / 10000);
  }
  const missingCount = all.filter((line) => line.status === "missing" || line.status === "invalid").length;
  const needsDescription = all.filter((line) => line.status === "needs-description").length;
  const zeroCount = counted.filter((line) => line.status === "zero").length;
  const skippedRuns = groups.filter((group) => group.skipped).length;
  return {
    groups,
    labour,
    extras,
    subtotalCents,
    gstCents,
    totalCents: subtotalCents + gstCents,
    missingCount,
    needsDescription,
    zeroCount,
    skippedRuns,
    anyRounded: counted.some((line) => line.rounded),
    incomplete: missingCount > 0 || needsDescription > 0 || zeroCount > 0 || skippedRuns > 0,
  };
}
