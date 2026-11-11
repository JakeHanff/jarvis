// One-time setup: Python venv + backend deps, frontend deps, .env from template.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { API_DIR, IS_WIN, NPM, ROOT, VENV_PY, WEB_DIR, systemPython } from "./_common.mjs";

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: IS_WIN && cmd.endsWith(".cmd") });
  if (r.status !== 0) {
    console.error(`\nFailed: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

if (!existsSync(VENV_PY)) {
  const [py, pre] = systemPython();
  run(py, [...pre, "-m", "venv", ".venv"], API_DIR);
}
run(VENV_PY, ["-m", "pip", "install", "--upgrade", "pip"], API_DIR);
run(VENV_PY, ["-m", "pip", "install", "-r", "requirements-dev.txt"], API_DIR);
run(NPM, ["install"], WEB_DIR);

const env = join(ROOT, ".env");
if (!existsSync(env)) {
  copyFileSync(join(ROOT, ".env.example"), env);
  console.log("\nCreated .env from .env.example — add your ANTHROPIC_API_KEY there to enable chat.");
}
console.log("\nSetup complete. Start JARVIS with:  npm run dev\n");
