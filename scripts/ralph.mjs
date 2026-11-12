// Bounded Ralph loop. Each iteration runs a fresh `claude -p` with ralph/PROMPT.md,
// then the loop (not the model) runs the verify command and decides what happens next.
// Usage: node scripts/ralph.mjs [--max 3] [--dry-run]
// Exit codes: 0 success, 3 needs_human, 4 limit_reached, 5 check_error.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { loadConfig } from "../.claude/hooks/lib.mjs";

const root = process.cwd();
const cfg = loadConfig(root);
const r = { prompt: "ralph/PROMPT.md", progress: "ralph/progress.md", maxIterations: 3, iterationTimeoutSec: 600, allowedTools: [], ...(cfg.ralph || {}) };
const argv = process.argv.slice(2);
const max = Number(argv[argv.indexOf("--max") + 1]) || r.maxIterations;
const dryRun = argv.includes("--dry-run");
const win = process.platform === "win32";
const failFile = path.join(root, ".harness", "ralph-last-failure.txt");
const progressFile = path.join(root, r.progress);
fs.mkdirSync(path.dirname(failFile), { recursive: true });
fs.mkdirSync(path.dirname(progressFile), { recursive: true });
if (!fs.existsSync(progressFile)) fs.writeFileSync(progressFile, "# 진행 기록\n");

const log = (rec) => fs.appendFileSync(path.join(root, ".harness", "ralph-runs.jsonl"), JSON.stringify({ ts: new Date().toISOString(), ...rec }) + "\n");
const progress = (lines) => fs.appendFileSync(progressFile, "\n" + lines.join("\n") + "\n");
const tailOf = (s, n = 40) => s.trim().split("\n").slice(-n).join("\n");
const finish = (state, code, i, note) => {
  log({ iteration: i, state, note });
  progress(["## 종료: " + state, "- 반복 " + i + "회, " + note]);
  console.log("[ralph] " + state + " (" + i + "/" + max + ") " + note);
  process.exit(code);
};

let prevHash = null;
for (let i = 1; i <= max; i++) {
  let prompt = fs.readFileSync(path.join(root, r.prompt), "utf8");
  if (fs.existsSync(failFile)) prompt += "\n\n## 지난 반복의 검증 실패\n\n```\n" + fs.readFileSync(failFile, "utf8") + "\n```\n";

  let agentNote = "dry-run: 에이전트 호출 생략";
  if (!dryRun) {
    const args = ["-p", "--output-format", "json", "--permission-mode", "acceptEdits"];
    if (r.allowedTools.length) args.push("--allowedTools", ...r.allowedTools);
    // The prompt goes through stdin, so newlines and quotes survive on every shell.
    const res = spawnSync("claude", win ? args.map((a) => JSON.stringify(a)) : args, {
      cwd: root, input: prompt, encoding: "utf8", shell: win, maxBuffer: 64 * 1024 * 1024,
      timeout: r.iterationTimeoutSec * 1000, env: { ...process.env, HARNESS_SKIP_STOP_VERIFY: "1" },
    });
    let out = {};
    try { out = JSON.parse(res.stdout); } catch {}
    if (res.error || res.status !== 0 || out.is_error) {
      const why = res.error ? res.error.message : out.result || tailOf(res.stderr || res.stdout || "", 5);
      finish("check_error", 5, i, "에이전트 실행 실패: " + String(why).slice(0, 300));
    }
    agentNote = "턴 " + (out.num_turns ?? "?") + ", 추정 비용 $" + (out.total_cost_usd ?? "?");
  }

  const v = spawnSync(cfg.verify, { cwd: root, shell: true, encoding: "utf8", timeout: cfg.verifyTimeoutSec * 1000 });
  const tail = tailOf((v.stdout || "") + (v.stderr || ""));
  const diff = spawnSync("git", ["diff", "--stat"], { cwd: root, encoding: "utf8" }).stdout?.trim() || "(git diff 없음)";
  const passed = v.status === 0;
  progress(["## 반복 " + i + " · " + new Date().toLocaleString("ko-KR"), "- 에이전트: " + agentNote, "- 검증: " + cfg.verify + " → " + (passed ? "통과" : "실패"), "- 변경: " + diff.split("\n").pop()]);
  log({ iteration: i, verify: passed ? "pass" : "fail", agent: agentNote });

  if (passed) { fs.rmSync(failFile, { force: true }); finish("success", 0, i, "검증 통과"); }
  // Same failure output twice in a row means the loop is not making progress.
  const hash = crypto.createHash("sha1").update(tail.replace(/\d+(\.\d+)?ms/g, "")).digest("hex");
  if (hash === prevHash) finish("needs_human", 3, i, "같은 실패가 두 번 연속 나왔습니다. 사람이 원인을 확인합니다.");
  prevHash = hash;
  fs.writeFileSync(failFile, tail);
}
finish("limit_reached", 4, max, "반복 상한에 도달했습니다. 마지막 실패는 .harness/ralph-last-failure.txt에 있습니다.");
