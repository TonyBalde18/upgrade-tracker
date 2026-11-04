# Upgrade Tracker

A personal web app to plan and track ServiceNow family-release upgrades (for example Zurich to Australia) across customers.

> The full step-by-step guide (GitHub Pages, private data repo, token, backups) is written in phase 7.

## Run it on Windows

You need Node.js 20 or newer (`node -v` in a terminal shows your version).

Open a terminal in this folder (in VS Code: **Terminal → New Terminal**) and run:

```powershell
npm install
npm run dev
```

Then open the address it prints, usually <http://localhost:5173/>.

Other commands:

| Command         | What it does                                            |
| --------------- | ------------------------------------------------------- |
| `npm run test`  | Runs the unit tests                                     |
| `npm run lint`  | Checks the code for mistakes                            |
| `npm run build` | Builds the site for GitHub Pages into the `dist` folder |

## Privacy

This repository is public. It contains **no customer data, no tokens and no secrets**. Real data only lives in your browser and, later, in the private `upgrade-tracker-data` repository. The demo data uses fictional companies only.
