# FoodSave — Flask + React + shadcn/ui

A food rescue platform for Odisha: donors publish surplus, a random-forest model scores how long each batch stays
safe, and nearby NGOs claim and collect it.

- **Backend** — Python Flask + SQLite + scikit-learn
- **Frontend** — React 18 + Vite + **shadcn/ui** (Tailwind CSS v4 + Radix UI + lucide-react + Recharts)

## 🚀 Quick Start

### 1. Install Python Dependencies

```powershell
cd hybrid_app
pip install -r requirements.txt
```

### 2. Build the Frontend

```powershell
cd frontend
npm install
npm run build      # outputs to ../web/dist, which Flask serves
```

> The frontend build is required once before the first run. Re-run `npm run build` after any frontend change.
> For hot reloading during development, run `python app.py` in one terminal and `npm run dev` in another
> (Vite proxies `/api` to Flask on port 5000).

### 3. Seed the Database (optional — a seeded DB is usually already present)

```powershell
python scripts/seed_db.py
```

Demo accounts: **Donor** `donor1` / `pass123`, **NGO** `ngo1` / `pass123`.

### 4. Run the App

```powershell
python app.py
```

Open **http://127.0.0.1:5000**

## 🌐 GitHub Pages Deployment (Frontend)

This repository includes `.github/workflows/deploy-pages.yml` to deploy the React frontend to GitHub Pages.

1. In GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. (Optional, recommended) Add a repository variable named `VITE_API_BASE_URL` with your backend URL
   (for example, `https://your-backend.example.com`) so API calls from Pages do not point to the Pages domain.
3. Push to `main` (or run the workflow manually) and the site will be published automatically.

The Pages build uses a repository subpath base and also publishes `404.html` as an SPA fallback for client-side routes.

## 🧩 Architecture

Flask serves the API **and** the compiled SPA from `web/dist`. Routing is a normal React Router tree, so any
non-`/api` path falls through to `index.html` and the client router resolves it.

```
hybrid_app/
├── app.py                        Flask API + SQLite + ML model
├── frontend/                     Vite + shadcn/ui source
│   ├── vite.config.js            Builds to ../web/dist, proxies /api in dev
│   ├── components.json           shadcn CLI config (new-york, neutral base)
│   ├── index.html
│   └── src/
│       ├── main.jsx              Theme + App providers, Tooltip, Toaster
│       ├── App.jsx               Route tree, auth guards, public vs portal shell
│       ├── index.css             HIG design system (tokens, slot layer, patterns)
│       ├── lib/
│       │   ├── api.js            fetch wrapper (rejects on non-success status)
│       │   ├── store.jsx         ThemeProvider + AppProvider (session, data, actions, chat)
│       │   ├── format.js         Formatting, CSV export, food-safety helpers
│       │   └── routes.js         Route table, nav config, form option lists
│       ├── components/
│       │   ├── ui/               34 shadcn components (CLI-managed)
│       │   ├── shell.jsx         Public nav, app sidebar, notifications, theme toggle
│       │   ├── common.jsx        KPI, safety badge, page header, action tiles
│       │   ├── charts.jsx        Recharts wrappers on shadcn's ChartContainer
│       │   ├── portal.jsx        Live board, leaderboard, filter bar, footer
│       │   ├── listings-table.jsx
│       │   ├── claim-widgets.jsx Feed card, pickup pass, claim chat
│       │   └── leaflet-map.jsx
│       └── pages/                public · auth · donor · ngo · admin · settings · visualizations
├── requirements.txt
├── scripts/seed_db.py
└── data/                         foodsave.db (gitignored), food_model_v2.pkl
```

## 🎨 Design System

The interface follows the **Apple Human Interface Guidelines**, implemented on top of shadcn/ui's `new-york` style.
shadcn supplies the behaviour and accessibility (Radix primitives); the HIG supplies the entire visual layer.

### Type

SF Pro with the optical-size model: SF Text below 20pt, SF Display at 20pt and above, with the tracking table that
makes the transition invisible. The font stack is `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
"Helvetica Neue", Inter, system-ui`, so Apple devices get SF and everything else falls back to the platform UI font.

Sizes follow the iOS text styles: 34pt large title, 28/22/20pt title styles, 17pt headline and body, 13pt footnote,
11pt caption. Tracking is negative for the display sizes and near zero for the text sizes.

### Colour

