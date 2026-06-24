# benefitoffers sync worker (Phase 2)

A tiny Cloudflare Worker that auto-syncs your **Amex & Chase** transactions into
the app via [SimpleFIN](https://www.simplefin.org/), so you never export a
statement by hand. It holds your SimpleFIN access URL (the secret that can read
your transactions), pulls daily on a cron, caches the result in D1, and serves
it to your app behind a bearer token.

> **Apple Card is not supported** — Goldman Sachs blocks all aggregators
> (SimpleFIN/MX/Teller/Plaid). Keep importing Apple Card via the in-app file
> importer (Wallet → statement → Export Transactions).

Your bank password is **never** stored in this worker or the app — SimpleFIN
handles the bank connection; the worker only ever sees a read-only access URL.

---

## What you need (one time)

1. A **Cloudflare account** (free) with the `wrangler` CLI: `npm i -g wrangler`.
2. A **SimpleFIN Bridge** account (~$1.50/mo): https://bridge.simplefin.org/ —
   connect your Amex & Chase logins there, then **"Create a new Setup Token."**

## Deploy

```bash
cd worker

# 1. Log in to Cloudflare
wrangler login

# 2. Create the D1 database, then paste the printed database_id into wrangler.toml
wrangler d1 create benefitoffers

# 3. Create the tables
wrangler d1 execute benefitoffers --remote --file=./schema.sql

# 4. Set secrets
#    API_TOKEN: any long random string (e.g. `openssl rand -hex 24`)
#    ALLOWED_ORIGIN: your app origin, exactly
wrangler secret put API_TOKEN
wrangler secret put ALLOWED_ORIGIN   # e.g. https://jakenicholas.github.io

# 5. Ship it
wrangler deploy
```

`wrangler deploy` prints your worker URL, e.g.
`https://benefitoffers-sync.<you>.workers.dev`.

## Connect the app

In the app: **＋ → Bank sync (auto)** (or **Settings → Bank sync**), then:

1. Paste the **Worker URL** and the **API_TOKEN** you set.
2. Paste your SimpleFIN **setup token** → **Connect**. Your accounts appear.
3. **Map** each SimpleFIN account to the matching card.
4. **Sync now.** After that, the worker refreshes daily and the app auto-pulls
   the cached data each time you open it.

## Endpoints (all require `Authorization: Bearer <API_TOKEN>`)

| Method | Path             | Purpose                                            |
|--------|------------------|----------------------------------------------------|
| POST   | `/api/connect`   | Claim a SimpleFIN setup token → store access URL   |
| GET    | `/api/status`    | `{ connected, lastFetched }`                        |
| POST   | `/api/sync`      | Live pull from SimpleFIN, cache, return raw JSON    |
| GET    | `/api/snapshot`  | Last cached pull (used for auto-sync on open)       |

## Notes

- **Cost:** Cloudflare Workers + D1 free tier easily covers one user; SimpleFIN
  is the only real cost.
- **Lookback:** the worker pulls ~120 days each sync; the app dedupes by
  SimpleFIN transaction id, so re-syncing is safe.
- **Security:** single-user model — the bearer token gates all access. Rotate it
  by re-running `wrangler secret put API_TOKEN` and updating the app.
