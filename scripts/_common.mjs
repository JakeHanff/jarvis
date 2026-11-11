import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const API_DIR = join(ROOT, "services", "api");
export const WEB_DIR = join(ROOT, "apps", "web");
export const IS_WIN = process.platform === "win32";
export const VENV_PY = IS_WIN ? join(API_DIR, ".venv", "Scripts", "python.exe") : join(API_DIR, ".venv", "bin", "python");
export const NPM = IS_WIN ? "npm.cmd" : "npm";

export function systemPython() {
  // Windows: the "py" launcher is the most reliable; fall back to python.
  return IS_WIN ? ["py", ["-3"]] : ["python3", []];
}

export function requireVenv() {
  if (!existsSync(VENV_PY)) {
    console.error("\n  Python environment not found. Run:  npm run setup\n");
    process.exit(1);
  }
}
