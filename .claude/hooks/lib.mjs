// Shared helpers for the harness hooks and scripts: config loading, stdin parsing, and JSONL logs.
import fs from "node:fs";
import path from "node:path";

const DEFAULTS = {
  protect: ["tests/", "evals/", ".env"],
  verify: "npm test",
  verifyTimeoutSec: 300,
  onlyWhenChanged: true,
  maxStopRetries: 2,
};

export function projectRoot(input = {}) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

export function loadConfig(root) {
  const file = path.join(root, "harness.config.json");
  if (!fs.existsSync(file)) return { ...DEFAULTS };
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, "utf8")) };
}

export function readStdinJson() {
  const raw = fs.readFileSync(0, "utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

export function appendLog(root, name, record) {
  const dir = path.join(root, ".harness");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, name), JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n");
}

// Returns the protect entry that covers a project-relative path, or undefined.
export function protectedHit(rel, protect) {
  const p = rel.split(path.sep).join("/").replace(/^\.\//, "");
  return protect.find((g) => {
    const base = g.replace(/\/$/, "");
    return p === base || p.startsWith(base + "/");
  });
}
