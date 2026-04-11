# Cubico School Prototypes

Private repository for school website prototypes — used as pitch demos to land new clients.

Each school is a self-contained, deploy-ready website with **4 public pages** (Home, About, Programs, Admissions) and **1 hidden admin page** for uploading real school imagery via Supabase.

---

## What's in this repo

```
school-prototypes/
├── README.md
├── vercel.json                    ← clean URLs + noindex headers
├── supabase-config.js             ← paste your Supabase keys here ONCE
├── index.html                     ← PRIVATE internal dashboard (do not share)
│
├── shared/                        ← shared infrastructure (don't duplicate per school)
│   ├── image-loader.js            ← swaps placeholder images with uploaded ones
│   ├── admin-uploader.js          ← admin upload UI logic (used by every admin.html)
│   └── admin-styles.css           ← admin page styles
│
├── msl-clifton/                   ← MSL Clifton prototype
│   ├── index.html                 ← Home
│   ├── about.html                 ← About / Story / Leadership
│   ├── programs.html              ← Programs / Curriculum
│   ├── admissions.html            ← Admissions / Apply / Contact
│   ├── admin.html                 ← Image upload page (password-gated)
│   └── styles.css                 ← School-specific design
│
└── playway-grammar/               ← Playway Grammar prototype
    ├── index.html
    ├── about.html
    ├── programs.html
    ├── admissions.html
    ├── admin.html
    └── styles.css
```

**No build step.** Plain HTML + CSS + a few small JS files. No `npm install`, no dependencies, no framework.

---

## The Rule (every school follows this template)

Every new school folder MUST contain exactly these 6 files:

| File | Purpose |
|---|---|
| `index.html` | Home page — hero, story teaser, programs preview, why us, testimonials, CTA |
| `about.html` | About page — full story, values, principal, campus gallery |
| `programs.html` | Programs page — full program details + curriculum approach |
| `admissions.html` | Admissions page — process steps, contact form, school info |
| `admin.html` | Hidden admin uploader (password-gated, never linked from nav) |
| `styles.css` | School-specific design — colors, fonts, layout flourishes |

Every school uses the **same 20 image slots** so the admin page is identical:

| Section | Slots |
|---|---|
| Brand | `logo` |
| Hero backgrounds | `hero-home`, `hero-about`, `hero-programs`, `hero-admissions` |
| About page | `about-story`, `principal-photo`, `campus-1`, `campus-2`, `campus-3` |
| Programs page | `program-1`, `program-2`, `program-3`, `program-4` |
| Gallery | `gallery-1`, `gallery-2`, `gallery-3`, `gallery-4` |
| Admissions page | `admissions-photo` |

**Design changes per school. Structure does not.** That's the whole point — every prototype is consistent under the hood, so the admin page works the same way for every client.

---

## One-time setup — Supabase

Image uploads are powered by Supabase (free tier — generous, never charges for pitch demos).

### 1. Create the Supabase project (5 minutes)

1. Go to https://supabase.com → **New Project** → name it `cubico-schools`
2. Pick a region close to Karachi (Singapore or Mumbai)
3. Set a database password and save it somewhere
4. Wait ~60 seconds for the project to provision

### 2. Run the SQL setup (one click)

Open **SQL Editor → New query** in the Supabase dashboard, paste this, click **Run**:

```sql
-- Bucket for all school images (every school uses the same bucket,
-- with a folder prefix per school slug)
insert into storage.buckets (id, name, public)
values ('school-images', 'school-images', true)
on conflict (id) do nothing;

-- Storage policies: public read + public write
create policy "Public read school-images"
  on storage.objects for select
  using (bucket_id = 'school-images');
create policy "Public insert school-images"
  on storage.objects for insert
  with check (bucket_id = 'school-images');
create policy "Public update school-images"
  on storage.objects for update
  using (bucket_id = 'school-images');
create policy "Public delete school-images"
  on storage.objects for delete
  using (bucket_id = 'school-images');

-- Table mapping (school, slot) -> uploaded image URL
create table if not exists public.school_images (
  school_slug  text        not null,
  slot         text        not null,
  url          text        not null,
  updated_at   timestamptz not null default now(),
  primary key (school_slug, slot)
);

alter table public.school_images enable row level security;

create policy "Public read school_images"
  on public.school_images for select
  using (true);
create policy "Public insert school_images"
  on public.school_images for insert
  with check (true);
create policy "Public update school_images"
  on public.school_images for update
  using (true);
create policy "Public delete school_images"
  on public.school_images for delete
  using (true);
```

### 3. Paste your Supabase keys into `supabase-config.js`

