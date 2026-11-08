import { equalPostCopy, parseNumber, stepRoundingCopy } from "./calc.js";
import { mountSvg } from "./diagrams.js";
import { el } from "./dom.js";
import { formatAud, formatDisplayDate, formatPercent, formatQty, todayISO } from "./format.js";
import { priceAmount, priceJob } from "./money.js";
import {
  STATUSES,
  addRun,
  blankManual,
  buildFictionalExample,
  createJob,
  deleteJob,
  duplicateJob,
  duplicateRun,
  measurementNote,
  recalculateRun,
  removeRun,
  runSummary,
} from "./quote.js";
import { exportBackup, loadStore, mergeState, parseBackup, saveStore } from "./store.js";

const LIMITS = {
  name: 200,
  phone: 80,
  email: 200,
  site: 400,
  title: 200,
  notes: 8000,
  short: 300,
  wording: 4000,
  reference: 40,
};

export function createQuotes(root, hooks) {
  const loaded = loadStore();
  let state = loaded.ok ? loaded.state : { schemaVersion: 1, business: loaded.state ? loaded.state.business : undefined, jobs: [], enquiries: [] };
  if (!loaded.ok) {
    state = {
      schemaVersion: 1,
      business: {
        tradingName: "",
        contactLines: "",
        abn: "",
        inclusions: "",
        exclusions: "",
        quotePrefix: "Q",
        nextNumber: 1,
        gstRegistered: false,
        gstPercent: 10,
      },
      jobs: [],
      enquiries: [],
    };
  }
  let holdSaves = !loaded.ok;
  let recovery = loaded.ok ? null : loaded;
  let openJobId = null;
  let filter = "all";
  let search = "";
  let timer = 0;

  if (loaded.ok) {
    for (const job of state.jobs) {
      for (const run of job.runs) {
        if (!run.snapshot) recalculateRun(run);
      }
    }
  }

  function say(message, isError) {
    hooks.status(message || "", !!isError);
  }

  function persist(immediate) {
    if (holdSaves) return;
    const write = () => {
      const result = saveStore(state);
      if (!result.ok) say(result.message, true);
    };
    clearTimeout(timer);
    if (immediate) write();
    else timer = setTimeout(write, 250);
  }

  window.addEventListener("pagehide", () => {
    if (!holdSaves) saveStore(state);
  });
  window.addEventListener("beforeprint", () => {
    const job = state.jobs.find((item) => item.id === openJobId);
    const sheet = document.getElementById("print-sheet");
    if (job && sheet) sheet.replaceChildren(buildPrint(job));
  });

  function jobById(id) {
    return state.jobs.find((job) => job.id === id) || null;
  }

  function touch(job) {
    job.updatedAt = new Date().toISOString();
  }

  function show(hash) {
    const route = hash || "#/quotes";
    if (root.dataset.route === route) return;
    root.dataset.route = route;
    window.scrollTo(0, 0);
    if (recovery && !route.startsWith("#/job/")) {
      renderRecovery();
      return;
    }
    if (route.startsWith("#/job/")) {
      const parts = route.split("/");
      const id = parts[2];
      const job = jobById(id);
      openJobId = job ? job.id : null;
      if (!job) renderMissing();
      else if (parts[3] === "print") renderPreview(job);
      else renderEditor(job);
      return;
    }
    openJobId = null;
    if (route.startsWith("#/settings")) renderSettings();
    else renderList();
  }

  function rerender() {
    root.dataset.route = "";
    show(location.hash || "#/quotes");
  }

  function renderRecovery() {
    root.replaceChildren(
      shell([
        el("section", { class: "card" }, [
          el("h2", { text: "Saved quotes couldn’t be read" }),
          el("p", { text: recovery.message }),
          recovery.errors ? el("ul", {}, recovery.errors.map((error) => el("li", { text: error }))) : null,
          el("div", { class: "button-row" }, [
            el("button", { type: "button", class: "btn btn-primary", text: "Download the raw backup", onclick: () => download("fencing-quotes-unreadable.txt", recovery.raw || "") }),
            el("button", {
              type: "button",
              class: "btn btn-danger",
              text: "Erase saved quotes on this device",
              onclick: async () => {
                const yes = await ask("Erase the unreadable saved quotes on this device? This cannot be undone. Download the raw backup first if you might need it.");
                if (!yes) return;
                try {
                  localStorage.removeItem("fencing-quotes.v1");
                } catch {
                  say("Couldn’t erase local storage.", true);
                  return;
                }
                recovery = null;
                holdSaves = false;
                state.jobs = [];
                rerender();
                say("Local quotes erased on this device.", false);
              },
            }),
          ]),
        ]),
      ]),
    );
  }

  function renderMissing() {
    root.replaceChildren(shell([el("section", { class: "card" }, [el("h2", { text: "That quote isn’t on this device" }), el("button", { type: "button", class: "btn", text: "Back to quotes", onclick: () => { location.hash = "#/quotes"; } })])]));
  }

  function renderList() {
    const bar = el("div", { class: "list-toolbar" }, [
      el("button", { type: "button", class: "btn btn-primary", "data-testid": "new-quote", text: "New quote", onclick: newQuote }),
      el("button", { type: "button", class: "btn", "data-testid": "sample-quote", text: "Load fictional example", onclick: loadSample }),
      el("button", { type: "button", class: "btn", text: "Business details", onclick: () => { location.hash = "#/settings"; } }),
      el("button", { type: "button", class: "btn", "data-testid": "export-backup", text: "Export backup", onclick: doExport }),
      el("button", { type: "button", class: "btn", "data-testid": "import-backup", text: "Import backup", onclick: () => document.getElementById("import-file").click() }),
    ]);
    const searchInput = el("input", {
      type: "search",
      placeholder: "Search customer, site, reference",
      "data-testid": "quote-search",
      autocomplete: "off",
    });
    searchInput.value = search;
    searchInput.addEventListener("input", () => {
      search = searchInput.value;
      applyFilter();
    });
    const filters = el("div", { class: "filter-row", role: "group", "aria-label": "Filter by status" }, [
      filterButton("all", "All"),
      ...STATUSES.map((status) => filterButton(status.id, status.label)),
    ]);
    const cards = el("div", { class: "job-list", "data-testid": "job-list" });
    if (!state.jobs.length) {
      cards.append(el("section", { class: "card empty-card" }, [
        el("p", { class: "empty-title", text: "No quotes on this device yet" }),
        el("p", { class: "empty-body", text: "Create a quote, or load the fictional example to see a two-run layout. Prices start blank." }),
      ]));
    }
    for (const job of state.jobs) {
      const priced = priceJob(job);
      const card = el("article", {
        class: "card job-card",
        "data-testid": "job-card",
        "data-job-id": job.id,
        "data-status": job.status,
        "data-search": [job.reference, job.customer.name, job.customer.siteAddress, job.jobTitle].join(" ").toLowerCase(),
      }, [
        el("div", { class: "job-card-top" }, [
          el("h2", { text: job.reference || "Quote" }),
          el("span", { class: "status-pill status-" + job.status, text: statusLabel(job.status) }),
        ]),
        el("p", { class: "job-customer", text: job.customer.name || "No customer name yet" }),
        el("p", { class: "hint", text: [job.jobTitle, job.customer.siteAddress, formatDisplayDate(job.quoteDate)].filter(Boolean).join(" · ") }),
        el("p", { class: "job-total", text: moneyLabel(priced) }),
        el("p", { class: "hint", text: job.runs.length + " run" + (job.runs.length === 1 ? "" : "s") + (job.fictional ? " · fictional sample" : "") }),
        el("div", { class: "button-row" }, [
          el("button", { type: "button", class: "btn btn-primary", text: "Open", "data-testid": "open-job", onclick: () => { location.hash = "#/job/" + job.id; } }),
          el("button", { type: "button", class: "btn", text: "Duplicate", "data-testid": "duplicate-job", onclick: () => duplicateFrom(job.id) }),
          el("button", { type: "button", class: "btn btn-danger", text: "Delete", "data-testid": "delete-job", onclick: () => removeJob(job) }),
        ]),
      ]);
      cards.append(card);
    }
    root.replaceChildren(shell([
      localBanner(),
      bar,
      el("div", { class: "card list-filters" }, [searchInput, filters]),
      cards,
    ]));
    applyFilter();

    function filterButton(id, label) {
      return el("button", {
        type: "button",
        class: "chip-btn" + (filter === id ? " is-active" : ""),
        text: label,
        onclick: () => {
          filter = id;
          rerender();
          const input = root.querySelector("[data-testid=quote-search]");
          if (input) input.focus();
        },
      });
    }
    function applyFilter() {
      const query = search.trim().toLowerCase();
      root.querySelectorAll("[data-testid=job-card]").forEach((card) => {
        const statusOk = filter === "all" || card.dataset.status === filter;
        card.hidden = !(statusOk && card.dataset.search.includes(query));
      });
    }
  }

  function renderSettings() {
    const business = state.business;
    const enquiryNote = state.enquiries.length
      ? el("section", { class: "card" }, [
          el("h2", { text: "Enquiry records in this backup" }),
          el("p", { text: "These were stored in a backup file. This version does not collect new enquiries, send replies, or sign anyone in." }),
          el("ul", {}, state.enquiries.map((item) => el("li", { text: item.customer.name + " · " + item.status + " · " + item.siteAddress }))),
        ])
      : el("p", { class: "hint", text: "Customer sign-in and shared sync are not in this version. A later backup can hold inbound enquiries. This app does not pretend to receive them." });
    root.replaceChildren(shell([
      el("div", { class: "button-row" }, [el("button", { type: "button", class: "btn", text: "Back to quotes", onclick: () => { location.hash = "#/quotes"; } })]),
      localBanner(),
      el("section", { class: "card" }, [
        el("h2", { text: "Business heading" }),
        el("p", { class: "hint", text: "This is what prints on the customer sheet. Leave it blank until you type your own details. No prices are stored here." }),
        textField("Trading name", business.tradingName, 200, (value) => { business.tradingName = value; }, "business-name"),
        areaField("Contact details", business.contactLines, 2000, (value) => { business.contactLines = value; }, "Shown under the name. Address, phone, email — only what you type."),
        textField("ABN", business.abn, 20, (value) => { business.abn = value; }, "business-abn"),
        areaField("Default inclusions", business.inclusions, 4000, (value) => { business.inclusions = value; }, "Copied onto new quotes. Existing quotes keep their own wording."),
        areaField("Default exclusions", business.exclusions, 4000, (value) => { business.exclusions = value; }, ""),
        textField("Quote prefix", business.quotePrefix || "Q", 12, (value) => { business.quotePrefix = value || "Q"; }, "quote-prefix"),
        numberSetting("Next quote number", business.nextNumber, (value) => { business.nextNumber = Math.max(1, Math.round(value || 1)); }),
      ]),
      el("section", { class: "card" }, [
        el("h2", { text: "GST" }),
        el("p", { text: "Off unless you are registered. New quotes copy this switch. It does not change quotes you already started, and it does not mean this app lodges anything." }),
        checkboxField("GST registered", business.gstRegistered, (checked) => { business.gstRegistered = checked; }, "gst-registered"),
        numberSetting("GST percent", business.gstPercent, (value) => { business.gstPercent = value; }, "0–100, used only when GST is on"),
      ]),
      el("section", { class: "card" }, [el("h2", { text: "Later" }), enquiryNote]),
      el("section", { class: "card" }, [
        el("h2", { text: "This device" }),
        el("button", {
          type: "button",
          class: "btn btn-danger",
          text: "Erase all quotes on this device",
          onclick: async () => {
            const yes = await ask("Erase every quote saved in this browser? Export a backup first if you want a copy. This cannot be undone.");
            if (!yes) return;
            state.jobs = [];
            state.enquiries = [];
            persist(true);
            location.hash = "#/quotes";
            rerender();
          },
        }),
      ]),
    ]));
  }

  function renderEditor(job) {
    openJobId = job.id;
    const runs = el("div", { class: "run-list", "data-testid": "run-list" });
    for (const run of job.runs) runs.append(runCard(job, run));
    root.replaceChildren(shell([
      editorBar(job),
      job.fictional ? el("p", { class: "sample-banner", "data-testid": "sample-banner", text: "Fictional sample — not a real customer. Rates are still blank until you type them." }) : null,
      localBanner(),
      unverifiedBanner(job),
      el("div", { class: "editor-grid" }, [
        el("div", {}, [
          customerCard(job),
          el("section", { class: "card" }, [
            el("div", { class: "section-head" }, [
              el("h2", { text: "Fence runs" }),
              el("div", { class: "button-row" }, [
                el("button", { type: "button", class: "btn btn-primary", "data-testid": "add-colourbond", text: "Add Colourbond", onclick: () => { addRun(job, "colourbond"); touch(job); persist(true); rerender(); } }),
                el("button", { type: "button", class: "btn", "data-testid": "add-timber", text: "Add timber paling", onclick: () => { addRun(job, "timber"); touch(job); persist(true); rerender(); } }),
              ]),
            ]),
            job.runs.length ? null : el("p", { class: "hint", text: "Each run keeps its own measurements, quantities, and diagram." }),
            runs,
          ]),
          manualCard(job, "labour", "Labour", "hr", "Add labour"),
          manualCard(job, "extras", "Additional items", "each", "Add item"),
          wordingCard(job),
        ]),
        totalsCard(job),
      ]),
      totalBar(job),
    ]));
    document.getElementById("print-sheet").replaceChildren(buildPrint(job));
  }

  function renderPreview(job) {
    openJobId = job.id;
    const sheet = buildPrint(job);
    root.replaceChildren(shell([
      el("div", { class: "button-row no-print" }, [
        el("button", { type: "button", class: "btn", text: "Back to edit", onclick: () => { location.hash = "#/job/" + job.id; } }),
        el("button", { type: "button", class: "btn btn-primary", "data-testid": "do-print", text: "Print / Save as PDF", onclick: () => window.print() }),
      ]),
      el("p", { class: "local-banner no-print", text: "Customer sheet. Internal notes stay off this view. Choose Save as PDF in the print dialog. Nothing is emailed." }),
      sheet,
    ]));
    document.getElementById("print-sheet").replaceChildren(buildPrint(job));
  }

  function newQuote() {
    if (holdSaves) return say("Resolve the saved-quotes problem before creating a new one.", true);
    const job = createJob(state);
    persist(true);
    location.hash = "#/job/" + job.id;
  }

  function loadSample() {
    if (holdSaves) return say("Resolve the saved-quotes problem before loading the example.", true);
    const job = buildFictionalExample(state);
    persist(true);
    location.hash = "#/job/" + job.id;
  }

  function duplicateFrom(id) {
    const copy = duplicateJob(state, id);
    if (!copy) return;
    persist(true);
    location.hash = "#/job/" + copy.id;
  }

  async function removeJob(job) {
    const yes = await ask("Delete " + (job.reference || "this quote") + " from this device? This does not contact the customer. Export a backup first if you might need it.");
    if (!yes) return;
    deleteJob(state, job.id);
    persist(true);
    location.hash = "#/quotes";
    rerender();
  }

  function doExport() {
    const result = exportBackup(state);
    if (!result.ok) return say(result.errors.join(" "), true);
    download(result.filename, result.json);
    say("Backup downloaded. It stays on this device until you move the file yourself.", false);
  }

  async function onImportFile(file) {
    const text = await file.text();
    const parsed = parseBackup(text);
    const summary = document.getElementById("import-summary");
    const errors = document.getElementById("import-errors");
    errors.replaceChildren();
    document.getElementById("import-merge").disabled = !parsed.ok;
    document.getElementById("import-replace").disabled = !parsed.ok;
    if (!parsed.ok) {
      summary.textContent = "That file was not imported. Nothing on this device was changed.";
      for (const error of parsed.errors) errors.append(el("li", { text: error }));
    } else {
      summary.textContent = "Valid backup with " + parsed.state.jobs.length + " quote" + (parsed.state.jobs.length === 1 ? "" : "s") + " and " + parsed.state.enquiries.length + " enquiry record" + (parsed.state.enquiries.length === 1 ? "" : "s") + ". Choose how to apply it on this device.";
    }
    const dialog = document.getElementById("import-dialog");
    const choice = await new Promise((resolve) => {
      function finish(value) {
        dialog.close(value);
      }
      dialog.addEventListener("close", () => resolve(dialog.returnValue || "cancel"), { once: true });
      document.getElementById("import-cancel").onclick = () => finish("cancel");
      document.getElementById("import-merge").onclick = () => finish("merge");
      document.getElementById("import-replace").onclick = () => finish("replace");
      dialog.showModal();
    });
    if (!parsed.ok || choice === "cancel" || choice === "") return;
    if (choice === "replace") {
      const yes = await ask("Replace every quote on this device with the backup? Quotes that exist only on this device will be removed.");
      if (!yes) return;
      state = parsed.state;
    } else {
      const merged = mergeState(state, parsed.state);
      if (!merged.ok) return say(merged.errors.join(" "), true);
      state = merged.state;
      say("Added " + merged.added + " quote" + (merged.added === 1 ? "" : "s") + " from the backup.", false);
    }
    holdSaves = false;
    recovery = null;
    persist(true);
    rerender();
  }

  function editorBar(job) {
    const reference = el("input", { "data-testid": "quote-reference", maxlength: String(LIMITS.reference), autocomplete: "off", "aria-label": "Quote reference" });
    reference.value = job.reference;
    reference.addEventListener("input", () => { job.reference = reference.value.slice(0, LIMITS.reference); touch(job); persist(false); });
    const date = el("input", { type: "date", "data-testid": "quote-date", "aria-label": "Quote date" });
    date.value = job.quoteDate;
    date.addEventListener("change", () => { job.quoteDate = date.value || todayISO(); touch(job); persist(true); });
    const status = el("select", { "data-testid": "job-status", "aria-label": "Status" });
    for (const item of STATUSES) {
      const option = el("option", { value: item.id, text: item.label });
      if (item.id === job.status) option.selected = true;
      status.append(option);
    }
    status.addEventListener("change", () => { job.status = status.value; touch(job); persist(true); });
    return el("div", { class: "editor-bar" }, [
      el("button", { type: "button", class: "btn", text: "All quotes", onclick: () => { location.hash = "#/quotes"; } }),
      reference,
      date,
      status,
      el("button", { type: "button", class: "btn", "data-testid": "preview-quote", text: "Customer sheet", onclick: () => { location.hash = "#/job/" + job.id + "/print"; } }),
      el("button", { type: "button", class: "btn", "data-testid": "duplicate-open", text: "Duplicate", onclick: () => duplicateFrom(job.id) }),
      el("button", { type: "button", class: "btn btn-danger", text: "Delete", onclick: () => removeJob(job) }),
    ]);
  }

  function customerCard(job) {
    return el("section", { class: "card" }, [
      el("h2", { text: "Customer and job" }),
      el("p", { class: "hint", text: "Status is a label on this device. Nothing is emailed when you change it." }),
      textInput(job, "customer", "name", "Customer name", "customer-name", LIMITS.name),
      textInput(job, "customer", "phone", "Phone", "customer-phone", LIMITS.phone),
      textInput(job, "customer", "email", "Email", "customer-email", LIMITS.email),
      textInput(job, "customer", "siteAddress", "Site address", "site-address", LIMITS.site),
      plainInput(job, "jobTitle", "Job title", "job-title", LIMITS.title),
      plainArea(job, "internalNotes", "Internal notes", "internal-notes", "Only on this device. Left off the customer sheet."),
    ]);
  }

  function wordingCard(job) {
    const gst = el("input", { type: "checkbox", "data-testid": "gst-enabled" });
    gst.checked = !!job.gstEnabled;
    const percent = el("input", { type: "number", min: "0", max: "100", step: "0.01", "data-testid": "gst-percent" });
    percent.value = String(job.gstPercent);
    const percentWrap = el("div", { class: "field" }, [el("label", { text: "GST percent" }), percent]);
    percentWrap.hidden = !job.gstEnabled;
    gst.addEventListener("change", () => {
      job.gstEnabled = gst.checked;
      percentWrap.hidden = !gst.checked;
      touch(job);
      persist(true);
      refreshMoney(job);
    });
    percent.addEventListener("input", () => {
      const value = Number(percent.value);
      if (Number.isFinite(value) && value >= 0 && value <= 100) job.gstPercent = value;
      touch(job);
      persist(false);
      refreshMoney(job);
    });
    return el("section", { class: "card" }, [
      el("h2", { text: "Wording and GST" }),
      el("label", { class: "check-line" }, [gst, el("span", { text: "Add GST on this quote" })]),
      el("p", { class: "hint", text: "Leave this off unless you are registered. Rates you type are treated as ex GST when it is on." }),
      percentWrap,
      plainArea(job, "inclusions", "Inclusions", "inclusions", "Prints on the customer sheet."),
      plainArea(job, "exclusions", "Exclusions", "exclusions", "Prints on the customer sheet."),
      plainArea(job, "customerNotes", "Notes for the customer", "customer-notes", "Prints on the customer sheet."),
      job.fictional
        ? checkboxField("Keep the fictional-sample banner", true, (checked) => { job.fictional = checked; touch(job); persist(true); rerender(); }, "fictional-flag")
        : null,
    ]);
  }

  function runCard(job, run) {
    const output = el("div", { class: "run-output", "data-testid": "run-output", "data-run-id": run.id });
    const card = el("article", { class: "run-card", "data-testid": "run-card", "data-run-id": run.id }, [
      el("div", { class: "section-head" }, [
        nameInput(job, run),
        el("div", { class: "button-row" }, [
          el("button", { type: "button", class: "btn", text: "Duplicate run", "data-testid": "duplicate-run", onclick: () => { duplicateRun(job, run.id); touch(job); persist(true); rerender(); } }),
          el("button", {
            type: "button",
            class: "btn btn-danger",
            text: "Remove run",
            "data-testid": "remove-run",
            onclick: async () => {
              const yes = await ask("Remove this fence run from the quote?");
              if (!yes) return;
              removeRun(job, run.id);
              touch(job);
              persist(true);
              rerender();
            },
          }),
        ]),
      ]),
      measurementToggle(job, run, output),
      run.kind === "timber" ? timberFields(job, run, output) : colourbondFields(job, run, output),
      output,
    ]);
    fillRunOutput(job, run, output);
    return card;
  }

  function nameInput(job, run) {
    const input = el("input", { "data-testid": "run-name", "data-run-id": run.id, maxlength: "120", "aria-label": "Run name", autocomplete: "off" });
    input.value = run.name;
    input.addEventListener("input", () => { run.name = input.value.slice(0, 120); touch(job); persist(false); });
    return input;
  }

  function measurementToggle(job, run, output) {
    const input = el("input", { type: "checkbox", "data-testid": "checked-on-site", "data-run-id": run.id });
    input.checked = !!run.checkedOnSite;
    input.addEventListener("change", () => {
      run.checkedOnSite = input.checked;
      touch(job);
      persist(true);
      fillRunOutput(job, run, output);
      const banner = document.getElementById("unverified-banner");
      if (banner) banner.replaceWith(unverifiedBanner(job));
    });
    return el("label", { class: "check-line" }, [input, el("span", { text: "Checked on site" })]);
  }

  function bindCalc(job, run, output, input, key) {
    const write = () => {
      if (input.type === "checkbox") run.input[key] = input.checked;
      else {
        const parsed = parseNumber(input.value);
        run.input[key] = input.value.trim() === "" ? null : parsed;
      }
      recalculateRun(run);
      touch(job);
      persist(false);
      fillRunOutput(job, run, output);
      refreshMoney(job);
    };
    input.addEventListener("input", write);
    input.addEventListener("change", write);
  }

  function numField(job, run, output, key, label, unit, testid, hint, value) {
    const input = el("input", {
      type: "number",
      inputmode: "decimal",
      step: "any",
      id: key + "-" + run.id,
      "data-testid": testid,
      "data-run-id": run.id,
      autocomplete: "off",
    });
    if (value != null) input.value = String(value);
    bindCalc(job, run, output, input, key);
    const control = el("div", { class: "input-with-unit" }, [input, el("span", { class: "unit-suffix", text: unit })]);
    const lab = el("label", { text: label });
    lab.htmlFor = input.id;
    return el("div", { class: "field" }, [lab, control, hint ? el("p", { class: "hint", text: hint }) : null]);
  }

  function timberFields(job, run, output) {
    const input = run.input;
    return el("div", { class: "run-fields" }, [
      numField(job, run, output, "lengthM", "Run length", "m", "run-length", "Straight-line length.", input.lengthM),
      numField(job, run, output, "maxBayM", "Max bay", "m", "run-maxbay", "Equal centres will not exceed this.", input.maxBayM),
      numField(job, run, output, "heightMm", "Fence height", "mm", "run-height", "Paling length equals the fence height.", input.heightMm),
      numField(job, run, output, "postMm", "Post size", "mm", "run-post", "Square timber posts.", input.postMm),
      numField(job, run, output, "widthMm", "Paling width", "mm", "run-width", "", input.widthMm),
      numField(job, run, output, "lapMm", "Lap each side", "mm", "run-lap", "Overlap onto the back palings, each side.", input.lapMm),
      numField(job, run, output, "rails", "Rails per bay", "rails", "run-rails", "Nails scale with the number of rails.", input.rails),
      numField(job, run, output, "nailsPerRail", "Nails per paling per rail", "nails", "run-nails", "2 × 3 rails = 6 nails a paling.", input.nailsPerRail),
      checkField(job, run, output, "plinth", "Plinth / kickboard", "One board per bay. Off unless you turn it on."),
    ]);
  }

  function colourbondFields(job, run, output) {
    const input = run.input;
    const maxWrap = numField(job, run, output, "maxBayM", "Max bay", "m", "run-maxbay", "Equal centres, never over this.", input.maxBayM);
    const countWrap = numField(job, run, output, "count", input.postMode === "bays" ? "Bays" : "Posts", input.postMode === "bays" ? "bays" : "posts", "run-count", "", input.count);
    countWrap.hidden = input.postMode === "maxbay";
    maxWrap.hidden = input.postMode !== "maxbay";
    const modes = el("div", { class: "segmented", role: "group", "aria-label": "How to set posts" }, ["maxbay", "posts", "bays"].map((mode) => {
      const button = el("button", { type: "button", class: "seg-btn" + (input.postMode === mode ? " is-active" : ""), text: mode === "maxbay" ? "Max bay" : mode === "posts" ? "Posts" : "Bays" });
      button.addEventListener("click", () => {
        input.postMode = mode;
        touch(job);
        recalculateRun(run);
        persist(true);
        rerender();
      });
      return button;
    }));
    const timberWrap = el("div", { class: "sub-fields" }, [
      numField(job, run, output, "timberSizeMm", "Timber post width", "mm", "timber-size", "Default 100 × 100. Clear bay = centres − this width.", input.timberSizeMm),
      numField(job, run, output, "fixingsPerPost", "Fixings per post", "fixings", "fixings", "", input.fixingsPerPost),
    ]);
    timberWrap.hidden = !input.timberPosts;
    const stepWrap = el("div", { class: "sub-fields" }, [
      numField(job, run, output, "fallMm", "Total fall", "mm", "run-fall", "High end to low end. Steps = bays = posts − 1.", input.fallMm),
      checkField(job, run, output, "equalPosts", "Posts same height above ground", "Tops follow the fall. Steps do not change."),
      numField(job, run, output, "postHeightMm", "Post height above its ground", "mm", "post-height", "2100 is 1800 panel + 150 plinth + 150 above the panel at the high end.", input.postHeightMm),
    ]);
    stepWrap.hidden = !input.useStepDown;
    return el("div", { class: "run-fields" }, [
      numField(job, run, output, "lengthM", "Run length", "m", "run-length", "", input.lengthM),
      el("div", { class: "field" }, [el("span", { class: "label-text", text: "Posts" }), modes]),
      maxWrap,
      countWrap,
      numField(job, run, output, "heightMm", "Fence height", "mm", "run-height", "Optional. Not assumed.", input.heightMm),
      numField(job, run, output, "coverMm", "Panel cover width", "mm", "run-cover", "Brands differ. This app does not assume a cover width.", input.coverMm),
      numField(job, run, output, "railsPerBay", "Rails per bay", "rails", "run-rails", "", input.railsPerBay),
      checkField(job, run, output, "includeCaps", "Include post caps", ""),
      checkWrap(job, run, output, "timberPosts", "Colourbond posts on timber", "Max bay stays the timber centres.", timberWrap),
      checkWrap(job, run, output, "useStepDown", "Sloping ground — equal step-downs", "Panels level, posts plumb.", stepWrap),
    ]);
  }

  function checkField(job, run, output, key, label, hint) {
    const input = el("input", { type: "checkbox", "data-testid": "check-" + key, "data-run-id": run.id });
    input.checked = !!run.input[key];
    bindCalc(job, run, output, input, key);
    return el("div", { class: "field" }, [el("label", { class: "check-line" }, [input, el("span", { text: label })]), hint ? el("p", { class: "hint", text: hint }) : null]);
  }

  function checkWrap(job, run, output, key, label, hint, wrap) {
    const input = el("input", { type: "checkbox", "data-testid": "check-" + key, "data-run-id": run.id });
    input.checked = !!run.input[key];
    input.addEventListener("change", () => {
      run.input[key] = input.checked;
      wrap.hidden = !input.checked;
      recalculateRun(run);
      touch(job);
      persist(false);
      fillRunOutput(job, run, output);
      refreshMoney(job);
    });
    return el("div", { class: "field" }, [el("label", { class: "check-line" }, [input, el("span", { text: label })]), hint ? el("p", { class: "hint", text: hint }) : null, wrap]);
  }

  function fillRunOutput(job, run, output) {
    output.replaceChildren();
    const note = measurementNote(run);
    output.append(el("p", { class: note.unverified ? "measure-warn" : "measure-ok", "data-testid": "measure-note", text: note.text }));
    if (run.error) {
      output.append(el("div", { class: "error-card", "data-testid": "run-error" }, [el("p", { class: "error-title", text: run.error.title }), el("p", { class: "error-body", text: run.error.message })]));
      return;
    }
    if (!run.snapshot) {
      output.append(el("p", { class: "hint", text: run.kind === "colourbond" ? "Enter run length and panel cover. Cover width is not assumed." : "Enter a run length to calculate." }));
      return;
    }
    output.append(el("p", { class: "run-summary", "data-testid": "run-summary", text: runSummary(run) }));
    const result = run.snapshot.result;
    if (result.step && result.step.pending) output.append(el("p", { class: "hint", text: "Enter the fall to include equal step-downs." }));
    if (result.step && !result.step.pending) {
      const rounding = stepRoundingCopy(result.step);
      if (rounding) output.append(el("p", { class: "rounding-note", text: rounding }));
      if (result.step.equal) {
        const info = equalPostCopy(result.step.equal);
        output.append(el("p", { class: info.tone === "warn" ? "rounding-note" : "assumption-note", text: info.text }));
      }
    }
    for (const diagram of run.snapshot.diagrams) {
      const svg = svgNode("diagram");
      const wrap = el("div", { class: "diagram-wrap" }, svg);
      output.append(wrap);
      mountSvg(svg, diagram);
      output.append(el("p", { class: "diagram-caption", text: diagram.caption }));
    }
    const table = el("table", { class: "drop-table rate-table" }, [
      el("thead", {}, el("tr", {}, ["Description", "Qty", "Unit", "Unit rate (AUD)", "Amount"].map((label) => el("th", { text: label, scope: "col" })))),
      el("tbody", {}, run.snapshot.lines.map((line) => rateRow(job, run, line))),
    ]);
    output.append(el("div", { class: "table-scroll" }, table));
    output.append(el("p", { class: "hint", text: "Rates start blank. A blank rate is left out of the total and marked incomplete. $0 is kept only if you type 0." }));
  }

  function rateRow(job, run, line) {
    const input = el("input", {
      type: "number",
      min: "0",
      step: "0.01",
      inputmode: "decimal",
      placeholder: "Rate",
      "data-testid": "rate",
      "data-rate-key": line.key,
      "data-run-id": run.id,
      autocomplete: "off",
      "aria-label": "Unit rate for " + line.description,
    });
    if (run.rates[line.key] != null) input.value = String(run.rates[line.key]);
    const amount = el("span", { "data-testid": "line-amount" });
    const paint = () => {
      const priced = priceAmount(line.qty, run.rates[line.key] == null ? null : run.rates[line.key]);
      amount.textContent = priced.cents == null ? "Rate needed" : formatAud(priced.cents);
      amount.classList.toggle("is-missing", priced.status !== "priced");
    };
    input.addEventListener("input", () => {
      const text = input.value.trim();
      if (text === "") run.rates[line.key] = null;
      else {
        const value = Number(text);
        run.rates[line.key] = Number.isFinite(value) && value >= 0 ? value : null;
      }
      touch(job);
      persist(false);
      paint();
      refreshMoney(job);
    });
    paint();
    return el("tr", {}, [
      el("td", { text: line.description }),
      el("td", { text: formatQty(line.qty) }),
      el("td", { text: line.unit }),
      el("td", {}, input),
      el("td", {}, amount),
    ]);
  }

  function manualCard(job, key, title, unit, button) {
    const body = el("div", { "data-testid": key + "-list" });
    for (const item of job[key]) body.append(manualRow(job, key, item));
    return el("section", { class: "card" }, [
      el("div", { class: "section-head" }, [
        el("h2", { text: title }),
        el("button", {
          type: "button",
          class: "btn",
          "data-testid": "add-" + key,
          text: button,
          onclick: () => {
            job[key].push(blankManual(unit));
            touch(job);
            persist(true);
            rerender();
          },
        }),
      ]),
      body,
    ]);
  }

  function manualRow(job, key, item) {
    const description = el("input", { "data-testid": key + "-description", maxlength: "300", placeholder: "Description", autocomplete: "off" });
    description.value = item.description;
    const qty = el("input", { type: "number", min: "0", step: "any", "data-testid": key + "-qty", "aria-label": "Quantity" });
    qty.value = String(item.qty);
    const rate = el("input", { type: "number", min: "0", step: "0.01", placeholder: "Rate", "data-testid": key + "-rate", "aria-label": "Unit rate" });
    if (item.rate != null) rate.value = String(item.rate);
    const amount = el("span", { "data-testid": "manual-amount" });
    const paint = () => {
      const priced = priceAmount(item.qty, item.rate);
      amount.textContent = !item.description.trim() && item.rate == null ? "" : priced.cents == null ? "Rate needed" : formatAud(priced.cents);
    };
    const write = () => {
      item.description = description.value.slice(0, 300);
      const qtyValue = parseNumber(qty.value);
      item.qty = qtyValue == null || Number.isNaN(qtyValue) ? 0 : qtyValue;
      const text = rate.value.trim();
      item.rate = text === "" ? null : Number.isFinite(Number(text)) && Number(text) >= 0 ? Number(text) : null;
      touch(job);
      persist(false);
      paint();
      refreshMoney(job);
    };
    description.addEventListener("input", write);
    qty.addEventListener("input", write);
    rate.addEventListener("input", write);
    paint();
    return el("div", { class: "manual-row" }, [
      description,
      el("div", { class: "input-with-unit" }, [qty, el("span", { class: "unit-suffix", text: item.unit })]),
      rate,
      amount,
      el("button", {
        type: "button",
        class: "btn",
        text: "Remove",
        onclick: async () => {
          if ((item.description || item.rate != null) && !(await ask("Remove this line?"))) return;
          job[key] = job[key].filter((line) => line.id !== item.id);
          touch(job);
          persist(true);
          rerender();
        },
      }),
    ]);
  }

  function totalsCard(job) {
    return el("aside", { class: "card totals-card", id: "totals-card", "data-testid": "totals-card" }, moneyNodes(job));
  }

  function totalBar(job) {
    const priced = priceJob(job);
    return el("div", { class: "total-bar no-print", "data-testid": "total-bar" }, [
      el("strong", { id: "bar-total", text: "Total " + formatAud(priced.totalCents) }),
      el("span", { id: "bar-flag", text: priced.incomplete ? "Pricing incomplete" : job.gstEnabled ? "Includes GST" : "GST off" }),
    ]);
  }

  function moneyNodes(job) {
    const priced = priceJob(job);
    const nodes = [el("h2", { text: "Quote total" }), el("p", { class: "hint", text: "AUD. Blank rates are not guessed and are not in the total." })];
    if (priced.missingCount || priced.skippedRuns || priced.needsDescription) {
      nodes.push(el("p", { class: "rounding-note", "data-testid": "pricing-incomplete", text: incompleteText(priced) }));
    }
    if (priced.zeroCount) nodes.push(el("p", { class: "rounding-note", text: priced.zeroCount + " line" + (priced.zeroCount === 1 ? " is" : "s are") + " $0.00. Confirm that is intentional." }));
    nodes.push(moneyRow("Priced subtotal", formatAud(priced.subtotalCents)));
    if (job.gstEnabled) nodes.push(moneyRow("GST " + formatPercent(job.gstPercent), formatAud(priced.gstCents)));
    else nodes.push(el("p", { class: "hint", "data-testid": "gst-off", text: "GST is off for this quote. Turn it on only if you are registered." }));
    nodes.push(el("p", { class: "grand-total", "data-testid": "grand-total", text: "Total " + formatAud(priced.totalCents) }));
    if (priced.anyRounded) nodes.push(el("p", { class: "hint", text: "Line amounts round to the nearest cent. A half cent rounds up." }));
    return nodes;
  }

  function refreshMoney(job) {
    const card = document.getElementById("totals-card");
    if (card) card.replaceChildren(...moneyNodes(job));
    const bar = document.querySelector("[data-testid=total-bar]");
    if (bar) bar.replaceWith(totalBar(job));
    const sheet = document.getElementById("print-sheet");
    if (sheet && openJobId === job.id) sheet.replaceChildren(buildPrint(job));
  }

  function buildPrint(job) {
    const priced = priceJob(job);
    const business = state.business;
    const heading = business.tradingName.trim() || "Quote";
    const blocks = [
      job.fictional ? el("p", { class: "sample-banner", text: "FICTIONAL SAMPLE — not a customer, not a real price list." }) : null,
      el("header", { class: "print-head" }, [
        el("p", { class: "print-kicker", text: "Quote" }),
        el("h1", { text: heading }),
        business.contactLines.trim() ? el("p", { class: "print-contact", text: business.contactLines }) : null,
        business.abn.trim() ? el("p", { text: "ABN " + business.abn }) : null,
      ]),
      el("div", { class: "print-meta" }, [
        metaPair("Quote", job.reference),
        metaPair("Date", formatDisplayDate(job.quoteDate)),
        metaPair("Customer", job.customer.name),
        metaPair("Phone", job.customer.phone),
        metaPair("Email", job.customer.email),
        metaPair("Site", job.customer.siteAddress),
        job.jobTitle ? metaPair("Job", job.jobTitle) : null,
      ]),
    ];
    job.runs.forEach((run, index) => {
      const note = measurementNote(run);
      const section = el("section", { class: "print-run" }, [
        el("h2", { text: "Run " + (index + 1) + " — " + (run.name || "Fence") }),
        el("p", { class: note.unverified ? "measure-warn" : "measure-ok", text: note.text }),
      ]);
      if (!run.snapshot) {
        section.append(el("p", { text: "Quantities to be confirmed." }));
      } else {
        section.append(el("p", { text: runSummary(run) }));
        for (const diagram of run.snapshot.diagrams) {
          const svg = svgNode("diagram print-diagram");
          section.append(el("div", { class: "diagram-wrap print-diagram-wrap" }, svg));
          mountSvg(svg, diagram);
          section.append(el("p", { class: "diagram-caption", text: diagram.caption }));
        }
        const lines = priced.groups.find((group) => group.run === run);
        section.append(lineTable((lines && lines.lines) || []));
      }
      blocks.push(section);
    });
    if (priced.labour.length || priced.extras.length) {
      blocks.push(el("section", { class: "print-run" }, [
        el("h2", { text: "Labour and other items" }),
        lineTable([...priced.labour, ...priced.extras]),
      ]));
    }
    const totals = el("section", { class: "print-totals" }, [
      moneyRow("Subtotal", formatAud(priced.subtotalCents)),
    ]);
    if (job.gstEnabled) {
      totals.append(moneyRow("GST " + formatPercent(job.gstPercent), formatAud(priced.gstCents)));
      totals.append(el("p", { class: "grand-total", text: "Total " + formatAud(priced.totalCents) }));
      totals.append(el("p", { class: "hint", text: "GST is included in the total." }));
    } else {
      totals.append(el("p", { class: "grand-total", text: "Total " + formatAud(priced.totalCents) }));
      totals.append(el("p", { text: "GST is not included in this quote." }));
    }
    if (priced.missingCount || priced.skippedRuns) totals.append(el("p", { text: "Items marked “To be confirmed” are not included in the total." }));
    if (priced.anyRounded) totals.append(el("p", { class: "hint", text: "Amounts are rounded to the nearest cent." }));
    blocks.push(totals);
    if (job.inclusions.trim()) blocks.push(el("section", { class: "print-notes" }, [el("h2", { text: "Inclusions" }), el("p", { text: job.inclusions })]));
    if (job.exclusions.trim()) blocks.push(el("section", { class: "print-notes" }, [el("h2", { text: "Exclusions" }), el("p", { text: job.exclusions })]));
    if (job.customerNotes.trim()) blocks.push(el("section", { class: "print-notes" }, [el("h2", { text: "Notes" }), el("p", { text: job.customerNotes })]));
    blocks.push(el("p", { class: "print-foot", text: "Prepared as a quote. This sheet was not sent from the app." }));
    return el("article", { class: "customer-sheet", "data-testid": "customer-sheet" }, blocks);
  }

  function lineTable(lines) {
    return el("table", { class: "drop-table" }, [
      el("thead", {}, el("tr", {}, ["Description", "Qty", "Unit", "Rate", "Amount"].map((label) => el("th", { scope: "col", text: label })))),
      el("tbody", {}, lines.map((line) => el("tr", {}, [
        el("td", { text: line.description || "Item" }),
        el("td", { text: formatQty(Number(line.qty)) }),
        el("td", { text: line.unit || "" }),
        el("td", { text: line.status === "missing" || line.status === "invalid" ? "—" : line.rate == null ? "—" : formatAud(Math.round(Number(line.rate) * 100)) }),
        el("td", { text: line.cents == null ? "To be confirmed" : formatAud(line.cents) }),
      ]))),
    ]);
  }

  function textInput(job, group, key, label, testid, max) {
    const input = el("input", { id: testid, "data-testid": testid, maxlength: String(max), autocomplete: "off" });
    input.value = job[group][key];
    input.addEventListener("input", () => {
      job[group][key] = input.value.slice(0, max);
      touch(job);
      persist(false);
    });
    const lab = el("label", { text: label });
    lab.htmlFor = testid;
    return el("div", { class: "field" }, [lab, input]);
  }

  function plainInput(job, key, label, testid, max) {
    const input = el("input", { id: testid, "data-testid": testid, maxlength: String(max), autocomplete: "off" });
    input.value = job[key];
    input.addEventListener("input", () => { job[key] = input.value.slice(0, max); touch(job); persist(false); });
    const lab = el("label", { text: label });
    lab.htmlFor = testid;
    return el("div", { class: "field" }, [lab, input]);
  }

  function plainArea(job, key, label, testid, hint) {
    const input = el("textarea", { id: testid, "data-testid": testid, rows: "3", maxlength: "8000" });
    input.value = job[key];
    input.addEventListener("input", () => { job[key] = input.value.slice(0, 8000); touch(job); persist(false); });
    const lab = el("label", { text: label });
    lab.htmlFor = testid;
    return el("div", { class: "field" }, [lab, input, hint ? el("p", { class: "hint", text: hint }) : null]);
  }

  function textField(label, value, max, onInput, testid) {
    const input = el("input", { id: testid, "data-testid": testid, maxlength: String(max), autocomplete: "off" });
    input.value = value || "";
    input.addEventListener("input", () => { onInput(input.value.slice(0, max)); persist(false); });
    const lab = el("label", { text: label });
    lab.htmlFor = testid;
    return el("div", { class: "field" }, [lab, input]);
  }

  function areaField(label, value, max, onInput, hint) {
    const input = el("textarea", { rows: "3", maxlength: String(max) });
    input.value = value || "";
    input.addEventListener("input", () => { onInput(input.value.slice(0, max)); persist(false); });
    return el("div", { class: "field" }, [el("label", { text: label }), input, hint ? el("p", { class: "hint", text: hint }) : null]);
  }

  function numberSetting(label, value, onInput, hint) {
    const input = el("input", { type: "number", step: "any" });
    input.value = String(value);
    input.addEventListener("input", () => {
      const next = Number(input.value);
      if (Number.isFinite(next)) onInput(next);
      persist(false);
    });
    return el("div", { class: "field" }, [el("label", { text: label }), input, hint ? el("p", { class: "hint", text: hint }) : null]);
  }

  function checkboxField(label, checked, onChange, testid) {
    const input = el("input", { type: "checkbox", "data-testid": testid });
    input.checked = !!checked;
    input.addEventListener("change", () => { onChange(input.checked); persist(true); });
    return el("label", { class: "check-line" }, [input, el("span", { text: label })]);
  }

  const file = document.getElementById("import-file");
  file.addEventListener("change", async () => {
    const picked = file.files && file.files[0];
    file.value = "";
    if (picked) await onImportFile(picked);
  });

  return { show };
}