The iOS/macOS system palette, in `oklch`:

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `#FFFFFF` | `#000000` |
| `--muted` (grouped background) | `#F2F2F7` | `#1C1C1E` |
| `--primary` (systemBlue) | `#007AFF` | `#0A84FF` |
| `--destructive` (systemRed) | `#FF3B30` | `#FF453A` |

The chrome is deliberately achromatic. Colour is reserved for meaning: the chart series (`--chart-1…5` —
systemBlue, systemGreen, systemOrange, systemPurple, systemTeal) and the food-safety scale
(`--safe`, `--caution`, `--unsafe`).

### Structure

- **Navigation bar** — translucent with `backdrop-filter` and a hairline bottom border.
- **Large titles** — 34pt bold above the content, with a secondary-colour subtitle.
- **Grouped lists** — rounded 12pt containers with inset hairline separators and 44pt rows.
- **Segmented controls** — 2px inset track with a lifted active segment.
- **Controls** — plain / tinted / filled button hierarchy, 10pt filled fields, 51×31pt iOS switches.
- **Touch targets** — 44pt minimum, applied via `@media (pointer: coarse)`.
- **Motion** — Apple's spring-like curve, `cubic-bezier(0.32, 0.72, 0, 1)`, and honouring
  `prefers-reduced-motion`.

### How the theming works

`src/index.css` has two layers, and the split matters:

1. **The slot layer** (unlayered) restyles every shadcn component through its `data-slot` attribute — `button`,
   `card`, `input`, `badge`, `switch`, `tabs-trigger`, `table-cell` and so on. It is deliberately unlayered: shadcn
   ships its own Tailwind utilities on those same elements (`py-6` on `Card`, `h-9` on `Button`), and a layered rule
   would lose to them, leaving the result dependent on the order Tailwind happens to emit them.
   The rule is: **the slot layer declares the properties the design system owns; everything else (width, alignment,
   visibility) stays with shadcn and the call site.**
2. **The pattern layer** (`.hig-*` classes, inside `@layer components`) holds the application-level pieces —
   `.hig-group`, `.hig-row`, `.hig-stat`, `.hig-navbar`, `.hig-meter`. Being in the components layer, an ordinary
   Tailwind utility at a call site still wins.

A call site that needs to deviate from the system uses a `!` utility. An important declaration beats an unlayered
one, so `!px-0` on a `CardContent` overrides the slot layer, while a plain `px-0` would not.

### Adding a shadcn component

```powershell
cd frontend
npx shadcn@latest add <component-name>
```

New components arrive unstyled by the HIG. Give the root element a `data-slot` and add a rule for it in the slot
layer of `src/index.css`.

## ✨ Features

**Public** — Home (hero, how-it-works, live stat strip), Impact (real metrics + charts from `/api/analytics`),
Leaderboard (donors by kg, NGOs by claims), About, Contact (posts to `/api/support`).

**Auth** — Sign in, register (donor/NGO, city + geolocation), forgot password, reset password, one-click demo login.

**Donor** — Dashboard, Donate (live scoring against `/api/ai/predict` with gauge, confidence/urgency meters and a
condition matrix), Active listings, History with inline editing, CSV export, retract and claim chat.

**NGO** — Dashboard, Live feed (filterable, claimable), Map view (Leaflet, markers coloured by safe window and sized
by quantity), Active claims (pickup passes with live countdowns), Claim history, AI advisor (ranked queue with the
reasoning behind each position).

**Admin** — Platform overview, User management (verify / unverify / ban / unban), AI & audit logs.

**Shared** — Visual Lab (real data only), Settings (profile, location, alerts), claim chat with optimistic send and
delivery states, light/dark themes, responsive sidebar drawer on mobile.

## 📊 Data honesty

Every figure on the marketing pages, dashboards and the Visual Lab comes from the database. Charts that previously
computed their own values — the Sankey, waterfall, radar and leaderboard sparklines synthesised from a single
number — were removed rather than restyled. The hard-coded "92% model confidence" and "92.3% accuracy / 0.8h MAE"
figures were replaced with the real `confidence_score` and `priority_score` the API returns.

## 🔐 Security Notes

Demonstration architecture. For production:
- Hash passwords (`bcrypt` or `werkzeug.security`)
- Replace the `localStorage` session with JWT or cookie-based auth — the current role is trusted client-side
- CORS policies, input validation and rate limiting

## 📊 Next Steps

- Real QR codes on pickup passes (needs a code generator and a backend change)
- WebSocket notifications instead of 8-second polling
- Map tile provider key for production traffic
- Code-split the Recharts bundle (currently ~350 kB gzipped)
- Deploy to cloud (PythonAnywhere, Heroku, Render)