// Starts the FastAPI backend and the Next.js frontend together.
//   npm run dev        -> this computer only (http://localhost:3000)
//   npm run dev:lan    -> also reachable from your phone/iPad on the same Wi-Fi
//   npm start          -> production build (faster; use for daily use)
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { API_DIR, IS_WIN, NPM, ROOT, VENV_PY, WEB_DIR, requireVenv } from "./_common.mjs";

requireVenv();
const lan = process.argv.includes("--lan");
const prod = process.argv.includes("--prod");
const host = lan ? "0.0.0.0" : "127.0.0.1";
const WEB_PORT = process.env.PORT ?? "3000";
const API_PORT = process.env.JARVIS_API_PORT ?? "8000";

function envHasToken() {
  const f = join(ROOT, ".env");
  if (!existsSync(f)) return false;
  return /^\s*JARVIS_ACCESS_TOKEN\s*=\s*\S+/m.test(readFileSync(f, "utf8"));
}

if (lan && !envHasToken()) {
  console.warn("\n  ⚠  LAN mode without JARVIS_ACCESS_TOKEN: anyone on your network could open JARVIS.");
  console.warn("     Set JARVIS_ACCESS_TOKEN in .env (see README) before using this on shared Wi-Fi.\n");
}

const children = [];
function start(name, cmd, args, cwd, env = {}) {
  const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], shell: IS_WIN && cmd.endsWith(".cmd") });
  const tag = name === "api" ? "\x1b[36m[api]\x1b[0m" : "\x1b[35m[web]\x1b[0m";
  const out = (d) => d.toString().split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`${tag} ${l}`));
  p.stdout.on("data", out);
  p.stderr.on("data", out);
  p.on("exit", (code) => {
    console.log(`${tag} exited (${code})`);
    shutdown(code ?? 0);
  });
  children.push(p);
}

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode === null) {
      if (IS_WIN) spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"]);
      else c.kill("SIGTERM");
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// The backend always binds to localhost; other devices reach it through the Next.js proxy.
start("api", VENV_PY, ["-m", "uvicorn", "jarvis_api.main:app", "--host", "127.0.0.1", "--port", API_PORT, ...(prod ? [] : ["--reload"])], API_DIR);

const webEnv = { JARVIS_API_URL: `http://127.0.0.1:${API_PORT}` };
if (prod) {
  const b = spawnSync(NPM, ["run", "build"], { cwd: WEB_DIR, stdio: "inherit", env: { ...process.env, ...webEnv }, shell: IS_WIN });
  if (b.status !== 0) shutdown(1);
  start("web", NPM, ["run", "start", "--", "-H", host, "-p", WEB_PORT], WEB_DIR, webEnv);
} else {
  start("web", NPM, ["run", "dev", "--", "-H", host, "-p", WEB_PORT], WEB_DIR, webEnv);
}

setTimeout(() => {
  console.log(`\n  JARVIS → http://localhost:${WEB_PORT}`);
  if (lan) {
    for (const addrs of Object.values(networkInterfaces()))
      for (const a of addrs ?? []) if (a.family === "IPv4" && !a.internal) console.log(`  On your phone/iPad → http://${a.address}:${WEB_PORT}`);
  }
  console.log("");
}, 2500);
