# Fencing quotes

Mobile-first quotes workspace for Australian fencing jobs, built on the existing Colourbond and timber paling calculators. It runs as a static site (GitHub Pages or any file server). Quotes stay in this browser. Nothing is sent, and there is no account or sync.

Live calculators before this change: https://devinefreqz.github.io/fencing-calculator/

## What you can do

- Keep a list of quotes on this device: create, edit, reopen, duplicate, delete.
- Customer and job details, a status label, and notes. Status is only a label. It does not email anyone.
- Several fence runs on one quote. Each run stores its own calculator inputs, quantities, and diagram. Editing one run does not change another.
- Colourbond runs use the step-down, post-spacing, and materials calculators. Timber paling runs use the lap-and-cap calculator.
- Type your own unit rates. Rates start blank. Blank lines are marked incomplete and left out of the total. Nothing is pre-priced.
- Labour lines and extra lines. Totals are in AUD, ex GST, with optional GST.
- GST is off until you turn it on. The app does not assume the business is registered.
- A customer sheet you can print or save as PDF, with a diagram for every calculated run. Internal notes are left off that sheet.
- Export and import a JSON backup. Imports are checked before they replace or merge anything.
- Customer-supplied measurements stay marked unverified until you tick **Checked on site**.

The standalone calculators are still there: step-downs, materials, post spacing, and timber paling.

## Open it

```bash
python3 -m http.server 8080
```

Then open http://127.0.0.1:8080/ . Opening the HTML file directly will not load the modules.

## Tests

```bash
node --test tests/calc.test.mjs tests/quote-store.test.mjs
```

Browser checks (needs Chrome and `playwright-core`):

```bash
npx --yes playwright-core --version
node tests/e2e.mjs
```

## Calculator rules kept from the current app

Colourbond panels stay level and posts stay plumb. Equal steps, and steps = bays = posts − 1.

Post spacing: bays = ceil(length ÷ max bay), centres = length ÷ bays, posts = bays + 1. Centres are never over the max bay.

Timber-supported Colourbond keeps the timber checkbox. The default timber section is 100×100 mm. Clear opening = centres − timber width.

The step-down diagram draws a 150 mm wood-coloured plinth on the ground line and a thin soil band. The “posts same height above local ground” option is unchanged.

Timber paling defaults: 3 rails, 1800 mm high, 100 mm posts, 150 mm palings, 25 mm lap on **each** side, 2 nails per rail (6 per paling), plinth off.

The 10 m / 2.4 m max-bay baseline is unchanged: 6 posts, 5 bays at 2 m, 15 rail pieces (30 m), 80 palings (40 back + 40 front), 480 nails, 8 palings per metre, 100 mm back-row gap.

Palings are counted along the whole run, starting on a back paling. Each paling advances by width − lap. The back gap is width − 2 × lap. A lap that closes that gap, or a post as wide as the bay, is rejected. Nails are palings × rails × nails per rail, so they scale when the rail count changes. That is the geometry already implemented in v12; older wording that described the pitch differently is not used.

## Saved data

The backup is JSON, `schemaVersion` 1. It holds business details, quotes, and an `enquiries` list that a later version could fill from inbound jobs. This version does not collect enquiries and does not sign anyone in. Each quote has `sync.status: "device-only"` so a future backend can attach without pretending this copy already syncs.

Older releases of this repo were stored as base64 chunks because some uploads corrupted UTF-8. This version is normal source files.

## Not in this version

No customer portal, no shared database, no email, and no prices built in.
