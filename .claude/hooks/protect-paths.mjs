// PreToolUse hook. Blocks edits to protected paths (tests, evals, secrets).
// Exit 2 blocks the tool call, and Claude reads the stderr text as the reason.
import path from "node:path";
import { appendLog, loadConfig, projectRoot, protectedHit, readStdinJson } from "./lib.mjs";

const input = readStdinJson();
const root = projectRoot(input);
const { protect } = loadConfig(root);
const tool = input.tool_name;
const ti = input.tool_input || {};
const toRel = (p) => path.relative(root, path.resolve(input.cwd || root, p));

let reason = null;
if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const target = ti.file_path || ti.notebook_path;
  const hit = target && protectedHit(toRel(target), protect);
  if (hit) reason = toRel(target) + " 파일은 보호 경로(" + hit + ")에 있습니다.";
} else if (tool === "Bash") {
  // String checks catch common write commands only. A script that writes files can still get through.
  const cmd = String(ti.command || "").replace(/\d?>&\d/g, "");
  const tokens = cmd.split(/[\s;|&()"']+/).filter(Boolean);
  const hit = tokens.map((t) => protectedHit(toRel(t), protect)).find(Boolean);
  const writes = /\b(rm|mv|cp|tee|truncate|unlink|chmod)\b|\bsed\s+-i|\bgit\s+(checkout|restore|rm|mv)\b|>/;
  if (hit && writes.test(cmd)) reason = "Bash 명령이 보호 경로(" + hit + ")를 바꿀 수 있습니다: " + cmd.slice(0, 120);
}

if (reason) {
  appendLog(root, "hook-log.jsonl", { hook: "protect-paths", decision: "block", tool, reason });
  process.stderr.write(
    "[protect-paths] 차단: " + reason + "\n" +
    "테스트와 평가 기준은 사람이 검토한 뒤 바꿉니다. 구현 코드를 고쳐 기존 테스트를 통과시키세요.\n" +
    "기준이 틀렸다고 판단하면 파일을 바꾸지 말고, 근거와 함께 사람에게 보고하세요.\n"
  );
  process.exit(2);
}
process.exit(0);
