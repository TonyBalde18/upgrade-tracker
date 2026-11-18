# Upgrade Tracker

A personal web app to plan and track ServiceNow family-release upgrades (for example Zurich to Australia) for all your customers: a dashboard, a canvas view, a global week-by-week timeline, a day-by-day plan per customer, "My week", and calendar export for Outlook.

- **Code** (this repository, public): published with GitHub Pages at <https://tonybalde18.github.io/upgrade-tracker/>.
- **Data**: in a Firebase (Google) database that only your Google account can open. You sign in with Google on the site; nothing is shown before that.

> **Privacy.** This repository contains no customer data and no secrets. The Firebase settings in `src/firebase.config.ts` are public by design (every Firebase web app sends them to the browser); the data is protected by Google sign-in and the database rules. The demo data uses fictional companies (Acme Corp, Globex…).

---

## Contents

1. [Run it on your PC](#1-run-it-on-your-pc)
2. [Publish it on GitHub Pages](#2-publish-it-on-github-pages)
3. [Set up Firebase (once)](#3-set-up-firebase-once)
4. [Sign in and load your data](#4-sign-in-and-load-your-data)
5. [Everyday tasks: backup, updates](#5-everyday-tasks)
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

Open the address it prints, usually <http://localhost:5173/>, and sign in with Google. Your PC uses the same database as the published site, so you see the same data.

- Stop the app with `Ctrl+C` in the terminal.
- Until Firebase is set up (section 3), the app shows _"Firebase is not set up yet"_.

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
5. The site is at **<https://tonybalde18.github.io/upgrade-tracker/>**.

From then on, every push to `main` publishes the new version automatically.

---

## 3. Set up Firebase (once)

Firebase's free plan (Spark) is far more than this app needs. You don't need to add a payment method. The Firebase console changes its wording from time to time; if a button has a slightly different name, pick the closest one.

### 3.1 Create the project

1. Go to <https://console.firebase.google.com> and sign in with the Google account you will use for the app.
2. **Create a project** (or **Add project**) → name it **`upgrade-tracker`** → continue.
3. Turn **Google Analytics off** (not needed) → **Create project** → **Continue**.

### 3.2 Turn on Google sign-in

1. Left menu: **Build → Authentication** → **Get started**.
2. Tab **Sign-in method** → **Google** → switch **Enable** on → choose your email as **Project support email** → **Save**.
3. Tab **Settings** → **Authorized domains** → **Add domain** → type **`tonybalde18.github.io`** → **Add**. (`localhost` is already in the list, so the app also works on your PC.)

### 3.3 Create the database

1. Left menu: **Build → Firestore Database** → **Create database**.
2. If asked for an edition, choose **Standard**. Keep the database ID **(default)**.
3. **Location:** an EU location, e.g. **`eur3 (Europe)`** or **`europe-west6 (Zurich)`**. This can't be changed later.
4. Choose **Start in production mode** → **Create**.

### 3.4 Allow only your account

1. In **Firestore Database**, open the **Rules** tab.
2. Replace everything with the text below, and put **your own Google email address** where it says `YOUR-EMAIL@gmail.com`:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null
           && request.auth.uid == uid
           && request.auth.token.email == "YOUR-EMAIL@gmail.com"
           && request.auth.token.email_verified == true;
       }
     }
   }
   ```

3. Click **Publish**.

Now only that Google account can read or write, and only its own data. Anyone else who signs in on the site sees _"No access"_ and no data. The email address stays in Firebase; it is not in the code.

### 3.5 Connect the app to the project

1. Click the **gear icon** next to _Project Overview_ → **Project settings** → tab **General**.
2. Under **Your apps**, click the **web icon `</>`** → nickname **`upgrade-tracker`** → leave _Firebase Hosting_ unticked → **Register app**.
3. Firebase shows a block of code with `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`. You need four values from it: **apiKey**, **authDomain**, **projectId** and **appId**. (You can find them again later on the same page.)
4. Open `src/firebase.config.ts` in VS Code and fill them in, keeping the quotes:

   ```ts
   export const firebaseConfig = {
     apiKey: 'AIza...',
     authDomain: 'upgrade-tracker-xxxxx.firebaseapp.com',
     projectId: 'upgrade-tracker-xxxxx',
     appId: '1:1234567890:web:abc123',
   }
   ```

5. Save the file, check that the app starts (`npm run dev`, sign in), then publish it:

   ```powershell
   git add src/firebase.config.ts
   git commit -m "Connect the Firebase project"
   git push
   ```

These values are not secret (they identify the project, they don't give access to it), so they can go in the public repository.

---

## 4. Sign in and load your data

1. Open the site and click **Sign in with Google**. A Google window opens. If nothing happens, allow pop-ups for the site.
2. The first time, the database is empty and you see the welcome screen:
   - **Import JSON** loads a backup or a prepared `tracker.json` file.
   - **Load demo data** fills it with fictional customers to try things out.
   - Or paste your customer names, one per line.
3. From now on everything saves automatically about a second after each change. The indicator at the top right shows **Saving… → Saved ✓**; `Ctrl+S` saves right away.

**Several devices:** sign in on each one. Changes appear on the others within a second or two. If two devices change **different** customers or upgrades at the same time, both changes are kept. If they change the **same** upgrade at the same moment, the last save wins.

**Offline:** the app keeps working with the copy in your browser. Changes are sent as soon as you are back online, even if you closed the tab in between.

**Sign out:** Settings → Account & sync → **Sign out** (or `Ctrl+K` → _Sign out_). This also removes the offline copy from that browser, so use it on shared computers.

---

## 5. Everyday tasks

### Back up

- **Settings → Backup → Export JSON** downloads everything (customers, logos, upgrades, template, settings) as one file. Keep it somewhere private: it contains customer data.
- **Import JSON** restores a backup (it asks before replacing anything).
- The free Firebase plan keeps **no version history**, so export a backup regularly, for example once a month and before big changes.

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

### Allow a different Google account

Firebase console → **Firestore Database → Rules** → change the email address → **Publish**. The data belongs to the account that created it: to move it to another account, export JSON with the old account and import it with the new one.

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
| **Settings**            | Account and sign out, backup, time zones, owner / assignee lists, statuses, theme, animations                                                                                           |

**Keyboard:** `Ctrl+K` command palette · `/` search · `N` new upgrade · `G` then `D`/`C`/`T`/`W` go to a view · `Ctrl+S` save · `Ctrl+Z` / `Ctrl+Shift+Z` undo / redo.

**Calendar (.ics):** on a plan, **⋯ → Export to calendar**. On the Timeline or My week, **Export upcoming**. Choose _Windows only_, _Windows + milestones_ or _Everything_, then double-click the file (or in Outlook: **File → Open & Export → Import/Export → Import an iCalendar (.ics)** → **Import**). Exporting again later updates the same events instead of creating duplicates.

**Customer logos:** Customers → pick a customer → **Logo**: upload, drag an image in, or click the box and press `Ctrl+V`. PNG, JPG or WebP; the image is shrunk to 128 px and stored only in your database.

---

## 7. Troubleshooting

| Problem                                                        | Fix                                                                                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.ps1 cannot be loaded because running scripts is disabled` | Run once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, answer `Y`, open a new terminal. (Or type `npm.cmd` instead of `npm`.) |
| `Could not read package.json`                                  | The terminal is in the wrong folder: `cd "C:\Users\Tony Baldé\OneDrive - Incognit Clouds, Lda\P4M\upgrade-tracker"`                                      |
| _Firebase is not set up yet_                                   | Fill in `src/firebase.config.ts` (section 3.5) and push                                                                                                  |
| _This web address is not allowed to sign in yet_               | Add the domain in Firebase: **Authentication → Settings → Authorized domains** (section 3.2)                                                             |
| _Your browser blocked the Google sign-in window_               | Allow pop-ups for the site (icon at the right of the address bar), then click Sign in again                                                              |
| _Google sign-in is not enabled_                                | **Authentication → Sign-in method → Google → Enable**                                                                                                    |
| **No access** after signing in                                 | Wrong Google account, or the email in the database rules is different (section 3.4). Sign out and use the right account                                  |
| _Still waiting for the database_                               | No internet connection on a device that has never loaded the data. It loads by itself once online                                                        |
| Sync indicator **Offline**                                     | Nothing to do: edits are kept and sent when you are back online                                                                                          |
| The site shows an old version                                  | Refresh with `Ctrl+F5`, and check the last run in the **Actions** tab is green                                                                           |
| OneDrive is slow or a build fails with "file locked"           | Pause OneDrive sync while running `npm install` or `npm run build` (the `node_modules` folder holds many small files)                                    |

---

## 8. For developers

| Command           | What it does                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`     | Development server with hot reload                                                                                                                                |
| `npm run build`   | Type-check and build the site into `dist/` (adds the Content-Security-Policy)                                                                                     |
| `npm run preview` | Serve the built site at <http://localhost:4173/upgrade-tracker/>                                                                                                  |
| `npm run test`    | Unit tests (Vitest): dates and time zones, ISO weeks, template scheduling, N/A without UAT, ICS, migrations, Firestore sync and merging, sign-in screens, screens |
| `npm run lint`    | ESLint                                                                                                                                                            |
| `npm run format`  | Prettier                                                                                                                                                          |

**Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Motion, React Flow, Radix UI, dnd-kit, Zustand (+ Immer, zundo for undo/redo), Firebase (Auth + Firestore), date-fns / date-fns-tz, zod, cmdk, sonner, TanStack Virtual, lucide-react, self-hosted fonts.

**Structure**

```
src/
  app/            shell, sign-in gate, routing, command palette, shortcuts
  features/       dashboard, canvas, timeline, plan, week, customers, template, settings, ics
  lib/            dates, ics, template (scheduling), upgrade (logic), timeline, agenda,
                  cloud (Firebase setup, document split/merge), storage, migrations,
                  model (types + zod schema), images
  store/          Zustand store, edit actions, auth (Google sign-in), cloud (Firestore sync engine)
  theme/          brand.ts (Plat4mation colours and fonts), tokens, motion
  components/ui/  shared UI (buttons, dialogs, status badges, red flow…)
  demo/           fictional demo data
  firebase.config.ts   the Firebase web app settings (public by design)
```

**Storage:** Firestore at `users/<uid>/parts/<id>`: one `core` record (settings, template, order), one `c_<id>` per customer and one `u_<id>` per upgrade, each holding the JSON of that piece. Edits are merged per record (see `src/lib/cloud/parts.ts`). Data that can't be read is never overwritten.

**Brand:** colours and fonts live in `src/theme/brand.ts` (signature red `#E1292C`, night `#0F0100`). To use the official font later, change `fonts` there and the `@fontsource` import in `src/main.tsx`.

**Data model:** `src/lib/model/types.ts` (schema version 1). To change it: bump `SCHEMA_VERSION`, add a migration in `src/lib/migrations/index.ts`, update the zod schema and add a test.

**Security:** Google sign-in plus Firestore rules that allow a single account; strict Content-Security-Policy (only this site, Google sign-in and Firestore); no raw HTML from user data; only `http(s)` links are clickable; logos are re-encoded as small raster images.
