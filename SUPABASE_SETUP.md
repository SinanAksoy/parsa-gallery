# Supabase setup — Parsa's Gallery

Current state (18 October 2026): The live site now contains the optional Supabase adapter (`cloud.js` and cloud-enabled `app.js`). It **continues in browser-local mode while `config.js` is empty**. There is no access to your Supabase project from this GitHub repository; whether its schema has been applied must be verified in Supabase. Local-mode Owner/Friends sign-in is simulated and not secure.

## 1. Create a Supabase project

Visit https://supabase.com/dashboard and choose **New project**. Name it `parsa-gallery`. Choose the organization, region and a strong **database password** (not a gallery login password). The free plan is enough for initial testing. Store the database password privately.

## 2. Initialize the database

First check **Table Editor** for the `profiles`, `editions`, `photos`, `photo_tags`, `comments`, and `friend_uploads` tables. If absent, open **SQL Editor**, paste and run [supabase/schema.sql](supabase/schema.sql) once on an empty project. **Do not rerun** the creation script when the tables already exist.

**Important:** This schema is for a new/empty project. It creates the tables, foreign keys, publication guards, row-level security (RLS) policies, `parsa-images` bucket, and a secure role model. It does not create user passwords or populate editions.

## 3. Create the gallery owner (one time)

In **Authentication → Users → Add user**, create the owner's email/password account and confirm it. Do not send the password to ChatGPT and never commit it to GitHub.

Then run in SQL Editor, replacing only the email and display name:

```sql
insert into public.profiles (id, email, display_name, role)
select id, lower(email), 'Parsa', 'owner'
from auth.users
where lower(email) = lower('YOUR_OWNER_EMAIL@example.com');
```

Confirm with:

```sql
select id, email, display_name, role from public.profiles;
```

The database allows exactly one owner.

## 4. Add friends as needed

Create each friend under **Authentication → Users**, then provision a friend profile:

```sql
insert into public.profiles (id, email, display_name, role)
select id, lower(email), 'Friend display name', 'friend'
from auth.users
where lower(email) = lower('FRIEND_EMAIL@example.com');
```

Owner tagging can use names/emails before a friend's account exists. Their tagged-photo permissions activate when the account is provisioned with the matching email.

## 5. Browser configuration — public values only

Find **Project URL** and **publishable key** using the project's **Connect** dialog or **Settings → API Keys**. Those are safe to use in the browser when RLS is correctly configured.

Do **not** put `sb_secret_...`, a legacy `service_role` key, database passwords or user passwords into `config.js`, `creds.json` in GitHub, or GitHub Pages.

Target URL for the website: https://sinanaksoy.github.io/parsa-gallery/

Edit [config.js](config.js) in GitHub, replacing **only** `url` and `publishableKey` with your actual public values:

```js
window.PARSA_SUPABASE = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_YOUR_PUBLIC_KEY'
};
```

Click **Commit changes** and wait for GitHub Pages to deploy. When these two values are valid, the site switches to Supabase mode. Before changing `config.js`, ensure the schema exists and the owner profile is present. If unsure, leave the two values empty until verified.

For Auth email links, set **Authentication → URL Configuration → Site URL** to this website. If using email confirmations or password recovery links, also add it to allowed redirect URLs.

## 6. Connect app and test permissions

The frontend already contains the cloud adapter and will switch when the public configuration is set. **Existing local editions are not transferred automatically**, including photographs stored in Safari's IndexedDB. Back up/export or arrange a migration before clearing Safari storage or assuming the old editions are in Supabase. Supabase starts with no editions unless you import or create them in cloud mode.

Test the following on separate browsers: anonymous visitor sees only published editions; a friend can post/comment only where tagged; an owner can create 20-slot draft, publish, replace and delete editions; all visitors see shared updates.

## Remaining work before unrestricted public commenting

Anonymous comments need abuse protection (e.g. CAPTCHA, server-side rate limits and moderation). Photo replacement/deletion must also clean orphaned Storage objects. Current bucket is PUBLIC for gallery images, including hard-to-guess draft object URLs. Test RLS carefully before using real sensitive photographs.
