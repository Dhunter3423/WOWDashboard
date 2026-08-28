# Therapy+ Candidate Tracker — deploy guide

Shared storage uses **Netlify Blobs + two small serverless functions**. No access key,
no environment variables — Blobs turns on automatically. Protect the **site** at the
Netlify level (password / Identity) instead of gating the endpoints.

## What's in this folder
```
netlify.toml                     serve /public, bundle functions (esbuild), security headers
package.json                     the one dependency (@netlify/blobs)
netlify/functions/candidates.mjs shared snapshot (records + jobs) on /api/candidates
netlify/functions/uploads.mjs    raw upload archive on /api/uploads
public/index.html                the dashboard (backend-aware, offline-capable)
```

## How it works
- On the deployed site, imports save to Netlify Blobs, so everyone who opens the site
  sees the same candidates and reqs. The badge by the title reads **● Shared**.
- Open the raw HTML file locally and it still works, storing in your browser only
  (**● This browser**).
- Storage model is *latest snapshot wins*: whoever imports overwrites for everyone.
  A candidate import and a reqs import are merged, so neither clobbers the other.
- Every import also archives the raw file (see the **Uploads** button).

## Deploy (must be a BUILD deploy — the drag-and-drop dropzone will NOT work)

**Option A — Git (best for recurring refreshes, no terminal):**
1. Create a repo at github.com → "uploading an existing file" → drag this whole folder in → Commit.
2. Netlify → Add new project → Import from Git → pick the repo → Deploy.
3. Future refreshes: replace `public/index.html` in the repo (drag-and-drop on GitHub) — Netlify redeploys itself.

**Option B — Netlify CLI, run from inside this folder:**
```
npm install -g netlify-cli
netlify login
netlify init            # create & configure a new site
netlify deploy --build --prod
```

No environment variables to set.

## Protect it (recommended — this holds candidate PII)
In the Netlify site dashboard: **Site configuration → Access & security → Password
protection** (site-wide password), or set up **Netlify Identity** for per-person logins.
This keeps the whole site — page and endpoints — private to your team.

## Smoke test after deploy
```
curl -i https://YOURSITE.netlify.app/api/candidates
```
Expect `200 {}` before anything is published (or your data once imported). Then open the
site (badge should say **● Shared**), import an export, and confirm it shows up in a second
browser/device. Files should appear under the **Uploads** button.
