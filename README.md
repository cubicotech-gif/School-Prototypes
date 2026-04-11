# Cubico School Prototypes

Private repository for school website prototypes — used as pitch demos to land new clients.

Each folder is a self-contained, deploy-ready website. One GitHub repo + one Vercel project hosts them all.

---

## 📁 What's in this repo

```
school-prototypes/
├── .gitignore
├── README.md              ← you are here
├── vercel.json            ← clean URLs + noindex (hides from Google)
├── index.html             ← PRIVATE internal dashboard (do not share)
├── msl-clifton/
│   └── index.html         ← MSL Clifton prototype
└── playway-grammar/
    └── index.html         ← Playway Grammar prototype
```

**Important:** These are plain HTML files with embedded CSS. No build step, no `npm install`, no dependencies. They just work.

---

## 🏃 How to run these files

### Option 1 — Just open them (simplest)

Double-click any `index.html` file on your computer. It opens in your browser. Done.

This works for previewing, but some browsers block certain features when opening files directly (`file://` URLs). For a proper preview, use Option 2.

### Option 2 — Run a local server (recommended for previewing)

Open your terminal inside the repo folder and run **one** of these:

```bash
# If you have Python 3 installed (most Macs and Linux already do)
python3 -m http.server 8000

# If you have Node.js installed
npx serve

# If you use VS Code, install the "Live Server" extension and click "Go Live"
```

Then open your browser to:

- `http://localhost:8000/` → internal dashboard
- `http://localhost:8000/msl-clifton/` → MSL demo
- `http://localhost:8000/playway-grammar/` → Playway demo

Press `Ctrl+C` in the terminal to stop the server.

### Option 3 — Deploy to Vercel (what you actually want for pitching)

See the **Deployment** section below.

---

## 🚀 Deployment — step by step

### First-time setup (do this once)

**1. Create a private GitHub repo**

Go to [github.com/new](https://github.com/new):
- Repository name: `cubico-school-demos`
- Set to **Private** (important — you don't want clients finding other schools' demos)
- Don't initialize with a README (we already have one)
- Click "Create repository"

**2. Push this folder to GitHub**

Open terminal in this `school-prototypes` folder and run:

```bash
git init
git add .
git commit -m "Initial commit: MSL Clifton + Playway Grammar prototypes"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/cubico-school-demos.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

**3. Connect to Vercel**

- Go to [vercel.com](https://vercel.com) and log in with your GitHub account
- Click **"Add New... → Project"**
- Find `cubico-school-demos` in the list and click **Import**
- Framework preset: **Other** (Vercel will auto-detect static HTML)
- Leave all other settings as default
- Click **Deploy**

In about 30 seconds, you'll get a live URL like `cubico-school-demos.vercel.app`.

**4. Test your live URLs**

- `https://cubico-school-demos.vercel.app/` → internal dashboard (keep private)
- `https://cubico-school-demos.vercel.app/msl-clifton/` → MSL pitch link ✉️
- `https://cubico-school-demos.vercel.app/playway-grammar/` → Playway pitch link ✉️

### Going forward (after first setup)

Every time you add a new school or edit a file, just:

```bash
git add .
git commit -m "Add new school prototype"
git push
```

Vercel auto-deploys within 30 seconds. No manual upload needed.

---

## ➕ How to add a new school

1. Create a new folder with a URL-safe name (lowercase, dashes, no spaces):
   ```
   mkdir beaconhouse-pecs
   ```

2. Copy one of the existing prototypes as a starting point:
   ```bash
   cp msl-clifton/index.html beaconhouse-pecs/index.html
   ```

3. Customize the content, colors, school name, and contact details inside `beaconhouse-pecs/index.html`

4. Add a card for it in the root `index.html` (so you can find it in your internal dashboard)

5. Commit and push:
   ```bash
   git add .
   git commit -m "Add Beaconhouse PECS prototype"
   git push
   ```

The new demo is live at `your-project.vercel.app/beaconhouse-pecs/` within a minute.

---

## 💡 Pro tips

**Use a custom subdomain** — once you're happy with the setup, point a subdomain like `demos.cubico.com` at the Vercel project. Your pitch links become:
- `demos.cubico.com/msl-clifton/`
- `demos.cubico.com/playway-grammar/`

This looks far more professional in a cold email than a `vercel.app` URL, and reinforces the Cubico brand every time a principal clicks.

**Only share the specific school link** — never share the root URL (`/`). The root page is your internal dashboard and lists all demos. Sharing it would let one school discover the others.

**Keep designs visually distinct** — the MSL and Playway prototypes deliberately look like they came from different studios (different fonts, colors, layouts). When a principal asks "can we see other schools you've designed for?", each one feels custom, not templated.

**Noindex is already set** — `vercel.json` adds `X-Robots-Tag: noindex, nofollow` headers so these demos never appear in Google search results.

---

## 🛠️ Tech stack

- Plain HTML5 + CSS3 (embedded, no external stylesheets)
- Google Fonts (loaded via CDN)
- No JavaScript frameworks
- No build step
- Hosted on Vercel (static file hosting)

That's it. Minimal, fast, and dead simple to maintain.

---

© Cubico Technologies · For internal pitching use only
