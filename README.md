# Parsa's Gallery

Standalone, interactive visual prototype for the three-category, edition-based photography gallery.

## Open the review build

Open `index.html` directly in a browser, or run `python -m http.server 8000` from this directory, then visit `http://localhost:8000`.

Review-mode access (no secure sign-in yet):
- Gallery owner: enter **any nonempty valid email and password** to inspect the owner UI.
- Friends: enter **any nonempty valid email and password** to inspect the friend UI. A friend can comment on or attach an image to a Friends photo only if the photo has a tag with that exact email. For the seeded first edition, `mina@example.test` or `arman@example.test` are tagged on photos 1 or 2; any nonempty password works.
- Visitor: name only.

**Important:** Role selection is deliberately simulated in the standalone review. It is *not authentication* and must never be used to protect an internet-facing writable site. Data is browser-local (`localStorage`, `IndexedDB`), not shared across devices or users. Online deployment with uploads/comments requires wiring Supabase Auth, Storage and database policies first.

## What is interactive

- Three distinct entry paths (owner, friend, visitor).
- Timeline with two completed initial editions; each has exactly 10 Friends, 5 Interactions, and 5 Everything else images.
- Tabbed categories, image lightbox, responsive photo grid, subtle motion.
- Owner creates a new edition by uploading **exactly 20 images** across category-specific slots, publishing only at 20/20. Draft resumes across reloads in the same browser.
- Owner deletes a previous edition, replaces photos, adds/removes multiple friend tags using name + email, and toggles comments on Everything else photographs.
- Owner's Content editor changes category labels and interface copy without editing code; title defaults to *Parsa's Gallery* with no subtitle.
- Friends can comment on tagged Friends images and upload one photo **per tagged gallery photo**; any visitor can comment on Interactions and on Everything else when comments are enabled.
- Replacing a previously published photo clears its friend tags, comments, and friend uploads.
- Email addresses do not appear on the public photo cards or lightbox.

## Assets & design

`theme.json` is the provisional dark Persian-inspired design token proposal. It will be refined after `sample_theme.jpg` arrives. `content.json` lists default interface strings; the owner content editor overrides them locally. Reference photography is temporarily hosted via Unsplash image URLs and will be replaced with your own uploads. The gallery UI avoids filler subtitles and any visible preview/demo labels.

## Recommended GitHub + Supabase implementation

Frontend: keep this static app initially, or migrate UI components to React/Vite once the backend is connected. Host the static frontend on **GitHub Pages**. Backend: **Supabase Auth** (owner/friends), Postgres + RLS (editions, photo metadata, tags, comments and settings), **Supabase Storage** (pictures), with a transaction-scoped `publish_edition()` database function that verifies slot counts atomically. For anonymous comments, add abuse controls and a server-side validation/rate-limit path before opening the site publicly.

`supabase/schema.sql` contains the initial database schema and RLS groundwork. It has **not been applied to a Supabase project**, and the standalone app is **not yet connected** to it. Avoid exposing `service_role` or passwords in frontend code.

### Provisioning accounts and `creds.json`

Your requested `creds.json` can be an offline, private provisioning input used once by an administrator script to create Supabase Auth users. Only Supabase Auth will then manage their password hashes and sessions; `creds.json` must not be deployed, fetched by the browser, or committed to GitHub. `.gitignore` excludes it. Copy `creds.example.json` to `creds.json` privately when ready.

### Deployment path

1. The repository `SinanAksoy/parsa-gallery` has been created and contains the static frontend.
2. Publish the website through **Settings → Pages → Deploy from a branch → main / (root)**.
3. Configure **Settings → Pages → Build and deployment → Deploy from a branch → main / (root)**; this will publish a read-only visual preview only until real backend authorization is wired in.
4. Connect a Supabase project and execute the reviewed migration in `supabase/schema.sql`, then configure Auth users and Storage policies.
5. Replace the simulated role access, local storage and uploads with Supabase session checks, RLS queries, and signed/controlled uploads before making the public site writable.

Do not treat a GitHub Pages deployment of this prototype as a secure multi-user application. The published site must not include the simulated owner/friend mutation interface until Supabase integration is complete.

## Design decisions to confirm

- A friend receives **one supplementary upload per Friends photo they are tagged in** (rather than one upload across the whole site).
- Updating a historical gallery photo erases associated comments, tags and supplementary friend uploads; editing a tag alone does not remove comments.
- Editions use a calendar date and exactly 20 owner photos (10+5+5). Supplementary friend uploads do not count against those 20 slots.