function shell(children) {
  return el("div", { class: "main main-wide" }, children);
}

function svgNode(className) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  return svg;
}

function localBanner() {
  return el("p", { class: "local-banner", "data-testid": "local-banner", text: "Saved in this browser only. No account, no sync, and nothing is sent. Export a backup if you want a copy — clearing this browser’s data deletes the quotes." });
}

function unverifiedBanner(job) {
  const open = job.runs.filter((run) => !run.checkedOnSite);
  if (!job.runs.length || !open.length) return el("p", { id: "unverified-banner", class: "hint", text: job.runs.length ? "Every run is marked checked on site." : "" });
  return el("p", { id: "unverified-banner", class: "measure-warn", "data-testid": "unverified-banner", text: open.length + " run" + (open.length === 1 ? "" : "s") + " still marked as customer-supplied measurements, not verified on site." });
}

function statusLabel(id) {
  const found = STATUSES.find((status) => status.id === id);
  return found ? found.label : id;
}

function moneyLabel(priced) {
  const total = "Total " + formatAud(priced.totalCents);
  return priced.incomplete ? total + " · pricing incomplete" : total;
}

function incompleteText(priced) {
  const parts = [];
  if (priced.missingCount) parts.push(priced.missingCount + " line" + (priced.missingCount === 1 ? " has" : "s have") + " no rate");
  if (priced.needsDescription) parts.push(priced.needsDescription + " line" + (priced.needsDescription === 1 ? " needs a description" : "s need a description"));
  if (priced.skippedRuns) parts.push(priced.skippedRuns + " run" + (priced.skippedRuns === 1 ? " is" : "s are") + " not calculated");
  return "Pricing incomplete — " + parts.join(", ") + ". Those items are excluded from the total.";
}

function moneyRow(label, value) {
  return el("p", { class: "money-row" }, [el("span", { text: label }), el("span", { text: value })]);
}

function metaPair(label, value) {
  if (!value) return null;
  return el("p", {}, [el("span", { class: "meta-label", text: label }), document.createTextNode(" "), el("span", { text: value })]);
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ask(message) {
  const dialog = document.getElementById("confirm-dialog");
  document.getElementById("confirm-message").textContent = message;
  dialog.showModal();
  return new Promise((resolve) => {
    const ok = document.getElementById("confirm-ok");
    const cancel = document.getElementById("confirm-cancel");
    function finish(value) {
      if (dialog.open) dialog.close();
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      resolve(value);
    }
    function onOk() { finish(true); }
    function onCancel() { finish(false); }
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
  });
}