1. Supabase Dashboard → **Project Settings → API**
2. Copy the **Project URL** and the **anon public** key
3. Open `/supabase-config.js` in this repo and replace the placeholders:

```js
window.CUBICO_CONFIG = {
  SUPABASE_URL:      "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
  ADMIN_PASSWORD:    "change-me-now",   // password for admin pages
  STORAGE_BUCKET:    "school-images",   // leave as is
};
```

**The anon key is safe to commit.** It's designed to be public — security comes from RLS policies + the admin password gate.

That's it. Forever. Every new school you create after this will use the same Supabase project — no further setup required.

---

## Running locally

Open your terminal in the repo folder and run **one** of these:

```bash
# Python (most Macs and Linux already have it)
python3 -m http.server 8000

# Node.js
npx serve

# VS Code: install "Live Server" extension, click "Go Live"
```

Then open:
- `http://localhost:8000/` → internal dashboard
- `http://localhost:8000/msl-clifton/` → MSL home
- `http://localhost:8000/msl-clifton/about.html` → MSL about
- `http://localhost:8000/msl-clifton/admin.html` → MSL admin uploader
- `http://localhost:8000/playway-grammar/` → Playway home
- … etc

---

## Deploying to Vercel

If the repo is already pushed to GitHub, just connect Vercel to it once:

1. https://vercel.com → **Add New… → Project**
2. Find `school-prototypes` in the list → **Import**
3. Framework Preset: **Other** (do not pick a framework — it's static HTML)
4. Build Command: leave **empty**
5. Output Directory: leave **empty**
6. Click **Deploy**

After that, every `git push` to `main` auto-deploys in ~30 seconds. No manual upload.

Optional: add a custom subdomain like `demos.cubico.com` in Vercel → Project Settings → Domains.

---

## Adding a new school (the workflow)

Copy `msl-clifton` or `playway-grammar` as a starting point:

```bash
cp -r msl-clifton beaconhouse-pecs
cd beaconhouse-pecs
```

Then in every file:

1. **`index.html`, `about.html`, `programs.html`, `admissions.html`** — update the copy: school name, taglines, programs, addresses, phone numbers, testimonials. Leave the structure alone.
2. **`styles.css`** — change the colour palette (`--cream`, `--burgundy`, etc), the Google Font, and any layout flourishes that should feel different for this school.
3. **`admin.html`** — change ONE line:
   ```js
   window.CUBICO_SCHOOL = { slug: "beaconhouse-pecs", name: "Beaconhouse PECS" };
   ```
4. **All public pages** — change the bottom script call to match the slug:
   ```js
   CubicoImages.init("beaconhouse-pecs");
   ```
5. **Root `index.html`** — add a card for the new school in the demo grid

Then upload images via the admin page and `git push`. Done.

The `slug` you use becomes the folder prefix in Supabase Storage and the row key in `school_images`. Use lowercase, dashes, no spaces.

---

## How the image system works

1. **Public pages** (Home/About/etc) ship with placeholder Unsplash images. Each `<img>` and hero background has a `data-slot="..."` or `data-slot-bg="..."` attribute.
2. On page load, `shared/image-loader.js` fetches `school_images` from Supabase for the current school slug and swaps any `<img src>` and CSS `--slot-image` variables for the uploaded URLs.
3. Repeat visitors get instant loading via `localStorage` caching (5 min TTL). First visit shows placeholders for ~200ms before real images load.
4. The **admin page** (`admin.html`) is password-gated, lists all 20 slots, and lets you upload files directly to Supabase Storage. Each upload also writes a row to `school_images` so the public pages can find it.
5. Uploads bust the cache so the new image shows up on the live site within seconds.

---

## Pro tips

**Only share specific school links.** Never share the root `/` URL — that's your internal dashboard and lists every school. Send principals only their `/school-name/` link.

**Never share the `/admin.html` URL** with anyone. It's password-gated but the URL itself shouldn't get out.

**Designs should feel distinct.** The MSL and Playway prototypes deliberately look like they came from different studios — different fonts, palettes, layouts. When a principal asks "what other schools have you designed for?", each one should feel custom, not templated.

**Noindex is set everywhere.** `vercel.json` adds `X-Robots-Tag: noindex, nofollow` headers. Every HTML file also has the `<meta name="robots">` tag. These demos should never appear in Google results.

---

## Tech stack

- Plain HTML5 + CSS3 (one stylesheet per school)
- ~600 lines of vanilla JS for upload + image loading
- Google Fonts via CDN
- Supabase for image storage + URL persistence
- No frameworks, no build step, no `node_modules`
- Hosted on Vercel (static file hosting)

That's it. Minimal, fast, and dead simple to maintain.

---

© Cubico Technologies · For internal pitching use only
