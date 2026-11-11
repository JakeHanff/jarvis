// Runs every automated check: backend tests, frontend lint + typecheck.
import { spawnSync } from "node:child_process";
import { API_DIR, IS_WIN, NPM, VENV_PY, WEB_DIR, requireVenv } from "./_common.mjs";

requireVenv();
const steps = [
  ["backend tests", VENV_PY, ["-m", "pytest", "-q"], API_DIR],
  ["frontend lint", NPM, ["run", "lint"], WEB_DIR],
  ["frontend typecheck", IS_WIN ? "npx.cmd" : "npx", ["tsc", "--noEmit"], WEB_DIR],
];
for (const [name, cmd, args, cwd] of steps) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: IS_WIN && cmd.endsWith(".cmd") });
  if (r.status !== 0) {
    console.error(`\n✗ ${name} failed`);
    process.exit(1);
  }
}
console.log("\n✓ all checks passed\n");
