# MindSpace (v2)

A student well-being web app for self-reflection and learning. Educational only, not a diagnostic or medical tool.

## Files
- `index.html` – page structure (Home, Track, Learn, Breathe, Habits)
- `style.css` – all styling (colours and sizes are at the top, in `:root`)
- `script.js` – app logic

## Where data is stored
Check-ins, notes and habits are saved in the browser's localStorage on the device being used.
- No server, no accounts, no analytics.
- Not synced between devices, not encrypted, visible to anyone using the same browser profile.
- Clearing browser data deletes it. Use **Export** on the Track page to keep a JSON copy.
- Records that cannot be read are set aside under `mindspace.entries.v1.unreadable`, not deleted.

## Run locally
Open `index.html` in a browser. Keep all three files in the same folder.

## Deploy (Vercel)
Upload the files to a GitHub repo and import it on vercel.com. If the files are inside a folder in the repo,
set Settings > Build and Deployment > Root Directory to that folder, then redeploy.

## Common edits
- Colours: edit the `:root { ... }` block at the top of `style.css`.
- Habit list: edit `HABITS` near the top of `script.js` (keep 5, or update "of 5" text in `index.html`).
- Quiz questions: edit `QUIZ` in `script.js`.
- Sidebar width: `--sidebar-w` in `style.css`.
