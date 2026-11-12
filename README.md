# JARVIS

A personal AI assistant and customisable dashboard: tasks, goals, calendar, a structured memory you control, and a chat assistant that uses all of it as context.

**Status: v0.1, first working version.** See [PROGRESS.md](PROGRESS.md) for exactly what works today and [ROADMAP.md](ROADMAP.md) for what comes next.

---

## Run it on your Windows laptop (Lenovo Yoga)

### 1. Install the prerequisites (once)

| Tool | Get it | Check |
|---|---|---|
| **Node.js 20 or newer** (LTS) | https://nodejs.org | `node -v` |
| **Python 3.11 or newer** | https://www.python.org/downloads/ (tick **"Add python.exe to PATH"** in the installer) | `py -3 --version` |
| **Git** | https://git-scm.com/download/win | `git --version` |

### 2. Get the code and set it up (once)

Open **PowerShell** in the folder where you want the project and run:

```bash
git clone <your-repo-url> jarvis
```

```bash
cd jarvis
```

```bash
npm run setup
```

`setup` creates a Python virtual environment, installs the backend and frontend dependencies and creates a `.env` file from `.env.example`.

### 3. Connect the AI model (for chat)

1. Create an API key at https://console.anthropic.com/ (Settings → API keys). Usage is billed by Anthropic.
2. Open `.env` in the project root and set:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Save the file. (Restart JARVIS if it was running.)

Without a key, everything except chat and conversation distillation works, and the dashboard says clearly that the model is not connected. It never fakes a reply.

### 4. Start JARVIS

```bash
npm run dev
```

Open **http://localhost:3000**. Stop it with `Ctrl+C`. Your data lives in `data/jarvis.db` and survives restarts.

For everyday use, the production build is faster:

```bash
npm start
```

### 5. Open it on your iPhone / iPad (same Wi-Fi)

1. Generate an access token:
   ```bash
   py -3 -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
2. Put it in `.env` as `JARVIS_ACCESS_TOKEN=...` (anyone on your Wi-Fi could otherwise open JARVIS).
3. Start in LAN mode:
   ```bash
   npm run dev:lan
   ```
   The terminal prints an address like `http://192.168.1.23:3000`. Windows may ask to allow Node.js through the firewall — allow it on **private** networks only.
4. On the phone, open that address in Safari → **Settings** page → paste the access token → Save. Do the same once on the laptop.
5. Safari → Share → **Add to Home Screen** to get an app icon.

The phone sees the same tasks, memories and settings because it talks to the same backend. **This only works while the laptop is on and JARVIS is running.** To make it work when the laptop is off, move storage to Supabase and host the backend — see *Cloud sync* below.

### Check that everything works

```bash
npm test
```

Runs the backend test suite plus frontend lint and type-checking.

---

## Cloud sync (optional, next step)

v0.1 can already use a cloud Postgres database instead of the local file:

1. Create a free project at https://supabase.com.
2. Project → **Connect** → copy the **Session pooler** connection string.
3. In `.env` set (note the `+psycopg` part):
   ```
   DATABASE_URL=postgresql+psycopg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
4. Install the Postgres driver (once): `services\\api\\.venv\\Scripts\\python -m pip install -r services/api/requirements-postgres.txt`
5. Restart JARVIS. Tables are created automatically, with row-level security switched on so Supabase's public API can't read them.

This moves your *data* to the cloud. For your phone to reach JARVIS when the laptop is off, the backend and frontend also need to be hosted — that's the next milestone (see ROADMAP.md). Existing local data is not migrated automatically yet; use **Settings → Export** first if you want to keep it.

---

## Using it

- **Dashboard**: drag widgets to reorder in **Edit layout**, click the width button to resize, hide/show widgets. Phones keep a separate layout.
- **Customise**: theme, accent colour, wallpaper (presets, upload, or an https image URL), panel opacity, blur, density, saved presets.
- **Tasks**: add, complete, double-click to rename, delete. Goals have a progress slider.
- **JARVIS chat**: pick a mode (casual, academic, strategic, executive, research) or leave it on auto. JARVIS can *propose* memories and tasks; nothing is saved until you click ✓.
- **Memory** page: see everything JARVIS believes, by layer. Confirm, correct, mark temporary, archive, update (keeps history) or delete. Export everything as JSON.
- **Settings**: import your memory profile (JSON or plain lines) and ChatGPT history, see devices, the action log and approvals, and erase all data.

## Project layout

```
apps/web/            Next.js + React + TypeScript + Tailwind dashboard (PWA)
services/api/        Python FastAPI backend: data, memory, AI, skills
supabase/migrations/ PostgreSQL schema for cloud storage
scripts/             cross-platform setup / dev / check scripts
data/                local database and uploads (git-ignored)
```

Docs: [ARCHITECTURE](ARCHITECTURE.md) · [MEMORY_SCHEMA](MEMORY_SCHEMA.md) · [SECURITY](SECURITY.md) · [DECISIONS](DECISIONS.md) · [ROADMAP](ROADMAP.md) · [PROGRESS](PROGRESS.md)

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Python environment not found` | Run `npm run setup`. |
| `py` not recognised | Reinstall Python with "Add to PATH" ticked, or install from the Microsoft Store. |
| Red dot in the top bar | Backend isn't running or (if a token is set) this device has no/wrong token — set it in Settings. |
| Amber dot | Backend fine; AI key missing. |
| Port 3000 or 8000 in use | `set PORT=3001` / `set JARVIS_API_PORT=8001` before `npm run dev` (PowerShell: `$env:PORT=3001`). |
| Phone can't connect | Same Wi-Fi? Used `dev:lan`? Windows firewall allowed Node on private networks? |
