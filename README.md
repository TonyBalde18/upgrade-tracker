# Upgrade Tracker

A personal web app to plan and track ServiceNow family-release upgrades (for example Zurich to Australia) for all your customers: a dashboard, a canvas view, a global week-by-week timeline, a day-by-day plan per customer, "My week", and calendar export for Outlook.

- **Code** (this repository, public): `upgrade-tracker`, published with GitHub Pages at <https://tonybalde18.github.io/upgrade-tracker/>.
- **Data** (private repository): `upgrade-tracker-data`, a single file `tracker.json` that the app reads and writes with your personal token.

> **Privacy.** This repository contains no customer data, no tokens and no secrets. Real data only lives in your browser and in the private data repository. The demo data uses fictional companies (Acme Corp, Globex…).

---

## Contents

1. [Run it on your PC](#1-run-it-on-your-pc)
2. [Publish it on GitHub Pages](#2-publish-it-on-github-pages)
3. [Create the private data repository and the token](#3-create-the-private-data-repository-and-the-token)
4. [Connect the app to GitHub](#4-connect-the-app-to-github)
5. [Everyday tasks: backup, token renewal, updates](#5-everyday-tasks)
6. [Using the app](#6-using-the-app)
7. [Troubleshooting](#7-troubleshooting)
8. [For developers](#8-for-developers)

---

## 1. Run it on your PC

**You need:** Node.js 20 or newer. Check in a terminal with `node -v`. If the command is unknown, install the **LTS** version from <https://nodejs.org> (default options), then open a new terminal.

Open the project folder in VS Code (**File → Open Folder… → `upgrade-tracker`**), then open a terminal (**Terminal → New Terminal**) and run:

```powershell
npm install
npm run dev
```

Open the address it prints, usually <http://localhost:5173/>.

- The first time, the app opens in **Local mode** with a welcome screen. Click **Load demo data** to try everything with fictional customers, or paste your customer names (one per line).
- Stop the app with `Ctrl+C` in the terminal.

> If you see _"npm.ps1 cannot be loaded because running scripts is disabled"_, see [Troubleshooting](#7-troubleshooting).

---

## 2. Publish it on GitHub Pages

Do this once.

1. On GitHub, create a new repository named **`upgrade-tracker`**, **Public**, and **empty** (no README, no .gitignore, no licence).
2. In the VS Code terminal, in the project folder:

   ```powershell
   git remote add origin https://github.com/TonyBalde18/upgrade-tracker.git
   git push -u origin main
   ```

3. On GitHub, open the repository → **Settings** → **Pages** → **Build and deployment** → **Source: GitHub Actions**.
4. Open the **Actions** tab. A run called **"Deploy to GitHub Pages"** checks the code (lint and tests), builds and publishes the site. It takes 1 to 2 minutes; a green tick means done.
5. The site is at **<https://tonybalde18.github.io/upgrade-tracker/>** (the link is also shown on the finished run and in **Settings → Pages**).

From then on, every push to `main` publishes the new version automatically.

---

## 3. Create the private data repository and the token

### The data repository

1. On GitHub: **New repository** → name **`upgrade-tracker-data`** → **Private** → tick **Add a README file** (so the `main` branch exists) → **Create repository**.
2. You don't need to add anything else: the app creates `tracker.json` on the first save.

### The fine-grained token

1. On GitHub: your profile picture → **Settings** → **Developer settings** (at the bottom) → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name:** `upgrade-tracker`. **Expiration:** e.g. 90 days (put a reminder in your calendar).
3. **Repository access:** **Only select repositories** → choose **`upgrade-tracker-data`** only.
4. **Permissions** → **Repository permissions** → **Contents: Read and write**. (Metadata: Read-only is added automatically. Nothing else is needed.)
5. **Generate token** and copy it right away (it starts with `github_pat_`). GitHub shows it only once.

The token can only read and write files in your data repository. It cannot touch the code repository or your account.

---

## 4. Connect the app to GitHub

1. In the app: **Settings → Data & sync**. Owner (`TonyBalde18`), repository (`upgrade-tracker-data`), branch (`main`) and file (`tracker.json`) are already filled in.
2. Paste the token → **Save token**. It is stored only in this browser and shown masked.
3. Click **Test connection**. You should see three green ticks:
   - **Token**: valid, with its expiry date
   - **Access to TonyBalde18/upgrade-tracker-data**: private repository
   - **File tracker.json on main**: "not created yet" the first time, which is fine
4. Switch **Mode** to **GitHub**.
   - If GitHub has no data yet, the data in this browser is uploaded and `tracker.json` is created.
   - If both sides have data, the app asks which one to keep.
5. From now on, changes are saved to GitHub about 3 seconds after your last edit. The indicator at the top right shows **Unsaved → Saving… → Saved ✓**. `Ctrl+S` (or clicking the indicator) saves immediately.

Every save is a commit in the data repository with a readable message, e.g. `Acme Corp - Australia: "Upgrade DEV to Australia release" → Completed`, so you have a full history.

**Using another browser or PC:** open the site, paste the token in Settings, switch to GitHub. The token is stored per browser and per site, so `localhost` and the published site each need it once.

**If two browsers edit at the same time**, the second one to save shows **"Data changed elsewhere"** and lets you **Reload from GitHub**, **Overwrite with mine**, or first **Download my version**. Nothing is ever overwritten silently.

---

## 5. Everyday tasks

### Back up

- **Settings → Backup → Export JSON** downloads everything (customers, logos, upgrades, template, settings) as one file. Keep it somewhere private: it contains customer data.
- **Import JSON** restores a backup (it asks before replacing anything).
- In GitHub mode, the data repository also keeps every previous version: open `tracker.json` on GitHub → **History**.

### Renew the token (before or after it expires)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens** → open `upgrade-tracker` → **Regenerate token** (or create a new one with the same settings as in step 3).
2. In the app: **Settings → Data & sync → Forget token**, paste the new one → **Save token** → **Test connection**.

If the token has expired, the sync indicator shows **Error** with "The token is invalid or has expired". Your edits stay in the browser and are sent once the new token is saved.

### Update the app

1. Change the code (or ask for changes), then in the terminal:

   ```powershell
   npm run lint
   npm run test
   git add -A
   git commit -m "Describe the change"
   git push
   ```

2. GitHub Actions checks, builds and publishes it. Refresh the site after the green tick.

---

## 6. Using the app

| Where                   | What                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard** (`G` `D`) | Countdown to the next window, overdue / blocked / Go-No-Go tiles, 30-day activity strip, a card per active upgrade with its phase flow and next steps                                   |
| **Canvas** (`G` `C`)    | One lane per upgrade: Preparation → DEV → UAT → Go/No-Go → PROD → Hypercare. Click a phase to see its tasks, double-click to open the plan, drag lanes, or switch to a shared time axis |
| **Timeline** (`G` `T`)  | ISO-week grid of all upgrades. Drag a ◆ window to reschedule it. Red stripes = two customers on PROD the same night                                                                     |
| **My week** (`G` `W`)   | Overdue and blocked first, then the next 7 / 14 / 30 days day by day, with one-click done                                                                                               |
| **Upgrade plan**        | Windows (DEV / UAT / PROD, UAT can be N/A), the 24 steps grouped by phase with a day-by-day Gantt, recalculate / shift / duplicate / apply template, activity log                       |
| **Customers**           | Details, ServiceNow contact, consultants, instance links, **logo**, upgrade history                                                                                                     |
| **Template**            | The standard steps: owner, assignee, anchor window, offset, duration, kind, with a live preview                                                                                         |
| **Settings**            | GitHub connection, backup, time zones, owner / assignee lists, statuses, theme, animations                                                                                              |

**Keyboard:** `Ctrl+K` command palette · `/` search · `N` new upgrade · `G` then `D`/`C`/`T`/`W` go to a view · `Ctrl+S` save · `Ctrl+Z` / `Ctrl+Shift+Z` undo / redo.

**Calendar (.ics):** on a plan, **⋯ → Export to calendar**. On the Timeline or My week, **Export upcoming**. Choose _Windows only_, _Windows + milestones_ or _Everything_, then double-click the file (or in Outlook: **File → Open & Export → Import/Export → Import an iCalendar (.ics)** → **Import**). Exporting again later updates the same events instead of creating duplicates.

**Customer logos:** Customers → pick a customer → **Logo**: upload, drag an image in, or click the box and press `Ctrl+V`. The image is shrunk to 128 px and stored only in your private data file.

---

## 7. Troubleshooting

| Problem                                                        | Fix                                                                                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.ps1 cannot be loaded because running scripts is disabled` | Run once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, answer `Y`, open a new terminal. (Or type `npm.cmd` instead of `npm`.) |
| `Could not read package.json`                                  | The terminal is in the wrong folder: `cd "C:\Users\Tony Baldé\OneDrive - Incognit Clouds, Lda\P4M\upgrade-tracker"`                                      |
| Test connection: **Invalid or expired token**                  | Create or regenerate the token (section 5) and paste it again                                                                                            |
| Test connection: **Repository not found, or no access**        | Check owner and repository name, and that the token's repository access includes `upgrade-tracker-data`                                                  |
| **Not allowed to write**                                       | The token needs **Contents: Read and write**                                                                                                             |
| Sync indicator **Offline**                                     | Nothing to do: edits are kept and sent when GitHub is reachable again                                                                                    |
| **Data changed elsewhere**                                     | Another browser saved in the meantime. Choose Reload, Overwrite, or Download my version first                                                            |
| The site shows an old version                                  | Refresh with `Ctrl+F5`, and check the last run in the **Actions** tab is green                                                                           |
| OneDrive is slow or a build fails with "file locked"           | Pause OneDrive sync while running `npm install` or `npm run build` (the `node_modules` folder holds many small files)                                    |

---

## 8. For developers

| Command           | What it does                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`     | Development server with hot reload                                                                                                                                  |
| `npm run build`   | Type-check and build the site into `dist/` (adds the Content-Security-Policy)                                                                                       |
| `npm run preview` | Serve the built site at <http://localhost:4173/upgrade-tracker/>                                                                                                    |
| `npm run test`    | Unit tests (Vitest): dates and time zones, ISO weeks, template scheduling, N/A without UAT, ICS, migrations, GitHub sync and conflicts, smoke tests of every screen |
| `npm run lint`    | ESLint                                                                                                                                                              |
| `npm run format`  | Prettier                                                                                                                                                            |

**Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Motion, React Flow, Radix UI, dnd-kit, Zustand (+ Immer, zundo for undo/redo), date-fns / date-fns-tz, zod, cmdk, sonner, TanStack Virtual, lucide-react, self-hosted fonts.

**Structure**

```
src/
  app/            shell, routing, command palette, shortcuts, sync dialogs
  features/       dashboard, canvas, timeline, plan, week, customers, template, settings, ics
  lib/            dates, ics, template (scheduling), upgrade (logic), timeline, agenda,
                  github (API client), storage, migrations, model (types + zod schema), images
  store/          Zustand store, edit actions, persistence + GitHub sync engine
  theme/          brand.ts (Plat4mation colours and fonts), tokens, motion
  components/ui/  shared UI (buttons, dialogs, status badges, red flow…)
  demo/           fictional demo data
```

**Brand:** colours and fonts live in `src/theme/brand.ts` (signature red `#E1292C`, night `#0F0100`). To use the official font later, change `fonts` there and the `@fontsource` import in `src/main.tsx`.

**Data model:** `src/lib/model/types.ts` (schema version 1). To change it: bump `SCHEMA_VERSION`, add a migration in `src/lib/migrations/index.ts`, update the zod schema and add a test.

**Security:** strict Content-Security-Policy (only this site and `api.github.com`), no raw HTML from user data, only `http(s)` links are clickable, logos are re-encoded as small raster images, the token is sent only in the `Authorization` header and never logged.
