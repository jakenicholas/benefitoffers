# Card Perks Tracker

A mobile-first **PWA** that tracks the benefits, credits, and offers across all
your credit cards — so you can see what value is still unused **before it resets
or expires**.

- **Benefits / credits** — fixed card perks (e.g. Amex Platinum $200 hotel
  credit, $50 semiannual Saks, monthly Uber Cash) with their reset cadence.
- **Offers** — card-linked merchant offers, entered manually.

It is **private and offline-first**: no login, no servers, no bank connections,
no Plaid. All data lives in your browser's `localStorage` on one device. Back it
up or move it with the built-in JSON export/import.

> ⚠️ The seed data ships with **placeholder** amounts/cadences flagged
> **“verify.”** They are not guaranteed current — correct them against your own
> card's terms.

---

## Features

- **Dashboard sorted by urgency** — unused value with the soonest reset floats to
  the top, with big `$X left · resets in N days` badges.
- **Red urgency cue** — benefits with unused value resetting within 14 days turn red.
- **Two views** — *By card* (collapsible groups with an annual-fee-vs-captured ROI
  line) or flat *What's expiring*.
- **Quick mark-used** — tap a benefit for a slider + `+$` / *Use all* / *Reset* buttons.
- **Automatic period rollover** — `usedThisPeriod` resets to 0 when a period ends
  (checked every time you open the app).
- **Reset math** for annual / semiannual / quarterly / monthly / one-time, on a
  **calendar** basis (Jan 1, Jul 1, …) or **cardmember-year** basis (your card's
  anniversary month).
- **Offers tab** with an activated toggle and expiry.
- **Search** across benefits and offers (name, card, merchant, notes).
- **JSON export / import** for backup and bulk editing.
- **Installable** to your iPhone home screen, works offline.

---

## Run locally

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # production build into dist/
npm run preview    # serve the production build (under /benefitoffers/)
npm test           # period-math unit tests (node:test)
```

On first launch the dashboard is empty — tap **Load sample data** (or the ⚙︎
settings sheet → *Load sample cards & benefits*) to populate it from
[`src/data/cards.seed.json`](src/data/cards.seed.json). Edit that file to change
the seed set.

---

## Data model

Stored as one JSON blob under the `localStorage` key `cardPerks.v1`.

**Card** — `id, name, issuer, annualFee, last4, anniversaryMonth`
(anniversary month 1–12 is needed for cardmember-year benefits).

**Benefit** — `id, cardId, name, description, amount, cadence
("annual"|"semiannual"|"quarterly"|"monthly"|"one_time"), resetBasis
("calendar"|"cardmember_year"), usedThisPeriod, currentPeriodEnd, notes, verify`.
`periodsPerYear` and `currentPeriodEnd` are derived; "remaining this period" =
`amount − usedThisPeriod`.

**Offer** — `id, cardId, merchant, value, expires, activated, notes`.

Reset boundaries (`src/lib/periods.js`):

- semiannual calendar → Jan 1 & Jul 1
- quarterly calendar → Jan / Apr / Jul / Oct 1
- cardmember-year → stepped from the card's anniversary month

---

## Deploy to GitHub Pages

A workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
builds and deploys on every push to `main`.

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`. The site publishes at
   `https://<your-username>.github.io/benefitoffers/`.

The build serves from the `/benefitoffers/` sub-path (the repo name). If your
repo has a **different name**, change `BASE_PATH` in the workflow (and the
`base` default in `vite.config.js`) to `/<your-repo-name>/`.

---

## Install on your iPhone home screen

1. Open the published Pages URL in **Safari** (PWA install requires Safari on iOS).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch it from the home screen — it opens full-screen (standalone) and works
   offline thanks to the service worker.

---

## Backup & restore

Open **⚙︎ → Export to JSON** to download a timestamped backup, or **Import from
JSON…** to restore / move data to another device. Since storage is per-device,
export before clearing Safari data or switching phones.

## Privacy

100% local. No accounts, analytics, network calls, or third-party services. The
only thing the app fetches is its own static files.
