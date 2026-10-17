# Supabase setup — Parsa's Gallery

Current state: GitHub Pages still serves the **browser-local review site**. The SQL schema is committed, but no Supabase project has been connected and no migration has been applied. Do not treat the simulated Owner/Friends login as secure.

## 1. Create a Supabase project

Visit https://supabase.com/dashboard and choose **New project**. Name it `parsa-gallery`. Choose the organization, region and a strong **database password** (not a gallery login password). The free plan is enough for initial testing. Store the database password privately.

## 2. Initialize the database

In the new project's **SQL Editor**, paste and run the complete contents of [supabase/schema.sql](supabase/schema.sql).

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

For Auth email links, set **Authentication → URL Configuration → Site URL** to this website. If using email confirmations or password recovery links, also add it to allowed redirect URLs.

## 6. Connect app and test permissions

The frontend must next be switched from localStorage/IndexedDB to Supabase Auth, Postgres, and Storage. Once the connection is configured, the current locally seeded editions and previously uploaded browser-only photographs will not appear in Supabase automatically; they require an explicit import. Do not overwrite user browser data expecting an automatic migration.

Test the following on separate browsers: anonymous visitor sees only published editions; a friend can post/comment only where tagged; an owner can create 20-slot draft, publish, replace and delete editions; all visitors see shared updates.

## Remaining work before unrestricted public commenting

Anonymous comments need abuse protection (e.g. CAPTCHA, server-side rate limits and moderation). Photo replacement/deletion must also clean orphaned Storage objects. Current bucket is PUBLIC for gallery images, including hard-to-guess draft object URLs. Test RLS carefully before using real sensitive photographs.
