// Stop hook. Runs the verify command when Claude tries to finish.
// A failing check blocks the stop with exit 2 and sends the output tail back to Claude.
// A per-session retry cap and stop_hook_active prevent an endless loop.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { appendLog, loadConfig, projectRoot, readStdinJson } from "./lib.mjs";

const input = readStdinJson();
const root = projectRoot(input);
const cfg = loadConfig(root);
// The Ralph loop runs its own verification after each iteration.
if (process.env.HARNESS_SKIP_STOP_VERIFY === "1") process.exit(0);

if (cfg.onlyWhenChanged) {
  const git = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  if (git.status === 0 && !git.stdout.trim()) process.exit(0);
}

const stateFile = path.join(root, ".harness", "stop-state.json");
let state = {};
try { state = JSON.parse(fs.readFileSync(stateFile, "utf8")); } catch {}
if (state.session !== input.session_id) state = { session: input.session_id, retries: 0 };

const run = spawnSync(cfg.verify, { cwd: root, shell: true, encoding: "utf8", timeout: cfg.verifyTimeoutSec * 1000 });
const out = ((run.stdout || "") + (run.stderr || "")).trim();
const tail = out.split("\n").slice(-40).join("\n");
const passed = run.status === 0;
const save = () => { fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(state)); };

if (passed) {
  state.retries = 0; save();
  appendLog(root, "verify-log.jsonl", { hook: "verify-on-stop", status: "pass", cmd: cfg.verify });
  process.exit(0);
}
if (input.stop_hook_active && state.retries >= cfg.maxStopRetries) {
  appendLog(root, "verify-log.jsonl", { hook: "verify-on-stop", status: "limit_reached", cmd: cfg.verify, retries: state.retries });
  process.exit(0);
}
state.retries += 1; save();
appendLog(root, "verify-log.jsonl", { hook: "verify-on-stop", status: run.error ? "check_error" : "fail", cmd: cfg.verify, retries: state.retries });
process.stderr.write(
  "[verify-on-stop] 검증 실패 (" + state.retries + "/" + cfg.maxStopRetries + "). 명령: " + cfg.verify + "\n" +
  (run.error ? "실행 오류: " + run.error.message + "\n" : "") +
  "--- 출력 끝부분 ---\n" + tail + "\n---\n" +
  "실패 원인을 고친 뒤 끝내세요. 테스트와 평가 기준은 바꾸지 마세요. 고칠 수 없으면 이유를 보고하세요.\n"
);
process.exit(2);
