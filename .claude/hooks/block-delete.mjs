// PreToolUse hook. 파일 삭제 명령이 보이면 무조건 멈춘다. (exit 2 = 차단)
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const cmd = String(input.tool_input?.command || "");

// 삭제 명령(rm, unlink, rmdir, trash, git rm/clean, find -delete)을 찾는다.
const deleting = /(^|[\s;|&(])(rm|unlink|rmdir|trash)\s|\bgit\s+(rm|clean)\b|\bfind\b.*\s-delete\b/;

if (deleting.test(cmd)) {
  process.stderr.write("[block-delete] 파일 삭제는 허용되지 않습니다. 사용자에게 먼저 확인받으세요: " + cmd.slice(0, 120) + "\n");
  process.exit(2);
}
